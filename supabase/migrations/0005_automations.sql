-- WhatsApp automations: messages that go out by themselves to patients AND doctors.
-- Run after 0004. The database queues the messages when something happens (an appointment is booked,
-- marked no-show, done...). A small worker (/api/cron/automations, every 5 minutes) sends what is due.
--
-- WhatsApp rule: a free-text message is allowed only within 24 hours of the person's last message.
-- Outside that window (most reminders, and almost every message to a doctor) Meta requires an
-- APPROVED TEMPLATE. Each automation can be given its template name on the Automations page.

alter type public.message_sender add value if not exists 'automation';

alter table public.doctors add column if not exists phone text; -- doctor's WhatsApp number, international digits (923001234567)
alter table public.clinics
  add column if not exists google_review_url text,
  add column if not exists automations_last_run_at timestamptz;

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  body text not null,                 -- message text; {name}, {date}, {time}, {doctor}... are filled in
  template_name text,                 -- approved WhatsApp template used outside the 24-hour window
  template_lang text not null default 'en',
  updated_at timestamptz not null default now(),
  unique (clinic_id, key)
);

create table if not exists public.automation_queue (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  automation_key text not null,
  recipient text not null check (recipient in ('patient', 'doctor')),
  appointment_id uuid references public.appointments (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete cascade,
  doctor_id uuid references public.doctors (id) on delete cascade,
  send_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  attempts integer not null default 0,
  error text,
  body text,                          -- what was sent (for the log)
  external_id text,
  sent_at timestamptz,
  dedupe_key text not null unique,    -- never send the same reminder twice
  created_at timestamptz not null default now()
);

create index if not exists automation_queue_due on public.automation_queue (send_at) where status = 'pending';
create index if not exists automation_queue_recent on public.automation_queue (clinic_id, created_at desc);

drop trigger if exists touch_automations on public.automations;
create trigger touch_automations before update on public.automations for each row execute function public.touch_updated_at();

alter table public.automations enable row level security;
alter table public.automation_queue enable row level security;

drop policy if exists "automations: clinic read" on public.automations;
create policy "automations: clinic read" on public.automations
  for select to authenticated using (clinic_id = public.my_clinic_id());
drop policy if exists "automations: admin write" on public.automations;
create policy "automations: admin write" on public.automations
  for update to authenticated
  using (clinic_id = public.my_clinic_id() and public.my_role() = 'admin')
  with check (clinic_id = public.my_clinic_id());
drop policy if exists "automation queue: clinic read" on public.automation_queue;
create policy "automation queue: clinic read" on public.automation_queue
  for select to authenticated using (clinic_id = public.my_clinic_id());

-- ---------------------------------------------------------------------------
-- Default automations (editable later). Called by seed.sql for a new clinic.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_default_automations(p_clinic uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.automations (clinic_id, key, enabled, body) values
    (p_clinic, 'confirmation', true,
     'Assalam o alaikum {name}! Aap ki appointment {date} ko {time} baje {doctor} ke saath confirm ho gayi hai. Address: {address}. - {clinic}'),
    (p_clinic, 'doctor_new', true,
     'New appointment: {name} ({phone}) on {date} at {time} for {service}.'),
    (p_clinic, 'reminder', true,
     'Assalam o alaikum {name}! Reminder: aap ki appointment {date} ko {time} baje {doctor} ke saath hai. Time badalna ho to isi number par reply karein. - {clinic}'),
    (p_clinic, 'doctor_schedule', true,
     'Good morning {doctor}! Aaj aap ki {count} appointments hain: {schedule}'),
    (p_clinic, 'no_show', true,
     '{name}, aaj aap appointment par tashreef nahi la sakay. Naya time choose karne ke liye isi number par reply karein. - {clinic}'),
    (p_clinic, 'aftercare', true,
     '{name}, treatment ke baad aap ki tabiyat kaisi hai? Koi takleef ho to isi number par batayein. - {clinic}'),
    (p_clinic, 'review', true,
     'Shukriya {name}! Aap ka tajurba kaisa raha? Google par review de kar hamari madad karein: {review_link}'),
    (p_clinic, 'lead_follow_up', true,
     'Hi {name}, aap ne {interest} ke baare mein poocha tha. Is hafte slot available hai, book karein? - {clinic}'),
    (p_clinic, 'win_back', false,
     '{name}, kaafi time ho gaya! Is mahine check-up ke liye slot book karein. - {clinic}')
  on conflict (clinic_id, key) do nothing;
$$;

select public.ensure_default_automations(id) from public.clinics;

-- ---------------------------------------------------------------------------
-- Queue helper: adds a message only if that automation is switched on.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_automation(
  p_clinic uuid, p_key text, p_recipient text, p_appointment uuid, p_patient uuid, p_doctor uuid, p_send_at timestamptz, p_dedupe text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.automations where clinic_id = p_clinic and key = p_key and enabled) then
    return;
  end if;
  insert into public.automation_queue (clinic_id, automation_key, recipient, appointment_id, patient_id, doctor_id, send_at, dedupe_key)
  values (p_clinic, p_key, p_recipient, p_appointment, p_patient, p_doctor, p_send_at, p_dedupe)
  on conflict (dedupe_key) do nothing;
end;
$$;

-- Appointment events -> queue
create or replace function public.automation_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reminder_at timestamptz := new.starts_at - interval '24 hours';
  v_reminder_key text := 'reminder:' || new.id || ':' || extract(epoch from new.starts_at)::bigint;
begin
  if tg_op = 'INSERT' then
    if new.status in ('booked', 'confirmed') and new.starts_at > now() then
      -- The AI already confirms in the chat, so only staff bookings get the confirmation message.
      if new.booked_by <> 'ai' then
        perform public.enqueue_automation(new.clinic_id, 'confirmation', 'patient', new.id, new.patient_id, null, now(), 'confirmation:' || new.id);
      end if;
      if new.doctor_id is not null then
        perform public.enqueue_automation(new.clinic_id, 'doctor_new', 'doctor', new.id, new.patient_id, new.doctor_id, now(), 'doctor_new:' || new.id);
      end if;
      if v_reminder_at > now() + interval '30 minutes' then
        perform public.enqueue_automation(new.clinic_id, 'reminder', 'patient', new.id, new.patient_id, null, v_reminder_at, v_reminder_key);
      end if;
    end if;
    return new;
  end if;

  -- Rescheduled: drop the old reminder, queue a new one, tell the (new) doctor.
  if new.starts_at is distinct from old.starts_at or new.doctor_id is distinct from old.doctor_id then
    update public.automation_queue set status = 'cancelled'
     where appointment_id = new.id and automation_key = 'reminder' and status = 'pending';
    if new.status in ('booked', 'confirmed') and v_reminder_at > now() + interval '30 minutes' then
      perform public.enqueue_automation(new.clinic_id, 'reminder', 'patient', new.id, new.patient_id, null, v_reminder_at, v_reminder_key);
    end if;
    if new.doctor_id is not null and new.starts_at > now() then
      perform public.enqueue_automation(new.clinic_id, 'doctor_new', 'doctor', new.id, new.patient_id, new.doctor_id, now(),
        'doctor_new:' || new.id || ':' || extract(epoch from new.starts_at)::bigint || ':' || new.doctor_id);
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('cancelled', 'no_show', 'done') then
      update public.automation_queue set status = 'cancelled'
       where appointment_id = new.id and automation_key = 'reminder' and status = 'pending';
    end if;
    if new.status = 'no_show' then
      perform public.enqueue_automation(new.clinic_id, 'no_show', 'patient', new.id, new.patient_id, null, now() + interval '30 minutes', 'no_show:' || new.id);
    elsif new.status = 'done' then
      perform public.enqueue_automation(new.clinic_id, 'review', 'patient', new.id, new.patient_id, null, now() + interval '2 hours', 'review:' || new.id);
      perform public.enqueue_automation(new.clinic_id, 'aftercare', 'patient', new.id, new.patient_id, null, now() + interval '1 day', 'aftercare:' || new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists automation_on_appointment on public.appointments;
create trigger automation_on_appointment after insert or update of starts_at, doctor_id, status on public.appointments
  for each row execute function public.automation_on_appointment();

revoke execute on function public.enqueue_automation(uuid, text, text, uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.ensure_default_automations(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Run the worker every 5 minutes (needs pg_cron + pg_net, both available on Supabase).
-- Replace the URL and secret, then run these lines once in the SQL Editor:
--
--   create extension if not exists pg_net;
--   select cron.schedule('crm-automations', '*/5 * * * *', $job$
--     select net.http_get(
--       url := 'https://YOUR-CRM-DOMAIN/api/cron/automations',
--       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
--       timeout_milliseconds := 55000
--     );
--   $job$);
-- ---------------------------------------------------------------------------
