export type Channel = "whatsapp" | "instagram" | "facebook" | "tiktok" | "google" | "website" | "phone";
export type Sender = "patient" | "staff" | "ai" | "system" | "automation";
export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "arrived"
  | "in_consultation"
  | "done"
  | "no_show"
  | "cancelled";

export interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  is_side: boolean;
  auto_key?: AutoStageKey | null;
}

/** Pipeline steps the database moves leads into automatically (see 0003_pipeline_automation.sql). */
export type AutoStageKey = "new" | "engaged" | "booked" | "visited" | "nurturing" | "lost";

export const AUTO_STAGE_RULE: Record<AutoStageKey, string> = {
  new: "New message from a new contact",
  engaged: "AI or staff replied",
  booked: "Appointment booked",
  visited: "Appointment marked arrived or done",
  nurturing: "No-show / cancelled, or quiet for a few days",
  lost: "No reply for a long time",
};

export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  stage_id: string | null;
  interest: string | null;
  expected_value: number | null;
  lead_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  patient_id: string;
  channel: Channel;
  external_id: string | null;
  source_tag: string | null;
  last_message_text: string | null;
  last_message_at: string;
  last_patient_message_at: string | null;
  unread_count: number;
  ai_receptionist: boolean;
  ai_summary: string | null;
  ai_summary_at: string | null;
  needs_human: boolean;
  patient?: Patient | null;
}

/** Columns the inbox loads for each conversation (keep in one place so every query matches). */
export const CONVERSATION_SELECT =
  "id, patient_id, channel, external_id, source_tag, last_message_text, last_message_at, last_patient_message_at, unread_count, ai_receptionist, ai_summary, ai_summary_at, needs_human, patient:patients(id, name, phone, email, source, stage_id, interest, expected_value, lead_score, notes, created_at)";

/** Channels where WhatsApp/Meta only allow free-form replies within 24 hours of the patient's last message. */
export const WINDOWED_CHANNELS: Channel[] = ["whatsapp", "instagram", "facebook"];

/** Website live-chat conversations use this external_id prefix; booking-form leads use the phone number. */
export const LIVE_CHAT_PREFIX = "chat:";

/**
 * Can the CRM send a message back on this conversation? (Lead forms and logged calls cannot: call or WhatsApp them.)
 * Real WhatsApp numbers, Messenger PSIDs and Instagram IGSIDs are all digits; lead/manual chats use "lead:"/"manual:" ids.
 */
export function isReplyable(conv: { channel: Channel; external_id: string | null }) {
  if (conv.channel === "website") return Boolean(conv.external_id?.startsWith(LIVE_CHAT_PREFIX));
  const messaging = conv.channel === "whatsapp" || conv.channel === "instagram" || conv.channel === "facebook";
  return messaging && /^\d+$/.test(conv.external_id ?? "");
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: Sender;
  body: string | null;
  status: string | null;
  created_at: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string | null;
}

export interface Service {
  id: string;
  name: string;
  price: number | null;
  duration_min: number;
}

export interface Appointment {
  id: string;
  starts_at: string;
  duration_min: number;
  type: string;
  status: AppointmentStatus;
  notes: string | null;
  patient: Pick<Patient, "id" | "name" | "phone"> | null;
  doctor: Pick<Doctor, "id" | "name"> | null;
  service: Pick<Service, "id" | "name"> | null;
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  google: "Google",
  website: "Website chat",
  phone: "Phone call",
};

/** patients.source values shown as readable labels. */
export const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  google: "Google",
  website: "Website",
  phone: "Phone call",
  phone_call: "Phone call",
  walk_in: "Walk-in",
  referral: "Referral",
};

export const sourceLabel = (source: string | null | undefined) =>
  source ? (SOURCE_LABEL[source] ?? source.replace(/_/g, " ")) : "Unknown";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  arrived: "Arrived",
  in_consultation: "In consultation",
  done: "Done",
  no_show: "No-show",
  cancelled: "Cancelled",
};
