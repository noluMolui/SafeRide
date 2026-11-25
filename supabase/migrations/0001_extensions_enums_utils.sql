create extension if not exists pgcrypto;

create type public.user_role as enum ('driver', 'parent', 'admin');
create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.route_direction as enum ('morning', 'afternoon');
create type public.enrollment_status as enum ('pending', 'active', 'removed');
create type public.trip_status as enum ('active', 'completed', 'cancelled');
create type public.log_status as enum ('picked_up', 'dropped_off', 'absent');
create type public.delay_reason as enum ('traffic', 'vehicle_issue', 'weather', 'school_delay', 'other');
create type public.fee_status as enum ('pending', 'paid', 'overdue');
create type public.payment_method as enum ('cash', 'eft', 'other');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sast_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Africa/Johannesburg')::date;
$$;
