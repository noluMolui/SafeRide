create table public.fee_records (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  billing_month date not null check (extract(day from billing_month) = 1),
  amount_cents integer not null check (amount_cents between 1 and 5000000),
  due_date date not null,
  status public.fee_status not null default 'pending',
  paid_at timestamptz,
  payment_method public.payment_method,
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 50),
  note text check (note is null or char_length(note) <= 200),
  ever_paid boolean not null default false,
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_unique_per_month unique (driver_id, learner_id, billing_month),
  constraint fee_due_after_month check (due_date >= billing_month),
  constraint fee_paid_consistency check (
    (status = 'paid' and paid_at is not null and payment_method is not null)
    or (status <> 'paid' and paid_at is null and payment_method is null and payment_reference is null)
  )
);
create index fee_driver_month_idx on public.fee_records(driver_id, billing_month desc, status);
create index fee_learner_month_idx on public.fee_records(learner_id, billing_month desc);
create trigger trg_fee_updated before update on public.fee_records
  for each row execute function public.set_updated_at();
alter table public.fee_records enable row level security;
alter table public.fee_records force row level security;
revoke all on public.fee_records from public, anon, authenticated;
grant select on public.fee_records to authenticated;
create policy fees_driver_select on public.fee_records for select to authenticated using (driver_id = (select auth.uid()));
create policy fees_parent_select on public.fee_records for select to authenticated
  using (exists (select 1 from public.learners where id = learner_id and parent_id = (select auth.uid())));

create function public.create_fee(target_learner_id uuid, month date, amount integer, due date, fee_note text default null)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  new_fee_id uuid;
begin
  if auth.uid() is null or not public.driver_serves_learner(target_learner_id) then
    raise exception 'learner_not_enrolled' using errcode = '42501';
  end if;
  insert into public.fee_records (driver_id, learner_id, billing_month, amount_cents, due_date, note, status_changed_by)
  values (auth.uid(), target_learner_id, month, amount, due, fee_note, auth.uid()) returning id into new_fee_id;
  return new_fee_id;
end;
$$;

create function public.generate_monthly_fees(month date, amount_cents integer, due_date date, route_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_count integer;
  created_count integer;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role = 'driver') then
    raise exception 'driver_role_required' using errcode = '42501';
  end if;
  if month is null or extract(day from month) <> 1 or amount_cents is null or amount_cents not between 1 and 5000000 or due_date is null or due_date < month then
    raise exception 'invalid_fee' using errcode = '22023';
  end if;
  if route_id is not null and not exists (select 1 from public.routes where id = route_id and driver_id = auth.uid()) then
    raise exception 'route_not_found' using errcode = '42501';
  end if;
  select count(distinct enrollment.learner_id) into target_count
  from public.route_enrollments as enrollment
  join public.routes as route on route.id = enrollment.route_id
  join public.learners as learner on learner.id = enrollment.learner_id
  where route.driver_id = auth.uid() and enrollment.status = 'active' and learner.is_active
    and (generate_monthly_fees.route_id is null or route.id = generate_monthly_fees.route_id);
  insert into public.fee_records (driver_id, learner_id, billing_month, amount_cents, due_date, status_changed_by)
  select distinct auth.uid(), enrollment.learner_id, month, amount_cents, due_date, auth.uid()
  from public.route_enrollments as enrollment
  join public.routes as route on route.id = enrollment.route_id
  join public.learners as learner on learner.id = enrollment.learner_id
  where route.driver_id = auth.uid() and enrollment.status = 'active' and learner.is_active
    and (generate_monthly_fees.route_id is null or route.id = generate_monthly_fees.route_id)
  on conflict (driver_id, learner_id, billing_month) do nothing;
  get diagnostics created_count = row_count;
  return jsonb_build_object('created', created_count, 'skipped', target_count - created_count);
end;
$$;

create function public.set_fee_status(fee_id uuid, new_status public.fee_status, method public.payment_method default null, reference text default null, payment_time timestamptz default null)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  selected_fee public.fee_records%rowtype;
begin
  select * into selected_fee from public.fee_records where id = fee_id and driver_id = auth.uid() for update;
  if not found then raise exception 'fee_not_found' using errcode = '42501'; end if;
  if new_status is null or selected_fee.status = new_status or (selected_fee.status = 'paid' and new_status = 'overdue') or (selected_fee.status = 'pending' and new_status not in ('paid', 'overdue')) then
    raise exception 'invalid_fee_transition' using errcode = 'P0001';
  end if;
  if new_status = 'paid' and (method is null or (coalesce(payment_time, now()) at time zone 'Africa/Johannesburg')::date > public.sast_today()) then
    raise exception 'invalid_payment' using errcode = 'P0001';
  end if;
  update public.fee_records set status = new_status,
    paid_at = case when new_status = 'paid' then coalesce(payment_time, now()) else null end,
    payment_method = case when new_status = 'paid' then method else null end,
    payment_reference = case when new_status = 'paid' then reference else null end,
    ever_paid = ever_paid or new_status = 'paid', status_changed_at = now(), status_changed_by = auth.uid()
  where id = selected_fee.id;
end;
$$;

create function public.delete_pending_fee(fee_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  delete from public.fee_records where id = fee_id and driver_id = auth.uid() and status = 'pending' and not ever_paid;
  if not found then raise exception 'fee_not_deletable' using errcode = '42501'; end if;
end;
$$;

revoke all on function public.create_fee(uuid, date, integer, date, text), public.generate_monthly_fees(date, integer, date, uuid), public.set_fee_status(uuid, public.fee_status, public.payment_method, text, timestamptz), public.delete_pending_fee(uuid) from public, anon;
grant execute on function public.create_fee(uuid, date, integer, date, text), public.generate_monthly_fees(date, integer, date, uuid), public.set_fee_status(uuid, public.fee_status, public.payment_method, text, timestamptz), public.delete_pending_fee(uuid) to authenticated;