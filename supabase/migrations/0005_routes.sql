create table public.routes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  direction public.route_direction not null,
  departure_time time not null,
  days_of_week smallint[] not null default '{1,2,3,4,5}'
    check (cardinality(days_of_week) between 1 and 7 and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]),
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  invite_active boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_vehicle_fk foreign key (vehicle_id, driver_id) references public.vehicles (id, driver_id) on delete restrict,
  constraint routes_id_direction_unique unique (id, direction),
  constraint routes_id_driver_unique unique (id, driver_id)
);

create or replace function public.generate_invite_code()
returns text
language plpgsql volatile
set search_path = pg_catalog, public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_value bigint := ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))::bit(40)::bigint;
  result text := '';
  position_index integer;
begin
  for position_index in 1..8 loop
    result := result || substr(alphabet, ((random_value % 32) + 1)::integer, 1);
    random_value := random_value / 32;
  end loop;
  return result;
end;
$$;

alter table public.routes alter column invite_code set default public.generate_invite_code();
create index routes_driver_idx on public.routes(driver_id);
create trigger trg_routes_updated before update on public.routes
  for each row execute function public.set_updated_at();

alter table public.routes enable row level security;
alter table public.routes force row level security;
revoke all on public.routes from public, anon, authenticated;
grant select (id, driver_id, vehicle_id, name, direction, departure_time, days_of_week, invite_active, is_active, created_at, updated_at) on public.routes to authenticated;
grant insert (id, driver_id, vehicle_id, name, direction, departure_time, days_of_week) on public.routes to authenticated;
grant update (vehicle_id, name, direction, departure_time, days_of_week, invite_active, is_active) on public.routes to authenticated;

create policy routes_driver_select on public.routes for select to authenticated
  using (driver_id = (select auth.uid()));
create policy routes_driver_insert on public.routes for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'driver')
    and exists (select 1 from public.vehicles where id = vehicle_id and driver_id = (select auth.uid()) and is_active)
  );
create policy routes_driver_update on public.routes for update to authenticated
  using (driver_id = (select auth.uid()))
  with check (
    driver_id = (select auth.uid())
    and exists (select 1 from public.vehicles where id = vehicle_id and driver_id = (select auth.uid()) and is_active)
  );

create function public.get_route_invite_code(route_id uuid)
returns text
language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select invite_code from public.routes
  where id = route_id and driver_id = auth.uid();
$$;
revoke all on function public.get_route_invite_code(uuid) from public, anon;
grant execute on function public.get_route_invite_code(uuid) to authenticated;