create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  signup_role text := new.raw_user_meta_data ->> 'role';
begin
  if signup_role is null or signup_role not in ('driver', 'parent') then
    raise exception 'Only parent and driver roles can self-register' using errcode = '22023';
  end if;

  if coalesce(new.raw_user_meta_data ->> 'consent', 'false') <> 'true' then
    raise exception 'POPIA consent is required' using errcode = '22023';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('saferide_signup_role', signup_role)
  where id = new.id;

  if signup_role = 'parent' then
    insert into public.profiles (id, role, full_name, phone_e164, consent_accepted_at)
    values (
      new.id,
      'parent',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'phone_e164',
      now()
    );
  end if;

  return new;
end;
$$;

alter function public.register_driver_profile(jsonb, jsonb)
  rename to register_driver_profile_unchecked;

revoke all on function public.register_driver_profile_unchecked(jsonb, jsonb)
  from public, anon, authenticated;

create function public.register_driver_profile(profile jsonb, vehicle jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  signup_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select raw_app_meta_data ->> 'saferide_signup_role' into signup_role
  from auth.users
  where id = auth.uid();

  if signup_role is distinct from 'driver' then
    raise exception 'driver_role_required' using errcode = '42501';
  end if;

  return public.register_driver_profile_unchecked(profile, vehicle);
end;
$$;

revoke all on function public.register_driver_profile(jsonb, jsonb) from public, anon;
grant execute on function public.register_driver_profile(jsonb, jsonb) to authenticated;