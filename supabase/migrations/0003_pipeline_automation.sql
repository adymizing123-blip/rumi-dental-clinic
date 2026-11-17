-- Automatic leads pipeline
-- Run after 0002. Leads move between stages by themselves, whichever part of the system caused the event
-- (AI receptionist, staff in the CRM, website, webhooks), because the rules live in the database:
--
--   new message from an unknown / lost contact  -> New enquiry
--   AI or staff replies                          -> AI engaged
--   appointment booked                           -> Appointment booked
--   appointment marked arrived / done            -> Visited
--   appointment cancelled / no-show              -> Nurturing
--   engaged but silent for N days                -> Nurturing   (hourly job)
--   nurturing and silent for M days              -> Lost        (hourly job)
--
-- Stages are matched by auto_key, not by name, so admins can rename stages freely.
-- Dragging a card by hand always works; automation only moves leads forward on real events.

alter table public.pipeline_stages
  add column if not exists auto_key text check (auto_key in ('new', 'engaged', 'booked', 'visited', 'nurturing', 'lost'));
create unique index if not exists pipeline_stages_auto_key on public.pipeline_stages (clinic_id, auto_key) where auto_key is not null;

alter table public.clinics
  add column if not exists nurture_after_days integer not null default 3 check (nurture_after_days between 1 and 60),
  add column if not exists lost_after_days integer not null default 30 check (lost_after_days between 2 and 365);

-- Existing clinics (older seed): link the matching stages to their automation step.
update public.pipeline_stages s set auto_key = m.key
from (values
  ('new inquiry', 'new'), ('new enquiry', 'new'),
  ('contacted', 'engaged'), ('ai engaged', 'engaged'),
  ('appointment booked', 'booked'),
  ('visited', 'visited'),
  ('follow-up due', 'nurturing'), ('nurturing', 'nurturing'),
  ('not interested', 'lost'), ('lost', 'lost')
) as m(name, key)
where lower(s.name) = m.name
  and s.auto_key is null
  and not exists (select 1 from public.pipeline_stages o where o.clinic_id = s.clinic_id and o.auto_key = m.key);

-- ---------------------------------------------------------------------------
-- Core helper: move a patient to the stage with key p_to, but only if their current stage is in p_from.
--   'none'   = patient has no stage yet
--   'custom' = patient sits in a stage the admin added (no auto_key)
-- ---------------------------------------------------------------------------
create or replace function public.auto_move_patient(p_patient uuid, p_to text, p_from text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_stage uuid;
  v_current text;
  v_target uuid;
begin
  select p.clinic_id, p.stage_id, s.auto_key
    into v_clinic, v_stage, v_current
    from public.patients p
    left join public.pipeline_stages s on s.id = p.stage_id
   where p.id = p_patient and p.deleted_at is null;
  if v_clinic is null then
    return;
  end if;

  v_current := case when v_stage is null then 'none' else coalesce(v_current, 'custom') end;
  if not (v_current = any (p_from)) then
    return;
  end if;

  select id into v_target from public.pipeline_stages where clinic_id = v_clinic and auto_key = p_to;
  if v_target is not null and v_target is distinct from v_stage then
    update public.patients set stage_id = v_target where id = p_patient;
  end if;
end;
$$;

-- Messages: replies move "New enquiry" to "AI engaged"; a lost lead writing again becomes a new enquiry.
create or replace function public.pipeline_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient uuid;
begin
  select patient_id into v_patient from public.conversations where id = new.conversation_id;
  if v_patient is null then
    return new;
  end if;
  if new.sender in ('ai', 'staff') and coalesce(new.status, '') <> 'failed' then
    perform public.auto_move_patient(v_patient, 'engaged', array['none', 'new']);
  elsif new.sender = 'patient' then
    perform public.auto_move_patient(v_patient, 'new', array['none', 'lost']);
  end if;
  return new;
end;
$$;

drop trigger if exists pipeline_on_message on public.messages;
create trigger pipeline_on_message after insert on public.messages
  for each row execute function public.pipeline_on_message();

-- Appointments: booking, visit, cancellation / no-show.
create or replace function public.pipeline_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed boolean := true;
begin
  if tg_op = 'UPDATE' then
    v_changed := new.status is distinct from old.status;
  end if;

  if v_changed then
    if new.status in ('booked', 'confirmed') then
      perform public.auto_move_patient(new.patient_id, 'booked', array['none', 'new', 'engaged', 'nurturing', 'lost', 'custom']);
    elsif new.status in ('arrived', 'in_consultation', 'done') then
      perform public.auto_move_patient(new.patient_id, 'visited', array['none', 'new', 'engaged', 'booked', 'nurturing', 'lost', 'custom']);
    elsif new.status in ('no_show', 'cancelled')
      and not exists (
        select 1 from public.appointments a
         where a.patient_id = new.patient_id and a.id <> new.id
           and a.status in ('booked', 'confirmed') and a.starts_at > now()
      ) then
      perform public.auto_move_patient(new.patient_id, 'nurturing', array['booked']);
    end if;
  end if;

  -- Fill the lead's value from the booked service's price if nobody set it yet.
  if tg_op = 'INSERT' and new.service_id is not null then
    update public.patients p
       set expected_value = s.price
      from public.services s
     where p.id = new.patient_id and s.id = new.service_id
       and p.expected_value is null and s.price is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists pipeline_on_appointment on public.appointments;
create trigger pipeline_on_appointment after insert or update of status on public.appointments
  for each row execute function public.pipeline_on_appointment();

-- ---------------------------------------------------------------------------
-- Time-based moves (Nurturing / Lost). Runs hourly through pg_cron if available.
-- ---------------------------------------------------------------------------
create or replace function public.age_leads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved integer := 0;
  v_count integer;
begin
  -- AI engaged, but the patient has gone quiet and has nothing booked -> Nurturing
  with candidates as (
    select p.id, n.id as target
      from public.patients p
      join public.pipeline_stages s on s.id = p.stage_id and s.auto_key = 'engaged'
      join public.clinics c on c.id = p.clinic_id
      join public.pipeline_stages n on n.clinic_id = p.clinic_id and n.auto_key = 'nurturing'
     where p.deleted_at is null
       and coalesce(
             (select max(cv.last_patient_message_at) from public.conversations cv where cv.patient_id = p.id),
             p.created_at
           ) < now() - make_interval(days => c.nurture_after_days)
       and not exists (
             select 1 from public.appointments a
              where a.patient_id = p.id and a.status in ('booked', 'confirmed') and a.starts_at > now()
           )
  )
  update public.patients p set stage_id = c.target from candidates c where p.id = c.id;
  get diagnostics v_count = row_count;
  v_moved := v_moved + v_count;

  -- Nurturing and silent for a long time -> Lost
  with candidates as (
    select p.id, l.id as target
      from public.patients p
      join public.pipeline_stages s on s.id = p.stage_id and s.auto_key = 'nurturing'
      join public.clinics c on c.id = p.clinic_id
      join public.pipeline_stages l on l.clinic_id = p.clinic_id and l.auto_key = 'lost'
     where p.deleted_at is null
       and p.updated_at < now() - make_interval(days => c.lost_after_days)
       and coalesce(
             (select max(cv.last_patient_message_at) from public.conversations cv where cv.patient_id = p.id),
             p.created_at
           ) < now() - make_interval(days => c.lost_after_days)
  )
  update public.patients p set stage_id = c.target from candidates c where p.id = c.id;
  get diagnostics v_count = row_count;
  return v_moved + v_count;
end;
$$;

-- Only the server should run the aging job.
revoke execute on function public.age_leads() from public, anon, authenticated;
revoke execute on function public.auto_move_patient(uuid, text, text[]) from public, anon, authenticated;

-- Schedule hourly with pg_cron (Supabase: Database > Extensions > pg_cron). If it is not available,
-- the migration still succeeds; enable pg_cron later and run the cron.schedule line on its own.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('age-leads-hourly', '17 * * * *', 'select public.age_leads()');
exception when others then
  raise notice 'pg_cron not available (%). Enable it, then run: select cron.schedule(''age-leads-hourly'', ''17 * * * *'', ''select public.age_leads()'');', sqlerrm;
end $$;
