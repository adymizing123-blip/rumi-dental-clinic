import { createClient } from "@/lib/supabase/server";
import { site } from "@/config/site";
import { PageHeader } from "@/components/crm/PageHeader";
import { AppointmentsCalendar, type CalendarAppointment } from "@/components/crm/AppointmentsCalendar";
import type { AppointmentStatus } from "@/types/db";
import { fmtDate, todayInOffset } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Rel<T> = T | T[] | null;
const one = <T,>(v: Rel<T>) => (Array.isArray(v) ? (v[0] ?? null) : v);

const toMinutes = (t: string | null | undefined, fallback: number) => {
  if (!t) return fallback;
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ date?: string; patient?: string }> }) {
  const sp = await searchParams;
  const today = todayInOffset(site.timezoneOffset);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const supabase = await createClient();

  const [appts, doctors, services, patients, clinic] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, duration_min, type, status, notes, doctor_id, patient:patients(id, name, phone), service:services(id, name)",
      )
      .gte("starts_at", `${date}T00:00:00${site.timezoneOffset}`)
      .lte("starts_at", `${date}T23:59:59${site.timezoneOffset}`)
      .order("starts_at"),
    supabase.from("doctors").select("id, name, specialization").eq("active", true).order("created_at"),
    supabase.from("services").select("id, name, price, duration_min").eq("active", true).order("name"),
    supabase.from("patients").select("id, name, phone").is("deleted_at", null).order("name").limit(1000),
    supabase.from("clinics").select("opening_time, closing_time, slot_minutes").limit(1).maybeSingle(),
  ]);

  const appointments: CalendarAppointment[] = (appts.data ?? []).map((a) => ({
    id: a.id as string,
    startsAt: a.starts_at as string,
    duration: Number(a.duration_min ?? 30),
    status: a.status as AppointmentStatus,
    type: a.type as string,
    notes: (a.notes as string | null) ?? null,
    doctorId: (a.doctor_id as string | null) ?? null,
    patient: one(a.patient as Rel<{ id: string; name: string; phone: string | null }>),
    service: one(a.service as Rel<{ id: string; name: string }>)?.name ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={fmtDate(`${date}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />
      <AppointmentsCalendar
        key={date}
        date={date}
        today={today}
        appointments={appointments}
        doctors={(doctors.data ?? []) as { id: string; name: string; specialization: string | null }[]}
        services={(services.data ?? []) as { id: string; name: string; duration_min: number }[]}
        patients={(patients.data ?? []) as { id: string; name: string; phone: string | null }[]}
        openMin={toMinutes(clinic.data?.opening_time as string | undefined, 10 * 60)}
        closeMin={toMinutes(clinic.data?.closing_time as string | undefined, 21 * 60)}
        prefillPatientId={sp.patient ?? null}
      />
    </>
  );
}
