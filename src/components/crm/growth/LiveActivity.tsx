"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, MessageCircle, Send, Sparkles, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  kind: "message" | "ai" | "ai_booking" | "booking" | "automation" | "note";
  text: string;
  at: string;
  href?: string;
};

const ICONS = {
  message: MessageCircle,
  ai: Sparkles,
  ai_booking: CalendarCheck,
  booking: CalendarDays,
  automation: Send,
  note: Zap,
};

function ago(iso: string) {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return h < 48 ? "Yesterday" : `${Math.floor(h / 24)} days ago`;
}

/** Recent events across every channel. Refreshes itself when anything new happens (Supabase Realtime). */
export function LiveActivity({ items }: { items: ActivityItem[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        router.refresh();
      }, 3000);
    };
    const channel = supabase
      .channel("growth-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments" }, refresh)
      .subscribe();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  if (items.length === 0) return <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing yet. New chats and bookings appear here live.</p>;

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((it) => {
        const Icon = ICONS[it.kind];
        const body = (
          <>
            <span
              className={cn(
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                it.kind === "ai" || it.kind === "ai_booking" ? "bg-violet-50 text-violet-600" : "bg-slate-100 text-slate-500",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 block text-sm text-ink">{it.text}</span>
              <span className="text-xs text-slate-400" suppressHydrationWarning>
                {ago(it.at)}
              </span>
            </span>
          </>
        );
        return (
          <li key={it.id}>
            {it.href ? (
              <a href={it.href} className="flex gap-3 px-5 py-3 transition hover:bg-slate-50">
                {body}
              </a>
            ) : (
              <div className="flex gap-3 px-5 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
