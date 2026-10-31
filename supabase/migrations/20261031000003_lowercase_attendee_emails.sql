-- Store every attendee email in lowercase.
--
-- The app lowercases what people type and looks profiles up with an exact
-- match, so attendees whose email was imported with capitals
-- (e.g. "Ab1234@princeton.edu") are told "Email not registered" and can't log
-- in. Check-ins are already stored lowercase. Safe to apply at any time.
--
-- Stops without changing anything if lowercasing would create a duplicate.

begin;

do $$
begin
  if exists (
    select lower(trim(email))
    from public."attendeeProfile"
    group by lower(trim(email))
    having count(*) > 1
  ) then
    raise exception 'Two attendee rows differ only by case/spaces; merge them first';
  end if;
end;
$$;

update public."attendeeProfile"
   set email = lower(trim(email))
 where email <> lower(trim(email));

commit;

-- Check afterwards (expect 0):
--   select count(*) from public."attendeeProfile" where email <> lower(trim(email));
-- Also look for rows that aren't emails at all (an organizer must fix these by hand):
--   select email, "firstName", "lastName" from public."attendeeProfile" where email not like '%@%';
