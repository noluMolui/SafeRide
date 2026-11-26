begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000401', 'authenticated', 'authenticated', 'enrollment-parent@example.invalid', '{}', '{"role":"parent","full_name":"Parent Test","phone_e164":"+27821234567","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000402', 'authenticated', 'authenticated', 'enrollment-driver@example.invalid', '{}', '{"role":"driver","full_name":"Driver Test","phone_e164":"+27821234568","consent":true}', now(), now());
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver Test","phone_e164":"+27821234568","pdp_number":"PDP12345","pdp_expiry_date":"2099-12-31","service_suburbs":["Fourways"]}', '{"registration_number":"ENROLL01","make_model":"Toyota Quantum","seating_capacity":4,"roadworthy_expiry_date":"2099-12-31"}');
insert into public.routes (id, driver_id, vehicle_id, name, direction, departure_time, invite_code)
select '00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000402', id, 'Test route', 'morning', '07:00', 'ABCDEFGH'
from public.vehicles where driver_id = '00000000-0000-0000-0000-000000000402';
insert into public.learners (id,parent_id,full_name,school_name,grade,home_address,school_address,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone)
values ('00000000-0000-0000-0000-000000000421','00000000-0000-0000-0000-000000000401','Child Test','Test School','3','10 Main Road','20 School Road','Parent Test','Parent','+27821234567');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}', true);
select is(public.redeem_invite('INVALID2','00000000-0000-0000-0000-000000000421') ->> 'error', 'invalid_code', 'invalid invite is rejected uniformly');
select is(public.redeem_invite('ABCDEFGH','00000000-0000-0000-0000-000000000421') ->> 'status', 'pending', 'valid invite creates pending enrollment');
select is((select count(*)::int from public.route_enrollments), 1, 'parent can read own enrollment');
select throws_ok($$update public.route_enrollments set status='active'$$, '42501', null, 'parent cannot approve enrollment directly');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}', true);
select is((select count(*)::int from public.learners), 0, 'driver cannot read pending learner details');
select is(public.decide_enrollment((select id from public.route_enrollments limit 1), 'approve') ->> 'status', 'active', 'route owner may approve a pending learner');
select is((select count(*)::int from public.learners), 1, 'driver can read an actively enrolled learner');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}', true);
update public.learners set is_active = false where id = '00000000-0000-0000-0000-000000000421';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}', true);
select is((select count(*)::int from public.learners), 0, 'archiving revokes the driver learner access');
reset role;
select * from finish();
rollback;