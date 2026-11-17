"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Loader2, MessageCircle, Phone, Plus, X } from "lucide-react";
import { createAppointment, rescheduleAppointment, type AppointmentFormState } from "@/app/crm/appointments/actions";
import { StatusSelect } from "./StatusSelect";
import { site } from "@/config/site";
import { STATUS_LABEL, type AppointmentStatus } from "@/types/db";
import { cn, fmtDate } from "@/lib/utils";

export type CalendarAppointment = {
  id: string;
  startsAt: string;
  duration: number;
  status: AppointmentStatus;
  type: string;
  notes: string | null;
  doctorId: string | null;
  patient: { id: string; name: string; phone: string | null } | null;
  service: string | null;
};

type Doctor = { id: string; name: string; specialization: string | null };
type Service = { id: string; name: string; duration_min: number };
type PatientOption = { id: string; name: string; phone: string | null };
type Panel = { mode: "new"; doctorId?: string; time?: string } | { mode: "view"; id: string } | null;

const ROW_MIN = 30;
const ROW_PX = 56;
const UNASSIGNED = "__none";
const PALETTE = [
  { border: "#2558c9", soft: "#f0fdfa" },
  { border: "#0d9488", soft: "#f0fdfa" },
  { border: "#ca8a04", soft: "#fefce8" },
  { border: "#db2777", soft: "#fdf2f8" },
  { border: "#0284c7", soft: "#f0f9ff" },
  { border: "#16a34a", soft: "#f0fdf4" },
];
const GREY = { border: "#94a3b8", soft: "#f8fafc" };
const STATUS_DOT: Record<AppointmentStatus, string> = {
  booked: "bg-sky-500",
  confirmed: "bg-emerald-500",
  arrived: "bg-violet-500",
  in_consultation: "bg-amber-500",
  done: "bg-green-600",
  no_show: "bg-rose-500",
  cancelled: "bg-slate-400",
};

const OFFSET_MIN = (() => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(site.timezoneOffset);
  if (!m) return 0;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -v : v;
})();

/** Minutes after midnight in clinic time. */
const localMinutes = (ms: number) => ((Math.floor(ms / 60_000) + OFFSET_MIN) % 1440 + 1440) % 1440;
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const clock = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1}:${pad(min % 60)} ${min < 720 ? "AM" : "PM"}`;

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Side-by-side lanes when one doctor has overlapping appointments (double booking). */
function layout(items: CalendarAppointment[]) {
  const laneEnds: number[] = [];
  const placed = [...items]
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((a) => {
      const s = localMinutes(Date.parse(a.startsAt));
      const e = s + a.duration;
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(e);
      } else {
        laneEnds[lane] = e;
      }
      return { a, s, e, lane };
    });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

export function AppointmentsCalendar({
  date,
  today,
  appointments,
  doctors,
  services,
  patients,
  openMin,
  closeMin,
  prefillPatientId,
}: {
  date: string;
  today: string;
  appointments: CalendarAppointment[];
  doctors: Doctor[];
  services: Service[];
  patients: PatientOption[];
  openMin: number;
  closeMin: number;
  prefillPatientId: string | null;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(prefillPatientId ? { mode: "new" } : null);
  const [nowMin, setNowMin] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = date === today;

  // Doctor columns (+ "Any doctor" only when something is unassigned, e.g. an old booking).
  const columns = useMemo(() => {
    const cols = doctors.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length]! }));
    const known = new Set(doctors.map((d) => d.id));
    if (doctors.length === 0 || appointments.some((a) => !a.doctorId || !known.has(a.doctorId))) {
      cols.push({ id: UNASSIGNED, name: "Any doctor", specialization: "Not assigned yet", color: GREY });
    }
    return cols;
  }, [doctors, appointments]);
  const colorOf = (doctorId: string | null) => columns.find((c) => c.id === doctorId)?.color ?? GREY;

  // Grid hours: clinic hours, stretched to fit any appointment outside them.
  const { start, end } = useMemo(() => {
    let s = Math.floor(openMin / ROW_MIN) * ROW_MIN;
    let e = Math.ceil(closeMin / ROW_MIN) * ROW_MIN;
    for (const a of appointments) {
      const m = localMinutes(Date.parse(a.startsAt));
      s = Math.min(s, Math.floor(m / ROW_MIN) * ROW_MIN);
      e = Math.max(e, Math.ceil((m + a.duration) / ROW_MIN) * ROW_MIN);
    }
    return { start: s, end: Math.min(e, 24 * 60) };
  }, [appointments, openMin, closeMin]);
  const rows = useMemo(() => Array.from({ length: Math.max(1, (end - start) / ROW_MIN) }, (_, i) => start + i * ROW_MIN), [start, end]);

  // Red "now" line on today's calendar (client only, so server and browser render the same HTML).
  useEffect(() => {
    if (!isToday) return;
    const tick = () => setNowMin(localMinutes(Date.now()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  // Open at the current time (today) or the first appointment.
  useEffect(() => {
    const first = appointments[0] ? localMinutes(Date.parse(appointments[0].startsAt)) : null;
    const target = isToday ? localMinutes(Date.now()) : first;
    if (target != null && scrollRef.current) scrollRef.current.scrollTop = Math.max(0, ((target - start) / ROW_MIN) * ROW_PX - 80);
    // Only when the day changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = appointments.filter((a) => a.status !== "cancelled");
  const confirmed = active.filter((a) => a.status === "confirmed").length;
  const awaiting = active.filter((a) => a.status === "booked").length;
  const visited = active.filter((a) => ["arrived", "in_consultation", "done"].includes(a.status)).length;
  const viewing = panel?.mode === "view" ? appointments.find((a) => a.id === panel.id) ?? null : null;

  function finished(newDate?: string) {
    setPanel(null);
    if (newDate && newDate !== date) router.push(`/crm/appointments?date=${newDate}`);
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            {fmtDate(`${date}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short" })}
            {isToday && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Today</span>}
          </h2>
          <p className="text-sm text-slate-500">
            {active.length} appointments · {confirmed} confirmed · {awaiting} awaiting confirmation · {visited} visited
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/crm/appointments?date=${shiftDate(date, -1)}`} className="crm-btn-outline px-2.5" aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href="/crm/appointments" className="crm-btn-outline">
            Today
          </Link>
          <Link href={`/crm/appointments?date=${shiftDate(date, 1)}`} className="crm-btn-outline px-2.5" aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && router.push(`/crm/appointments?date=${e.target.value}`)}
            className="crm-input w-auto"
            aria-label="Go to date"
          />
          <button type="button" onClick={() => setPanel({ mode: "new" })} className="crm-btn">
            <Plus className="h-4 w-4" /> New appointment
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="mt-4 max-h-[calc(100dvh-230px)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="grid"
          style={{ gridTemplateColumns: `76px repeat(${columns.length}, minmax(220px, 1fr))`, minWidth: 76 + columns.length * 220 }}
        >
          {/* Header row */}
          <div className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-white" />
          {columns.map((c) => (
            <div key={c.id} className="sticky top-0 z-20 flex min-w-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color.border }} />
              <span className="shrink-0 font-semibold text-ink">{c.name}</span>
              {c.specialization && <span className="truncate text-slate-500">· {c.specialization}</span>}
            </div>
          ))}

          {/* Time column */}
          <div className="sticky left-0 z-10 border-r border-slate-200 bg-white">
            {rows.map((r) => (
              <div key={r} style={{ height: ROW_PX }} className="border-b border-slate-100 px-2 pt-2 font-mono text-[11px] text-slate-400">
                {clock(r)}
              </div>
            ))}
          </div>

          {/* Doctor columns */}
          {columns.map((col) => {
            const known = new Set(doctors.map((d) => d.id));
            const items = appointments.filter((a) =>
              col.id === UNASSIGNED ? !a.doctorId || !known.has(a.doctorId) : a.doctorId === col.id,
            );
            const { placed, lanes } = layout(items);
            return (
              <div key={col.id} className="relative border-r border-slate-100 last:border-r-0" style={{ height: rows.length * ROW_PX }}>
                {rows.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPanel({ mode: "new", doctorId: col.id === UNASSIGNED ? undefined : col.id, time: hhmm(r) })}
                    style={{ height: ROW_PX }}
                    className="group flex w-full items-start border-b border-slate-100 px-3 pt-2 text-left transition-colors hover:bg-brand-50/50"
                    aria-label={`Book ${clock(r)} with ${col.name}`}
                  >
                    <span className="hidden items-center gap-1 text-[11px] font-semibold text-brand-700 group-hover:flex">
                      <Plus className="h-3 w-3" /> {clock(r)}
                    </span>
                  </button>
                ))}

                {placed.map(({ a, s, e, lane }) => {
                  const off = a.status === "cancelled" || a.status === "no_show";
                  const inClinic = a.status === "arrived" || a.status === "in_consultation" || a.status === "done";
                  const height = Math.max(ROW_PX - 6, ((e - s) / ROW_MIN) * ROW_PX - 6);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setPanel({ mode: "view", id: a.id })}
                      className={cn(
                        "absolute overflow-hidden rounded-lg border-2 px-2.5 py-1.5 text-left shadow-sm transition hover:z-10 hover:-translate-y-0.5 hover:shadow-md",
                        off && "border-dashed opacity-60",
                      )}
                      style={{
                        top: ((s - start) / ROW_MIN) * ROW_PX + 3,
                        height,
                        left: `calc(${(lane * 100) / lanes}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                        borderColor: col.color.border,
                        background: inClinic ? col.color.soft : "#fff",
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn("truncate text-[13px] font-semibold text-ink", off && "line-through")}>{a.patient?.name ?? "Patient"}</span>
                        {a.status === "done" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        ) : (
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[a.status])} title={STATUS_LABEL[a.status]} />
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">{a.service ?? "Consultation"}</span>
                      {height > ROW_PX && (
                        <span className="block text-[11px] text-slate-400">
                          {clock(s)} – {clock(e)} · {STATUS_LABEL[a.status]}
                        </span>
                      )}
                    </button>
                  );
                })}

                {nowMin != null && nowMin >= start && nowMin <= end && (
                  <div className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-rose-500" style={{ top: ((nowMin - start) / ROW_MIN) * ROW_PX }}>
                    {col.id === columns[0]?.id && <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        {(Object.keys(STATUS_DOT) as AppointmentStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} /> {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="ml-auto">Click an empty slot to book it.</span>
      </div>

      <AnimatePresence>
        {panel && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanel(null)}
            />
            <motion.aside
              role="dialog"
              aria-label={panel.mode === "new" ? "New appointment" : "Appointment"}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="font-display text-lg font-bold text-ink">{panel.mode === "new" ? "New appointment" : "Appointment"}</h2>
                <button type="button" onClick={() => setPanel(null)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {panel.mode === "new" ? (
                <NewAppointmentForm
                  date={date}
                  doctors={doctors}
                  services={services}
                  patients={patients}
                  doctorId={panel.doctorId}
                  time={panel.time}
                  patientId={prefillPatientId}
                  onDone={finished}
                />
              ) : viewing ? (
                <AppointmentDetails appt={viewing} doctors={doctors} color={colorOf(viewing.doctorId)} onDone={finished} />
              ) : null}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewAppointmentForm({
  date,
  doctors,
  services,
  patients,
  doctorId,
  time,
  patientId,
  onDone,
}: {
  date: string;
  doctors: Doctor[];
  services: Service[];
  patients: PatientOption[];
  doctorId?: string;
  time?: string;
  patientId: string | null;
  onDone: (date?: string) => void;
}) {
  const [state, action, pending] = useActionState(createAppointment, {} as AppointmentFormState);
  const [newPatient, setNewPatient] = useState(!patientId);

  useEffect(() => {
    if (state.ok) onDone(state.date);
    // Run once per successful save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.at]);

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <button type="button" onClick={() => setNewPatient(false)} className={cn("flex-1 rounded-lg py-1.5", !newPatient ? "bg-white shadow-sm" : "text-slate-500")}>
          Existing patient
        </button>
        <button type="button" onClick={() => setNewPatient(true)} className={cn("flex-1 rounded-lg py-1.5", newPatient ? "bg-white shadow-sm" : "text-slate-500")}>
          New patient
        </button>
      </div>

      {newPatient ? (
        <div className="grid grid-cols-2 gap-2">
          <input name="new_name" required placeholder="Patient name" className="crm-input" />
          <input name="new_phone" inputMode="tel" placeholder="Phone (03xx…)" className="crm-input" />
        </div>
      ) : (
        <select name="patient_id" required defaultValue={patientId ?? ""} className="crm-input">
          <option value="" disabled>
            Choose a patient
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.phone ? ` · +${p.phone}` : ""}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Date</span>
          <input type="date" name="date" defaultValue={date} required className="crm-input" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Time</span>
          <input type="time" name="time" defaultValue={time ?? "17:00"} step={900} required className="crm-input" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Doctor</span>
        <select name="doctor_id" defaultValue={doctorId ?? ""} className="crm-input">
          <option value="">Any doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.specialization ? ` · ${d.specialization}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Service</span>
          <select name="service_id" className="crm-input">
            <option value="">Consultation</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_min} min)
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Type</span>
          <select name="type" className="crm-input" defaultValue="new">
            <option value="new">New</option>
            <option value="follow_up">Follow-up</option>
            <option value="procedure">Procedure</option>
          </select>
        </label>
      </div>

      <textarea name="notes" rows={2} placeholder="Notes (optional)" className="crm-input resize-none" />
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="crm-btn w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Save appointment
      </button>
    </form>
  );
}

function AppointmentDetails({
  appt,
  doctors,
  color,
  onDone,
}: {
  appt: CalendarAppointment;
  doctors: Doctor[];
  color: { border: string; soft: string };
  onDone: (date?: string) => void;
}) {
  const reschedule = useMemo(() => rescheduleAppointment.bind(null, appt.id), [appt.id]);
  const [state, action, pending] = useActionState(reschedule, {} as AppointmentFormState);
  const startMs = Date.parse(appt.startsAt);
  const startMin = localMinutes(startMs);
  const localDate = new Date(startMs + OFFSET_MIN * 60_000).toISOString().slice(0, 10);
  const doctor = doctors.find((d) => d.id === appt.doctorId);
  const when = `${fmtDate(appt.startsAt, { weekday: "long", day: "numeric", month: "short" })}, ${clock(startMin)}`;
  const reminder = appt.patient?.phone
    ? `https://wa.me/${appt.patient.phone}?text=${encodeURIComponent(
        `Assalam o alaikum ${appt.patient.name}! ${site.name} mein aap ki appointment ${when} par hai. Tashreef laane ka intezar rahega.`,
      )}`
    : null;

  useEffect(() => {
    if (state.ok) onDone(state.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.at]);

  return (
    <div className="space-y-5 p-5">
      <div className="rounded-2xl border-2 p-4" style={{ borderColor: color.border, background: color.soft }}>
        <Link href={`/crm/patients/${appt.patient?.id}`} className="font-display text-lg font-bold text-ink hover:underline">
          {appt.patient?.name ?? "Patient"}
        </Link>
        <p className="font-mono text-xs text-slate-500">{appt.patient?.phone ? `+${appt.patient.phone}` : "No phone"}</p>
        <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-1.5 text-sm">
          <dt className="text-slate-500">When</dt>
          <dd className="font-medium text-ink">
            {when} – {clock(startMin + appt.duration)}
          </dd>
          <dt className="text-slate-500">Doctor</dt>
          <dd className="font-medium text-ink">{doctor?.name ?? "Any doctor"}</dd>
          <dt className="text-slate-500">Service</dt>
          <dd className="font-medium text-ink">{appt.service ?? "Consultation"}</dd>
          <dt className="text-slate-500">Type</dt>
          <dd className="font-medium capitalize text-ink">{appt.type.replace("_", "-")}</dd>
          {appt.notes && (
            <>
              <dt className="text-slate-500">Notes</dt>
              <dd className="text-ink">{appt.notes}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Status</span>
        <StatusSelect key={appt.status} id={appt.id} value={appt.status} />
      </div>

      {appt.patient?.phone && (
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:+${appt.patient.phone}`} className="crm-btn-outline">
            <Phone className="h-4 w-4" /> Call
          </a>
          <a href={reminder!} target="_blank" rel="noopener noreferrer" className="crm-btn-outline">
            <MessageCircle className="h-4 w-4" /> WhatsApp reminder
          </a>
        </div>
      )}

      <form action={action} className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-ink">Reschedule</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" name="date" defaultValue={localDate} required className="crm-input" />
          <input type="time" name="time" defaultValue={hhmm(startMin)} step={900} required className="crm-input" />
        </div>
        <select name="doctor_id" defaultValue={appt.doctorId ?? ""} className="crm-input">
          <option value="">Any doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending} className="crm-btn w-full">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Save new time
        </button>
      </form>
    </div>
  );
}
