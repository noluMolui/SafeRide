create function public.is_saferide_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_saferide_admin() from public, anon;
grant execute on function public.is_saferide_admin() to authenticated;

grant update (full_name, phone_e164, business_name, pdp_number, pdp_expiry_date, pdp_document_path, service_suburbs) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_select on public.profiles for select to authenticated
  using (public.is_saferide_admin() and role = 'driver');

grant insert (driver_id, registration_number, make_model, seating_capacity, roadworthy_expiry_date, roadworthy_document_path) on public.vehicles to authenticated;
grant update (registration_number, make_model, seating_capacity, roadworthy_expiry_date, roadworthy_document_path, is_active) on public.vehicles to authenticated;
create policy vehicles_insert_own on public.vehicles for insert to authenticated
  with check (driver_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'driver'));
create policy vehicles_update_own on public.vehicles for update to authenticated
  using (driver_id = (select auth.uid())) with check (driver_id = (select auth.uid()));
create policy vehicles_admin_select on public.vehicles for select to authenticated
  using (public.is_saferide_admin());

create function public.verify_compliance(target_id uuid, document_type text, new_status public.verification_status, reason text default null)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not public.is_saferide_admin() then
    raise exception 'admin_role_required' using errcode = '42501';
  end if;
  if new_status not in ('verified', 'rejected') or new_status is null or char_length(reason) > 200 then
    raise exception 'invalid_verification' using errcode = '22023';
  end if;
  if document_type = 'pdp' then
    update public.profiles set pdp_verification = new_status, pdp_verification_note = reason
    where id = target_id and role = 'driver' and pdp_document_path is not null;
  elsif document_type = 'roadworthy' then
    update public.vehicles set roadworthy_verification = new_status, roadworthy_verification_note = reason
    where id = target_id and roadworthy_document_path is not null;
  else
    raise exception 'invalid_document_type' using errcode = '22023';
  end if;
  if not found then raise exception 'document_not_found' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.verify_compliance(uuid, text, public.verification_status, text) from public, anon;
grant execute on function public.verify_compliance(uuid, text, public.verification_status, text) to authenticated;