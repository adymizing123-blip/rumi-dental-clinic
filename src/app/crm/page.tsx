import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { PageHeader } from "@/components/crm/PageHeader";
import { DemandChart, type DemandPoint } from "@/components/crm/growth/DemandChart";
import { LiveActivity, type ActivityItem } from "@/components/crm/growth/LiveActivity";
import { CHANNEL_LABEL, sourceLabel, type Channel } from "@/types/db";
import { cn, fmtDate, formatPKR, todayInOffset } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const MINUTES_SAVED_PER_AI_REPLY = 2; // estimate shown as such on the card
const off = site.timezoneOffset;
const OFFSET_MIN = (() => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(off);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
})();

/** YYYY-MM-DD of a timestamp in clinic time. */
const localDay = (iso: string) => new Date(Date.parse(iso) + OFFSET_MIN * 60_000).toISOString().slice(0, 10);
const localHour = (iso: string) => new Date(Date.parse(iso) + OFFSET_MIN * 60_000).getUTCHours();
const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dayStart = (day: string) => `${day}T00:00:00${off}`;

type Rel<T> = T | T[] | null;
const one = <T,>(v: Rel<T>) => (Array.isArray(v) ? (v[0] ?? null) : v);

function compact(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)} lac`;
  return n.toLocaleString("en-PK");
}

export default async function GrowthCenterPage() {
  const supabase = await createClient();
  const today = todayInOffset(off);
  const monthStart = `${today.slice(0, 7)}-01T00:00:00${off}`;
  const windowStart = dayStart(shiftDay(today, -29));
  const monthName = fmtDate(`${today}T12:00:00Z`, { month: "long" });

  const [
    clinic,
    activeConvs,
    aiMsgs,
    aiAppts,
    todayAppts,
    enquiriesToday,
    enquiriesLastWeek,
    replySeconds,
    monthPatients,
    needsReply,
    demandConvs,
    demandAppts,
    sourceRows,
    hourRows,
    recentMessages,
    recentAppts,
  ] = await Promise.all([
    supabase.from("clinics").select("ai_enabled").limit(1).maybeSingle(),
    supabase.from("conversations").select("id", { count: "exact", head: true }).gte("last_message_at", monthStart),
    supabase.from("messages").select("conversation_id").eq("sender", "ai").gte("created_at", monthStart).limit(20000),
    supabase.from("appointments").select("status, service:services(price)").eq("booked_by", "ai").gte("created_at", monthStart),
    supabase.from("appointments").select("status").gte("starts_at", dayStart(today)).lt("starts_at", dayStart(shiftDay(today, 1))),
    supabase.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", dayStart(today)),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayStart(shiftDay(today, -7)))
      .lt("created_at", dayStart(shiftDay(today, -6))),
    supabase.rpc("ai_reply_seconds", { p_since: monthStart }),
    supabase
      .from("patients")
      .select("id, stage:pipeline_stages(auto_key), appointments(status)")
      .gte("created_at", monthStart)
      .is("deleted_at", null)
      .limit(5000),
    supabase.from("conversations").select("id", { count: "exact", head: true }).or("needs_human.eq.true,unread_count.gt.0"),
    supabase.from("conversations").select("created_at").gte("created_at", windowStart).limit(20000),
    supabase.from("appointments").select("created_at").gte("created_at", windowStart).limit(20000),
    supabase.from("patients").select("source").gte("created_at", windowStart).is("deleted_at", null).limit(20000),
    supabase.from("messages").select("created_at").eq("sender", "patient").gte("created_at", windowStart).limit(20000),
    supabase
      .from("messages")
      .select("id, sender, body, created_at, conversation:conversations(id, channel, patient:patients(name))")
      .in("sender", ["patient", "ai", "system", "automation"])
      .order("created_at", { ascending: false })
      .limit(16),
    supabase
      .from("appointments")
      .select("id, created_at, starts_at, booked_by, patient:patients(name), service:services(name)")
      .eq("booked_by", "staff")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // --- Growth report (this month) ------------------------------------------------------------
  const aiReplies = aiMsgs.data?.length ?? 0;
  const aiConversations = new Set((aiMsgs.data ?? []).map((m) => m.conversation_id as string)).size;
  const aiBooked = (aiAppts.data ?? []).filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const aiRevenue = aiBooked.reduce((sum, a) => sum + Number(one(a.service as Rel<{ price: number | null }>)?.price ?? 0), 0);
  const hoursSaved = Math.round((aiReplies * MINUTES_SAVED_PER_AI_REPLY) / 60);

  // --- KPI cards ------------------------------------------------------------------------------
  const appts = todayAppts.data ?? [];
  const live = appts.filter((a) => a.status !== "cancelled");
  const done = appts.filter((a) => a.status === "done").length;
  const noShow = appts.filter((a) => a.status === "no_show").length;
  const enqToday = enquiriesToday.count ?? 0;
  const enqLastWeek = enquiriesLastWeek.count ?? 0;
  const enqDelta = enqLastWeek > 0 ? Math.round(((enqToday - enqLastWeek) / enqLastWeek) * 100) : null;
  const avgReply = typeof replySeconds.data === "number" ? replySeconds.data : replySeconds.data ? Number(replySeconds.data) : null;

  const newPatients = (monthPatients.data ?? []) as unknown as {
    id: string;
    stage: Rel<{ auto_key: string | null }>;
    appointments: { status: string }[] | null;
  }[];
  const booked = newPatients.filter((p) => (p.appointments ?? []).some((a) => a.status !== "cancelled")).length;
  const visited = newPatients.filter((p) => (p.appointments ?? []).some((a) => ["arrived", "in_consultation", "done"].includes(a.status))).length;
  const lost = newPatients.filter((p) => one(p.stage)?.auto_key === "lost").length;
  const conversion = newPatients.length ? Math.round((booked / newPatients.length) * 100) : 0;

  // --- 30-day demand chart ------------------------------------------------------------------------
  const days = Array.from({ length: 30 }, (_, i) => shiftDay(today, i - 29));
  const enqByDay = new Map<string, number>();
  for (const c of demandConvs.data ?? []) enqByDay.set(localDay(c.created_at as string), (enqByDay.get(localDay(c.created_at as string)) ?? 0) + 1);
  const bookedByDay = new Map<string, number>();
  for (const a of demandAppts.data ?? []) bookedByDay.set(localDay(a.created_at as string), (bookedByDay.get(localDay(a.created_at as string)) ?? 0) + 1);
  const demand: DemandPoint[] = days.map((d) => ({
    label: fmtDate(`${d}T12:00:00Z`, { day: "numeric", month: "short" }),
    enquiries: enqByDay.get(d) ?? 0,
    booked: bookedByDay.get(d) ?? 0,
  }));
  const totalEnquiries = demand.reduce((s, d) => s + d.enquiries, 0);

  // --- Sources & busiest hours --------------------------------------------------------------------
  const sourceCounts = new Map<string, number>();
  for (const r of sourceRows.data ?? []) sourceCounts.set((r.source as string) || "other", (sourceCounts.get((r.source as string) || "other") ?? 0) + 1);
  const sources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const maxSource = Math.max(1, ...sources.map(([, n]) => n));

  const hours = Array.from({ length: 24 }, () => 0);
  for (const m of hourRows.data ?? []) hours[localHour(m.created_at as string)]!++;
  const firstHour = Math.min(8, ...hours.map((n, h) => (n ? h : 24)));
  const lastHour = Math.max(22, ...hours.map((n, h) => (n ? h : -1)));
  const shownHours = hours.slice(firstHour, lastHour + 1).map((n, i) => ({ hour: firstHour + i, n }));
  const maxHour = Math.max(1, ...shownHours.map((h) => h.n));
  const peak = shownHours.reduce((a, b) => (b.n > a.n ? b : a), shownHours[0] ?? { hour: 0, n: 0 });
  const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;

  // --- Live activity ------------------------------------------------------------------------------
  const activity: ActivityItem[] = [];
  for (const m of recentMessages.data ?? []) {
    const conv = one(m.conversation as Rel<{ id: string; channel: Channel; patient: Rel<{ name: string }> }>);
    const name = one(conv?.patient ?? null)?.name ?? "A patient";
    const channel = conv ? CHANNEL_LABEL[conv.channel] : "";
    const href = conv ? `/crm/inbox?c=${conv.id}` : undefined;
    const body = String(m.body ?? "").replace(/\s+/g, " ").trim();
    const short = body.length > 70 ? `${body.slice(0, 70)}…` : body;
    if (m.sender === "patient") activity.push({ id: m.id, kind: "message", text: `New message on ${channel} from ${name}: “${short}”`, at: m.created_at, href });
    else if (m.sender === "ai") activity.push({ id: m.id, kind: "ai", text: `AI replied to ${name} on ${channel}`, at: m.created_at, href });
    else if (m.sender === "automation") activity.push({ id: m.id, kind: "automation", text: `Automatic WhatsApp sent to ${name}`, at: m.created_at, href });
    else if (body.startsWith("Appointment booked by AI")) activity.push({ id: m.id, kind: "ai_booking", text: `AI booked ${name} · ${body.replace("Appointment booked by AI: ", "")}`, at: m.created_at, href });
  }
  for (const a of recentAppts.data ?? []) {
    const name = one(a.patient as Rel<{ name: string }>)?.name ?? "A patient";
    const svc = one(a.service as Rel<{ name: string }>)?.name ?? "Consultation";
    const when = `${fmtDate(a.starts_at as string, { weekday: "short", day: "numeric", month: "short" })}`;
    activity.push({ id: `a-${a.id}`, kind: "booking", text: `${name} booked · ${svc} · ${when}`, at: a.created_at as string, href: "/crm/appointments" });
  }
  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const kpis = [
    { label: "Appointments today", value: String(live.length), hint: `${done} done · ${noShow} no-show`, href: "/crm/appointments" },
    {
      label: "New enquiries today",
      value: String(enqToday),
      hint: enqDelta === null ? "No data for last week yet" : `vs same day last week`,
      delta: enqDelta,
      href: "/crm/inbox",
    },
    {
      label: "Avg AI reply time",
      value: avgReply != null ? String(Math.round(avgReply)) : "–",
      unit: avgReply != null ? "sec" : undefined,
      hint: clinic.data?.ai_enabled ? "24/7, including Sundays" : "AI receptionist is off",
      href: "/crm/settings#ai",
    },
    { label: "Enquiry → booking", value: String(conversion), unit: "%", hint: `${booked} of ${newPatients.length} new leads this month`, href: "/crm/pipeline" },
    { label: "Needs a reply", value: String(needsReply.count ?? 0), hint: "Unread or handed over by AI", href: "/crm/inbox" },
  ];

  const journey = [
    { label: "New enquiries", n: newPatients.length },
    { label: "Booked an appointment", n: booked },
    { label: "Visited the clinic", n: visited },
  ];

  return (
    <>
      <PageHeader title="Growth Center" subtitle={fmtDate(`${today}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long" })} />
      <div className="space-y-6 p-4 sm:p-6">
        {/* Growth report */}
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#111d3d_0%,#1c3267_55%,#2145a3_100%)] p-6 text-white shadow-soft sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[1fr_1.35fr] xl:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-300">Growth report · {monthName}</p>
              <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
                Your team handled {activeConvs.count?.toLocaleString("en-PK") ?? 0} patient conversations this month
              </h2>
              <p className="mt-2 max-w-md text-sm text-brand-100/80">
                WhatsApp, Instagram, Facebook, TikTok, Google, website chat and phone, in one place.
                {aiConversations > 0 ? ` The AI receptionist answered ${aiConversations.toLocaleString("en-PK")} of them.` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <HeroStat value={`Rs ${compact(aiRevenue)}`} label="Booked by AI (service value)" accent />
              <HeroStat value={aiConversations.toLocaleString("en-PK")} label="Chats answered by AI" />
              <HeroStat value={String(aiBooked.length)} label="Appointments booked by AI" />
              <HeroStat value={String(hoursSaved)} unit="hrs" label={`Front-desk time saved (est. ${MINUTES_SAVED_PER_AI_REPLY} min/reply)`} />
            </div>
          </div>
        </section>

        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="card group p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
              <p className="text-sm text-slate-500">{k.label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-ink">
                {k.value}
                {k.unit && <span className="ml-0.5 text-base font-semibold text-slate-500">{k.unit}</span>}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                {"delta" in k && k.delta != null && (
                  <span
                    className={cn(
                      "inline-flex items-center font-semibold",
                      k.delta > 0 ? "text-emerald-600" : k.delta < 0 ? "text-rose-600" : "text-slate-500",
                    )}
                  >
                    {k.delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : k.delta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    {Math.abs(k.delta)}%
                  </span>
                )}
                {k.hint}
              </p>
            </Link>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink">Patient demand, last 30 days</h2>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{totalEnquiries} enquiries</span>
            </div>
            <div className="p-4">
              <DemandChart data={demand} />
            </div>
          </section>

          <section className="card flex max-h-[420px] flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink">Live activity</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LiveActivity items={activity.slice(0, 10)} />
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card p-5">
            <h2 className="font-display text-base font-bold text-ink">Patient journey this month</h2>
            <ul className="mt-4 space-y-4">
              {journey.map((j) => {
                const pct = newPatients.length ? Math.round((j.n / newPatients.length) * 100) : 0;
                return (
                  <li key={j.label} title={`${j.n} patients (${pct}%)`}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{j.label}</span>
                      <span className="font-semibold text-ink">
                        {j.n} <span className="font-normal text-slate-400">· {pct}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
                      <div className="h-2.5 rounded-full bg-[#2558c9]" style={{ width: `${Math.max(pct, j.n ? 2 : 0)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-slate-500">{lost} lost this month. Nurturing and Lost are moved automatically in the pipeline.</p>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-base font-bold text-ink">Where patients come from</h2>
            <p className="text-xs text-slate-500">New leads, last 30 days</p>
            <ul className="mt-4 space-y-3">
              {sources.length === 0 && <li className="text-sm text-slate-500">No leads yet.</li>}
              {sources.map(([source, n]) => (
                <li key={source} title={`${n} leads`}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{sourceLabel(source)}</span>
                    <span className="font-semibold text-ink">{n}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-[#2558c9]" style={{ width: `${(n / maxSource) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-base font-bold text-ink">Busiest hours</h2>
            <p className="text-xs text-slate-500">
              Patient messages by hour, last 30 days{peak.n ? ` · busiest at ${hourLabel(peak.hour)}` : ""}
            </p>
            <div className="mt-5 flex h-36 items-end gap-[2px]" role="img" aria-label="Patient messages by hour of day">
              {shownHours.map((h) => (
                <div key={h.hour} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t-[4px]", h.hour === peak.hour && peak.n ? "bg-[#2558c9]" : "bg-[#2558c9]/45")}
                    style={{ height: `${Math.max(2, (h.n / maxHour) * 100)}%` }}
                  />
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {hourLabel(h.hour)}: {h.n}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>{hourLabel(firstHour)}</span>
              <span>{hourLabel(Math.round((firstHour + lastHour) / 2))}</span>
              <span>{hourLabel(lastHour)}</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function HeroStat({ value, unit, label, accent }: { value: string; unit?: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur transition hover:bg-white/10">
      <p className={cn("font-display text-2xl font-bold", accent ? "text-amber-300" : "text-white")}>
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-white/60">{unit}</span>}
      </p>
      <p className="mt-1 text-xs leading-snug text-brand-100/70">{label}</p>
    </div>
  );
}
