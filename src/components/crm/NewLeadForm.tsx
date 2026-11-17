"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createManualLead } from "@/app/crm/inbox/actions";
import { CHANNEL_LABEL, type Channel } from "@/types/db";

/** Log a lead that did not arrive by itself: phone call, walk-in enquiry, a TikTok or Google message... */
export function NewLeadForm({ onCreated }: { onCreated: (conversationId: string) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 rounded-xl bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await createManualLead({
            channel: String(fd.get("channel")),
            name: String(fd.get("name") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            note: String(fd.get("note") ?? ""),
          });
          if (res.ok) onCreated(res.conversationId);
          else setError(res.error);
        });
      }}
    >
      <p className="text-xs font-semibold text-slate-700">Log a lead (phone call, TikTok, Google…)</p>
      <select name="channel" defaultValue="phone" className="crm-input">
        {(["phone", "tiktok", "google", "instagram", "facebook", "whatsapp", "website"] as Channel[]).map((ch) => (
          <option key={ch} value={ch}>
            {CHANNEL_LABEL[ch]}
          </option>
        ))}
      </select>
      <input name="name" required placeholder="Patient name" className="crm-input" />
      <input name="phone" inputMode="tel" placeholder="Phone (03xx…)" className="crm-input" />
      <textarea name="note" rows={2} placeholder="What did they ask?" className="crm-input resize-none" />
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <button className="crm-btn w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add lead
      </button>
    </form>
  );
}
