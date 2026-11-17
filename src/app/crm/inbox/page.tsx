import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "@/components/crm/InboxClient";
import { aiConfigured } from "@/lib/ai/provider";
import { CONVERSATION_SELECT, type Conversation, type Patient, type Stage } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const supabase = await createClient();

  const [{ data: convRows }, { data: stages }, { data: clinic }] = await Promise.all([
    supabase.from("conversations").select(CONVERSATION_SELECT).order("last_message_at", { ascending: false }).limit(300),
    supabase.from("pipeline_stages").select("id, name, color, position, is_side").order("position"),
    supabase.from("clinics").select("ai_enabled").limit(1).maybeSingle(),
  ]);

  const conversations: Conversation[] = (convRows ?? []).map((row) => ({
    ...(row as unknown as Conversation),
    patient: (Array.isArray(row.patient) ? row.patient[0] : row.patient) as Patient | null,
  }));

  return (
    <InboxClient
      initialConversations={conversations}
      stages={(stages ?? []) as Stage[]}
      initialActiveId={c ?? null}
      ai={{ configured: aiConfigured(), clinicEnabled: Boolean(clinic?.ai_enabled) }}
    />
  );
}
