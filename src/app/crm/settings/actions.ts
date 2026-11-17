"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Channel } from "@/types/db";

function back(msg?: string, hash = "", ok?: string): never {
  const qs = msg ? `?error=${encodeURIComponent(msg)}` : ok ? `?ok=${encodeURIComponent(ok)}` : "?saved=1";
  redirect(`/crm/settings${qs}${hash}`);
}

/** Channel tokens are only handled with the service-role client, so check the admin role ourselves. */
async function requireAdmin(hash: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) back("Please sign in again.", hash);
  const { data: profile } = await supabase.from("profiles").select("clinic_id, role").eq("id", user!.id).maybeSingle();
  if (profile?.role !== "admin") back("Only an admin can change this.", hash);
  return { supabase, clinicId: profile!.clinic_id as string };
}

export async function updateClinic(formData: FormData) {
  const supabase = await createClient();
  const { data: clinic } = await supabase.from("clinics").select("id").limit(1).single();
  if (!clinic) back("Clinic not found");
  const { error } = await supabase
    .from("clinics")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
    })
    .eq("id", clinic!.id);
  revalidatePath("/crm", "layout");
  back(error ? "Only an admin can change clinic details." : undefined);
}

export async function addStage(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#3573e8");
  const isSide = formData.get("is_side") === "on";
  if (!name) back("Enter a stage name", "#stages");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("pipeline_stages")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("pipeline_stages")
    .insert({ name, color, is_side: isSide, position: (last?.position ?? 0) + 1 });
  revalidatePath("/crm/pipeline");
  back(error ? "Only an admin can change pipeline stages." : undefined, "#stages");
}

export async function updateStage(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pipeline_stages")
    .update({ name: String(formData.get("name") ?? "").trim(), color: String(formData.get("color") ?? "#3573e8") })
    .eq("id", id);
  revalidatePath("/crm/pipeline");
  back(error ? "Only an admin can change pipeline stages." : undefined, "#stages");
}

/** Swap a stage with its neighbour to reorder the pipeline. */
export async function moveStage(id: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: stages } = await supabase.from("pipeline_stages").select("id, position").order("position");
  const list = stages ?? [];
  const i = list.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) back(undefined, "#stages");
  const a = list[i]!;
  const b = list[j]!;
  await supabase.from("pipeline_stages").update({ position: b.position }).eq("id", a.id);
  const { error } = await supabase.from("pipeline_stages").update({ position: a.position }).eq("id", b.id);
  revalidatePath("/crm/pipeline");
  back(error ? "Only an admin can change pipeline stages." : undefined, "#stages");
}

export async function deleteStage(id: string) {
  const supabase = await createClient();
  // Patients in this stage keep their record; their stage becomes empty (on delete set null).
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  revalidatePath("/crm/pipeline");
  back(error ? "Only an admin can change pipeline stages." : undefined, "#stages");
}

// ---------------------------------------------------------------------------
// AI receptionist + opening hours + pipeline timing
// ---------------------------------------------------------------------------
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function updateAiSettings(formData: FormData) {
  const { supabase, clinicId } = await requireAdmin("#ai");
  const opening = String(formData.get("opening_time") ?? "");
  const closing = String(formData.get("closing_time") ?? "");
  if (!TIME.test(opening) || !TIME.test(closing) || closing <= opening) back("Closing time must be after opening time.", "#ai");
  const slot = Number(formData.get("slot_minutes") ?? 30);
  const closed = formData
    .getAll("closed")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const nurture = Math.min(60, Math.max(1, Number(formData.get("nurture_after_days") ?? 3) || 3));
  const lost = Math.min(365, Math.max(2, Number(formData.get("lost_after_days") ?? 30) || 30));

  const { error } = await supabase
    .from("clinics")
    .update({
      ai_enabled: formData.get("ai_enabled") === "on",
      ai_instructions: String(formData.get("ai_instructions") ?? "").slice(0, 4000),
      opening_time: opening,
      closing_time: closing,
      slot_minutes: [15, 20, 30, 45, 60].includes(slot) ? slot : 30,
      closed_weekdays: closed,
      nurture_after_days: nurture,
      lost_after_days: Math.max(lost, nurture + 1),
    })
    .eq("id", clinicId);
  revalidatePath("/crm", "layout");
  back(error ? error.message : undefined, "#ai");
}

// ---------------------------------------------------------------------------
// Channels (added by the developer for each clinic)
// ---------------------------------------------------------------------------
const MESSAGING: Channel[] = ["whatsapp", "instagram", "facebook"];
const LEAD_SOURCES: Channel[] = ["google", "tiktok", "facebook", "instagram", "website"];

export async function addChannelConnection(formData: FormData) {
  const { clinicId } = await requireAdmin("#channels");
  const channel = String(formData.get("channel") ?? "") as Channel;
  const accountId = String(formData.get("account_id") ?? "").trim();
  const token = String(formData.get("access_token") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim().slice(0, 80) || null;
  if (!MESSAGING.includes(channel)) back("Choose WhatsApp, Instagram or Facebook.", "#channels");
  if (!/^\d{5,30}$/.test(accountId)) back("The account / phone number ID should be digits only (copy it from Meta).", "#channels");
  if (token.length < 20) back("Paste the full access token.", "#channels");

  const { error } = await createAdminClient()
    .from("channel_connections")
    .insert({ clinic_id: clinicId, channel, kind: "messaging", label, account_id: accountId, access_token: token });
  if (error?.code === "23505") back("This account is already connected.", "#channels");
  back(error ? error.message : undefined, "#channels", error ? undefined : "Channel added. Use “Test” to check the token.");
}

export async function addLeadSource(formData: FormData) {
  const { clinicId } = await requireAdmin("#channels");
  const channel = String(formData.get("channel") ?? "") as Channel;
  const label = String(formData.get("label") ?? "").trim().slice(0, 80);
  if (!LEAD_SOURCES.includes(channel)) back("Choose where the leads come from.", "#channels");
  if (label.length < 2) back("Give the lead source a name, e.g. “Google Ads form”.", "#channels");
  const { error } = await createAdminClient()
    .from("channel_connections")
    .insert({ clinic_id: clinicId, channel, kind: "leads", label, account_id: crypto.randomBytes(18).toString("base64url") });
  back(error ? error.message : undefined, "#channels", error ? undefined : "Lead source created. Copy its webhook URL.");
}

export async function toggleChannelConnection(id: string, enabled: boolean) {
  const { clinicId } = await requireAdmin("#channels");
  const { error } = await createAdminClient().from("channel_connections").update({ enabled }).eq("id", id).eq("clinic_id", clinicId);
  back(error ? error.message : undefined, "#channels");
}

export async function deleteChannelConnection(id: string) {
  const { clinicId } = await requireAdmin("#channels");
  const { error } = await createAdminClient().from("channel_connections").delete().eq("id", id).eq("clinic_id", clinicId);
  back(error ? error.message : undefined, "#channels");
}

/** Calls Meta with the saved token to confirm it works and shows the account name. */
export async function testChannelConnection(id: string) {
  const { clinicId } = await requireAdmin("#channels");
  const { data: conn } = await createAdminClient()
    .from("channel_connections")
    .select("channel, account_id, access_token")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!conn?.access_token) back("Nothing to test.", "#channels");

  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const token = conn!.access_token as string;
  const igLogin = conn!.channel === "instagram" && token.startsWith("IG");
  const url =
    conn!.channel === "whatsapp"
      ? `https://graph.facebook.com/${version}/${conn!.account_id}?fields=display_phone_number,verified_name`
      : igLogin
        ? `https://graph.instagram.com/${version}/me?fields=username`
        : conn!.channel === "instagram"
          ? `https://graph.facebook.com/${version}/${conn!.account_id}?fields=username`
          : `https://graph.facebook.com/${version}/${conn!.account_id}?fields=name`;

  // redirect() works by throwing, so never call back() inside the try block.
  let result = "";
  let failure: string | null = null;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    const json = (await res.json()) as Record<string, string> & { error?: { message?: string } };
    if (!res.ok) failure = `Meta says: ${json.error?.message ?? res.status}`;
    else result = json.verified_name ? `${json.verified_name} (${json.display_phone_number})` : json.username ? `@${json.username}` : (json.name ?? "OK");
  } catch {
    failure = "Could not reach Meta. Try again.";
  }
  if (failure) back(failure, "#channels");
  back(undefined, "#channels", `Connected: ${result}`);
}
