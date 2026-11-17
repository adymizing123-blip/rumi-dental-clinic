import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient, getClinicId } from "@/lib/supabase/admin";
import { verifyChallenge, verifyMetaSignature } from "@/lib/whatsapp";
import { fetchLeadgen, fetchMetaProfileName, listConnections, type Connection } from "@/lib/channels";
import { addPatientMessage, resolveContact } from "@/lib/inbox-store";
import { autoReply } from "@/lib/ai/receptionist";
import { normalisePhone } from "@/lib/utils";
import type { Channel } from "@/types/db";

/**
 * Facebook Messenger + Instagram DMs + Facebook/Instagram Lead Ads.
 * In the Meta app, point BOTH the Messenger webhook and the Instagram webhook to /api/webhooks/meta
 * (same verify token as WhatsApp). Subscribe: messages, messaging_postbacks (and leadgen for lead forms).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const challenge = verifyChallenge(request.nextUrl.searchParams);
  return challenge
    ? new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
    : new NextResponse("Forbidden", { status: 403 });
}

type MessagingEvent = {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type?: string }[];
    referral?: { source?: string };
  };
  postback?: { title?: string; payload?: string };
  referral?: { source?: string };
};

type MetaEntry = {
  id: string; // Page id (object "page") or Instagram account id (object "instagram")
  messaging?: MessagingEvent[];
  changes?: { field: string; value: { leadgen_id?: string; form_id?: string } }[];
};

const ATTACHMENT_LABEL: Record<string, string> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎤 Voice message",
  file: "📄 File",
  story_mention: "Mentioned you in a story",
  share: "Shared a post",
  ig_reel: "Shared a reel",
};

function describe(event: MessagingEvent) {
  if (event.message?.text) return event.message.text;
  const att = event.message?.attachments?.[0]?.type;
  if (att) return ATTACHMENT_LABEL[att] ?? `[${att}]`;
  if (event.postback?.title) return event.postback.title;
  return null;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: { object?: string; entry?: MetaEntry[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  const channel: Channel | null = payload.object === "instagram" ? "instagram" : payload.object === "page" ? "facebook" : null;
  if (!channel) return new NextResponse("Ignored", { status: 200 });

  try {
    const db = createAdminClient();
    const clinicId = await getClinicId();
    const connections = new Map((await listConnections(db, channel)).map((c) => [c.account_id, c]));
    const latest = new Map<string, string>(); // conversationId -> newest messageId

    for (const entry of payload.entry ?? []) {
      const conn = connections.get(entry.id);
      if (!conn) continue; // not one of this clinic's Pages / Instagram accounts

      for (const event of entry.messaging ?? []) {
        const senderId = event.sender?.id;
        if (!senderId || senderId === entry.id || event.message?.is_echo) continue; // our own outgoing messages
        const body = describe(event);
        if (!body) continue; // reads, reactions, edits

        const fromAd = event.referral?.source === "ADS" || event.message?.referral?.source === "ADS";
        const contact = await resolveContact(db, clinicId, {
          channel,
          externalId: senderId,
          name: channel === "instagram" ? "Instagram user" : "Facebook user",
          source: channel,
          sourceTag: fromAd ? `${channel === "instagram" ? "Instagram" : "Facebook"} ad` : null,
          accountId: entry.id,
        });
        if (contact.created) await nameNewPatient(db, conn, senderId, contact.patientId);

        const messageId = await addPatientMessage(db, clinicId, contact.conversationId, {
          body,
          externalId: event.message?.mid ?? null,
          createdAt: event.timestamp ? new Date(event.timestamp).toISOString() : undefined,
        });
        if (messageId) latest.set(contact.conversationId, messageId);
      }

      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen" && change.value.leadgen_id) {
          await saveLeadAd(db, clinicId, conn, change.value.leadgen_id);
        }
      }
    }

    if (latest.size) {
      after(() =>
        Promise.all([...latest].map(([c, m]) => autoReply(c, m).catch((e) => console.error("autoReply", e)))).then(() => undefined),
      );
    }
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    console.error("Meta webhook failed", err);
    return new NextResponse("Error", { status: 500 });
  }
}

async function nameNewPatient(db: ReturnType<typeof createAdminClient>, conn: Connection, senderId: string, patientId: string) {
  const name = await fetchMetaProfileName(conn, senderId);
  if (name) await db.from("patients").update({ name }).eq("id", patientId);
}

/** Facebook / Instagram Lead Ads form → new lead in the inbox (cannot be replied to by DM; call or WhatsApp them). */
async function saveLeadAd(db: ReturnType<typeof createAdminClient>, clinicId: string, conn: Connection, leadgenId: string) {
  if (!conn.access_token) return;
  const lead = await fetchLeadgen(conn.access_token, leadgenId);
  const fields = new Map((lead.field_data ?? []).map((f) => [f.name.toLowerCase(), (f.values ?? []).join(", ")]));
  const name =
    fields.get("full_name") || [fields.get("first_name"), fields.get("last_name")].filter(Boolean).join(" ") || "Lead form";
  const phoneRaw = fields.get("phone_number") || fields.get("phone") || "";
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  const email = fields.get("email") || null;
  const answers = [...fields]
    .filter(([k]) => !["full_name", "first_name", "last_name", "phone_number", "phone", "email"].includes(k))
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);

  const contact = await resolveContact(db, clinicId, {
    channel: "facebook",
    externalId: `lead:${leadgenId}`,
    name,
    phone: phone && phone.length >= 11 ? phone : null,
    email,
    source: "facebook",
    sourceTag: "Lead form",
    accountId: conn.account_id,
  });
  await addPatientMessage(db, clinicId, contact.conversationId, {
    body: [`New lead form${lead.campaign_name ? ` (${lead.campaign_name})` : ""}`, phoneRaw && `Phone: ${phoneRaw}`, email && `Email: ${email}`, ...answers]
      .filter(Boolean)
      .join("\n"),
    externalId: `leadgen:${leadgenId}`,
  });
}
