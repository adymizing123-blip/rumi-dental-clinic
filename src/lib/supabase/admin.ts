import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so use it ONLY on the server for trusted work:
 * webhooks from Meta and the public booking form. Never import this in a Client Component.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cachedClinicId: string | null = null;

/** Each deployment serves one clinic. Returns that clinic's id (the first row in `clinics`). */
export async function getClinicId() {
  if (cachedClinicId) return cachedClinicId;
  const { data, error } = await createAdminClient()
    .from("clinics")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error("No clinic found. Run supabase/seed.sql first.");
  cachedClinicId = data.id as string;
  return cachedClinicId;
}
