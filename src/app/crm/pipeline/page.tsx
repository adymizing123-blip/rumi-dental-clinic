import Link from "next/link";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/crm/PageHeader";
import { PipelineBoard, type Lead } from "@/components/crm/PipelineBoard";
import { fmtDate } from "@/lib/utils";
import type { Channel, Stage } from "@/types/db";

export const dynamic = "force-dynamic";

type Row = Omit<Lead, "channel" | "sourceTag" | "lastActivity" | "conversationId"> & {
  conversations: { id: string; channel: Channel; source_tag: string | null; last_message_at: string }[] | null;
};

export default async function PipelinePage() {
  const supabase = await createClient();
  const [{ data: stages }, { data: rows }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, color, position, is_side, auto_key").order("position"),
    supabase
      .from("patients")
      .select(
        "id, name, phone, source, stage_id, interest, expected_value, lead_score, created_at, conversations(id, channel, source_tag, last_message_at)",
      )
      .is("deleted_at", null)
      .not("stage_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1000),
  ]);

  // Each card shows the patient's most recent conversation (channel, ad source, last activity).
  const leads: Lead[] = ((rows ?? []) as unknown as Row[]).map(({ conversations, ...p }) => {
    const latest = [...(conversations ?? [])].sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at))[0];
    return {
      ...p,
      channel: latest?.channel ?? null,
      sourceTag: latest?.source_tag ?? null,
      lastActivity: latest?.last_message_at ?? p.created_at,
      conversationId: latest?.id ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Leads Pipeline"
        subtitle={fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <Link href="/crm/settings#stages" className="crm-btn-outline">
            <Settings className="h-4 w-4" /> Edit stages
          </Link>
        }
      />
      <PipelineBoard stages={(stages ?? []) as Stage[]} leads={leads} />
    </>
  );
}
