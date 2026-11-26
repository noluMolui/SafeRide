insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('compliance-docs', 'compliance-docs', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create policy compliance_documents_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'compliance-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy compliance_documents_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'compliance-docs' and public.is_saferide_admin());
create policy compliance_documents_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'compliance-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'driver')
  );
create policy compliance_documents_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'compliance-docs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'compliance-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy compliance_documents_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'compliance-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);