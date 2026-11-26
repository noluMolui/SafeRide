begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(10);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'route-driver-a@example.invalid', '{}', '{"role":"driver","full_name":"Driver A","phone_e164":"+27821234567","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated', 'route-driver-b@example.invalid', '{}', '{"role":"driver","full_name":"Driver B","phone_e164":"+27821234568","consent":true}', now(), now());

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver A","phone_e164":"+27821234567","pdp_number":"PDP12345","pdp_expiry_date":"2099-12-31","service_suburbs":["Fourways"]}', '{"registration_number":"TEST0001","make_model":"Toyota Quantum","seating_capacity":15,"roadworthy_expiry_date":"2099-12-31"}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000302","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver B","phone_e164":"+27821234568","pdp_number":"PDP12346","pdp_expiry_date":"2099-12-31","service_suburbs":["Sandton"]}', '{"registration_number":"TEST0002","make_model":"Toyota Quantum","seating_capacity":15,"roadworthy_expiry_date":"2099-12-31"}');

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.routes'::regclass), 'routes use forced RLS');
select ok(public.generate_invite_code() ~ '^[A-HJ-NP-Z2-9]{8}$', 'generated invite uses the required alphabet');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.routes (id,driver_id,vehicle_id,name,direction,departure_time) values ('00000000-0000-0000-0000-000000000311','00000000-0000-0000-0000-000000000301',(select id from public.vehicles where driver_id='00000000-0000-0000-0000-000000000301'),'Morning route','morning','07:00')$$, 'driver creates a route using their vehicle');
select is((select count(*)::int from public.routes), 1, 'driver reads their own route');
select ok(public.get_route_invite_code('00000000-0000-0000-0000-000000000311') ~ '^[A-HJ-NP-Z2-9]{8}$', 'driver can read their invite code through the restricted function');
select throws_ok($$select invite_code from public.routes$$, '42501', null, 'invite codes cannot be selected directly');
select throws_ok($$insert into public.routes (driver_id,vehicle_id,name,direction,departure_time) values ('00000000-0000-0000-0000-000000000302',(select id from public.vehicles where driver_id='00000000-0000-0000-0000-000000000301'),'Wrong owner','morning','07:00')$$, '42501', null, 'driver cannot create a route for another driver');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000302","role":"authenticated"}', true);
select is((select count(*)::int from public.routes), 0, 'another driver cannot read the route');
select is(public.get_route_invite_code('00000000-0000-0000-0000-000000000311'), null::text, 'another driver cannot access the invite');
select throws_ok($$delete from public.routes$$, '42501', null, 'authenticated users cannot hard-delete routes');
reset role;
select * from finish();
rollback;