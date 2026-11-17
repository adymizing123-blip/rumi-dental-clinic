import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Staff login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="grain relative hidden overflow-hidden bg-[linear-gradient(140deg,#111d3d,#2558c9_55%,#5a93f5)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="font-display text-xl font-bold">
          {site.name}
        </Link>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight">Every patient message, one inbox.</h1>
          <p className="mt-4 max-w-md text-brand-50/80">
            Appointments, leads, WhatsApp, Instagram and Facebook chats for the whole front desk.
          </p>
        </div>
        <p className="text-sm text-white/60">Staff access only</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold text-ink">Sign in to the CRM</h2>
          <p className="mt-1 text-sm text-slate-500">Use the account your clinic admin created for you.</p>
          <LoginForm next={next ?? "/crm"} />
        </div>
      </section>
    </main>
  );
}
