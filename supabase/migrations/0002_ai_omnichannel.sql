-- AI receptionist + omnichannel connections
-- Run after 0001_init.sql (SQL Editor > New query > paste > Run), then run seed.sql on a fresh project.

-- ---------------------------------------------------------------------------
-- Clinic: AI receptionist settings and opening hours (used to offer free slots)
-- ---------------------------------------------------------------------------
alter table public.clinics
  add column if not exists ai_enabled boolean not null default false,          -- master switch for the whole clinic
  add column if not exists ai_instructions text not null default '',           -- extra facts: payment methods, parking, offers...
  add column if not exists opening_time time not null default '10:00',
  add column if not exists closing_time time not null default '21:00',
  add column if not exists slot_minutes integer not null default 30 check (slot_minutes between 10 and 120),
  add column if not exists closed_weekdays integer[] not null default '{0}';   -- 0 = Sunday ... 6 = Saturday

-- ---------------------------------------------------------------------------
-- Conversations: per-chat AI switch, AI summary, handoff flag
-- ai_receptionist already exists (per-chat switch). New chats get AI by default;
-- it still only replies while the clinic's master switch (clinics.ai_enabled) is on.
-- ---------------------------------------------------------------------------
alter table public.conversations alter column ai_receptionist set default true;
alter table public.conversations
  add column if not exists ai_summary text,
  add column if not exists ai_summary_at timestamptz,
  add column if not exists needs_human boolean not null default false,       -- AI handed over to staff
  add column if not exists channel_account_id text;                          -- which WhatsApp number / Page / IG account received it

-- ---------------------------------------------------------------------------
-- Channel connections: added by the developer from Settings > Channels
--   whatsapp  -> account_id = phone_number_id, access_token = system user token
--   facebook  -> account_id = Facebook Page id, access_token = Page access token
--   instagram -> account_id = Instagram professional account id, access_token = Page or Instagram token
--   google / tiktok / facebook lead forms -> account_id = secret key used in the lead webhook URL
-- Tokens are secrets: RLS is on with NO policies, so only the server (service role) can read this table.
-- ---------------------------------------------------------------------------
create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  channel public.channel_type not null,
  kind text not null default 'messaging' check (kind in ('messaging', 'leads')),
  label text,
  account_id text not null,
  access_token text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, account_id)
);

alter table public.channel_connections enable row level security;

drop trigger if exists touch_channel_connections on public.channel_connections;
create trigger touch_channel_connections before update on public.channel_connections
  for each row execute function public.touch_updated_at();

create index if not exists conversations_needs_human on public.conversations (clinic_id) where needs_human;
create index if not exists messages_ai_recent on public.messages (conversation_id, created_at) where sender = 'ai';

-- ---------------------------------------------------------------------------
-- Realtime: the inbox patient card updates live when the AI changes lead score / interest
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'patients'
  ) then
    alter publication supabase_realtime add table public.patients;
  end if;
end $$;
