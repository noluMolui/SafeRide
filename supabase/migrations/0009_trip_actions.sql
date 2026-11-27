create table public.trip_delay_notices (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  delay_minutes smallint not null check (delay_minutes in (5,10,15,20,30,45,60)),
  reason public.delay_reason not null,
  message text check (message is null or char_length(message) <= 140),
  created_at timestamptz not null default now()
);
create index delay_notices_trip_idx on public.trip_delay_notices(trip_id, created_at desc);
alter table public.trip_delay_notices enable row level security;
alter table public.trip_delay_notices force row level security;
revoke all on public.trip_delay_notices from public, anon, authenticated;
grant select on public.trip_delay_notices to authenticated;
create policy trip_delays_driver_select on public.trip_delay_notices for select to authenticated using (driver_id = (select auth.uid()));
create policy trip_delays_parent_select on public.trip_delay_notices for select to authenticated using (public.parent_can_read_trip(trip_id));

create function public.void_trip_log(log_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  selected_log public.trip_logs%rowtype;
  selected_trip public.trips%rowtype;
begin
  select * into selected_log from public.trip_logs where id = log_id;
  if not found or auth.uid() is null then raise exception 'log_not_found' using errcode = '42501'; end if;
  select * into selected_trip from public.trips where id = selected_log.trip_id and driver_id = auth.uid() for update;
  if not found then raise exception 'log_not_found' using errcode = '42501'; end if;
  select * into selected_log from public.trip_logs where id = log_id;
  if selected_trip.status <> 'active' or selected_log.voided_at is not null or selected_log.logged_at < now() - interval '5 minutes'
    or selected_log.logged_at > now() + interval '60 seconds' then
    raise exception 'undo_not_allowed' using errcode = 'P0001';
  end if;
  if selected_log.status = 'picked_up' and exists (select 1 from public.trip_logs where trip_id = selected_log.trip_id and learner_id = selected_log.learner_id and status = 'dropped_off' and voided_at is null) then
    raise exception 'undo_latest_first' using errcode = 'P0001';
  end if;
  update public.trip_logs set voided_at = now() where id = selected_log.id;
end;
$$;

create function public.send_delay_notice(trip_id uuid, minutes smallint, reason public.delay_reason, message text default null)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  selected_trip public.trips%rowtype;
  notice_id uuid;
begin
  select * into selected_trip from public.trips where id = trip_id and driver_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'trip_not_found' using errcode = '42501'; end if;
  if (select count(*) from public.trip_delay_notices where trip_delay_notices.trip_id = selected_trip.id) >= 5 then
    raise exception 'delay_limit_reached' using errcode = 'P0001';
  end if;
  insert into public.trip_delay_notices (trip_id, driver_id, delay_minutes, reason, message)
    values (selected_trip.id, auth.uid(), minutes, reason, message) returning id into notice_id;
  return notice_id;
end;
$$;

create function public.complete_trip(trip_id uuid, force boolean default false)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  selected_trip public.trips%rowtype;
  open_learners integer;
begin
  select * into selected_trip from public.trips where id = trip_id and driver_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'trip_not_found' using errcode = '42501'; end if;
  select count(*) into open_learners from public.trip_logs as pickup
    where pickup.trip_id = selected_trip.id and pickup.status = 'picked_up' and pickup.voided_at is null
    and not exists (select 1 from public.trip_logs as dropoff where dropoff.trip_id = pickup.trip_id and dropoff.learner_id = pickup.learner_id and dropoff.status = 'dropped_off' and dropoff.voided_at is null);
  if open_learners > 0 and not coalesce(force, false) then
    raise exception 'learners_still_on_board' using errcode = 'P0001';
  end if;
  update public.trips set status = 'completed', completed_at = now(), completed_with_open_learners = open_learners > 0 where id = selected_trip.id;
end;
$$;

create function public.cancel_trip(trip_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  update public.trips set status = 'cancelled', completed_at = now()
  where id = trip_id and driver_id = auth.uid() and status = 'active';
  if not found then raise exception 'trip_not_found' using errcode = '42501'; end if;
end;
$$;

revoke all on function public.void_trip_log(uuid), public.send_delay_notice(uuid, smallint, public.delay_reason, text), public.complete_trip(uuid, boolean), public.cancel_trip(uuid) from public, anon;
grant execute on function public.void_trip_log(uuid), public.send_delay_notice(uuid, smallint, public.delay_reason, text), public.complete_trip(uuid, boolean), public.cancel_trip(uuid) to authenticated;