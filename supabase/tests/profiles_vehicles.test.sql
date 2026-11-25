begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(28);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles forces RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.vehicles'::regclass), 'vehicles has RLS enabled');
select ok((select relforcerowsecurity from pg_class where oid = 'public.vehicles'::regclass), 'vehicles forces RLS');
select has_policy('public', 'profiles', 'profiles_select_own', 'profile owner select policy exists');
select has_policy('public', 'vehicles', 'vehicles_select_own', 'vehicle owner select policy exists');

select lives_ok($$insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated',
  'parent-profile-test@example.invalid', crypt('test-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"parent","full_name":"Parent Test","phone_e164":"+27821234567","consent":true}',
  now(), now()
)$$, 'parent auth signup creates successfully');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-000000000101'), 'parent', 'parent signup creates a parent profile');
select ok((select consent_accepted_at is not null from public.profiles where id = '00000000-0000-0000-0000-000000000101'), 'parent consent timestamp is recorded');

select lives_ok($$insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated',
  'driver-profile-test@example.invalid', crypt('test-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"driver","full_name":"Driver Test","phone_e164":"+27829876543","consent":true}',
  now(), now()
)$$, 'driver auth signup creates successfully');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000102'), 0, 'driver profile waits for atomic compliance registration');

select throws_ok($$insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated',
  'admin-profile-test@example.invalid', crypt('test-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"admin","full_name":"Admin Test","phone_e164":"+27821111111","consent":true}',
  now(), now()
)$$, '22023', 'Only parent and driver roles can self-register', 'admin signup is rejected');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}';
select lives_ok($$select public.register_driver_profile(
  '{"full_name":"Driver Test","phone_e164":"+27829876543","business_name":"Test Transport","pdp_number":"PDP12345","pdp_expiry_date":"2027-06-30","service_suburbs":["Fourways","Sandton"]}'::jsonb,
  '{"registration_number":"CA123456","make_model":"Toyota Quantum","seating_capacity":14,"roadworthy_expiry_date":"2027-06-30"}'::jsonb
)$$, 'driver profile and first vehicle register atomically');
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-000000000102'), 'driver', 'registered profile role is driver');
select is((select pdp_verification::text from public.profiles where id = '00000000-0000-0000-0000-000000000102'), 'unverified', 'PDP starts unverified');
select is((select roadworthy_verification::text from public.vehicles where driver_id = '00000000-0000-0000-0000-000000000102'), 'unverified', 'roadworthy starts unverified');

set local session_replication_role = replica;
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000105', 'authenticated', 'authenticated',
  'admin-profile-test@example.invalid', crypt('test-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
set local session_replication_role = origin;
insert into public.profiles (id, role, full_name, phone_e164, consent_accepted_at)
values ('00000000-0000-0000-0000-000000000105', 'admin', 'Admin Test', '+27821111111', now());
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000105';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000105","role":"authenticated"}';
select lives_ok($$update public.profiles set pdp_verification = 'verified' where id = '00000000-0000-0000-0000-000000000102'$$, 'admin may verify PDP');
select lives_ok($$update public.vehicles set roadworthy_verification = 'verified' where driver_id = '00000000-0000-0000-0000-000000000102'$$, 'admin may verify roadworthy');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}';

select throws_ok($$update public.profiles set role = 'parent' where id = '00000000-0000-0000-0000-000000000102'$$, '42501', 'profile role is immutable', 'a role cannot be changed');

update public.profiles set pdp_expiry_date = '2027-07-01' where id = '00000000-0000-0000-0000-000000000102';
select is((select pdp_verification::text from public.profiles where id = '00000000-0000-0000-0000-000000000102'), 'unverified', 'changing PDP details resets verification');
select throws_ok($$update public.profiles set pdp_verification = 'verified' where id = '00000000-0000-0000-0000-000000000102'$$, '42501', 'verification fields are admin-only', 'driver cannot set PDP verification');
update public.vehicles set roadworthy_expiry_date = '2027-07-01' where driver_id = '00000000-0000-0000-0000-000000000102';
select is((select roadworthy_verification::text from public.vehicles where driver_id = '00000000-0000-0000-0000-000000000102'), 'unverified', 'changing vehicle details resets verification');
select throws_ok($$update public.vehicles set roadworthy_verification = 'verified' where driver_id = '00000000-0000-0000-0000-000000000102'$$, '42501', 'verification fields are admin-only', 'driver cannot set roadworthy verification');

select lives_ok($$insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated',
  'driver-duplicate-test@example.invalid', crypt('test-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"driver","full_name":"Duplicate Test","phone_e164":"+27823334444","consent":true}',
  now(), now()
)$$, 'second driver auth signup creates successfully');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000104';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000104","role":"authenticated"}';
select throws_ok($$select public.register_driver_profile(
  '{"full_name":"Duplicate Test","phone_e164":"+27823334444","pdp_number":"PDP88888","pdp_expiry_date":"2027-06-30","service_suburbs":["Bryanston"]}'::jsonb,
  '{"registration_number":"CA123456","make_model":"Toyota Quantum","seating_capacity":14,"roadworthy_expiry_date":"2027-06-30"}'::jsonb
)$$, '23505', 'duplicate key value violates unique constraint "vehicles_registration_unique"', 'duplicate vehicle registration is rejected');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000104'), 0, 'failed vehicle registration rolls back profile insert');

select has_trigger('public', 'profiles', 'trg_profiles_updated', 'profile updated_at trigger exists');
select has_trigger('public', 'vehicles', 'trg_vehicles_updated', 'vehicle updated_at trigger exists');

select * from finish();
rollback;
