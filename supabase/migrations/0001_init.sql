-- Rumi Dental Clinic CRM: initial schema
-- Run in Supabase: SQL Editor > New query > paste > Run (or `supabase db push`).
-- One deployment serves one clinic, but every table carries clinic_id so the same schema
-- can later hold many clinics in one project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'doctor', 'receptionist', 'assistant', 'marketing');
create type public.channel_type as enum ('whatsapp', 'instagram', 'facebook', 'tiktok', 'google', 'website', 'phone');
create type public.message_sender as enum ('patient', 'staff', 'ai', 'system');
create type public.appointment_status as enum ('booked', 'confirmed', 'arrived', 'in_consultation', 'done', 'no_show', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  full_name text,
  role public.app_role not null default 'receptionist',
  created_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  degree text,
  pmdc_no text,
  specialization text,
  fee numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  price numeric(12, 2),
  duration_min integer not null default 30 check (duration_min between 5 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  color text not null default '#14aea6',
  position integer not null default 0,
  is_side boolean not null default false, -- side stages: No-show, Not Interested
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  phone text,                       -- international digits, e.g. 923001234567
  email text,
  gender text,
  age integer check (age between 0 and 130),
  source text not null default 'walk_in', -- whatsapp, instagram, facebook, website, walk_in, referral...
  tags text[] not null default '{}',
  stage_id uuid references public.pipeline_stages (id) on delete set null,
  interest text,
  expected_value numeric(12, 2),
  lead_score integer check (lead_score between 0 and 100),
  notes text,
  deleted_at timestamptz,           -- soft delete (Recycle Bin)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, phone)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  channel public.channel_type not null,
  external_id text,                 -- WhatsApp wa_id, Instagram/Facebook user id, phone for website
  source_tag text,                  -- e.g. "Instagram ad", "Booking form"
  last_message_text text,
  last_message_at timestamptz not null default now(),
  last_patient_message_at timestamptz, -- used for WhatsApp's 24-hour reply window
  unread_count integer not null default 0,
  assigned_to uuid references public.profiles (id) on delete set null,
  ai_receptionist boolean not null default false,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (clinic_id, channel, external_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender public.message_sender not null,
  body text,
  external_id text unique,          -- WhatsApp message id (wamid), prevents duplicates on webhook retries
  status text,                      -- sent / delivered / read / failed
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_id uuid references public.doctors (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  starts_at timestamptz not null,
  duration_min integer not null default 30,
  type text not null default 'new' check (type in ('new', 'follow_up', 'procedure')),
  status public.appointment_status not null default 'booked',
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes for the screens that list and filter
create index on public.patients (clinic_id, stage_id) where deleted_at is null;
create index on public.patients (clinic_id, created_at desc);
create index on public.conversations (clinic_id, last_message_at desc);
create index on public.messages (conversation_id, created_at);
create index on public.appointments (clinic_id, starts_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The clinic of the logged-in user. SECURITY DEFINER so RLS on profiles does not recurse.
create or replace function public.my_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Fill clinic_id automatically when a logged-in user inserts a row.
create or replace function public.set_clinic_id()
returns trigger
language plpgsql
as $$
begin
  if new.clinic_id is null then
    new.clinic_id := public.my_clinic_id();
  end if;
  return new;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Keep the conversation preview, unread count and 24h window in sync with new messages.
create or replace function public.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
     set last_message_text = left(coalesce(new.body, ''), 280),
         last_message_at = new.created_at,
         last_patient_message_at = case when new.sender = 'patient' then new.created_at else c.last_patient_message_at end,
         unread_count = case when new.sender = 'patient' then c.unread_count + 1 else c.unread_count end
   where c.id = new.conversation_id;
  return new;
end;
$$;

-- New auth users join the clinic. The very first user becomes admin.
-- IMPORTANT: turn OFF public sign-ups in Supabase (Authentication > Providers > Email)
-- and add staff with "Invite user", so strangers cannot create accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_is_first boolean;
begin
  select id into v_clinic from public.clinics order by created_at limit 1;
  if v_clinic is null then
    raise exception 'Create a clinic first (run supabase/seed.sql)';
  end if;
  select not exists (select 1 from public.profiles where clinic_id = v_clinic) into v_is_first;
  insert into public.profiles (id, clinic_id, full_name, role)
  values (
    new.id,
    v_clinic,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when v_is_first then 'admin'::public.app_role else 'receptionist'::public.app_role end
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger set_clinic_id before insert on public.doctors for each row execute function public.set_clinic_id();
create trigger set_clinic_id before insert on public.services for each row execute function public.set_clinic_id();
create trigger set_clinic_id before insert on public.pipeline_stages for each row execute function public.set_clinic_id();
create trigger set_clinic_id before insert on public.patients for each row execute function public.set_clinic_id();
create trigger set_clinic_id before insert on public.conversations for each row execute function public.set_clinic_id();
create trigger set_clinic_id before insert on public.messages for each row execute function public.set_clinic_id();
create trigger set_clinic_id before insert on public.appointments for each row execute function public.set_clinic_id();

create trigger touch_patients before update on public.patients for each row execute function public.touch_updated_at();
create trigger message_inserted after insert on public.messages for each row execute function public.on_message_inserted();

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: staff only see their own clinic's data
-- ---------------------------------------------------------------------------
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.services enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.patients enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.appointments enable row level security;

create policy "clinic: members read" on public.clinics
  for select to authenticated using (id = public.my_clinic_id());
create policy "clinic: admin update" on public.clinics
  for update to authenticated using (id = public.my_clinic_id() and public.my_role() = 'admin')
  with check (id = public.my_clinic_id());

create policy "profiles: same clinic read" on public.profiles
  for select to authenticated using (clinic_id = public.my_clinic_id());
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and clinic_id = public.my_clinic_id());

-- Same rule for every clinic-owned table: full access within your own clinic.
do $$
declare
  t text;
begin
  foreach t in array array['doctors', 'services', 'patients', 'conversations', 'messages', 'appointments'] loop
    execute format(
      'create policy "%1$s: clinic members" on public.%1$I for all to authenticated
         using (clinic_id = public.my_clinic_id())
         with check (clinic_id = public.my_clinic_id())', t);
  end loop;
end $$;

-- Pipeline stages: everyone reads, only admins change them.
create policy "stages: clinic read" on public.pipeline_stages
  for select to authenticated using (clinic_id = public.my_clinic_id());
create policy "stages: admin write" on public.pipeline_stages
  for all to authenticated
  using (clinic_id = public.my_clinic_id() and public.my_role() = 'admin')
  with check (clinic_id = public.my_clinic_id() and public.my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Realtime: the inbox and dashboard update live
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
