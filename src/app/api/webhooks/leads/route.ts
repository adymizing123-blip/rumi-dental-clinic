import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, getClinicId } from "@/lib/supabase/admin";
import { addPatientMessage, resolveContact } from "@/lib/inbox-store";
import { normalisePhone } from "@/lib/utils";
import type { Channel } from "@/types/db";

/**
 * Lead webhook for Google Ads lead forms, TikTok lead forms (through Zapier / Make) or any other form.
 * Create a "lead source" in Settings → Channels; it gives a URL like /api/webhooks/leads?key=XXXX.
 *
 * Accepts JSON in either format:
 *   Google Ads: { "google_key": "...", "lead_id": "...", "user_column_data": [{ "column_id": "FULL_NAME", "string_value": "Ali" }, ...] }
 *   Generic:    { "name": "Ali", "phone": "0300...", "email": "...", "message": "Braces price?" }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GoogleColumn = { column_id?: string; column_name?: string; string_value?: string };
type LeadBody = Record<string, unknown> & { user_column_data?: GoogleColumn[]; google_key?: string; lead_id?: string; is_test?: boolean };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

function parseLead(body: LeadBody) {
  const extra: string[] = [];
  if (Array.isArray(body.user_column_data)) {
    const col = new Map<string, string>();
    for (const c of body.user_column_data) {
      const id = (c.column_id ?? "").toUpperCase();
      const value = str(c.string_value);
      if (!value) continue;
      if (["FULL_NAME", "FIRST_NAME", "LAST_NAME", "PHONE_NUMBER", "EMAIL"].includes(id)) col.set(id, value);
      else extra.push(`${c.column_name || id.replace(/_/g, " ").toLowerCase()}: ${value}`);
    }
    return {
      name: col.get("FULL_NAME") || [col.get("FIRST_NAME"), col.get("LAST_NAME")].filter(Boolean).join(" "),
      phone: col.get("PHONE_NUMBER") ?? "",
      email: col.get("EMAIL") ?? "",
      message: "",
      extra,
    };
  }
  const known = new Set(["name", "full_name", "phone", "phone_number", "mobile", "email", "message", "note", "key"]);
  for (const [k, v] of Object.entries(body)) {
    if (!known.has(k) && str(v) && str(v).length < 300) extra.push(`${k.replace(/_/g, " ")}: ${str(v)}`);
  }
  return {
    name: str(body.name) || str(body.full_name),
    phone: str(body.phone) || str(body.phone_number) || str(body.mobile),
    email: str(body.email),
    message: str(body.message) || str(body.note),
    extra,
  };
}

export async function POST(request: NextRequest) {
  let body: LeadBody;
  try {
    const type = request.headers.get("content-type") ?? "";
    body = type.includes("application/json")
      ? ((await request.json()) as LeadBody)
      : (Object.fromEntries((await request.formData()).entries()) as LeadBody);
  } catch {
    return NextResponse.json({ error: "Send JSON or form data" }, { status: 400 });
  }

  const key = request.nextUrl.searchParams.get("key") || str(body.google_key) || str(body.key);
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 401 });

  const db = createAdminClient();
  const { data: source } = await db
    .from("channel_connections")
    .select("channel, label, account_id")
    .eq("kind", "leads")
    .eq("enabled", true)
    .eq("account_id", key)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "Unknown or disabled key" }, { status: 401 });

  const lead = parseLead(body);
  const phone = lead.phone ? normalisePhone(lead.phone) : "";
  if (!lead.name && !phone && !lead.email) return NextResponse.json({ error: "A lead needs a name, phone or email" }, { status: 400 });

  try {
    const clinicId = await getClinicId();
    const channel = source.channel as Channel;
    const label = (source.label as string | null) || "Lead form";
    const validPhone = phone.length >= 11 && phone.length <= 15 ? phone : null;

    const contact = await resolveContact(db, clinicId, {
      channel,
      // Same person filling the form again lands in the same chat. The "lead:" prefix marks it as
      // not messageable (a phone number is not a Messenger/Instagram id).
      externalId: `lead:${validPhone ?? (str(body.lead_id) || crypto.randomUUID())}`,
      name: lead.name || (validPhone ? `+${validPhone}` : lead.email),
      phone: validPhone,
      email: lead.email || null,
      source: channel,
      sourceTag: body.is_test ? `${label} (test)` : label,
    });
    await addPatientMessage(db, clinicId, contact.conversationId, {
      body: [`New lead from ${label}`, lead.phone && `Phone: ${lead.phone}`, lead.email && `Email: ${lead.email}`, lead.message, ...lead.extra]
        .filter(Boolean)
        .join("\n"),
      externalId: body.lead_id ? `${channel}-lead:${str(body.lead_id)}` : null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Lead webhook failed", err);
    return NextResponse.json({ error: "Could not save the lead" }, { status: 500 });
  }
}
