import { ArrowDown, ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/crm/PageHeader";
import { AiSection, type AiClinicSettings } from "@/components/crm/settings/AiSection";
import { ChannelsSection, type ConnectionRow } from "@/components/crm/settings/ChannelsSection";
import { aiModelLabel } from "@/lib/ai/provider";
import { addStage, deleteStage, moveStage, updateClinic, updateStage } from "./actions";
import { AUTO_STAGE_RULE, type AutoStageKey } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; ok?: string; error?: string }>;
}) {
  const { saved, ok, error } = await searchParams;
  const supabase = await createClient();
  const [{ data: clinic }, { data: stages }, { data: me }] = await Promise.all([
    supabase
      .from("clinics")
      .select(
        "id, name, phone, email, address, ai_enabled, ai_instructions, opening_time, closing_time, slot_minutes, closed_weekdays, nurture_after_days, lost_after_days",
      )
      .limit(1)
      .maybeSingle(),
    supabase.from("pipeline_stages").select("id, name, color, position, is_side, auto_key").order("position"),
    supabase.auth.getUser().then(async ({ data }) =>
      data.user ? supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle() : { data: null },
    ),
  ]);
  const isAdmin = me?.role === "admin";

  // Channel connections hold secret tokens: read them with the service role and never select access_token here.
  const { data: rows } = clinic
    ? await createAdminClient()
        .from("channel_connections")
        .select("id, channel, kind, label, account_id, enabled")
        .eq("clinic_id", clinic.id)
        .order("created_at")
    : { data: [] };
  const connections = (rows ?? []) as ConnectionRow[];
  const envNumber = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (envNumber && process.env.WHATSAPP_ACCESS_TOKEN && !connections.some((c) => c.channel === "whatsapp" && c.account_id === envNumber)) {
    connections.unshift({ id: null, channel: "whatsapp", kind: "messaging", label: "WhatsApp", account_id: envNumber, enabled: true });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://your-crm-domain.com").replace(/\/+$/, "");
  const webhookReady = Boolean(process.env.META_APP_SECRET && process.env.META_WEBHOOK_VERIFY_TOKEN);

  return (
    <>
      <PageHeader title="Settings" subtitle={isAdmin ? "You are an admin." : "Only admins can change these settings."} />
      <div className="space-y-6 p-6">
        {saved && <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">Saved.</p>}
        {ok && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{ok}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

        {clinic && <AiSection clinic={clinic as unknown as AiClinicSettings} isAdmin={isAdmin} modelLabel={aiModelLabel()} />}

        <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <section className="card p-5">
            <h2 className="font-display text-base font-bold">Clinic profile</h2>
            <form action={updateClinic} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="name" defaultValue={clinic?.name ?? ""} placeholder="Clinic name" className="crm-input sm:col-span-2" required />
              <input name="phone" defaultValue={clinic?.phone ?? ""} placeholder="Phone" className="crm-input" />
              <input name="email" defaultValue={clinic?.email ?? ""} placeholder="Email" className="crm-input" />
              <input name="address" defaultValue={clinic?.address ?? ""} placeholder="Address" className="crm-input sm:col-span-2" />
              <button className="crm-btn sm:col-span-2" disabled={!isAdmin}>
                Save clinic
              </button>
            </form>
          </section>

          <ChannelsSection connections={connections} isAdmin={isAdmin} siteUrl={siteUrl} webhookReady={webhookReady} />
        </div>

        <section id="stages" className="card p-5">
          <h2 className="font-display text-base font-bold">Pipeline stages</h2>
          <p className="mt-1 text-sm text-slate-500">
            Rename, recolour, reorder or add stages. Stages marked <Sparkles className="inline h-3.5 w-3.5 text-brand-500" /> are filled
            automatically; deleting one turns that automatic step off.
          </p>
          <ul className="mt-4 divide-y divide-slate-100">
            {(stages ?? []).map((s, i, arr) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
                <form action={updateStage.bind(null, s.id)} className="flex flex-1 items-center gap-2">
                  <input type="color" name="color" defaultValue={s.color} className="h-9 w-9 cursor-pointer rounded border border-slate-200" disabled={!isAdmin} />
                  <input name="name" defaultValue={s.name} className="crm-input max-w-xs" disabled={!isAdmin} />
                  {s.is_side && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Side</span>}
                  {s.auto_key && (
                    <span className="hidden items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 md:inline-flex">
                      <Sparkles className="h-3 w-3" /> {AUTO_STAGE_RULE[s.auto_key as AutoStageKey]}
                    </span>
                  )}
                  <button className="crm-btn-outline" disabled={!isAdmin}>
                    Save
                  </button>
                </form>
                <form action={moveStage.bind(null, s.id, "up")}>
                  <button className="crm-btn-outline px-2.5" disabled={!isAdmin || i === 0} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </form>
                <form action={moveStage.bind(null, s.id, "down")}>
                  <button className="crm-btn-outline px-2.5" disabled={!isAdmin || i === arr.length - 1} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </form>
                <form action={deleteStage.bind(null, s.id)}>
                  <button className="crm-btn-outline px-2.5 hover:border-red-300 hover:text-red-600" disabled={!isAdmin} aria-label="Delete stage">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addStage} className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <input type="color" name="color" defaultValue="#3573e8" className="h-9 w-9 cursor-pointer rounded border border-slate-200" />
            <input name="name" placeholder="New stage name" className="crm-input max-w-xs" required />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="is_side" /> Side stage
            </label>
            <button className="crm-btn" disabled={!isAdmin}>
              Add stage
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
