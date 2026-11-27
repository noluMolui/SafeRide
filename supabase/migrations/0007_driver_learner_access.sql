create function public.driver_serves_learner(target_learner_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.route_enrollments as enrollment
    join public.routes as route on route.id = enrollment.route_id
    join public.learners as learner on learner.id = enrollment.learner_id
    where enrollment.learner_id = target_learner_id
      and enrollment.status = 'active'
      and learner.is_active
      and route.driver_id = auth.uid()
  );
$$;
revoke all on function public.driver_serves_learner(uuid) from public, anon;
grant execute on function public.driver_serves_learner(uuid) to authenticated;
create policy learners_active_driver_select on public.learners for select to authenticated
  using (public.driver_serves_learner(id));