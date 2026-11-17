import "server-only";
import crypto from "node:crypto";

/**
 * Checks Meta's X-Hub-Signature-256 header against the raw request body.
 * Instagram API with Instagram Login signs with the Instagram app secret, so both secrets are accepted.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  const secrets = [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(Boolean) as string[];
  return secrets.some((secret) => {
    const expected = Buffer.from(crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"), "hex");
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  });
}

/** Webhook verification handshake shared by the WhatsApp and Messenger/Instagram webhooks. */
export function verifyChallenge(params: URLSearchParams) {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  return mode === "subscribe" && expected && token === expected && challenge ? challenge : null;
}

/** Turns any incoming WhatsApp message type into a readable line for the inbox. */
export function describeIncoming(msg: {
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { filename?: string };
  location?: { name?: string; address?: string };
}) {
  switch (msg.type) {
    case "text":
      return msg.text?.body ?? "";
    case "button":
      return msg.button?.text ?? "[button]";
    case "interactive":
      return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "[reply]";
    case "image":
      return msg.image?.caption ? `📷 ${msg.image.caption}` : "📷 Photo";
    case "video":
      return msg.video?.caption ? `🎥 ${msg.video.caption}` : "🎥 Video";
    case "audio":
      return "🎤 Voice message";
    case "document":
      return `📄 ${msg.document?.filename ?? "Document"}`;
    case "location":
      return `📍 ${msg.location?.name ?? msg.location?.address ?? "Location"}`;
    case "sticker":
      return "Sticker";
    default:
      return `[${msg.type}]`;
  }
}
