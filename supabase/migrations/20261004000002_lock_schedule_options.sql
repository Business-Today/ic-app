-- Lock scheduleOptions to editors.
--
-- APPLY ONLY AFTER everyone taking attendance runs the app build that checks
-- in via set_session_check_in(). Older builds update `emails` directly and
-- their check-ins will fail once this runs.

drop policy if exists "insert" on public."scheduleOptions";
drop policy if exists "update" on public."scheduleOptions";
drop policy if exists "Enable insert for authenticated users only" on public."scheduleOptions";

create policy "editors insert" on public."scheduleOptions"
  for insert to authenticated with check (public.is_editor());
create policy "editors update" on public."scheduleOptions"
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
