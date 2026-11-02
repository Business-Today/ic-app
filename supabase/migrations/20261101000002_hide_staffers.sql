-- staffers (names, emails, teams) was readable by anyone with the public key.
-- Nothing in the app or the portal reads it; it's only queried from the
-- dashboard, which these grants don't affect.

alter table public.staffers enable row level security;
revoke all on public.staffers from anon, authenticated;
