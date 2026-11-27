create table public.route_enrollments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null,
  direction public.route_direction not null,
  learner_id uuid not null references public.learners(id) on delete cascade,
  status public.enrollment_status not null default 'pending',
  stop_sequence smallint check (stop_sequence is null or stop_sequence between 1 and 99),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint enrollments_route_dir_fk foreign key (route_id, direction) references public.routes (id, direction) on delete cascade,
  constraint enrollments_route_learner_unique unique (route_id, learner_id),
  constraint enrollments_decided_chk check ((status = 'pending') = (decided_at is null))
);
create unique index enrollments_one_per_direction on public.route_enrollments(learner_id, direction) where status in ('pending', 'active');
create index enrollments_route_idx on public.route_enrollments(route_id, status);
create index enrollments_learner_idx on public.route_enrollments(learner_id, status);
create trigger trg_enrollments_updated before update on public.route_enrollments
  for each row execute function public.set_updated_at();

alter table public.route_enrollments enable row level security;
alter table public.route_enrollments force row level security;
revoke all on public.route_enrollments from public, anon, authenticated;
grant select on public.route_enrollments to authenticated;

create policy enrollments_parent_select on public.route_enrollments for select to authenticated
  using (exists (select 1 from public.learners where id = learner_id and parent_id = (select auth.uid())));
create policy enrollments_driver_select on public.route_enrollments for select to authenticated
  using (exists (select 1 from public.routes where id = route_id and driver_id = (select auth.uid())));

create table public.invite_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index invite_attempts_user_time_idx on public.invite_attempts(user_id, attempted_at);
alter table public.invite_attempts enable row level security;
alter table public.invite_attempts force row level security;
revoke all on public.invite_attempts from public, anon, authenticated;

create function public.redeem_invite(code text, learner_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  selected_route public.routes%rowtype;
  enrollment_id uuid;
begin
  if actor_id is null or not exists (select 1 from public.profiles where id = actor_id and role = 'parent') then
    raise exception 'parent_role_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.learners where id = learner_id and parent_id = actor_id and is_active) then
    raise exception 'learner_not_found' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));
  if (select count(*) from public.invite_attempts where user_id = actor_id and attempted_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  insert into public.invite_attempts (user_id) values (actor_id);
  select * into selected_route from public.routes where invite_code = upper(btrim(code)) and invite_active and is_active;
  if not found then
    return jsonb_build_object('error', 'invalid_code');
  end if;

  insert into public.route_enrollments (route_id, direction, learner_id)
  values (selected_route.id, selected_route.direction, learner_id)
  returning id into enrollment_id;
  return jsonb_build_object('enrollment_id', enrollment_id, 'status', 'pending');
end;
$$;

create function public.decide_enrollment(enrollment_id uuid, decision text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  selected_enrollment public.route_enrollments%rowtype;
  selected_route public.routes%rowtype;
  capacity integer;
begin
  if auth.uid() is null or decision not in ('approve', 'reject', 'remove') or decision is null then
    raise exception 'invalid_decision' using errcode = '42501';
  end if;
  select * into selected_enrollment from public.route_enrollments where id = enrollment_id for update;
  if not found then
    raise exception 'enrollment_not_found' using errcode = '42501';
  end if;
  select * into selected_route from public.routes where id = selected_enrollment.route_id and driver_id = auth.uid() for update;
  if not found then
    raise exception 'enrollment_not_found' using errcode = '42501';
  end if;
  if (decision in ('approve', 'reject') and selected_enrollment.status <> 'pending')
    or (decision = 'remove' and selected_enrollment.status <> 'active') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if decision = 'approve' then
    if not selected_route.is_active or not exists (select 1 from public.learners where id = selected_enrollment.learner_id and is_active) then
      raise exception 'inactive_route_or_learner' using errcode = 'P0001';
    end if;
    select seating_capacity - 1 into capacity from public.vehicles where id = selected_route.vehicle_id and is_active;
    if capacity is null or (select count(*) from public.route_enrollments where route_id = selected_route.id and status = 'active') >= capacity then
      raise exception 'route_full' using errcode = 'P0001';
    end if;
  end if;
  update public.route_enrollments
  set status = case when decision = 'approve' then 'active'::public.enrollment_status else 'removed'::public.enrollment_status end,
      decided_at = now()
  where id = enrollment_id;
  return jsonb_build_object('enrollment_id', enrollment_id, 'status', case when decision = 'approve' then 'active' else 'removed' end);
end;
$$;

create function public.remove_archived_learner_enrollments()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if old.is_active and not new.is_active then
    update public.route_enrollments set status = 'removed', decided_at = now()
    where learner_id = new.id and status in ('pending', 'active');
  end if;
  return new;
end;
$$;
create trigger trg_archive_learner_enrollments after update of is_active on public.learners
  for each row execute function public.remove_archived_learner_enrollments();

revoke all on function public.redeem_invite(text, uuid) from public, anon;
revoke all on function public.decide_enrollment(uuid, text) from public, anon;
grant execute on function public.redeem_invite(text, uuid) to authenticated;
grant execute on function public.decide_enrollment(uuid, text) to authenticated;