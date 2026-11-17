"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { normalisePhone } from "@/lib/utils";
import type { AppointmentStatus } from "@/types/db";

const STATUSES: AppointmentStatus[] = ["booked", "confirmed", "arrived", "in_consultation", "done", "no_show", "cancelled"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN = 60_000;

export type AppointmentFormState = { ok?: boolean; error?: string; date?: string; at?: number };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Name of the doctor's clashing appointment, or null if the doctor is free for the whole visit. */
async function doctorClash(supabase: Supabase, doctorId: string, startsAt: string, durationMin: number, ignoreId?: string) {
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * MIN;
  const { data } = await supabase
    .from("appointments")
    .select("id, starts_at, duration_min, patient:patients(name)")
    .eq("doctor_id", doctorId)
    .gte("starts_at", new Date(start - 8 * 60 * MIN).toISOString())
    .lt("starts_at", new Date(end).toISOString())
    .not("status", "in", "(cancelled,no_show)");
  const clash = (data ?? []).find((a) => {
    if (a.id === ignoreId) return false;
    const s = new Date(a.starts_at as string).getTime();
    return s < end && s + Number(a.duration_min ?? 30) * MIN > start;
  });
  if (!clash) return null;
  const p = clash.patient as { name?: string } | { name?: string }[] | null;
  return (Array.isArray(p) ? p[0]?.name : p?.name) ?? "another patient";
}

async function doctorName(supabase: Supabase, doctorId: string) {
  const { data } = await supabase.from("doctors").select("name").eq("id", doctorId).maybeSingle();
  return (data?.name as string | undefined) ?? "This doctor";
}

export async function createAppointment(_prev: AppointmentFormState, formData: FormData): Promise<AppointmentFormState> {
  const supabase = await createClient();

  let patientId = String(formData.get("patient_id") ?? "");
  const newName = String(formData.get("new_name") ?? "").trim();
  const newPhone = String(formData.get("new_phone") ?? "").trim();
  const doctorId = String(formData.get("doctor_id") ?? "") || null;
  const serviceId = String(formData.get("service_id") ?? "") || null;
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const type = String(formData.get("type") ?? "new");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!DATE.test(date) || !TIME.test(time)) return { error: "Pick a valid date and time." };
  if (!patientId && !newName) return { error: "Choose a patient or enter a new one." };

  let duration = 30;
  if (serviceId) {
    const { data: svc } = await supabase.from("services").select("duration_min").eq("id", serviceId).maybeSingle();
    if (svc?.duration_min) duration = svc.duration_min;
  }
  const startsAt = `${date}T${time}:00${site.timezoneOffset}`;

  if (doctorId) {
    const clash = await doctorClash(supabase, doctorId, startsAt, duration);
    if (clash) return { error: `${await doctorName(supabase, doctorId)} already has ${clash} at that time.` };
  }

  // Walk-in or phone booking for someone not in the system yet.
  if (!patientId) {
    const phone = newPhone ? normalisePhone(newPhone) : null;
    if (phone && (phone.length < 11 || phone.length > 15)) return { error: "Phone number looks wrong." };
    const { data: created, error } = await supabase
      .from("patients")
      .insert({ name: newName, phone, source: "walk_in" })
      .select("id")
      .single();
    if (created) {
      patientId = created.id;
    } else if (phone) {
      // Phone already exists: reuse that patient.
      const { data: existing } = await supabase.from("patients").select("id").eq("phone", phone).maybeSingle();
      if (!existing) return { error: error?.message ?? "Could not add the patient." };
      patientId = existing.id;
    } else {
      return { error: error?.message ?? "Could not add the patient." };
    }
  }

  const { error } = await supabase.from("appointments").insert({
    patient_id: patientId,
    doctor_id: doctorId,
    service_id: serviceId,
    starts_at: startsAt,
    duration_min: duration,
    type: ["new", "follow_up", "procedure"].includes(type) ? type : "new",
    notes,
  });
  if (error) return { error: error.message };

  // The pipeline moves the patient to "Appointment booked" by itself (database trigger, see 0003_pipeline_automation.sql).
  revalidatePath("/crm/appointments");
  revalidatePath("/crm");
  return { ok: true, date, at: Date.now() };
}

/** Move an appointment to another time and/or doctor. */
export async function rescheduleAppointment(id: string, _prev: AppointmentFormState, formData: FormData): Promise<AppointmentFormState> {
  const supabase = await createClient();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const doctorId = String(formData.get("doctor_id") ?? "") || null;
  if (!DATE.test(date) || !TIME.test(time)) return { error: "Pick a valid date and time." };

  const { data: appt } = await supabase.from("appointments").select("duration_min").eq("id", id).maybeSingle();
  if (!appt) return { error: "Appointment not found." };
  const startsAt = `${date}T${time}:00${site.timezoneOffset}`;

  if (doctorId) {
    const clash = await doctorClash(supabase, doctorId, startsAt, Number(appt.duration_min ?? 30), id);
    if (clash) return { error: `${await doctorName(supabase, doctorId)} already has ${clash} at that time.` };
  }

  const { error } = await supabase.from("appointments").update({ starts_at: startsAt, doctor_id: doctorId }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/crm/appointments");
  revalidatePath("/crm");
  return { ok: true, date, at: Date.now() };
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  if (!STATUSES.includes(status)) return { error: "Invalid status" };
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/crm/appointments");
  revalidatePath("/crm");
  return { ok: true };
}
