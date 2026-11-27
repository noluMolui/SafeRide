alter table public.fee_records add column if not exists ever_paid boolean not null default false;

grant select on public.fee_records to authenticated;

create or replace function public.get_parent_home()
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'parent') then
    raise exception 'parent_role_required' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'learner_id', learner.id,
    'learner_name', learner.full_name,
    'school_name', learner.school_name,
    'grade', learner.grade,
    'route_id', route_data.route_id,
    'route_name', route_data.route_name,
    'direction', route_data.direction,
    'departure_time', route_data.departure_time,
    'enrollment_status', route_data.enrollment_status,
    'driver_name', route_data.driver_name,
    'driver_phone', route_data.driver_phone,
    'pdp_verification', route_data.pdp_verification,
    'pdp_expiry_date', route_data.pdp_expiry_date,
    'roadworthy_verification', route_data.roadworthy_verification,
    'roadworthy_expiry_date', route_data.roadworthy_expiry_date,
    'trip_id', route_data.trip_id,
    'trip_status', route_data.trip_status,
    'trip_started_at', route_data.trip_started_at,
    'last_log_status', route_data.last_log_status,
    'last_log_at', route_data.last_log_at,
    'delay_minutes', route_data.delay_minutes,
    'delay_reason', route_data.delay_reason,
    'delay_message', route_data.delay_message
  ) order by learner.full_name, route_data.direction), '[]'::jsonb)
  into result
  from public.learners as learner
  left join lateral (
    select enrollment.route_id, enrollment.direction, enrollment.status as enrollment_status,
      route.name as route_name, route.departure_time, driver.full_name as driver_name, driver.phone_e164 as driver_phone,
      driver.pdp_verification, driver.pdp_expiry_date, vehicle.roadworthy_verification, vehicle.roadworthy_expiry_date,
      trip.id as trip_id, trip.status as trip_status, trip.started_at as trip_started_at,
      log.status as last_log_status, log.logged_at as last_log_at,
      delay.delay_minutes, delay.reason as delay_reason, delay.message as delay_message
    from public.route_enrollments as enrollment
    join public.routes as route on route.id = enrollment.route_id
    join public.profiles as driver on driver.id = route.driver_id
    join public.vehicles as vehicle on vehicle.id = route.vehicle_id
    left join lateral (
      select t.* from public.trips as t
      where t.route_id = route.id and t.trip_date = public.sast_today()
      order by t.started_at desc limit 1
    ) as trip on true
    left join lateral (
      select l.* from public.trip_logs as l
      where l.trip_id = trip.id and l.learner_id = learner.id and l.voided_at is null
      order by l.logged_at desc limit 1
    ) as log on true
    left join lateral (
      select d.* from public.trip_delay_notices as d
      where d.trip_id = trip.id order by d.created_at desc limit 1
    ) as delay on true
    where enrollment.learner_id = learner.id and enrollment.status in ('pending', 'active')
  ) as route_data on true
  where learner.parent_id = auth.uid() and learner.is_active;
  return result;
end;
$$;

create or replace function public.get_parent_trip_history(target_learner_id uuid, page_offset integer default 0, page_size integer default 20)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.learners where id = target_learner_id and parent_id = auth.uid()) then
    raise exception 'learner_not_found' using errcode = '42501';
  end if;
  if page_offset < 0 or page_size not between 1 and 50 then raise exception 'invalid_pagination' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'trip_id', page.trip_id, 'trip_date', page.trip_date, 'route_name', page.route_name,
    'direction', page.direction, 'trip_status', page.trip_status, 'started_at', page.started_at,
    'completed_at', page.completed_at, 'events', page.events, 'delays', page.delays
  ) order by page.trip_date desc, page.started_at desc), '[]'::jsonb)
  into result
  from (
    select trip.id as trip_id, trip.trip_date, route.name as route_name, route.direction,
      trip.status as trip_status, trip.started_at, trip.completed_at,
      (select coalesce(jsonb_agg(jsonb_build_object('status', log.status, 'logged_at', log.logged_at) order by log.logged_at), '[]'::jsonb)
        from public.trip_logs as log where log.trip_id = trip.id and log.learner_id = target_learner_id and log.voided_at is null) as events,
      (select coalesce(jsonb_agg(jsonb_build_object('minutes', delay.delay_minutes, 'reason', delay.reason, 'message', delay.message, 'created_at', delay.created_at) order by delay.created_at), '[]'::jsonb)
        from public.trip_delay_notices as delay where delay.trip_id = trip.id) as delays
    from public.route_enrollments as enrollment
    join public.routes as route on route.id = enrollment.route_id
    join public.trips as trip on trip.route_id = route.id
    where enrollment.learner_id = target_learner_id and trip.trip_date >= public.sast_today() - 90
    order by trip.trip_date desc, trip.started_at desc
    offset page_offset limit page_size
  ) as page;
  return result;
end;
$$;

create or replace function public.get_driver_fee_ledger(target_month date)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'driver') then
    raise exception 'driver_role_required' using errcode = '42501';
  end if;
  if target_month is null or extract(day from target_month) <> 1 then raise exception 'invalid_billing_month' using errcode = '22023'; end if;
  with fee_rows as (
    select fee.id, fee.learner_id, learner.full_name as learner_name, fee.amount_cents, fee.due_date, fee.status, fee.billing_month, fee.paid_at, fee.payment_method, fee.payment_reference
    from public.fee_records as fee join public.learners as learner on learner.id = fee.learner_id
    where fee.driver_id = auth.uid() and fee.billing_month = target_month
  )
  select jsonb_build_object(
    'fees', coalesce((select jsonb_agg(to_jsonb(fee_rows) order by learner_name) from fee_rows), '[]'::jsonb),
    'summary', jsonb_build_object(
      'billed_cents', coalesce((select sum(amount_cents) from fee_rows), 0),
      'collected_cents', coalesce((select sum(amount_cents) from fee_rows where status = 'paid'), 0),
      'outstanding_cents', coalesce((select sum(amount_cents) from fee_rows where status in ('pending','overdue')), 0)
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_parent_home(), public.get_parent_trip_history(uuid, integer, integer), public.get_driver_fee_ledger(date) from public, anon;
grant execute on function public.get_parent_home(), public.get_parent_trip_history(uuid, integer, integer), public.get_driver_fee_ledger(date) to authenticated;

create or replace function public.update_pending_fee(fee_id uuid, new_amount_cents integer, new_due_date date, new_note text default null)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new_amount_cents not between 1 and 5000000 or new_due_date is null or new_note is not null and char_length(new_note) > 200 then
    raise exception 'invalid_fee' using errcode = '22023';
  end if;
  update public.fee_records set amount_cents = new_amount_cents, due_date = new_due_date, note = new_note
  where id = fee_id and driver_id = auth.uid() and status = 'pending' and not ever_paid and new_due_date >= billing_month;
  if not found then raise exception 'fee_not_editable' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.update_pending_fee(uuid, integer, date, text) from public, anon;
grant execute on function public.update_pending_fee(uuid, integer, date, text) to authenticated;

create or replace function public.mark_overdue_fees()
returns integer language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare changed integer;
begin
  update public.fee_records set status = 'overdue', status_changed_at = now(), status_changed_by = null
  where status = 'pending' and due_date < public.sast_today();
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.mark_overdue_fees() from public, anon, authenticated;
grant execute on function public.mark_overdue_fees() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $job$select cron.schedule('saferide-mark-overdue-fees', '0 0 * * *', 'select public.mark_overdue_fees()')$job$;
    exception when others then
      null;
    end;
  end if;
end;
$$;
