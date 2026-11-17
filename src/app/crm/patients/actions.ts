"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalisePhone } from "@/lib/utils";

export async function createPatient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const source = String(formData.get("source") ?? "walk_in");
  const interest = String(formData.get("interest") ?? "").trim() || null;
  if (name.length < 2) redirect(`/crm/patients?error=${encodeURIComponent("Enter the patient's name.")}`);

  const supabase = await createClient();
  const { data: firstStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("is_side", false)
    .order("position")
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("patients")
    .insert({
      name,
      phone: phoneRaw ? normalisePhone(phoneRaw) : null,
      source,
      interest,
      stage_id: firstStage?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "A patient with this phone number already exists." : error.message;
    redirect(`/crm/patients?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/crm/patients");
  redirect(`/crm/patients/${data.id}`);
}

export async function updatePatient(id: string, formData: FormData) {
  const supabase = await createClient();
  const value = String(formData.get("expected_value") ?? "").trim();
  const { error } = await supabase
    .from("patients")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim() || null,
      interest: String(formData.get("interest") ?? "").trim() || null,
      expected_value: value ? Number(value) : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) redirect(`/crm/patients/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/crm/patients/${id}`);
  redirect(`/crm/patients/${id}?saved=1`);
}

/** Soft delete: the record goes to the Recycle Bin (deleted_at) instead of being erased. */
export async function archivePatient(id: string) {
  const supabase = await createClient();
  await supabase.from("patients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/crm/patients");
  redirect("/crm/patients");
}
