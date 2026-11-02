-- Short "about me" on attendee profiles.
--
-- The app caps it at 150 words; the length check is only a backstop against
-- clients that skip that. `anon` has column-level SELECT on this table, so the
-- new column isn't readable before sign-in.

alter table public."attendeeProfile"
  add column if not exists bio text
    check (bio is null or char_length(bio) <= 2000);
