"use client";

import { useState, useTransition } from "react";
import { updateAppointmentStatus } from "@/app/crm/appointments/actions";
import { STATUS_LABEL, type AppointmentStatus } from "@/types/db";
import { cn } from "@/lib/utils";

const COLORS: Record<AppointmentStatus, string> = {
  booked: "bg-sky-50 text-sky-700 border-sky-200",
  confirmed: "bg-brand-50 text-brand-700 border-brand-200",
  arrived: "bg-violet-50 text-violet-700 border-violet-200",
  in_consultation: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_show: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export function StatusSelect({ id, value }: { id: string; value: AppointmentStatus }) {
  const [status, setStatus] = useState(value);
  const [pending, start] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as AppointmentStatus;
        const prev = status;
        setStatus(next);
        start(async () => {
          const res = await updateAppointmentStatus(id, next);
          if ("error" in res && res.error) setStatus(prev);
        });
      }}
      className={cn("rounded-full border px-3 py-1 text-xs font-semibold", COLORS[status])}
    >
      {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
