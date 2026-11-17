import clsx, { type ClassValue } from "clsx";
import { site } from "@/config/site";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPKR(value: number | null | undefined) {
  if (value == null) return "-";
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Short relative time like "5m", "2h", "3d". */
export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Today's date as YYYY-MM-DD in the clinic's timezone offset (e.g. "+05:00"). */
export function todayInOffset(offset: string) {
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hh, mm] = offset.slice(1).split(":").map(Number);
  const shifted = new Date(Date.now() + sign * ((hh ?? 0) * 60 + (mm ?? 0)) * 60000);
  return shifted.toISOString().slice(0, 10);
}

/** Normalise a Pakistani phone number to international digits (03001234567 -> 923001234567). */
export function normalisePhone(input: string) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return digits;
}

/** Time in the clinic's timezone, e.g. "5:30 PM" (servers run in UTC, so always pass the zone). */
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit", timeZone: site.timezone });
}

/** Date in the clinic's timezone. */
export function fmtDate(value: string | Date, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(value).toLocaleDateString("en-PK", { ...options, timeZone: site.timezone });
}

/** "Today", "Yesterday", "6 days ago" in the clinic's timezone (used on pipeline cards). */
export function dayLabel(iso: string | null | undefined) {
  if (!iso) return "";
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: site.timezone }); // YYYY-MM-DD
  const diff = Math.round((Date.parse(day(new Date())) - Date.parse(day(new Date(iso)))) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 30) return `${diff} days ago`;
  return fmtDate(iso, { day: "numeric", month: "short" });
}
