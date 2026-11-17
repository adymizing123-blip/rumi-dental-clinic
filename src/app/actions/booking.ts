"use server";

import { createAdminClient, getClinicId } from "@/lib/supabase/admin";
import { normalisePhone } from "@/lib/utils";
import { firstStageId } from "@/lib/inbox-store";

export type BookingState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

/**
 * Public booking form. Creates (or reuses) the patient as a lead, opens a "website" conversation
 * and drops the request into the CRM inbox, so the front desk sees it next to WhatsApp and Instagram chats.
 */
export async function bookAppointment(_prev: BookingState, formData: FormData): Promise<BookingState> {
  // Honeypot: real visitors never fill this hidden field.
  if (String(formData.get("company") ?? "").trim() !== "") return { ok: true };

  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);

  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Please enter your name.";
  const phone = normalisePhone(phoneRaw);
  if (phone.length < 11 || phone.length > 15) fieldErrors.phone = "Please enter a valid mobile number.";
  if (date && Number.isNaN(Date.parse(date))) fieldErrors.date = "Please pick a valid date.";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  try {
    const db = createAdminClient();
    const clinicId = await getClinicId();

    const firstStage = await firstStageId(db, clinicId);

    // Reuse the patient if this phone number is already known.
    let { data: patient } = await db
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone", phone)
      .maybeSingle();

    if (!patient) {
      const { data: created, error } = await db
        .from("patients")
        .insert({
          clinic_id: clinicId,
          name,
          phone,
          source: "website",
          stage_id: firstStage,
          interest: service || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      patient = created;
    }

    let { data: conversation } = await db
      .from("conversations")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("channel", "website")
      .eq("external_id", phone)
      .maybeSingle();

    if (!conversation) {
      const { data: created, error } = await db
        .from("conversations")
        .insert({
          clinic_id: clinicId,
          patient_id: patient!.id,
          channel: "website",
          external_id: phone,
          source_tag: "Booking form",
        })
        .select("id")
        .single();
      if (error) throw error;
      conversation = created;
    }

    const lines = [
      "New appointment request from the website",
      service && `Treatment: ${service}`,
      date && `Preferred date: ${date}`,
      note && `Note: ${note}`,
    ].filter(Boolean);

    const { error: msgError } = await db.from("messages").insert({
      clinic_id: clinicId,
      conversation_id: conversation!.id,
      sender: "patient",
      body: lines.join("\n"),
    });
    if (msgError) throw msgError;

    return { ok: true };
  } catch (err) {
    console.error("bookAppointment failed", err);
    return { ok: false, error: "Something went wrong. Please call or WhatsApp us instead." };
  }
}
