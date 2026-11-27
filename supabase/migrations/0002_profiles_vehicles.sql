create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  consent_accepted_at timestamptz not null,
  business_name text check (business_name is null or char_length(business_name) <= 100),
  pdp_number text check (pdp_number is null or pdp_number ~ '^[A-Za-z0-9]{4,20}$'),
  pdp_expiry_date date,
  pdp_document_path text,
  pdp_verification public.verification_status not null default 'unverified',
  pdp_verification_note text check (pdp_verification_note is null or char_length(pdp_verification_note) <= 200),
  service_suburbs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_fields_required check (
    role <> 'driver' or (
      pdp_number is not null and pdp_expiry_date is not null
      and cardinality(service_suburbs) between 1 and 10
    )
  ),
  constraint non_driver_no_driver_fields check (
    role = 'driver' or (
      pdp_number is null and pdp_expiry_date is null and pdp_document_path is null
      and business_name is null and cardinality(service_suburbs) = 0
    )
  )
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  registration_number text not null check (registration_number ~ '^[A-Z0-9]{4,10}$'),
  make_model text not null check (char_length(btrim(make_model)) between 2 and 80),
  seating_capacity smallint not null check (seating_capacity between 4 and 35),
  roadworthy_expiry_date date not null,
  roadworthy_document_path text,
  roadworthy_verification public.verification_status not null default 'unverified',
  roadworthy_verification_note text check (roadworthy_verification_note is null or char_length(roadworthy_verification_note) <= 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_registration_unique unique (registration_number),
  constraint vehicles_id_driver_unique unique (id, driver_id)
);

create index vehicles_driver_idx on public.vehicles(driver_id);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.vehicles enable row level security;
alter table public.vehicles force row level security;

grant select on public.profiles, public.vehicles to authenticated;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy vehicles_select_own
  on public.vehicles for select to authenticated
  using ((select auth.uid()) = driver_id);

create or replace function public.prevent_role_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'profile role is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_role public.user_role;
begin
  if auth.uid() is not null then
    select p.role into actor_role from public.profiles as p where p.id = auth.uid();
  end if;

  if new.pdp_number is distinct from old.pdp_number
    or new.pdp_expiry_date is distinct from old.pdp_expiry_date
    or new.pdp_document_path is distinct from old.pdp_document_path then
    new.pdp_verification := 'unverified';
    new.pdp_verification_note := null;
  elsif actor_role is distinct from 'admin'::public.user_role
    and (new.pdp_verification is distinct from old.pdp_verification
      or new.pdp_verification_note is distinct from old.pdp_verification_note) then
    raise exception 'verification fields are admin-only' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.protect_vehicle_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_role public.user_role;
begin
  if auth.uid() is not null then
    select p.role into actor_role from public.profiles as p where p.id = auth.uid();
  end if;

  if new.registration_number is distinct from old.registration_number
    or new.roadworthy_expiry_date is distinct from old.roadworthy_expiry_date
    or new.roadworthy_document_path is distinct from old.roadworthy_document_path then
    new.roadworthy_verification := 'unverified';
    new.roadworthy_verification_note := null;
  elsif actor_role is distinct from 'admin'::public.user_role
    and (new.roadworthy_verification is distinct from old.roadworthy_verification
      or new.roadworthy_verification_note is distinct from old.roadworthy_verification_note) then
    raise exception 'verification fields are admin-only' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_vehicle_driver_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_role public.user_role;
begin
  select p.role into owner_role from public.profiles as p where p.id = new.driver_id;
  if owner_role is distinct from 'driver'::public.user_role then
    raise exception 'vehicles must belong to a driver profile' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  signup_role text := new.raw_user_meta_data ->> 'role';
begin
  if signup_role not in ('driver', 'parent') then
    raise exception 'Only parent and driver roles can self-register' using errcode = '22023';
  end if;

  if coalesce(new.raw_user_meta_data ->> 'consent', 'false') <> 'true' then
    raise exception 'POPIA consent is required' using errcode = '22023';
  end if;

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

create or replace function public.register_driver_profile(profile jsonb, vehicle jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  user_id uuid := auth.uid();
  user_metadata jsonb;
  new_vehicle_id uuid;
  pdp_expiry date;
  roadworthy_expiry date;
begin
  if user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select u.raw_user_meta_data into user_metadata
  from auth.users as u
  where u.id = user_id;

  if user_metadata ->> 'role' <> 'driver' then
    raise exception 'driver_role_required' using errcode = '42501';
  end if;
  if coalesce(user_metadata ->> 'consent', 'false') <> 'true' then
    raise exception 'POPIA consent is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles as p where p.id = user_id) then
    raise exception 'profile_already_registered' using errcode = '23505';
  end if;

  pdp_expiry := (profile ->> 'pdp_expiry_date')::date;
  roadworthy_expiry := (vehicle ->> 'roadworthy_expiry_date')::date;
  if pdp_expiry < public.sast_today() then
    raise exception 'pdp_expired' using errcode = 'P0001';
  end if;
  if roadworthy_expiry < public.sast_today() then
    raise exception 'roadworthy_expired' using errcode = 'P0001';
  end if;

  insert into public.profiles (
    id, role, full_name, phone_e164, consent_accepted_at, business_name,
    pdp_number, pdp_expiry_date, pdp_document_path, service_suburbs
  ) values (
    user_id,
    'driver',
    coalesce(profile ->> 'full_name', user_metadata ->> 'full_name'),
    coalesce(profile ->> 'phone_e164', user_metadata ->> 'phone_e164'),
    now(),
    profile ->> 'business_name',
    profile ->> 'pdp_number',
    pdp_expiry,
    profile ->> 'pdp_document_path',
    array(select jsonb_array_elements_text(coalesce(profile -> 'service_suburbs', '[]'::jsonb)))
  );

  insert into public.vehicles (
    driver_id, registration_number, make_model, seating_capacity,
    roadworthy_expiry_date, roadworthy_document_path
  ) values (
    user_id,
    upper(regexp_replace(vehicle ->> 'registration_number', '[[:space:]-]', '', 'g')),
    vehicle ->> 'make_model',
    (vehicle ->> 'seating_capacity')::smallint,
    roadworthy_expiry,
    vehicle ->> 'roadworthy_document_path'
  ) returning id into new_vehicle_id;

  return jsonb_build_object('profile_id', user_id, 'vehicle_id', new_vehicle_id);
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_profiles_role_immutable
  before update on public.profiles
  for each row execute function public.prevent_role_change();

create trigger trg_profiles_verification_protected
  before update on public.profiles
  for each row execute function public.protect_profile_verification_fields();

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_vehicles_driver_role
  before insert or update of driver_id on public.vehicles
  for each row execute function public.enforce_vehicle_driver_role();

create trigger trg_vehicles_verification_protected
  before update on public.vehicles
  for each row execute function public.protect_vehicle_verification_fields();

create trigger trg_vehicles_updated
  before update on public.vehicles
  for each row execute function public.set_updated_at();

revoke all on function public.register_driver_profile(jsonb, jsonb) from public, anon;
grant execute on function public.register_driver_profile(jsonb, jsonb) to authenticated;
