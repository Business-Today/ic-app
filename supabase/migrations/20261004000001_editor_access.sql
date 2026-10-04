-- Editor access for the web portal (speakers, schedule, attendee schedules).
--
-- Safe to apply while the current app build is in use: nothing the app does
-- today is blocked by this migration. The scheduleOptions lockdown lives in
-- the follow-up migration, applied once staff run the build that checks in
-- through set_session_check_in().

-- Allowlist ---------------------------------------------------------------

create table if not exists public.editors (
  email text primary key
    check (email = lower(email) and email like '%@princeton.edu'),
  note text,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: the list is only readable and editable from the
-- Supabase dashboard (or the service role). The portal asks is_editor().
alter table public.editors enable row level security;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') like '%@princeton.edu'
      and exists (
        select 1 from public.editors e
        where e.email = lower(auth.jwt() ->> 'email')
      ),
    false
  );
$$;

revoke all on function public.is_editor() from public, anon;
grant execute on function public.is_editor() to authenticated;

-- Speakers: readable by everyone already, writable only by editors ---------

create policy "editors insert" on public."speakerProfile"
  for insert to authenticated with check (public.is_editor());
create policy "editors update" on public."speakerProfile"
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on public."speakerProfile"
  for delete to authenticated using (public.is_editor());

create policy "editors insert" on public."speakerProfileAll"
  for insert to authenticated with check (public.is_editor());
create policy "editors update" on public."speakerProfileAll"
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on public."speakerProfileAll"
  for delete to authenticated using (public.is_editor());

create policy "editors insert" on public."speakerProfileSem"
  for insert to authenticated with check (public.is_editor());
create policy "editors update" on public."speakerProfileSem"
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on public."speakerProfileSem"
  for delete to authenticated using (public.is_editor());

-- Schedule: editors may delete sessions (insert/update are tightened later) -

create policy "editors delete" on public."scheduleOptions"
  for delete to authenticated using (public.is_editor());

-- Check-in: the only scheduleOptions write the app needs -------------------
--
-- Adds or removes one email from a session's comma-separated `emails` list.
-- Same audience as the app's attendance screen (any signed-in
-- @princeton.edu user). Locks the row, so simultaneous scans can't drop
-- each other's check-ins the way read-modify-write from the client could.

create or replace function public.set_session_check_in(
  p_option_id text,
  p_email text,
  p_checked_in boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_current text[];
  v_result text;
begin
  if coalesce(lower(auth.jwt() ->> 'email'), '') not like '%@princeton.edu' then
    raise exception 'Not allowed to take attendance' using errcode = '42501';
  end if;

  if v_email = '' then
    raise exception 'Email is required' using errcode = '22023';
  end if;

  select coalesce(
           array_remove(
             string_to_array(lower(replace(coalesce(s.emails, ''), ' ', '')), ','),
             ''
           ),
           '{}'
         )
    into v_current
    from public."scheduleOptions" s
   where s."optionID" = p_option_id
     for update;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if p_checked_in then
    if not (v_email = any (v_current)) then
      v_current := v_current || v_email;
    end if;
  else
    v_current := array_remove(v_current, v_email);
  end if;

  v_result := array_to_string(v_current, ',');

  update public."scheduleOptions"
     set emails = v_result
   where "optionID" = p_option_id;

  return v_result;
end;
$$;

revoke all on function public.set_session_check_in(text, text, boolean) from public, anon;
grant execute on function public.set_session_check_in(text, text, boolean) to authenticated;

-- Attendee schedules: only editors change group / offsite / exec columns ---
--
-- attendeeProfile stays updatable by the app (profile edits, network, NFC),
-- so this is a column guard rather than a policy. Requests without an API
-- role (dashboard SQL editor, direct connections) are not affected.

create or replace function public.guard_attendee_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new."groupNumber", new.offsite, new.exec1, new.exec2, new.exec3, new.exec4)
       is distinct from
     (old."groupNumber", old.offsite, old.exec1, old.exec2, old.exec3, old.exec4)
     and auth.role() in ('anon', 'authenticated')
     and not public.is_editor()
  then
    raise exception 'Only editors can change attendee schedules'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_attendee_schedule on public."attendeeProfile";
create trigger guard_attendee_schedule
  before update on public."attendeeProfile"
  for each row execute function public.guard_attendee_schedule();
