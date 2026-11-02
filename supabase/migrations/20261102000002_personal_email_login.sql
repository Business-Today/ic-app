-- Let attendees sign in with the personal email on their profile when the
-- code sent to their school email doesn't arrive.
--
-- The login screen offers this after 30 seconds on the code step. It asks
-- is_registered_personal_email() whether the personal email typed belongs to
-- the same profile as the school email typed, then sends the code to the
-- personal email. Once signed in, the app finds the profile by either column.
--
-- Safe to apply at any time. Older builds don't call the new function.
--
-- Stops without changing anything if lowercasing would create a duplicate.

begin;

do $$
begin
  if exists (
    select lower(trim("personalEmail"))
    from public."attendeeProfile"
    where "personalEmail" is not null
    group by lower(trim("personalEmail"))
    having count(*) > 1
  ) then
    raise exception 'Two attendee rows share a personal email; fix them first';
  end if;
end;
$$;

-- The app looks profiles up with an exact match, like the school email.
update public."attendeeProfile"
   set "personalEmail" = lower(trim("personalEmail"))
 where "personalEmail" <> lower(trim("personalEmail"));

-- Yes/no check for the login screen. Reveals nothing beyond whether one
-- specific personal email is on file for one specific school email.
create or replace function public.is_registered_personal_email(
  p_email text,
  p_personal_email text
)
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
      and lower(trim(a."personalEmail")) = lower(trim(p_personal_email))
  );
$$;

revoke all on function public.is_registered_personal_email(text, text) from public;
grant execute on function public.is_registered_personal_email(text, text) to anon, authenticated;

commit;

-- Check afterwards:
--   select count(*) from public."attendeeProfile" where "personalEmail" <> lower(trim("personalEmail")); -- 0
--   set role anon; select public.is_registered_personal_email('nobody@princeton.edu', 'nobody@gmail.com'); -- false
--   reset role;
