-- Read-only access to the web portal.
--
-- `editors` is unchanged and still the only list that can change anything.
-- `viewers` can sign in to the portal and look, nothing more: every write
-- (speakers, schedule, attendee schedules) already checks is_editor(), so a
-- viewer's save is refused by the database whatever the page does.
-- Someone on both lists is an editor.

create table if not exists public.viewers (
  email text primary key
    check (email = lower(email) and email like '%@princeton.edu'),
  note text,
  created_at timestamptz not null default now()
);

-- Same as editors: RLS on with no policies, so the list is only readable and
-- editable from the Supabase dashboard. The portal asks portal_role().
alter table public.viewers enable row level security;

-- 'editor', 'viewer', or null for anyone on neither list.
create or replace function public.portal_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_editor() then 'editor'
    when lower(auth.jwt() ->> 'email') like '%@princeton.edu'
      and exists (
        select 1 from public.viewers v
        where v.email = lower(auth.jwt() ->> 'email')
      ) then 'viewer'
  end;
$$;

revoke all on function public.portal_role() from public, anon;
grant execute on function public.portal_role() to authenticated;
