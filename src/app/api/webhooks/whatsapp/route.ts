import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient, getClinicId } from "@/lib/supabase/admin";
import { describeIncoming, verifyChallenge, verifyMetaSignature } from "@/lib/whatsapp";
import { listConnections } from "@/lib/channels";
import { addPatientMessage, resolveContact } from "@/lib/inbox-store";
import { autoReply } from "@/lib/ai/receptionist";

// Meta must always reach the latest code; never cache this route.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // room for the AI reply that runs after the response

/** Step 1: Meta verifies the webhook once ("Verify and save" in the App Dashboard). */
export async function GET(request: NextRequest) {
  const challenge = verifyChallenge(request.nextUrl.searchParams);
  return challenge
    ? new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
    : new NextResponse("Forbidden", { status: 403 });
}

type WaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  referral?: { source_type?: string; source_url?: string; headline?: string };
  [key: string]: unknown;
};

type WaChange = {
  field: string;
  value: {
    metadata?: { phone_number_id?: string };
    contacts?: { wa_id: string; profile?: { name?: string } }[];
    messages?: WaMessage[];
    statuses?: { id: string; status: string }[];
  };
};

function adTag(referral: WaMessage["referral"]) {
  if (!referral) return null;
  const url = referral.source_url ?? "";
  if (url.includes("instagram")) return "Instagram ad";
  if (url.includes("facebook") || url.includes("fb.")) return "Facebook ad";
  return referral.source_type === "ad" ? "Ad" : "Referral";
}

/** Step 2: every incoming message and delivery status arrives here. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: { entry?: { changes?: WaChange[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  try {
    const db = createAdminClient();
    const clinicId = await getClinicId();
    // Numbers this clinic owns (Settings → Channels, or .env). Events for other numbers on the same Meta app are ignored.
    const ours = new Set((await listConnections(db, "whatsapp")).map((c) => c.account_id));
    const toReply: { conversationId: string; messageId: string }[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const numberId = value.metadata?.phone_number_id ?? null;
        if (ours.size > 0 && numberId && !ours.has(numberId)) continue;

        const names = new Map((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));

        for (const msg of value.messages ?? []) {
          const { conversationId } = await resolveContact(db, clinicId, {
            channel: "whatsapp",
            externalId: msg.from,
            phone: msg.from,
            name: names.get(msg.from) || `+${msg.from}`,
            source: "whatsapp",
            sourceTag: adTag(msg.referral),
            accountId: numberId,
          });
          const ts = Number(msg.timestamp);
          const messageId = await addPatientMessage(db, clinicId, conversationId, {
            body: describeIncoming(msg as Parameters<typeof describeIncoming>[0]),
            externalId: msg.id,
            createdAt: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : undefined,
          });
          if (messageId) toReply.push({ conversationId, messageId });
        }
        for (const st of value.statuses ?? []) {
          await db.from("messages").update({ status: st.status }).eq("external_id", st.id);
        }
      }
    }

    // Answer Meta first, then let the AI receptionist reply (it only acts if switched on).
    if (toReply.length) {
      // Only the newest message of each chat needs an answer.
      const latest = new Map(toReply.map((j) => [j.conversationId, j.messageId]));
      after(() =>
        Promise.all([...latest].map(([c, m]) => autoReply(c, m).catch((e) => console.error("autoReply", e)))).then(() => undefined),
      );
    }
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    console.error("WhatsApp webhook failed", err);
    // 500 makes Meta retry later; duplicates are ignored thanks to messages.external_id being unique.
    return new NextResponse("Error", { status: 500 });
  }
}
