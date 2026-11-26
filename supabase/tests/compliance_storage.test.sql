begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000801', 'authenticated', 'authenticated', 'storage-driver-a@example.invalid', '{}', '{"role":"driver","full_name":"Driver A","phone_e164":"+27821234567","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000802', 'authenticated', 'authenticated', 'storage-driver-b@example.invalid', '{}', '{"role":"driver","full_name":"Driver B","phone_e164":"+27821234568","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000803', 'authenticated', 'authenticated', 'storage-parent@example.invalid', '{}', '{"role":"parent","full_name":"Parent Test","phone_e164":"+27821234569","consent":true}', now(), now());
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver A","phone_e164":"+27821234567","pdp_number":"PDP12345","pdp_expiry_date":"2099-12-31","service_suburbs":["Fourways"]}', '{"registration_number":"STORE001","make_model":"Toyota Quantum","seating_capacity":4,"roadworthy_expiry_date":"2099-12-31"}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000802', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000802","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver B","phone_e164":"+27821234568","pdp_number":"PDP12346","pdp_expiry_date":"2099-12-31","service_suburbs":["Sandton"]}', '{"registration_number":"STORE002","make_model":"Toyota Quantum","seating_capacity":4,"roadworthy_expiry_date":"2099-12-31"}');

select is((select public from storage.buckets where id = 'compliance-docs'), false, 'compliance bucket is private');
select is((select file_size_limit from storage.buckets where id = 'compliance-docs'), 5242880::bigint, 'compliance uploads have a 5 MiB limit');
select ok((select allowed_mime_types = array['image/jpeg','image/png','application/pdf'] from storage.buckets where id = 'compliance-docs'), 'compliance bucket accepts only the required MIME types');
set local role authenticated;
select lives_ok($$insert into storage.objects (bucket_id, name) values ('compliance-docs','00000000-0000-0000-0000-000000000802/pdp.pdf')$$, 'driver can create an object in their folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('compliance-docs','00000000-0000-0000-0000-000000000801/pdp.pdf')$$, '42501', null, 'driver cannot create an object in another driver folder');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000801","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'compliance-docs'), 0, 'driver cannot read another driver document');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000803', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000803","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'compliance-docs'), 0, 'parent cannot read driver documents');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('compliance-docs','00000000-0000-0000-0000-000000000803/pdp.pdf')$$, '42501', null, 'parent cannot upload compliance documents');
reset role;
select * from finish();
rollback;