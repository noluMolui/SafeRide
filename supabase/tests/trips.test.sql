begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(18);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000501', 'authenticated', 'authenticated', 'trip-parent-a@example.invalid', '{}', '{"role":"parent","full_name":"Parent A","phone_e164":"+27821234567","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000502', 'authenticated', 'authenticated', 'trip-parent-b@example.invalid', '{}', '{"role":"parent","full_name":"Parent B","phone_e164":"+27821234568","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000503', 'authenticated', 'authenticated', 'trip-driver@example.invalid', '{}', '{"role":"driver","full_name":"Driver Test","phone_e164":"+27821234569","consent":true}', now(), now());
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000503', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver Test","phone_e164":"+27821234569","pdp_number":"PDP12345","pdp_expiry_date":"2099-12-31","service_suburbs":["Fourways"]}', '{"registration_number":"TRIP0001","make_model":"Toyota Quantum","seating_capacity":4,"roadworthy_expiry_date":"2099-12-31"}');
insert into public.routes (id, driver_id, vehicle_id, name, direction, departure_time, invite_code)
select '00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000503', id, 'Trip route', 'morning', '07:00', 'TRJPABCD'
from public.vehicles where driver_id = '00000000-0000-0000-0000-000000000503';
insert into public.learners (id,parent_id,full_name,school_name,grade,home_address,school_address,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone)
values
  ('00000000-0000-0000-0000-000000000521','00000000-0000-0000-0000-000000000501','Child A','Test School','3','10 Main Road','20 School Road','Parent A','Parent','+27821234567'),
  ('00000000-0000-0000-0000-000000000522','00000000-0000-0000-0000-000000000502','Child B','Test School','3','11 Main Road','20 School Road','Parent B','Parent','+27821234568');
insert into public.route_enrollments (route_id,direction,learner_id,status,decided_at)
values
  ('00000000-0000-0000-0000-000000000511','morning','00000000-0000-0000-0000-000000000521','active',now()),
  ('00000000-0000-0000-0000-000000000511','morning','00000000-0000-0000-0000-000000000522','active',now());

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.trips'::regclass), 'trips use forced RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.trip_logs'::regclass), 'trip logs use forced RLS');
set local role authenticated;
select lives_ok($$select set_config('test.trip_id', public.start_trip('00000000-0000-0000-0000-000000000511')::text, true)$$, 'driver can start an eligible route');
select throws_ok($$select public.start_trip('00000000-0000-0000-0000-000000000511')$$, '23505', null, 'driver cannot start a second active trip');
select throws_ok($$select public.log_trip_event('00000000-0000-0000-0000-000000000531',current_setting('test.trip_id')::uuid,'00000000-0000-0000-0000-000000000521','dropped_off',now())$$, 'P0001', 'invalid_log_transition', 'drop-off before pickup is rejected');
select lives_ok($$select public.log_trip_event('00000000-0000-0000-0000-000000000531',current_setting('test.trip_id')::uuid,'00000000-0000-0000-0000-000000000521','picked_up',now())$$, 'driver can pick up enrolled learner');
select lives_ok($$select public.log_trip_event('00000000-0000-0000-0000-000000000531',current_setting('test.trip_id')::uuid,'00000000-0000-0000-0000-000000000521','picked_up',now())$$, 'replaying the same event is idempotent');
select lives_ok($$select public.log_trip_event('00000000-0000-0000-0000-000000000532',current_setting('test.trip_id')::uuid,'00000000-0000-0000-0000-000000000522','picked_up',now())$$, 'driver can record another learner');
select throws_ok($$update public.trip_logs set status='absent'$$, '42501', null, 'authenticated users cannot directly edit trip logs');
select throws_ok($$select public.complete_trip(current_setting('test.trip_id')::uuid)$$, 'P0001', 'learners_still_on_board', 'completion is blocked while learners are on board');
select lives_ok($$select public.send_delay_notice(current_setting('test.trip_id')::uuid, 10::smallint, 'traffic', null)$$, 'driver can send a delay notice');
select lives_ok($$select public.void_trip_log('00000000-0000-0000-0000-000000000532')$$, 'driver can undo a recent pickup');
select lives_ok($$select public.log_trip_event('00000000-0000-0000-0000-000000000533',current_setting('test.trip_id')::uuid,'00000000-0000-0000-0000-000000000522','absent',now())$$, 'driver can mark absent after undo');
select lives_ok($$select public.log_trip_event('00000000-0000-0000-0000-000000000534',current_setting('test.trip_id')::uuid,'00000000-0000-0000-0000-000000000521','dropped_off',now())$$, 'driver can drop off a picked-up learner');
select lives_ok($$select public.complete_trip(current_setting('test.trip_id')::uuid)$$, 'driver can complete a trip when no learners remain on board');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}', true);
select is((select count(*)::int from public.trips), 1, 'parent can read the enrolled trip');
select is((select count(*)::int from public.trip_logs), 2, 'parent only receives their own learner logs');
select is((select learner_id from public.trip_logs limit 1), '00000000-0000-0000-0000-000000000521'::uuid, 'another family learner log remains private');
reset role;
select * from finish();
rollback;