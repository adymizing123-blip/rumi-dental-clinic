import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileNav, Sidebar } from "@/components/crm/Sidebar";

export const metadata: Metadata = { title: "CRM", robots: { index: false, follow: false } };

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: clinic }, { data: unreadRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle(),
    supabase.from("clinics").select("name").limit(1).maybeSingle(),
    supabase.from("conversations").select("unread_count").gt("unread_count", 0),
  ]);

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-xl font-bold">Your account is not linked to a clinic yet.</h1>
          <p className="mt-2 text-sm text-slate-500">Ask the clinic admin to add you, then sign in again.</p>
        </div>
      </main>
    );
  }

  const unread = (unreadRows ?? []).reduce((sum, r) => sum + (r.unread_count as number), 0);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        clinicName={clinic?.name ?? "Clinic"}
        userName={profile.full_name ?? user.email ?? "Staff"}
        role={profile.role}
        unread={unread}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        {children}
      </div>
    </div>
  );
}
