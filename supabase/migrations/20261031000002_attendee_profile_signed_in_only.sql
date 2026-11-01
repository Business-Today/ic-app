-- Make attendeeProfile readable only by signed-in users.
--
-- APPLY ONLY AFTER everyone runs the app build whose login screen calls
-- is_registered_attendee() (added in 20261031000001). Older builds look the
-- email up directly before sign-in; once this runs they'd say "Email not
-- registered" to everyone.

begin;

revoke select ("email") on public."attendeeProfile" from anon;

-- The old read policy was granted to `public` (which includes anon).
drop policy if exists "view" on public."attendeeProfile";
create policy "signed-in read" on public."attendeeProfile"
  for select to authenticated using (true);

commit;

-- Check afterwards:
--   set role anon; select email from public."attendeeProfile" limit 1;  -- ERROR: permission denied
--   set role anon; select public.is_registered_attendee('nobody@princeton.edu'); -- false (login still works)
--   reset role;
