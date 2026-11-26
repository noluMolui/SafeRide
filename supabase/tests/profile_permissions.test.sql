begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000701', 'authenticated', 'authenticated', 'permissions-parent@example.invalid', '{}', '{"role":"parent","full_name":"Parent Test","phone_e164":"+27821234567","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000702', 'authenticated', 'authenticated', 'permissions-driver@example.invalid', '{}', '{"role":"driver","full_name":"Driver Test","phone_e164":"+27821234568","consent":true}', now(), now());
set local session_replication_role = replica;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000703', 'authenticated', 'authenticated', 'permissions-admin@example.invalid', '{}', '{}', now(), now());
set local session_replication_role = origin;
insert into public.profiles (id, role, full_name, phone_e164, consent_accepted_at)
values ('00000000-0000-0000-0000-000000000703', 'admin', 'Admin Test', '+27821234569', now());
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver Test","phone_e164":"+27821234568","pdp_number":"PDP12345","pdp_expiry_date":"2099-12-31","service_suburbs":["Fourways"],"pdp_document_path":"driver/pdp.pdf"}', '{"registration_number":"PERM0001","make_model":"Toyota Quantum","seating_capacity":4,"roadworthy_expiry_date":"2099-12-31"}');

set local role authenticated;
select lives_ok($$update public.profiles set full_name = 'Driver Updated' where id = '00000000-0000-0000-0000-000000000702'$$, 'driver can update their own allowed fields');
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000702'$$, '42501', null, 'driver cannot change their role');
select throws_ok($$update public.profiles set pdp_verification = 'verified' where id = '00000000-0000-0000-0000-000000000702'$$, '42501', null, 'driver cannot set verification directly');
select throws_ok($$select public.verify_compliance('00000000-0000-0000-0000-000000000702','pdp','verified')$$, '42501', 'admin_role_required', 'driver cannot use admin verification RPC');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000702'), 0, 'unlinked parent cannot read driver profile');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000703', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000703","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000702'), 1, 'admin can review driver profile');
select lives_ok($$select public.verify_compliance('00000000-0000-0000-0000-000000000702','pdp','verified')$$, 'admin can verify an uploaded PDP');
select is((select pdp_verification::text from public.profiles where id = '00000000-0000-0000-0000-000000000702'), 'verified', 'verified status is persisted');
reset role;
select * from finish();
rollback;