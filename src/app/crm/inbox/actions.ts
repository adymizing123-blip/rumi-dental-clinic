"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addPatientMessage, addSystemNote, resolveContact } from "@/lib/inbox-store";
import { aiConfigured } from "@/lib/ai/provider";
import { summarizeConversation } from "@/lib/ai/receptionist";
import { normalisePhone } from "@/lib/utils";
import { CHANNEL_LABEL, type Channel } from "@/types/db";

async function currentStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("clinic_id, full_name").eq("id", user.id).maybeSingle();
  return profile ? { supabase, clinicId: profile.clinic_id as string, name: (profile.full_name as string | null) ?? "Staff" } : null;
}

export type SummaryResult = { ok: true; summary: string; lead_score: number | null; interest: string | null } | { ok: false; error: string };

/** "Refresh summary" in the patient card. */
export async function refreshSummary(conversationId: string): Promise<SummaryResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Please sign in again." };
  if (!aiConfigured()) return { ok: false, error: "AI is not set up yet. Add AI_API_KEY in .env.local (see README)." };
  // RLS check: the chat must belong to this user's clinic.
  const { data: conv } = await staff.supabase.from("conversations").select("id").eq("id", conversationId).maybeSingle();
  if (!conv) return { ok: false, error: "Conversation not found." };
  try {
    return { ok: true, ...(await summarizeConversation(conversationId)) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const MANUAL_CHANNELS: Channel[] = ["phone", "google", "tiktok", "instagram", "facebook", "whatsapp", "website"];

export type LeadResult = { ok: true; conversationId: string } | { ok: false; error: string };

/** Log a lead that came by phone call, walk-in enquiry, TikTok/Google message etc. */
export async function createManualLead(input: { channel: string; name: string; phone: string; note: string }): Promise<LeadResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: "Please sign in again." };

  const channel = input.channel as Channel;
  if (!MANUAL_CHANNELS.includes(channel)) return { ok: false, error: "Choose a channel." };
  const name = input.name.trim().slice(0, 120);
  const phone = input.phone.trim() ? normalisePhone(input.phone) : "";
  const note = input.note.trim().slice(0, 2000);
  if (name.length < 2) return { ok: false, error: "Enter the patient's name." };
  if (phone && (phone.length < 11 || phone.length > 15)) return { ok: false, error: "Phone number looks wrong." };

  try {
    const db = createAdminClient();
    const contact = await resolveContact(db, staff.clinicId, {
      channel,
      // Repeat calls from the same number stay in one chat. "manual:" ids are never messaged by the CRM.
      externalId: phone ? `manual:${phone}` : `manual:${crypto.randomUUID()}`,
      name,
      phone: phone || null,
      source: channel === "phone" ? "phone_call" : channel,
      sourceTag: channel === "phone" ? "Phone call" : `${CHANNEL_LABEL[channel]} (logged)`,
    });
    if (note) {
      await addPatientMessage(db, staff.clinicId, contact.conversationId, { body: note });
    }
    await addSystemNote(db, staff.clinicId, contact.conversationId, `Lead logged by ${staff.name}`);
    return { ok: true, conversationId: contact.conversationId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
