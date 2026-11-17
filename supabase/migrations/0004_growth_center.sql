-- Growth Center (dashboard) support. Run after 0003.

-- Who booked each appointment, so the dashboard can show what the AI receptionist brought in.
alter table public.appointments
  add column if not exists booked_by text not null default 'staff' check (booked_by in ('staff', 'ai', 'website'));

-- Older AI bookings (before this column existed) carried a note.
update public.appointments set booked_by = 'ai' where booked_by = 'staff' and notes like 'Booked by AI receptionist%';

create index if not exists appointments_created on public.appointments (clinic_id, created_at desc);
create index if not exists conversations_created on public.conversations (clinic_id, created_at desc);

-- Average seconds between a patient's message and the AI's reply, since p_since.
-- SECURITY INVOKER: row level security still applies, so staff only see their own clinic.
create or replace function public.ai_reply_seconds(p_since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select round(avg(extract(epoch from (m.created_at - q.asked_at)))::numeric, 1)
    from public.messages m
    cross join lateral (
      select max(p.created_at) as asked_at
        from public.messages p
       where p.conversation_id = m.conversation_id
         and p.sender = 'patient'
         and p.created_at <= m.created_at
    ) q
   where m.sender = 'ai'
     and m.created_at >= p_since
     and q.asked_at is not null
     and m.created_at - q.asked_at < interval '1 hour';
$$;

grant execute on function public.ai_reply_seconds(timestamptz) to authenticated;
