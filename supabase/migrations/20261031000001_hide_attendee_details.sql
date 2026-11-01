-- Stop people who aren't signed in from reading attendee details.
--
-- The app's publishable key ships inside every build, so anything `anon` can
-- read is effectively public. Before this, `anon` could download every
-- attendee's name, school, major, LinkedIn, Instagram, interests, photo,
-- network and schedule numbers, plus the check-in email lists on each session.
--
-- Safe to apply with the current app build. The only thing the app reads
-- before sign-in is attendeeProfile.email (login's "is this email
-- registered?" check), which stays readable here. Everything else in the app
-- and the editor portal runs signed in (`authenticated`) and is unaffected.
-- The follow-up migration removes `anon` access to emails as well, once
-- everyone runs the build that uses is_registered_attendee().
--
-- Note: `anon` now has column-level SELECT. A column added to these tables
-- later is NOT readable by `anon` until granted (signed-in users are fine).

begin;

-- Yes/no registration check for the login screen. Reveals nothing beyond
-- whether one specific email is registered.
create or replace function public.is_registered_attendee(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."attendeeProfile" a
    where lower(trim(a.email)) = lower(trim(p_email))
  );
$$;

revoke all on function public.is_registered_attendee(text) from public;
grant execute on function public.is_registered_attendee(text) to anon, authenticated;

-- attendeeProfile: anon may read the email column only.
revoke select on public."attendeeProfile" from anon;
grant select ("email") on public."attendeeProfile" to anon;

-- scheduleOptions: anon may read everything except the check-in email list.
revoke select on public."scheduleOptions" from anon;
grant select (
  "optionID",
  "type",
  "title",
  "eventNumber",
  "idSpeaker",
  "location",
  "day",
  "startTime",
  "endTime",
  "numberAttendees"
) on public."scheduleOptions" to anon;

commit;

-- Checks to run afterwards (each should behave as described):
--   set role anon; select "firstName" from public."attendeeProfile" limit 1;  -- ERROR: permission denied
--   set role anon; select email from public."attendeeProfile" limit 1;        -- works (current app login)
--   set role anon; select emails from public."scheduleOptions" limit 1;       -- ERROR: permission denied
--   set role anon; select public.is_registered_attendee('nobody@princeton.edu'); -- false
--   reset role;
