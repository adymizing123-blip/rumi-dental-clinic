import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { site } from "@/config/site";

/**
 * Free appointment slots, computed from the clinic's opening hours and existing appointments.
 * Times are handled as clinic wall-clock time using site.timezoneOffset (Pakistan has no DST).
 */
export type Slot = {
  value: string; // "2026-11-13 16:00": what the AI must echo back to book
  label: string; // "Fri 13 Nov, 4:00 PM": what the patient sees
  startsAt: string; // "2026-11-13T16:00:00+05:00": stored in appointments.starts_at
};

export type ClinicHours = {
  opening_time: string; // "10:00:00"
  closing_time: string; // "21:00:00"
  slot_minutes: number;
  closed_weekdays: number[]; // 0 = Sunday
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MIN = 60_000;
const OFFSET_MIN = parseOffset(site.timezoneOffset);
const LEAD_TIME_MIN = 60; // never offer a slot that starts within the next hour

function parseOffset(offset: string) {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -minutes : minutes;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date whose UTC fields read as the clinic's local wall-clock time. */
function wallNow() {
  return new Date(Date.now() + OFFSET_MIN * MIN);
}

function clock12(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

export function describeHours(hours: ClinicHours) {
  const open = `${clock12(toMinutes(hours.opening_time))} to ${clock12(toMinutes(hours.closing_time))}`;
  const closed = hours.closed_weekdays.map((d) => FULL_DAY_NAMES[d]).filter(Boolean);
  return closed.length ? `Open ${open}. Closed on ${closed.join(", ")}.` : `Open every day, ${open}.`;
}

/** "Thursday 12 Nov 2026, 4:05 PM" in clinic time: lets the AI understand "kal" (tomorrow) correctly. */
export function describeNow() {
  const d = wallNow();
  return `${FULL_DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${clock12(d.getUTCHours() * 60 + d.getUTCMinutes())}`;
}

type Busy = { start: number; end: number };

async function busyTimes(db: SupabaseClient, clinicId: string, fromIso: string, toIso: string): Promise<Busy[]> {
  const { data, error } = await db
    .from("appointments")
    .select("starts_at, duration_min")
    .eq("clinic_id", clinicId)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .not("status", "in", "(cancelled,no_show)");
  if (error) throw error;
  return (data ?? []).map((a) => {
    const start = new Date(a.starts_at as string).getTime();
    return { start, end: start + Number(a.duration_min ?? 30) * MIN };
  });
}

function overlaps(busy: Busy[], start: number, end: number) {
  return busy.filter((b) => b.start < end && b.end > start).length;
}

/**
 * Returns up to `perDay` evenly spread free slots for the next `days` open days.
 * `capacity` = how many patients can be seen at the same time (usually the number of active doctors).
 */
export async function findFreeSlots(
  db: SupabaseClient,
  clinicId: string,
  hours: ClinicHours,
  { days = 3, perDay = 6, capacity = 1 }: { days?: number; perDay?: number; capacity?: number } = {},
): Promise<Slot[]> {
  const step = Math.max(10, hours.slot_minutes || 30);
  const open = toMinutes(hours.opening_time);
  const close = toMinutes(hours.closing_time);
  const now = wallNow();
  const earliestWall = now.getTime() + LEAD_TIME_MIN * MIN;

  // Real (UTC) range to load appointments for: today .. +14 days.
  const startReal = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - OFFSET_MIN * MIN;
  const busy = await busyTimes(db, clinicId, new Date(startReal).toISOString(), new Date(startReal + 15 * 24 * 60 * MIN).toISOString());

  const result: Slot[] = [];
  let openDays = 0;
  for (let offset = 0; offset < 14 && openDays < days; offset++) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
    if (hours.closed_weekdays.includes(day.getUTCDay())) continue;

    const free: Slot[] = [];
    for (let m = open; m + step <= close; m += step) {
      const wall = day.getTime() + m * MIN;
      if (wall < earliestWall) continue;
      const real = wall - OFFSET_MIN * MIN;
      if (overlaps(busy, real, real + step * MIN) >= capacity) continue;
      const date = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
      const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      free.push({
        value: `${date} ${time}`,
        label: `${DAY_NAMES[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}, ${clock12(m)}`,
        startsAt: `${date}T${time}:00${site.timezoneOffset}`,
      });
    }
    if (free.length === 0) continue;
    openDays++;
    if (free.length <= perDay) {
      result.push(...free);
    } else {
      // Spread the offered times across the day (morning, afternoon, evening).
      const picked = new Set<number>();
      for (let i = 0; i < perDay; i++) picked.add(Math.round((i * (free.length - 1)) / (perDay - 1)));
      result.push(...[...picked].map((i) => free[i]!));
    }
  }
  return result;
}

/** Re-checks a slot right before booking, in case someone else took it in the meantime. */
export async function slotStillFree(db: SupabaseClient, clinicId: string, startsAt: string, durationMin: number, capacity: number) {
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * MIN;
  const busy = await busyTimes(db, clinicId, new Date(start - 8 * 60 * MIN).toISOString(), new Date(end).toISOString());
  return overlaps(busy, start, end) < capacity;
}

/** First active doctor with nothing booked during this visit (so AI bookings land in a doctor's column). */
export async function pickFreeDoctor(db: SupabaseClient, clinicId: string, startsAt: string, durationMin: number) {
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * MIN;
  const [{ data: doctors }, { data: appts }] = await Promise.all([
    db.from("doctors").select("id").eq("clinic_id", clinicId).eq("active", true).order("created_at"),
    db
      .from("appointments")
      .select("doctor_id, starts_at, duration_min")
      .eq("clinic_id", clinicId)
      .gte("starts_at", new Date(start - 8 * 60 * MIN).toISOString())
      .lt("starts_at", new Date(end).toISOString())
      .not("status", "in", "(cancelled,no_show)"),
  ]);
  const busy = new Set(
    (appts ?? [])
      .filter((a) => {
        const s = new Date(a.starts_at as string).getTime();
        return s < end && s + Number(a.duration_min ?? 30) * MIN > start;
      })
      .map((a) => a.doctor_id as string | null),
  );
  return ((doctors ?? []) as { id: string }[]).find((d) => !busy.has(d.id))?.id ?? null;
}
