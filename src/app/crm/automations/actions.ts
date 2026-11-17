"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runAutomations } from "@/lib/automations/worker";
import { AUTOMATION_BY_KEY, type AutomationKey } from "@/lib/automations/definitions";
import { normalisePhone } from "@/lib/utils";

function back(error?: string, ok?: string, hash = ""): never {
  const qs = error ? `?error=${encodeURIComponent(error)}` : ok ? `?ok=${encodeURIComponent(ok)}` : "";
  redirect(`/crm/automations${qs}${hash}`);
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) back("Please sign in again.");
  const { data: profile } = await supabase.from("profiles").select("clinic_id, role").eq("id", user!.id).maybeSingle();
  if (profile?.role !== "admin") back("Only an admin can change automations.");
  return { supabase, clinicId: profile!.clinic_id as string };
}

export async function toggleAutomation(key: AutomationKey, enabled: boolean) {
  if (!AUTOMATION_BY_KEY[key]) back("Unknown automation.");
  const { supabase, clinicId } = await requireAdmin();
  const { error } = await supabase.from("automations").update({ enabled }).eq("clinic_id", clinicId).eq("key", key);
  revalidatePath("/crm/automations");
  back(error?.message, undefined, `#${key}`);
}

export async function updateAutomation(key: AutomationKey, formData: FormData) {
  if (!AUTOMATION_BY_KEY[key]) back("Unknown automation.");
  const { supabase, clinicId } = await requireAdmin();
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  const templateName = String(formData.get("template_name") ?? "").trim().toLowerCase();
  const templateLang = String(formData.get("template_lang") ?? "en").trim() || "en";
  if (body.length < 5) back("Write the message text.", undefined, `#${key}`);
  if (templateName && !/^[a-z0-9_]{1,512}$/.test(templateName)) back("Template names use only small letters, numbers and _ (as in WhatsApp Manager).", undefined, `#${key}`);
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(templateLang)) back("Language code looks wrong (e.g. en, en_US, ur).", undefined, `#${key}`);
  const { error } = await supabase
    .from("automations")
    .update({ body, template_name: templateName || null, template_lang: templateLang })
    .eq("clinic_id", clinicId)
    .eq("key", key);
  revalidatePath("/crm/automations");
  back(error?.message, error ? undefined : "Saved.", `#${key}`);
}

export async function updateReviewLink(formData: FormData) {
  const { supabase, clinicId } = await requireAdmin();
  const url = String(formData.get("google_review_url") ?? "").trim();
  if (url && !/^https:\/\/\S+$/.test(url)) back("Paste the full https:// review link.", undefined, "#setup");
  const { error } = await supabase.from("clinics").update({ google_review_url: url || null }).eq("id", clinicId);
  back(error?.message, error ? undefined : "Review link saved.", "#setup");
}

export async function updateDoctorPhone(doctorId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const raw = String(formData.get("phone") ?? "").trim();
  const phone = raw ? normalisePhone(raw) : null;
  if (phone && (phone.length < 11 || phone.length > 15)) back("That WhatsApp number looks wrong.", undefined, "#setup");
  const { error } = await supabase.from("doctors").update({ phone }).eq("id", doctorId);
  back(error?.message, error ? undefined : "Doctor's number saved.", "#setup");
}

export async function runNow() {
  await requireAdmin();
  let message = "";
  let failure: string | undefined;
  try {
    const r = await runAutomations();
    message = `Run finished: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed, ${r.retrying} will retry, ${r.queued} newly queued.`;
  } catch (err) {
    failure = (err as Error).message;
  }
  revalidatePath("/crm/automations");
  back(failure, message);
}
