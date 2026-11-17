import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  CalendarCheck,
  ClipboardList,
  HeartPulse,
  MessageCircle,
  Play,
  RotateCcw,
  Star,
  Stethoscope,
  UserX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { site } from "@/config/site";
import { PageHeader } from "@/components/crm/PageHeader";
import { findConnection } from "@/lib/channels";
import { AUTOMATIONS, AUTOMATION_BY_KEY, VARIABLES, type AutomationKey } from "@/lib/automations/definitions";
import { runNow, toggleAutomation, updateAutomation, updateDoctorPhone, updateReviewLink } from "./actions";
import { cn, fmtDate, fmtTime, timeAgo, todayInOffset } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICONS: Record<AutomationKey, typeof BellRing> = {
  confirmation: CalendarCheck,
  doctor_new: Stethoscope,
  reminder: BellRing,
  doctor_schedule: ClipboardList,
  no_show: UserX,
  aftercare: HeartPulse,
  review: Star,
  lead_follow_up: MessageCircle,
  win_back: RotateCcw,
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-sky-50 text-sky-700",
  sending: "bg-sky-50 text-sky-700",
  sent: "bg-emerald-50 text-emerald-700",
  skipped: "bg-amber-50 text-amber-800",
  failed: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const JOURNEY = [
  { step: "Step", title: "Enquiry", sub: "any channel" },
  { step: "Automatic", title: "AI reply", sub: "in seconds" },
  { step: "Automatic", title: "Booked", sub: "patient + doctor told" },
  { step: "Automatic", title: "Reminder", sub: "24 h before" },
  { step: "Step", title: "Visit", sub: "marked done" },
  { step: "Automatic", title: "Aftercare", sub: "next day" },
  { step: "Automatic", title: "Review", sub: "Google ★" },
  { step: "Automatic", title: "Win back", sub: "after 90 days" },
];

type Rel<T> = T | T[] | null;
const one = <T,>(v: Rel<T>) => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const monthStart = `${todayInOffset(site.timezoneOffset).slice(0, 7)}-01T00:00:00${site.timezoneOffset}`;

  const [{ data: me }, { data: clinic }, { data: rows }, { data: stats }, { data: recent }, { data: doctors }] = await Promise.all([
    supabase.auth.getUser().then(async ({ data }) =>
      data.user ? supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle() : { data: null },
    ),
    supabase.from("clinics").select("google_review_url, automations_last_run_at").limit(1).maybeSingle(),
    supabase.from("automations").select("key, enabled, body, template_name, template_lang"),
    supabase.from("automation_queue").select("automation_key, status").gte("created_at", monthStart).limit(20000),
    supabase
      .from("automation_queue")
      .select("id, automation_key, recipient, status, error, send_at, sent_at, patient:patients(name), doctor:doctors(name)")
      .order("send_at", { ascending: false })
      .limit(20),
    supabase.from("doctors").select("id, name, specialization, phone").eq("active", true).order("created_at"),
  ]);
  const isAdmin = me?.role === "admin";
  const whatsappReady = Boolean(await findConnection(createAdminClient(), "whatsapp").catch(() => null));
  type AutomationRow = { key: AutomationKey; enabled: boolean; body: string; template_name: string | null; template_lang: string };
  const byKey = new Map(((rows ?? []) as AutomationRow[]).map((r) => [r.key, r]));

  const count = (key: string, statuses: string[]) => (stats ?? []).filter((s) => s.automation_key === key && statuses.includes(s.status as string)).length;
  const lastRun = clinic?.automations_last_run_at as string | null | undefined;
  const schedulerStale = !lastRun || Date.now() - Date.parse(lastRun) > 20 * 60_000;

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="WhatsApp messages to patients and doctors that go out by themselves, at the right moment."
        actions={
          isAdmin && (
            <form action={runNow}>
              <button className="crm-btn">
                <Play className="h-4 w-4" /> Run now
              </button>
            </form>
          )
        }
      />
      <div className="space-y-6 p-4 sm:p-6">
        {ok && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{ok}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

        {(!whatsappReady || schedulerStale) && (
          <div className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {!whatsappReady && (
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> WhatsApp is not connected yet, so nothing can be sent.{" "}
                <Link href="/crm/settings#channels" className="font-semibold underline">
                  Connect it
                </Link>
              </p>
            )}
            {schedulerStale && (
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {lastRun ? `Last run ${timeAgo(lastRun)} ago.` : "The sender has never run."} Set up the 5-minute schedule (README → Automations), or press
                Run now to test.
              </p>
            )}
          </div>
        )}

        <section className="card p-5">
          <h2 className="font-display text-base font-bold text-ink">Patient journey, automated</h2>
          <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {JOURNEY.map((j, i) => (
              <li key={j.title} className="flex shrink-0 items-center gap-2">
                <div
                  className={cn(
                    "w-36 rounded-xl border px-3 py-2.5",
                    j.step === "Automatic" ? "border-violet-200 bg-violet-50/70" : "border-slate-200 bg-white",
                  )}
                >
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider", j.step === "Automatic" ? "text-violet-600" : "text-slate-400")}>{j.step}</p>
                  <p className="text-sm font-semibold text-ink">{j.title}</p>
                  <p className="text-xs text-slate-500">{j.sub}</p>
                </div>
                {i < JOURNEY.length - 1 && <span className="h-px w-4 bg-slate-300" />}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {AUTOMATIONS.map((def) => {
            const row = byKey.get(def.key);
            if (!row) return null;
            const Icon = ICONS[def.key];
            const sent = count(def.key, ["sent"]);
            const waiting = count(def.key, ["pending", "sending"]);
            const problems = count(def.key, ["failed", "skipped"]);
            return (
              <article key={def.key} id={def.key} className={cn("card scroll-mt-6 p-5 transition", !row.enabled && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-ink">{def.title}</h3>
                    <p className="text-xs text-slate-500">{def.trigger} · WhatsApp</p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        def.recipient === "doctor" ? "bg-indigo-50 text-indigo-700" : "bg-brand-50 text-brand-700",
                      )}
                    >
                      To {def.recipient}
                    </span>
                  </div>
                  <form action={toggleAutomation.bind(null, def.key, !row.enabled)}>
                    <button
                      role="switch"
                      aria-checked={row.enabled}
                      aria-label={`${def.title} on or off`}
                      disabled={!isAdmin}
                      className={cn("relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed", row.enabled ? "bg-brand-600" : "bg-slate-300")}
                    >
                      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", row.enabled && "translate-x-5")} />
                    </button>
                  </form>
                </div>

                <p className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">{row.body}</p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    Sent this month <b className="text-ink">{sent}</b>
                  </span>
                  <span>
                    Waiting <b className="text-ink">{waiting}</b>
                  </span>
                  {problems > 0 && (
                    <span className="text-amber-700">
                      Needs attention <b>{problems}</b>
                    </span>
                  )}
                </div>
                <p className={cn("mt-2 text-xs", row.template_name ? "text-slate-500" : "text-amber-700")}>
                  {row.template_name
                    ? `Template: ${row.template_name} (${row.template_lang})`
                    : def.recipient === "doctor"
                      ? "Add an approved template: messages to doctors are almost always outside WhatsApp's 24-hour window."
                      : "No template yet: sent only if the patient messaged in the last 24 hours."}
                </p>

                {isAdmin && (
                  <details className="group mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-700 hover:underline">Edit message & template</summary>
                    <form action={updateAutomation.bind(null, def.key)} className="mt-3 space-y-2">
                      <textarea name="body" rows={4} defaultValue={row.body} maxLength={1000} className="crm-input resize-y" />
                      <p className="text-[11px] text-slate-500">
                        You can use: {VARIABLES.map((v) => `{${v.key}}`).join(" ")}
                      </p>
                      <div className="grid grid-cols-[1fr_90px] gap-2">
                        <input name="template_name" defaultValue={row.template_name ?? ""} placeholder="Template name, e.g. appointment_reminder" className="crm-input" />
                        <input name="template_lang" defaultValue={row.template_lang} placeholder="en" className="crm-input" />
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
                        <p className="font-semibold text-slate-700">Create this template in WhatsApp Manager ({AUTOMATION_BY_KEY[def.key].category} category):</p>
                        <textarea readOnly rows={3} value={def.templateExample} className="mt-1 w-full resize-none rounded bg-white p-2 font-mono text-[11px] ring-1 ring-slate-200" />
                        <p className="mt-1">
                          Variables in order: {def.params.map((p, i) => `{{${i + 1}}} = ${VARIABLES.find((v) => v.key === p)?.label}`).join(", ")}
                        </p>
                      </div>
                      <button className="crm-btn w-full">Save</button>
                    </form>
                  </details>
                )}
              </article>
            );
          })}
        </section>

        <section id="setup" className="grid scroll-mt-6 gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-display text-base font-bold text-ink">Doctors&apos; WhatsApp numbers</h2>
            <p className="mt-1 text-sm text-slate-500">New-appointment alerts and the morning schedule go to these numbers.</p>
            <ul className="mt-4 divide-y divide-slate-100">
              {(doctors ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.specialization ?? "Doctor"}</p>
                  </div>
                  <form action={updateDoctorPhone.bind(null, d.id as string)} className="flex gap-2">
                    <input
                      name="phone"
                      defaultValue={d.phone ? `+${d.phone}` : ""}
                      inputMode="tel"
                      placeholder="03xx xxxxxxx"
                      className="crm-input w-40"
                      disabled={!isAdmin}
                    />
                    <button className="crm-btn-outline" disabled={!isAdmin}>
                      Save
                    </button>
                  </form>
                </li>
              ))}
              {(doctors ?? []).length === 0 && <li className="py-3 text-sm text-slate-500">No doctors yet.</li>}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-bold text-ink">Google review link</h2>
            <p className="mt-1 text-sm text-slate-500">
              Used in the review request. Find it in Google Business Profile → &quot;Ask for reviews&quot;.
            </p>
            <form action={updateReviewLink} className="mt-4 flex gap-2">
              <input
                name="google_review_url"
                defaultValue={clinic?.google_review_url ?? ""}
                placeholder="https://g.page/r/…/review"
                className="crm-input flex-1"
                disabled={!isAdmin}
              />
              <button className="crm-btn" disabled={!isAdmin}>
                Save
              </button>
            </form>
            <p className="mt-4 text-xs text-slate-500">
              Last run: {lastRun ? `${fmtDate(lastRun, { day: "numeric", month: "short" })}, ${fmtTime(lastRun)}` : "never"}. Messages wait in the queue and
              go out within 5 minutes of their time.
            </p>
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-4 font-display text-base font-bold text-ink">Recent automatic messages</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">When</th>
                  <th className="px-5 py-2.5 font-semibold">Automation</th>
                  <th className="px-5 py-2.5 font-semibold">To</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(recent ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      Nothing yet. Book an appointment to see the confirmation and reminder appear here.
                    </td>
                  </tr>
                )}
                {(recent ?? []).map((r) => {
                  const when = (r.sent_at as string | null) ?? (r.send_at as string);
                  const to =
                    r.recipient === "doctor"
                      ? one(r.doctor as Rel<{ name: string }>)?.name ?? "Doctor"
                      : one(r.patient as Rel<{ name: string }>)?.name ?? "Patient";
                  return (
                    <tr key={r.id as string}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">
                        {fmtDate(when, { day: "numeric", month: "short" })}, {fmtTime(when)}
                      </td>
                      <td className="px-5 py-2.5 text-ink">{AUTOMATION_BY_KEY[r.automation_key as AutomationKey]?.title ?? r.automation_key}</td>
                      <td className="px-5 py-2.5 text-slate-600">{to}</td>
                      <td className="px-5 py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLE[r.status as string])}>
                          {r.status === "pending" ? "waiting" : (r.status as string)}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-5 py-2.5 text-xs text-slate-500" title={(r.error as string | null) ?? ""}>
                        {(r.error as string | null) ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
