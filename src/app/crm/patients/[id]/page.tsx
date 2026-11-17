import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, MessageCircle, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/crm/PageHeader";
import { ChannelIcon } from "@/components/crm/ChannelIcon";
import { archivePatient, updatePatient } from "../actions";
import { CHANNEL_LABEL, STATUS_LABEL, type AppointmentStatus, type Channel } from "@/types/db";
import { fmtDate, fmtTime, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
  const supabase = await createClient();

  const [{ data: patient }, { data: appts }, { data: convs }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, name, phone, email, source, interest, expected_value, lead_score, notes, created_at, stage:pipeline_stages(name, color)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, status, type, doctor:doctors(name), service:services(name)")
      .eq("patient_id", id)
      .order("starts_at", { ascending: false })
      .limit(50),
    supabase
      .from("conversations")
      .select("id, channel, last_message_text, last_message_at")
      .eq("patient_id", id)
      .order("last_message_at", { ascending: false }),
  ]);

  if (!patient) notFound();
  const stage = (Array.isArray(patient.stage) ? patient.stage[0] : patient.stage) as { name: string; color: string } | null;
  const save = updatePatient.bind(null, patient.id);
  const archive = archivePatient.bind(null, patient.id);

  return (
    <>
      <PageHeader
        title={patient.name}
        subtitle={`${patient.phone ? `+${patient.phone} · ` : ""}Added ${fmtDate(patient.created_at)} · Source: ${String(patient.source).replace("_", " ")}`}
        actions={
          <>
            <Link href={`/crm/appointments?patient=${patient.id}`} className="crm-btn">
              <CalendarPlus className="h-4 w-4" /> Book appointment
            </Link>
            {patient.phone && (
              <>
                <a href={`tel:+${patient.phone}`} className="crm-btn-outline">
                  <Phone className="h-4 w-4" /> Call
                </a>
                <a href={`https://wa.me/${patient.phone}`} target="_blank" rel="noopener noreferrer" className="crm-btn-outline">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card">
            <h2 className="border-b border-slate-100 px-5 py-4 font-display text-base font-bold">Appointments</h2>
            <ul className="divide-y divide-slate-100">
              {(appts ?? []).length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No appointments yet.</li>}
              {(appts ?? []).map((a) => {
                const doctor = (Array.isArray(a.doctor) ? a.doctor[0] : a.doctor) as { name: string } | null;
                const service = (Array.isArray(a.service) ? a.service[0] : a.service) as { name: string } | null;
                return (
                  <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-ink">
                        {fmtDate(a.starts_at)} · {fmtTime(a.starts_at)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {service?.name ?? "Consultation"} · {doctor?.name ?? "Any doctor"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {STATUS_LABEL[a.status as AppointmentStatus]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <h2 className="border-b border-slate-100 px-5 py-4 font-display text-base font-bold">Conversations</h2>
            <ul className="divide-y divide-slate-100">
              {(convs ?? []).length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No chats yet.</li>}
              {(convs ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/crm/inbox?c=${c.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-slate-50">
                    <ChannelIcon channel={c.channel as Channel} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{CHANNEL_LABEL[c.channel as Channel]}</p>
                      <p className="truncate text-xs text-slate-500">{c.last_message_text}</p>
                    </div>
                    <span className="text-xs text-slate-400">{timeAgo(c.last_message_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card h-fit p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Details</h2>
            {stage && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                {stage.name}
              </span>
            )}
          </div>
          {saved && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">Saved.</p>}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
          <form action={save} className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Name</span>
              <input name="name" defaultValue={patient.name} required className="crm-input" />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Email</span>
              <input name="email" type="email" defaultValue={patient.email ?? ""} className="crm-input" />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Interested in</span>
              <input name="interest" defaultValue={patient.interest ?? ""} className="crm-input" />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Expected value (PKR)</span>
              <input name="expected_value" type="number" min={0} defaultValue={patient.expected_value ?? ""} className="crm-input" />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Notes (medical history, allergies…)</span>
              <textarea name="notes" rows={4} defaultValue={patient.notes ?? ""} className="crm-input resize-none" />
            </label>
            <button className="crm-btn w-full">Save changes</button>
          </form>
          <form action={archive} className="mt-3">
            <button className="w-full text-center text-xs font-semibold text-slate-400 transition hover:text-red-600">
              Move to Recycle Bin
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
