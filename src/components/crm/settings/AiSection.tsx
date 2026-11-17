import { CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { updateAiSettings } from "@/app/crm/settings/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type AiClinicSettings = {
  ai_enabled: boolean;
  ai_instructions: string;
  opening_time: string;
  closing_time: string;
  slot_minutes: number;
  closed_weekdays: number[];
  nurture_after_days: number;
  lost_after_days: number;
};

const EXAMPLE = `Payment: cash, card, bank transfer, JazzCash and Easypaisa. Instalments for braces and implants.
Parking: free parking in front of the clinic.
First consultation fee: Rs 1,500 (adjusted if treatment starts the same day).
Do not quote implant prices on chat; the doctor gives a plan after the X-ray.`;

export function AiSection({ clinic, isAdmin, modelLabel }: { clinic: AiClinicSettings; isAdmin: boolean; modelLabel: string | null }) {
  return (
    <section id="ai" className="card scroll-mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Sparkles className="h-4 w-4 text-brand-600" /> AI receptionist
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Answers WhatsApp, Instagram, Facebook and website chats from the facts below, offers free slots and books them. Emergencies,
            complaints and anything it doesn&apos;t know go to your team, and the AI pauses on that chat. Each chat also has its own on/off
            switch in the Inbox, and the AI steps back as soon as a staff member replies.
          </p>
        </div>
        {modelLabel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {modelLabel}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
            <CircleDashed className="h-3.5 w-3.5" /> No AI key yet: add AI_API_KEY to .env.local
          </span>
        )}
      </div>

      <form action={updateAiSettings} className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" name="ai_enabled" defaultChecked={clinic.ai_enabled} className="peer sr-only" disabled={!isAdmin} />
            <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400" />
            <span className="text-sm font-semibold text-ink">AI receptionist replies to patients</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">What else should the AI know?</span>
            <span className="block text-xs text-slate-500">
              Services, prices, doctors, address and timings are added automatically. Add payment methods, offers, parking, and anything it
              must not say.
            </span>
            <textarea
              name="ai_instructions"
              rows={7}
              maxLength={4000}
              defaultValue={clinic.ai_instructions}
              placeholder={EXAMPLE}
              className="crm-input mt-2 resize-y font-normal"
              disabled={!isAdmin}
            />
          </label>
        </div>

        <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">Opening hours (used to offer free slots)</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">
              Opens
              <input type="time" name="opening_time" defaultValue={clinic.opening_time.slice(0, 5)} className="crm-input mt-1" disabled={!isAdmin} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Closes
              <input type="time" name="closing_time" defaultValue={clinic.closing_time.slice(0, 5)} className="crm-input mt-1" disabled={!isAdmin} />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-600">
            Appointment slot length
            <select name="slot_minutes" defaultValue={String(clinic.slot_minutes)} className="crm-input mt-1" disabled={!isAdmin}>
              {[15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-xs font-medium text-slate-600">Closed on</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => (
                <label key={d} className="cursor-pointer">
                  <input type="checkbox" name="closed" value={i} defaultChecked={clinic.closed_weekdays.includes(i)} className="peer sr-only" disabled={!isAdmin} />
                  <span className="block rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition peer-checked:border-rose-300 peer-checked:bg-rose-50 peer-checked:text-rose-700">
                    {d}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-ink">Automatic pipeline timing</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-600">
                Move to Nurturing after (days quiet)
                <input type="number" name="nurture_after_days" min={1} max={60} defaultValue={clinic.nurture_after_days} className="crm-input mt-1" disabled={!isAdmin} />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Move to Lost after (days quiet)
                <input type="number" name="lost_after_days" min={2} max={365} defaultValue={clinic.lost_after_days} className="crm-input mt-1" disabled={!isAdmin} />
              </label>
            </div>
          </div>
        </div>

        <button className="crm-btn lg:col-span-2 lg:justify-self-start" disabled={!isAdmin}>
          Save AI settings
        </button>
      </form>
    </section>
  );
}
