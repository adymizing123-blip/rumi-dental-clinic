"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function movePatient(patientId: string, stageId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("patients").update({ stage_id: stageId }).eq("id", patientId);
  if (error) return { error: error.message };
  revalidatePath("/crm/pipeline");
  return { ok: true };
}
