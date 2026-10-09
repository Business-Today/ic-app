-- Require a signed-in user for app writes.
--
-- The original policies were granted to `public`, which includes `anon`: anyone
-- holding the app's publishable key could write without logging in. Every
-- write in the app happens after OTP sign-in, so moving these to
-- `authenticated` changes nothing for real users. Reads are left as they are.

-- attendeeProfile: profile edits, network, NFC (schedule columns stay guarded
-- by guard_attendee_schedule). Rows are added from the dashboard, not the app.

drop policy if exists "Enable read access for all users" on public."attendeeProfile";
create policy "signed-in update" on public."attendeeProfile"
  for update to authenticated using (true) with check (true);

drop policy if exists "insert" on public."attendeeProfile";
create policy "editors insert" on public."attendeeProfile"
  for insert to authenticated with check (public.is_editor());

-- attendanceHistory: the app appends scans.

drop policy if exists "Enable insert for authenticated users only" on public."attendanceHistory";
create policy "signed-in insert" on public."attendanceHistory"
  for insert to authenticated with check (true);

-- attendanceByAttendee / attendanceByEvent: not written by the current app,
-- but they hold data, so keep writes open to signed-in users only.

drop policy if exists "insert" on public."attendanceByAttendee";
drop policy if exists "update" on public."attendanceByAttendee";
drop policy if exists "delete" on public."attendanceByAttendee";
create policy "signed-in insert" on public."attendanceByAttendee"
  for insert to authenticated with check (true);
create policy "signed-in update" on public."attendanceByAttendee"
  for update to authenticated using (true) with check (true);
create policy "signed-in delete" on public."attendanceByAttendee"
  for delete to authenticated using (true);

drop policy if exists "insert" on public."attendanceByEvent";
drop policy if exists "update" on public."attendanceByEvent";
drop policy if exists "delete" on public."attendanceByEvent";
create policy "signed-in insert" on public."attendanceByEvent"
  for insert to authenticated with check (true);
create policy "signed-in update" on public."attendanceByEvent"
  for update to authenticated using (true) with check (true);
create policy "signed-in delete" on public."attendanceByEvent"
  for delete to authenticated using (true);
