import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "@/types/db";

/**
 * One place that turns "someone messaged us on channel X" into patient + conversation + message rows.
 * Used by every webhook, the website chat and manual leads, so all channels behave the same.
 * Always called with the service-role client.
 */
export const UNIQUE_VIOLATION = "23505";

/** The "New enquiry" stage (auto_key = 'new'), or the first main stage if the admin removed it. */
export async function firstStageId(db: SupabaseClient, clinicId: string) {
  const { data } = await db
    .from("pipeline_stages")
    .select("id, auto_key")
    .eq("clinic_id", clinicId)
    .eq("is_side", false)
    .order("position", { ascending: true });
  const rows = (data ?? []) as { id: string; auto_key: string | null }[];
  return (rows.find((r) => r.auto_key === "new") ?? rows[0])?.id ?? null;
}

type ContactInput = {
  channel: Channel;
  externalId: string; // WhatsApp number, Messenger PSID, Instagram IGSID, chat token, phone...
  name: string;
  phone?: string | null;
  email?: string | null;
  source: string; // patients.source: whatsapp, instagram, website, google...
  sourceTag?: string | null; // shown on the chat: "Instagram ad", "Google Ads form"...
  accountId?: string | null; // which number / Page / IG account received it
  interest?: string | null;
};

export async function resolveContact(db: SupabaseClient, clinicId: string, input: ContactInput) {
  const existing = await findConversation(db, clinicId, input.channel, input.externalId);
  if (existing) return { patientId: existing.patient_id as string, conversationId: existing.id as string, created: false };

  const { id: patientId, createdWithoutPhone } = await findOrCreatePatient(db, clinicId, input);

  const created = await db
    .from("conversations")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      channel: input.channel,
      external_id: input.externalId,
      source_tag: input.sourceTag ?? null,
      channel_account_id: input.accountId ?? null,
    })
    .select("id")
    .single();

  if (created.error?.code === UNIQUE_VIOLATION) {
    // A parallel webhook created this conversation a moment ago: use theirs.
    if (createdWithoutPhone) await db.from("patients").delete().eq("id", patientId);
    const again = await findConversation(db, clinicId, input.channel, input.externalId);
    if (!again) throw new Error("Conversation race could not be resolved");
    return { patientId: again.patient_id as string, conversationId: again.id as string, created: false };
  }
  if (created.error) throw created.error;
  return { patientId, conversationId: created.data.id as string, created: true };
}

async function findConversation(db: SupabaseClient, clinicId: string, channel: Channel, externalId: string) {
  const { data } = await db
    .from("conversations")
    .select("id, patient_id")
    .eq("clinic_id", clinicId)
    .eq("channel", channel)
    .eq("external_id", externalId)
    .maybeSingle();
  return data;
}

async function findOrCreatePatient(db: SupabaseClient, clinicId: string, input: ContactInput) {
  const phone = input.phone || null;
  if (phone) {
    const { data } = await db.from("patients").select("id").eq("clinic_id", clinicId).eq("phone", phone).maybeSingle();
    if (data) return { id: data.id as string, createdWithoutPhone: false };
  }

  const inserted = await db
    .from("patients")
    .insert({
      clinic_id: clinicId,
      name: input.name.slice(0, 120),
      phone,
      email: input.email || null,
      source: input.source,
      interest: input.interest || null,
      stage_id: await firstStageId(db, clinicId),
    })
    .select("id")
    .single();

  if (inserted.error?.code === UNIQUE_VIOLATION && phone) {
    const { data } = await db.from("patients").select("id").eq("clinic_id", clinicId).eq("phone", phone).single();
    return { id: data!.id as string, createdWithoutPhone: false };
  }
  if (inserted.error) throw inserted.error;
  return { id: inserted.data.id as string, createdWithoutPhone: !phone };
}

/** Saves an incoming patient message. Returns null if the platform re-sent a message we already have. */
export async function addPatientMessage(
  db: SupabaseClient,
  clinicId: string,
  conversationId: string,
  { body, externalId, createdAt }: { body: string; externalId?: string | null; createdAt?: string },
) {
  const { data, error } = await db
    .from("messages")
    .insert({
      clinic_id: clinicId,
      conversation_id: conversationId,
      sender: "patient",
      body: body.slice(0, 4096),
      external_id: externalId ?? null,
      ...(createdAt ? { created_at: createdAt } : {}),
    })
    .select("id")
    .single();
  if (error?.code === UNIQUE_VIOLATION) return null;
  if (error) throw error;
  return data.id as string;
}

/** Grey note in the chat, e.g. "Appointment booked by AI" or a logged phone call. */
export async function addSystemNote(db: SupabaseClient, clinicId: string, conversationId: string, body: string) {
  const { error } = await db.from("messages").insert({ clinic_id: clinicId, conversation_id: conversationId, sender: "system", body });
  if (error) console.error("Could not add system note", error);
}
