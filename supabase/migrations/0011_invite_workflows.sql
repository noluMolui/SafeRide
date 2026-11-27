create function public.lookup_invite(code text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  preview jsonb;
begin
  if actor_id is null or not exists (select 1 from public.profiles where id = actor_id and role = 'parent') then
    raise exception 'parent_role_required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));
  if (select count(*) from public.invite_attempts where user_id = actor_id and attempted_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  insert into public.invite_attempts (user_id) values (actor_id);
  select jsonb_build_object(
    'route_id', route.id, 'route_name', route.name, 'direction', route.direction,
    'departure_time', route.departure_time, 'days_of_week', route.days_of_week,
    'driver_name', driver.full_name, 'driver_phone', driver.phone_e164,
    'pdp_expiry_date', driver.pdp_expiry_date, 'pdp_verification', driver.pdp_verification,
    'registration_number', vehicle.registration_number, 'make_model', vehicle.make_model,
    'roadworthy_expiry_date', vehicle.roadworthy_expiry_date, 'roadworthy_verification', vehicle.roadworthy_verification
  ) into preview
  from public.routes as route
  join public.profiles as driver on driver.id = route.driver_id
  join public.vehicles as vehicle on vehicle.id = route.vehicle_id and vehicle.is_active
  where route.invite_code = upper(btrim(code)) and route.invite_active and route.is_active;
  return coalesce(preview, jsonb_build_object('error', 'invalid_code'));
end;
$$;

create function public.regenerate_invite(route_id uuid)
returns text language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  new_code text;
begin
  perform 1 from public.routes where id = route_id and driver_id = auth.uid() for update;
  if not found then raise exception 'route_not_found' using errcode = '42501'; end if;
  loop
    new_code := public.generate_invite_code();
    begin
      update public.routes set invite_code = new_code where id = route_id;
      return new_code;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$$;

create function public.leave_enrollment(enrollment_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  update public.route_enrollments as enrollment set status = 'removed', decided_at = now()
  where enrollment.id = enrollment_id and enrollment.status in ('pending', 'active')
    and exists (select 1 from public.learners where id = enrollment.learner_id and parent_id = auth.uid());
  if not found then raise exception 'enrollment_not_found' using errcode = '42501'; end if;
end;
$$;

create function public.get_pending_requests(target_route_id uuid)
returns table (enrollment_id uuid, first_name text, grade text, school_name text, parent_name text)
language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select enrollment.id, split_part(btrim(learner.full_name), ' ', 1), learner.grade, learner.school_name, parent.full_name
  from public.route_enrollments as enrollment
  join public.routes as route on route.id = enrollment.route_id
  join public.learners as learner on learner.id = enrollment.learner_id and learner.is_active
  join public.profiles as parent on parent.id = learner.parent_id
  where route.id = target_route_id and route.driver_id = auth.uid() and enrollment.status = 'pending';
$$;

revoke all on function public.lookup_invite(text), public.regenerate_invite(uuid), public.leave_enrollment(uuid), public.get_pending_requests(uuid) from public, anon;
grant execute on function public.lookup_invite(text), public.regenerate_invite(uuid), public.leave_enrollment(uuid), public.get_pending_requests(uuid) to authenticated;