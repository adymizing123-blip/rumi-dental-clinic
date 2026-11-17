import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, getClinicId } from "@/lib/supabase/admin";
import { site } from "@/config/site";
import { ChannelError, findConnection, sendText, sendWhatsAppTemplate } from "@/lib/channels";
import { resolveContact } from "@/lib/inbox-store";
import { fmtDate, fmtTime } from "@/lib/utils";
import { AUTOMATION_BY_KEY, renderMessage, type AutomationKey, type VarKey } from "./definitions";

/**
 * Sends the automation messages that are due. Called every 5 minutes by /api/cron/automations
 * (and by "Run now" on the Automations page). Safe to run twice at once: rows are claimed first.
 */
const BATCH = 40;
const MAX_ATTEMPTS = 3;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const DOCTOR_SCHEDULE_HOUR = Number(process.env.DOCTOR_SCHEDULE_HOUR ?? 8);

const OFFSET_MIN = (() => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(site.timezoneOffset);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
})();
const localNow = () => new Date(Date.now() + OFFSET_MIN * 60_000);
const localToday = () => localNow().toISOString().slice(0, 10);

type Rel<T> = T | T[] | null;
const one = <T,>(v: Rel<T>) => (Array.isArray(v) ? (v[0] ?? null) : v);

type AutomationRow = { key: AutomationKey; enabled: boolean; body: string; template_name: string | null; template_lang: string };
type QueueRow = {
  id: string;
  clinic_id: string;
  automation_key: AutomationKey;
  recipient: "patient" | "doctor";
  appointment_id: string | null;
  patient_id: string | null;
  doctor_id: string | null;
  attempts: number;
  dedupe_key: string;
};
type Clinic = { id: string; name: string; address: string | null; google_review_url: string | null };

export type RunResult = { queued: number; sent: number; skipped: number; failed: number; retrying: number };

export async function runAutomations(): Promise<RunResult> {
  const db = createAdminClient();
  const clinicId = await getClinicId();
  const result: RunResult = { queued: 0, sent: 0, skipped: 0, failed: 0, retrying: 0 };

  const [{ data: clinic }, { data: autoRows }] = await Promise.all([
    db.from("clinics").select("id, name, address, google_review_url").eq("id", clinicId).single(),
    db.from("automations").select("key, enabled, body, template_name, template_lang").eq("clinic_id", clinicId),
  ]);
  const autos = new Map(((autoRows ?? []) as AutomationRow[]).map((a) => [a.key, a]));

  // 1. Time-based automations that no single event triggers.
  result.queued += await queueDoctorSchedules(db, clinicId, autos);
  result.queued += await queueLeadFollowUps(db, clinicId, autos);
  result.queued += await queueWinBacks(db, clinicId, autos);

  // 2. Rows stuck in "sending" (worker crashed) go back to the queue.
  await db
    .from("automation_queue")
    .update({ status: "pending" })
    .eq("status", "sending")
    .lt("send_at", new Date(Date.now() - 15 * 60_000).toISOString());

  // 3. Claim what is due.
  const { data: due } = await db
    .from("automation_queue")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at")
    .limit(BATCH);
  const ids = (due ?? []).map((r) => r.id as string);
  if (ids.length) {
    const { data: claimed } = await db
      .from("automation_queue")
      .update({ status: "sending" })
      .in("id", ids)
      .eq("status", "pending")
      .select("id, clinic_id, automation_key, recipient, appointment_id, patient_id, doctor_id, attempts, dedupe_key");

    const connected = Boolean(await findConnection(db, "whatsapp"));
    for (const row of (claimed ?? []) as QueueRow[]) {
      const outcome = connected
        ? await processRow(db, clinic as Clinic, autos, row)
        : { status: "skipped" as const, error: "WhatsApp is not connected (Settings → Channels)." };
      result[outcome.status === "pending" ? "retrying" : outcome.status === "cancelled" ? "skipped" : outcome.status]++;
    }
  }

  await db.from("clinics").update({ automations_last_run_at: new Date().toISOString() }).eq("id", clinicId);
  return result;
}

type Outcome = { status: "sent" | "skipped" | "failed" | "cancelled" | "pending"; error?: string };

async function processRow(db: SupabaseClient, clinic: Clinic, autos: Map<AutomationKey, AutomationRow>, row: QueueRow): Promise<Outcome> {
  const finish = async (o: Outcome, extra: Record<string, unknown> = {}) => {
    const attempts = row.attempts + 1;
    const retry = o.status === "failed" && attempts < MAX_ATTEMPTS;
    await db
      .from("automation_queue")
      .update({
        status: retry ? "pending" : o.status,
        attempts,
        error: o.error ?? null,
        ...(retry ? { send_at: new Date(Date.now() + attempts * 10 * 60_000).toISOString() } : {}),
        ...extra,
      })
      .eq("id", row.id);
    return retry ? { ...o, status: "pending" as const } : o;
  };

  const def = AUTOMATION_BY_KEY[row.automation_key];
  const auto = autos.get(row.automation_key);
  if (!def || !auto?.enabled) return finish({ status: "skipped", error: "Automation is switched off." });

  // Load what the message talks about.
  const [apptRes, patientRes, doctorRes] = await Promise.all([
    row.appointment_id
      ? db
          .from("appointments")
          .select("starts_at, status, service:services(name), doctor:doctors(name)")
          .eq("id", row.appointment_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.patient_id ? db.from("patients").select("name, phone, interest").eq("id", row.patient_id).maybeSingle() : Promise.resolve({ data: null }),
    row.doctor_id ? db.from("doctors").select("name, phone").eq("id", row.doctor_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const appt = apptRes.data as { starts_at: string; status: string; service: Rel<{ name: string }>; doctor: Rel<{ name: string }> } | null;
  const patient = patientRes.data as { name: string; phone: string | null; interest: string | null } | null;
  const doctor = doctorRes.data as { name: string; phone: string | null } | null;

  // Things change between queueing and sending: never send an outdated message.
  if (row.appointment_id && !appt) return finish({ status: "cancelled", error: "Appointment was deleted." });
  if (appt) {
    const upcoming = ["booked", "confirmed"].includes(appt.status) && Date.parse(appt.starts_at) > Date.now();
    if (["reminder", "confirmation", "doctor_new"].includes(row.automation_key) && !upcoming)
      return finish({ status: "cancelled", error: "Appointment is no longer upcoming." });
    if (row.automation_key === "no_show" && appt.status !== "no_show") return finish({ status: "cancelled", error: "No longer a no-show." });
    if (["review", "aftercare"].includes(row.automation_key) && appt.status !== "done") return finish({ status: "cancelled", error: "Visit is not marked done." });
  }

  const to = row.recipient === "doctor" ? doctor?.phone : patient?.phone;
  if (!to) return finish({ status: "skipped", error: row.recipient === "doctor" ? "Doctor has no WhatsApp number (Automations page)." : "Patient has no phone number." });
  if (row.automation_key === "review" && !clinic.google_review_url) return finish({ status: "skipped", error: "Add the Google review link first." });

  const vars: Partial<Record<VarKey, string>> = {
    name: patient?.name ?? "",
    doctor: doctor?.name ?? one(appt?.doctor ?? null)?.name ?? "our dentist",
    service: one(appt?.service ?? null)?.name ?? "consultation",
    clinic: clinic.name,
    address: clinic.address ?? site.address,
    phone: patient?.phone ? `+${patient.phone}` : "",
    review_link: clinic.google_review_url ?? "",
    interest: patient?.interest ?? "treatment",
    ...(appt ? { date: fmtDate(appt.starts_at, { weekday: "short", day: "numeric", month: "short" }), time: fmtTime(appt.starts_at) } : {}),
  };
  if (row.automation_key === "doctor_schedule" && row.doctor_id) Object.assign(vars, await todaysSchedule(db, row.doctor_id));

  const body = renderMessage(auto.body, vars);

  // WhatsApp allows free text only within 24 hours of the person's last message; otherwise a template.
  const { data: conv } = await db
    .from("conversations")
    .select("last_patient_message_at")
    .eq("clinic_id", clinic.id)
    .eq("channel", "whatsapp")
    .eq("external_id", to)
    .maybeSingle();
  const inWindow = Boolean(conv?.last_patient_message_at && Date.now() - Date.parse(conv.last_patient_message_at) < 23.5 * HOUR);

  let externalId: string | null = null;
  try {
    if (inWindow) {
      externalId = (await sendText(db, { channel: "whatsapp", external_id: to }, body)).externalId;
    } else if (auto.template_name) {
      externalId = (await sendWhatsAppTemplate(db, to, auto.template_name, auto.template_lang, def.params.map((k) => vars[k] ?? ""))).externalId;
    } else {
      return finish({ status: "skipped", error: "Outside WhatsApp's 24-hour window: add an approved template name for this automation." }, { body });
    }
  } catch (err) {
    const msg = err instanceof ChannelError ? err.message : (err as Error).message;
    return finish({ status: "failed", error: msg }, { body });
  }

  // Show what the patient received in their WhatsApp chat in the Inbox.
  if (row.recipient === "patient" && patient) {
    try {
      const { conversationId } = await resolveContact(db, clinic.id, { channel: "whatsapp", externalId: to, phone: to, name: patient.name, source: "whatsapp" });
      await db.from("messages").insert({ clinic_id: clinic.id, conversation_id: conversationId, sender: "automation", body, external_id: externalId, status: "sent" });
    } catch (err) {
      console.error("Could not log automation message", err);
    }
  }
  return finish({ status: "sent" }, { body, external_id: externalId, sent_at: new Date().toISOString() });
}

/** "{count}" and "{schedule}" for a doctor's morning message. One line: templates may not contain new lines. */
async function todaysSchedule(db: SupabaseClient, doctorId: string) {
  const today = localToday();
  const { data } = await db
    .from("appointments")
    .select("starts_at, patient:patients(name), service:services(name)")
    .eq("doctor_id", doctorId)
    .in("status", ["booked", "confirmed"])
    .gte("starts_at", `${today}T00:00:00${site.timezoneOffset}`)
    .lte("starts_at", `${today}T23:59:59${site.timezoneOffset}`)
    .order("starts_at");
  const list = (data ?? []).map(
    (a) =>
      `${fmtTime(a.starts_at as string)} ${one(a.patient as Rel<{ name: string }>)?.name ?? "Patient"} (${one(a.service as Rel<{ name: string }>)?.name ?? "Consultation"})`,
  );
  return { count: String(list.length), schedule: list.join("; ") || "no appointments" };
}

async function queueRows(db: SupabaseClient, rows: Record<string, unknown>[]) {
  if (!rows.length) return 0;
  const { data, error } = await db.from("automation_queue").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
  if (error) console.error("Could not queue automations", error);
  return data?.length ?? 0;
}

async function queueDoctorSchedules(db: SupabaseClient, clinicId: string, autos: Map<AutomationKey, AutomationRow>) {
  const hour = localNow().getUTCHours();
  if (!autos.get("doctor_schedule")?.enabled || hour < DOCTOR_SCHEDULE_HOUR || hour >= 12) return 0;
  const today = localToday();
  const { data } = await db
    .from("appointments")
    .select("doctor_id")
    .eq("clinic_id", clinicId)
    .in("status", ["booked", "confirmed"])
    .not("doctor_id", "is", null)
    .gte("starts_at", `${today}T00:00:00${site.timezoneOffset}`)
    .lte("starts_at", `${today}T23:59:59${site.timezoneOffset}`);
  const doctorIds = [...new Set((data ?? []).map((a) => a.doctor_id as string))];
  return queueRows(
    db,
    doctorIds.map((id) => ({
      clinic_id: clinicId,
      automation_key: "doctor_schedule",
      recipient: "doctor",
      doctor_id: id,
      dedupe_key: `doctor_schedule:${id}:${today}`,
    })),
  );
}

/** Patient asked, we replied, then they went quiet for ~20 hours without booking. Still inside the 24-hour window. */
async function queueLeadFollowUps(db: SupabaseClient, clinicId: string, autos: Map<AutomationKey, AutomationRow>) {
  if (!autos.get("lead_follow_up")?.enabled) return 0;
  const { data: convs } = await db
    .from("conversations")
    .select("id, patient_id, last_message_at, last_patient_message_at, patient:patients(stage:pipeline_stages(auto_key))")
    .eq("clinic_id", clinicId)
    .eq("channel", "whatsapp")
    .gte("last_patient_message_at", new Date(Date.now() - 23 * HOUR).toISOString())
    .lte("last_patient_message_at", new Date(Date.now() - 20 * HOUR).toISOString())
    .limit(200);
  const candidates = ((convs ?? []) as unknown as {
    id: string;
    patient_id: string;
    last_message_at: string;
    last_patient_message_at: string;
    patient: Rel<{ stage: Rel<{ auto_key: string | null }> }>;
  }[]).filter((c) => {
    const stage = one(one(c.patient)?.stage ?? null)?.auto_key;
    // We answered last (the patient is the one who went quiet) and they are still a lead.
    return Date.parse(c.last_message_at) > Date.parse(c.last_patient_message_at) && (stage === "new" || stage === "engaged");
  });
  if (!candidates.length) return 0;
  const { data: booked } = await db
    .from("appointments")
    .select("patient_id")
    .in("patient_id", candidates.map((c) => c.patient_id))
    .neq("status", "cancelled");
  const hasBooking = new Set((booked ?? []).map((a) => a.patient_id as string));
  return queueRows(
    db,
    candidates
      .filter((c) => !hasBooking.has(c.patient_id))
      .map((c) => ({
        clinic_id: clinicId,
        automation_key: "lead_follow_up",
        recipient: "patient",
        patient_id: c.patient_id,
        dedupe_key: `lead_follow_up:${c.id}:${Date.parse(c.last_patient_message_at)}`,
      })),
  );
}

/** Last visit 90–97 days ago and nothing booked since. */
async function queueWinBacks(db: SupabaseClient, clinicId: string, autos: Map<AutomationKey, AutomationRow>) {
  if (!autos.get("win_back")?.enabled) return 0;
  const { data: visits } = await db
    .from("appointments")
    .select("patient_id, starts_at")
    .eq("clinic_id", clinicId)
    .eq("status", "done")
    .gte("starts_at", new Date(Date.now() - 97 * DAY).toISOString())
    .lte("starts_at", new Date(Date.now() - 90 * DAY).toISOString())
    .limit(200);
  const lastVisit = new Map<string, string>();
  for (const v of visits ?? []) {
    const prev = lastVisit.get(v.patient_id as string);
    if (!prev || (v.starts_at as string) > prev) lastVisit.set(v.patient_id as string, v.starts_at as string);
  }
  const patientIds = [...lastVisit.keys()];
  if (!patientIds.length) return 0;
  const { data: later } = await db
    .from("appointments")
    .select("patient_id")
    .in("patient_id", patientIds)
    .gt("starts_at", new Date(Date.now() - 90 * DAY).toISOString())
    .neq("status", "cancelled");
  const active = new Set((later ?? []).map((a) => a.patient_id as string));
  return queueRows(
    db,
    patientIds
      .filter((id) => !active.has(id))
      .map((id) => ({
        clinic_id: clinicId,
        automation_key: "win_back",
        recipient: "patient",
        patient_id: id,
        dedupe_key: `win_back:${id}:${lastVisit.get(id)!.slice(0, 10)}`,
      })),
  );
}
