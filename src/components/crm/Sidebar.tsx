"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Filter,
  LogOut,
  MessagesSquare,
  Settings,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Command",
    items: [
      { href: "/crm", label: "Growth Center", icon: TrendingUp },
      { href: "/crm/inbox", label: "Omnichannel Inbox", icon: MessagesSquare, badge: "unread" as const },
    ],
  },
  {
    label: "Front desk",
    items: [
      { href: "/crm/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/crm/pipeline", label: "Leads Pipeline", icon: Filter },
      { href: "/crm/patients", label: "Patients", icon: Users },
    ],
  },
  {
    label: "Growth engine",
    items: [{ href: "/crm/automations", label: "Automations", icon: Zap }],
  },
  {
    label: "Clinic",
    items: [{ href: "/crm/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar({
  clinicName,
  userName,
  role,
  unread,
}: {
  clinicName: string;
  userName: string;
  role: string;
  unread: number;
}) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#0c1633] text-slate-300 lg:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 font-display text-lg font-extrabold text-white">
          {clinicName[0] ?? "C"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-white">{clinicName}</p>
          <p className="text-xs text-slate-400">Clinic CRM</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
            <ul className="space-y-1">
              {g.items.map((item) => {
                const active = item.href === "/crm" ? path === "/crm" : path.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {"badge" in item && unread > 0 && (
                        <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-white">{userName}</p>
        <p className="text-xs capitalize text-slate-400">{role}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <button className="flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Compact top navigation for phones and tablets. */
export function MobileNav() {
  const path = usePathname();
  const items = groups.flatMap((g) => g.items);
  return (
    <nav className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
      {items.map((item) => {
        const active = item.href === "/crm" ? path === "/crm" : path.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600",
            )}
          >
            <Icon className="h-4 w-4" /> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
