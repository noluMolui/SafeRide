create table public.trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  driver_id uuid not null,
  trip_date date not null default public.sast_today(),
  status public.trip_status not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_with_open_learners boolean not null default false,
  created_at timestamptz not null default now(),
  constraint trips_route_driver_fk foreign key (route_id, driver_id) references public.routes (id, driver_id) on delete restrict,
  constraint trips_completed_chk check ((status = 'active') = (completed_at is null))
);
create unique index trips_one_active_per_driver on public.trips(driver_id) where status = 'active';
create unique index trips_one_per_route_per_day on public.trips(route_id, trip_date) where status in ('active', 'completed');
create index trips_route_date_idx on public.trips(route_id, trip_date desc);
create index trips_driver_date_idx on public.trips(driver_id, trip_date desc);

create table public.trip_logs (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  status public.log_status not null,
  logged_at timestamptz not null,
  logged_by uuid not null references public.profiles(id),
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index trip_logs_one_status_per_learner on public.trip_logs(trip_id, learner_id, status) where voided_at is null;
create index trip_logs_trip_idx on public.trip_logs(trip_id, logged_at);
create index trip_logs_learner_idx on public.trip_logs(learner_id, logged_at desc);

alter table public.trips enable row level security;
alter table public.trips force row level security;
alter table public.trip_logs enable row level security;
alter table public.trip_logs force row level security;
revoke all on public.trips, public.trip_logs from public, anon, authenticated;
grant select on public.trips, public.trip_logs to authenticated;

create function public.parent_can_read_trip(target_trip_id uuid, target_learner_id uuid default null)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.trips as trip
    join public.route_enrollments as enrollment on enrollment.route_id = trip.route_id and enrollment.status = 'active'
    join public.learners as learner on learner.id = enrollment.learner_id and learner.is_active
    where trip.id = target_trip_id and learner.parent_id = auth.uid()
      and (target_learner_id is null or learner.id = target_learner_id)
  );
$$;
revoke all on function public.parent_can_read_trip(uuid, uuid) from public, anon;
grant execute on function public.parent_can_read_trip(uuid, uuid) to authenticated;

create policy trips_driver_select on public.trips for select to authenticated using (driver_id = (select auth.uid()));
create policy trips_parent_select on public.trips for select to authenticated using (public.parent_can_read_trip(id));
create policy trip_logs_driver_select on public.trip_logs for select to authenticated
  using (exists (select 1 from public.trips where id = trip_id and driver_id = (select auth.uid())));
create policy trip_logs_parent_select on public.trip_logs for select to authenticated
  using (public.parent_can_read_trip(trip_id, learner_id));

create function public.start_trip(route_id uuid)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  selected_route public.routes%rowtype;
  new_trip_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into selected_route from public.routes where id = route_id and driver_id = auth.uid() and is_active for update;
  if not found then raise exception 'route_not_found' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'driver' and pdp_expiry_date >= public.sast_today())
    or not exists (select 1 from public.vehicles where id = selected_route.vehicle_id and is_active and roadworthy_expiry_date >= public.sast_today()) then
    raise exception 'compliance_expired' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.route_enrollments where route_enrollments.route_id = selected_route.id and status = 'active') then
    raise exception 'route_has_no_learners' using errcode = 'P0001';
  end if;
  insert into public.trips (route_id, driver_id) values (selected_route.id, auth.uid()) returning id into new_trip_id;
  return new_trip_id;
end;
$$;

create function public.log_trip_event(event_id uuid, trip_id uuid, learner_id uuid, event_status public.log_status, event_time timestamptz)
returns public.trip_logs language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  selected_trip public.trips%rowtype;
  existing_log public.trip_logs%rowtype;
  has_pickup boolean;
  has_terminal boolean;
  new_log public.trip_logs%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into selected_trip from public.trips where id = trip_id and driver_id = auth.uid() for update;
  if not found then raise exception 'trip_not_found' using errcode = '42501'; end if;
  select * into existing_log from public.trip_logs where id = event_id;
  if found then
    if existing_log.trip_id = trip_id and existing_log.learner_id = learner_id and existing_log.status = event_status and existing_log.logged_at = event_time then
      return existing_log;
    end if;
    raise exception 'event_id_conflict' using errcode = '23505';
  end if;
  if selected_trip.status <> 'active' then raise exception 'trip_not_active' using errcode = 'P0001'; end if;
  if event_id is null or event_status is null or event_time is null or event_time < selected_trip.started_at or event_time > now() + interval '60 seconds' then
    raise exception 'invalid_event' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.route_enrollments as enrollment join public.learners as learner on learner.id = enrollment.learner_id
    where enrollment.route_id = selected_trip.route_id and enrollment.learner_id = log_trip_event.learner_id and enrollment.status = 'active' and learner.is_active) then
    raise exception 'learner_not_enrolled' using errcode = '42501';
  end if;
  select exists(select 1 from public.trip_logs as log where log.trip_id = selected_trip.id and log.learner_id = log_trip_event.learner_id and log.status = 'picked_up' and log.voided_at is null),
    exists(select 1 from public.trip_logs as log where log.trip_id = selected_trip.id and log.learner_id = log_trip_event.learner_id and log.status in ('dropped_off', 'absent') and log.voided_at is null)
  into has_pickup, has_terminal;
  if has_terminal or (has_pickup and event_status <> 'dropped_off') or (not has_pickup and event_status not in ('picked_up', 'absent')) then
    raise exception 'invalid_log_transition' using errcode = 'P0001';
  end if;
  insert into public.trip_logs (id, trip_id, learner_id, status, logged_at, logged_by)
    values (event_id, selected_trip.id, learner_id, event_status, event_time, auth.uid()) returning * into new_log;
  return new_log;
end;
$$;

revoke all on function public.start_trip(uuid), public.log_trip_event(uuid, uuid, uuid, public.log_status, timestamptz) from public, anon;
grant execute on function public.start_trip(uuid), public.log_trip_event(uuid, uuid, uuid, public.log_status, timestamptz) to authenticated;