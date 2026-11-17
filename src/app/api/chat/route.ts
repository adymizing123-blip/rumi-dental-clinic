import crypto from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient, getClinicId } from "@/lib/supabase/admin";
import { addPatientMessage, resolveContact } from "@/lib/inbox-store";
import { autoReply } from "@/lib/ai/receptionist";
import { aiConfigured } from "@/lib/ai/provider";
import { normalisePhone } from "@/lib/utils";
import { LIVE_CHAT_PREFIX } from "@/types/db";

/**
 * Website live chat (the chat bubble on the landing page).
 * The visitor gets a random token when the chat starts; that token is the only way to read or write the chat.
 * Messages land in the CRM inbox as "Website chat"; staff and AI replies reach the visitor by polling GET.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT = 1000;
const MAX_MESSAGES_PER_10_MIN = 20;
const PUBLIC_FIELDS = "id, sender, body, created_at";

async function findChat(db: ReturnType<typeof createAdminClient>, token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const clinicId = await getClinicId();
  const { data } = await db
    .from("conversations")
    .select("id, clinic_id, ai_receptionist")
    .eq("clinic_id", clinicId)
    .eq("channel", "website")
    .eq("external_id", `${LIVE_CHAT_PREFIX}${token}`)
    .maybeSingle();
  return data;
}

async function aiWillReply(db: ReturnType<typeof createAdminClient>, clinicId: string, chatAi: boolean) {
  if (!chatAi || !aiConfigured()) return false;
  const { data } = await db.from("clinics").select("ai_enabled").eq("id", clinicId).maybeSingle();
  return Boolean(data?.ai_enabled);
}

/** Poll for new messages: GET /api/chat?token=...&after=ISO */
export async function GET(request: NextRequest) {
  const db = createAdminClient();
  const chat = await findChat(db, request.nextUrl.searchParams.get("token"));
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const afterParam = request.nextUrl.searchParams.get("after");
  let q = db
    .from("messages")
    .select(PUBLIC_FIELDS)
    .eq("conversation_id", chat.id)
    .in("sender", ["patient", "staff", "ai"]) // internal notes never leave the CRM
    .order("created_at", { ascending: true })
    .limit(100);
  if (afterParam && !Number.isNaN(Date.parse(afterParam))) q = q.gt("created_at", new Date(afterParam).toISOString());
  const { data } = await q;

  return NextResponse.json(
    { messages: data ?? [], ai: await aiWillReply(db, chat.clinic_id as string, Boolean(chat.ai_receptionist)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

type Body = { action?: string; token?: string; name?: string; phone?: string; text?: string; company?: string };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const text = String(body.text ?? "").trim().slice(0, MAX_TEXT);
  if (!text) return NextResponse.json({ error: "Please type a message." }, { status: 400 });

  const db = createAdminClient();

  try {
    if (body.action === "start") {
      if (String(body.company ?? "").trim()) return NextResponse.json({ error: "Rejected" }, { status: 400 }); // honeypot
      const name = String(body.name ?? "").trim().slice(0, 80);
      const phone = normalisePhone(String(body.phone ?? ""));
      if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
      if (phone.length < 11 || phone.length > 15) return NextResponse.json({ error: "Please enter a valid mobile number." }, { status: 400 });

      const clinicId = await getClinicId();
      const token = crypto.randomBytes(18).toString("base64url");
      const { conversationId } = await resolveContact(db, clinicId, {
        channel: "website",
        externalId: `${LIVE_CHAT_PREFIX}${token}`,
        name,
        phone,
        source: "website",
        sourceTag: "Website chat",
      });
      const messageId = await addPatientMessage(db, clinicId, conversationId, { body: text });
      if (messageId) after(() => autoReply(conversationId, messageId).catch((e) => console.error("autoReply", e)));
      const { data: messages } = await db.from("messages").select(PUBLIC_FIELDS).eq("conversation_id", conversationId).order("created_at");
      return NextResponse.json({ token, messages: messages ?? [], ai: await aiWillReply(db, clinicId, true) });
    }

    if (body.action === "send") {
      const chat = await findChat(db, body.token);
      if (!chat) return NextResponse.json({ error: "Chat expired. Please start a new chat." }, { status: 404 });

      const { count } = await db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", chat.id)
        .eq("sender", "patient")
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
      if ((count ?? 0) >= MAX_MESSAGES_PER_10_MIN) {
        return NextResponse.json({ error: "Too many messages. Please wait a few minutes." }, { status: 429 });
      }

      const messageId = await addPatientMessage(db, chat.clinic_id as string, chat.id as string, { body: text });
      if (messageId) after(() => autoReply(chat.id as string, messageId).catch((e) => console.error("autoReply", e)));
      const { data: message } = await db.from("messages").select(PUBLIC_FIELDS).eq("id", messageId).maybeSingle();
      return NextResponse.json({ message });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Website chat failed", err);
    return NextResponse.json({ error: "Chat is unavailable right now. Please WhatsApp us instead." }, { status: 500 });
  }
}
