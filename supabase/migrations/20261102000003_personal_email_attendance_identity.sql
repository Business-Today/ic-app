-- Treat a personal-email OTP login as the attendee's Princeton identity for
-- attendance permissions and audit rows.

begin;

create or replace function public.authenticated_princeton_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select lower(trim(a.email))
      from public."attendeeProfile" a
      where lower(trim(a."personalEmail")) =
            lower(trim(auth.jwt() ->> 'email'))
        and lower(trim(a.email)) like '%@princeton.edu'
      limit 1
    ),
    case
      when lower(trim(auth.jwt() ->> 'email')) like '%@princeton.edu'
        then lower(trim(auth.jwt() ->> 'email'))
    end
  );
$$;

revoke all on function public.authenticated_princeton_email() from public, anon;
grant execute on function public.authenticated_princeton_email() to authenticated;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.editors e
    where e.email = public.authenticated_princeton_email()
  );
$$;

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
  if public.authenticated_princeton_email() is null then
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

revoke all on function public.set_session_check_in(text, text, boolean)
  from public, anon;
grant execute on function public.set_session_check_in(text, text, boolean)
  to authenticated;

commit;
