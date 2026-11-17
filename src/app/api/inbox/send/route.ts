import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReply, ChannelError, sendText } from "@/lib/channels";
import { WINDOWED_CHANNELS, type Channel } from "@/types/db";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
// When a person replies, the AI steps back on that chat (staff can switch it on again).
const PAUSE_AI_ON_STAFF_REPLY = process.env.AI_PAUSE_ON_STAFF_REPLY !== "false";

/** Staff reply from the inbox. Sends through the conversation's channel, then stores it. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { conversationId, body } = (await request.json().catch(() => ({}))) as { conversationId?: string; body?: string };
  const text = (body ?? "").trim();
  if (!conversationId || !text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  if (text.length > 4096) return NextResponse.json({ error: "Message is too long" }, { status: 400 });

  // RLS guarantees the conversation belongs to this user's clinic.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, channel, external_id, channel_account_id, last_patient_message_at, ai_receptionist")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  let externalId: string | null = null;
  const delivered = canReply(conv);

  if (delivered) {
    if (WINDOWED_CHANNELS.includes(conv.channel as Channel)) {
      const last = conv.last_patient_message_at ? new Date(conv.last_patient_message_at).getTime() : 0;
      if (Date.now() - last > DAY_MS) {
        return NextResponse.json(
          { error: "More than 24 hours since the patient's last message. Meta only allows an approved template now." },
          { status: 409 },
        );
      }
    }
    try {
      // Tokens live in channel_connections, which only the service role can read.
      externalId = (await sendText(createAdminClient(), conv, text)).externalId;
    } catch (err) {
      const msg = err instanceof ChannelError ? err.message : "Could not send the message";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }
  // Lead forms, logged calls and booking-form enquiries: saved as a note (reply by call or WhatsApp).

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      sender: "staff",
      body: text,
      external_id: externalId,
      status: delivered ? "sent" : null,
      sent_by: user.id,
    })
    .select("id, conversation_id, sender, body, status, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const aiPaused = delivered && PAUSE_AI_ON_STAFF_REPLY && Boolean(conv.ai_receptionist);
  await supabase
    .from("conversations")
    .update({ needs_human: false, ...(aiPaused ? { ai_receptionist: false } : {}) })
    .eq("id", conv.id);

  return NextResponse.json({ message, aiPaused, delivered });
}
