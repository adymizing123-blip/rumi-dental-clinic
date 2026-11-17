import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/crm/PageHeader";
import { createPatient } from "./actions";
import { fmtDate, formatPKR, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SOURCES = ["walk_in", "whatsapp", "instagram", "facebook", "website", "google", "referral", "phone"];

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const { q, error } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("patients")
    .select("id, name, phone, source, interest, expected_value, created_at, stage:pipeline_stages(name, color)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) {
    // Escape characters that have meaning inside PostgREST filters.
    const safe = q.replace(/[%,()]/g, " ").trim();
    query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe.replace(/\D/g, "") || safe}%`);
  }
  const { data: patients } = await query;

  return (
    <>
      <PageHeader title="Patients" subtitle="Every patient and lead, from every channel." />
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          <form className="border-b border-slate-100 p-4">
            <label className="relative block max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} placeholder="Search by name or phone" className="crm-input pl-9" />
            </label>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Interest</th>
                  <th className="px-4 py-3 font-semibold">Value</th>
                  <th className="px-4 py-3 font-semibold">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(patients ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No patients found.
                    </td>
                  </tr>
                )}
                {(patients ?? []).map((p) => {
                  const stage = (Array.isArray(p.stage) ? p.stage[0] : p.stage) as { name: string; color: string } | null;
                  return (
                    <tr key={p.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/crm/patients/${p.id}`} className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                            {initials(p.name)}
                          </span>
                          <span>
                            <span className="block font-semibold text-ink">{p.name}</span>
                            <span className="text-xs text-slate-500">{p.phone ? `+${p.phone}` : "No phone"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {stage ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                            {stage.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{String(p.source ?? "").replace("_", " ")}</td>
                      <td className="px-4 py-3 text-slate-600">{p.interest ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatPKR(p.expected_value)}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card h-fit p-5">
          <h2 className="font-display text-base font-bold">Add patient</h2>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
          <form action={createPatient} className="mt-4 space-y-3">
            <input name="name" required placeholder="Full name" className="crm-input" />
            <input name="phone" placeholder="Mobile (03xx xxxxxxx)" className="crm-input" />
            <select name="source" className="crm-input" defaultValue="walk_in">
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <input name="interest" placeholder="Interested in (e.g. braces)" className="crm-input" />
            <button className="crm-btn w-full">Add patient</button>
          </form>
        </section>
      </div>
    </>
  );
}
