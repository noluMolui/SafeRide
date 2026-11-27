create function public.get_driver_trip_history(page_offset integer default 0, page_size integer default 20)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'driver') then
    raise exception 'driver_role_required' using errcode = '42501';
  end if;
  if page_offset < 0 or page_size not between 1 and 50 then raise exception 'invalid_pagination' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(page) order by trip_date desc, started_at desc), '[]'::jsonb) into result
  from (
    select trip.id as trip_id, trip.trip_date, trip.status as trip_status, trip.started_at, trip.completed_at,
      trip.completed_with_open_learners, route.name as route_name, route.direction,
      (count(log.id) filter (where log.status = 'picked_up' and log.voided_at is null))::int as picked_up_count,
      (count(log.id) filter (where log.status = 'dropped_off' and log.voided_at is null))::int as dropped_off_count,
      (count(log.id) filter (where log.status = 'absent' and log.voided_at is null))::int as absent_count,
      greatest((select count(*) from public.route_enrollments as enrollment where enrollment.route_id = route.id and enrollment.status = 'active')
        - count(distinct log.learner_id) filter (where log.voided_at is null), 0)::int as no_update_count
    from public.trips as trip
    join public.routes as route on route.id = trip.route_id
    left join public.trip_logs as log on log.trip_id = trip.id
    where trip.driver_id = auth.uid() and trip.trip_date >= public.sast_today() - 90
    group by trip.id, route.id
    order by trip.trip_date desc, trip.started_at desc
    offset page_offset limit page_size
  ) as page;
  return result;
end;
$$;

create function public.get_driver_trip_detail(target_trip_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.trips where id = target_trip_id and driver_id = auth.uid()) then
    raise exception 'trip_not_found' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'trip_id', trip.id, 'route_name', route.name, 'direction', route.direction, 'trip_date', trip.trip_date,
    'status', trip.status, 'started_at', trip.started_at, 'completed_at', trip.completed_at,
    'completed_with_open_learners', trip.completed_with_open_learners,
    'learners', coalesce((
      select jsonb_agg(jsonb_build_object('learner_id', learner.id, 'full_name', learner.full_name, 'grade', learner.grade, 'logs', coalesce((
        select jsonb_agg(jsonb_build_object('id', log.id, 'status', log.status, 'logged_at', log.logged_at) order by log.logged_at)
        from public.trip_logs as log where log.trip_id = trip.id and log.learner_id = learner.id and log.voided_at is null
      ), '[]'::jsonb)) order by enrollment.stop_sequence nulls last)
      from public.route_enrollments as enrollment join public.learners as learner on learner.id = enrollment.learner_id
      where enrollment.route_id = route.id and enrollment.status = 'active'
    ), '[]'::jsonb),
    'delays', coalesce((select jsonb_agg(jsonb_build_object('minutes', delay_minutes, 'reason', reason, 'message', message, 'created_at', created_at) order by created_at)
      from public.trip_delay_notices where trip_id = trip.id), '[]'::jsonb)
  ) into result
  from public.trips as trip join public.routes as route on route.id = trip.route_id
  where trip.id = target_trip_id and trip.driver_id = auth.uid();
  return result;
end;
$$;

revoke all on function public.get_driver_trip_history(integer, integer), public.get_driver_trip_detail(uuid) from public, anon;
grant execute on function public.get_driver_trip_history(integer, integer), public.get_driver_trip_detail(uuid) to authenticated;
