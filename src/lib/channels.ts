import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isReplyable, LIVE_CHAT_PREFIX, type Channel } from "@/types/db";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const FB_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;

export type Connection = {
  id: string | null; // null = taken from .env
  channel: Channel;
  kind: "messaging" | "leads";
  label: string | null;
  account_id: string;
  access_token: string | null;
  enabled: boolean;
};

/** Max text length each platform accepts in one message. */
export const MAX_TEXT: Partial<Record<Channel, number>> = { whatsapp: 4096, facebook: 2000, instagram: 1000, website: 2000 };

export class ChannelError extends Error {}

/** The WhatsApp number from .env still works, so existing setups keep running. */
function envWhatsApp(): Connection | null {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!id || !token) return null;
  return { id: null, channel: "whatsapp", kind: "messaging", label: "WhatsApp (.env)", account_id: id, access_token: token, enabled: true };
}

/** Enabled connections for a channel (service-role client only: tokens are secret). */
export async function listConnections(db: SupabaseClient, channel?: Channel): Promise<Connection[]> {
  let q = db.from("channel_connections").select("id, channel, kind, label, account_id, access_token, enabled").eq("enabled", true);
  if (channel) q = q.eq("channel", channel);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Connection[];
  const env = envWhatsApp();
  if (env && (!channel || channel === "whatsapp") && !rows.some((r) => r.channel === "whatsapp" && r.account_id === env.account_id)) {
    rows.push(env);
  }
  return rows;
}

export async function findConnection(db: SupabaseClient, channel: Channel, accountId?: string | null) {
  const list = (await listConnections(db, channel)).filter((c) => c.kind === "messaging");
  return (accountId ? list.find((c) => c.account_id === accountId) : undefined) ?? list[0] ?? null;
}

type SendTarget = { channel: Channel; external_id: string | null; channel_account_id?: string | null };

export function isLiveChat(conv: { channel: Channel; external_id: string | null }) {
  return conv.channel === "website" && Boolean(conv.external_id?.startsWith(LIVE_CHAT_PREFIX));
}

/** Conversations the CRM (and the AI) can actually reply to. Others (lead forms, logged calls) are leads to call back. */
export const canReply = (conv: SendTarget) => isReplyable(conv);

/** Sends a text reply through the conversation's channel. Returns the platform message id, if any. */
export async function sendText(db: SupabaseClient, conv: SendTarget, text: string): Promise<{ externalId: string | null }> {
  const max = MAX_TEXT[conv.channel];
  if (max && text.length > max) throw new ChannelError(`Message is too long for ${conv.channel} (max ${max} characters).`);

  if (isLiveChat(conv)) return { externalId: null }; // the website widget picks it up

  if (!conv.external_id) throw new ChannelError("This conversation has no recipient id.");
  if (!canReply(conv)) throw new ChannelError("Replies for this channel are not sent from the CRM. Call or WhatsApp the patient.");

  const conn = await findConnection(db, conv.channel, conv.channel_account_id);
  if (!conn?.access_token) throw new ChannelError(`${conv.channel} is not connected. Add it in Settings → Channels.`);

  if (conv.channel === "whatsapp") {
    const json = await graphPost(`${FB_GRAPH}/${conn.account_id}/messages`, conn.access_token, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: conv.external_id,
      type: "text",
      text: { preview_url: false, body: text },
    });
    return { externalId: (json.messages as { id: string }[] | undefined)?.[0]?.id ?? null };
  }

  // Messenger and Instagram use the Send API. Instagram tokens from "Instagram Login" start with "IG"
  // and go to graph.instagram.com; Page tokens (EAA...) go to graph.facebook.com.
  const base = conv.channel === "instagram" && conn.access_token.startsWith("IG") ? IG_GRAPH : FB_GRAPH;
  const body: Record<string, unknown> = { recipient: { id: conv.external_id }, message: { text } };
  if (conv.channel === "facebook") body.messaging_type = "RESPONSE";
  const json = await graphPost(`${base}/me/messages`, conn.access_token, body);
  return { externalId: (json.message_id as string | undefined) ?? null };
}

/**
 * Sends an approved WhatsApp template (needed outside the 24-hour window, e.g. reminders and doctor alerts).
 * Template variables may not contain new lines, tabs or more than 4 spaces in a row.
 */
export async function sendWhatsAppTemplate(db: SupabaseClient, to: string, name: string, lang: string, params: string[]) {
  const conn = await findConnection(db, "whatsapp");
  if (!conn?.access_token) throw new ChannelError("WhatsApp is not connected. Add it in Settings → Channels.");
  const clean = (t: string) => t.replace(/[\n\t]+/g, " · ").replace(/ {4,}/g, "   ").trim().slice(0, 1000) || "-";
  const json = await graphPost(`${FB_GRAPH}/${conn.account_id}/messages`, conn.access_token, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: lang || "en" },
      components: params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: clean(p) })) }] : [],
    },
  });
  return { externalId: (json.messages as { id: string }[] | undefined)?.[0]?.id ?? null };
}

async function graphPost(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new ChannelError(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

/** Best-effort profile name for a Messenger / Instagram sender. */
export async function fetchMetaProfileName(conn: Connection, userId: string): Promise<string | null> {
  if (!conn.access_token) return null;
  const ig = conn.channel === "instagram";
  const base = ig && conn.access_token.startsWith("IG") ? IG_GRAPH : FB_GRAPH;
  const fields = ig ? "name,username" : "first_name,last_name";
  try {
    const res = await fetch(`${base}/${encodeURIComponent(userId)}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${conn.access_token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const p = (await res.json()) as { name?: string; username?: string; first_name?: string; last_name?: string };
    const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
    return p.name || full || (p.username ? `@${p.username}` : null);
  } catch {
    return null;
  }
}

/** Reads a Facebook/Instagram Lead Ads submission (needs the leads_retrieval permission on the Page token). */
export async function fetchLeadgen(token: string, leadgenId: string) {
  const res = await fetch(`${FB_GRAPH}/${encodeURIComponent(leadgenId)}?fields=field_data,form_id,ad_name,campaign_name`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    field_data?: { name: string; values: string[] }[];
    ad_name?: string;
    campaign_name?: string;
    error?: { message?: string };
  };
  if (!res.ok) throw new ChannelError(json.error?.message || `Lead fetch failed ${res.status}`);
  return json;
}
