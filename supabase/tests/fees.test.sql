begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(14);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated', 'fee-parent-a@example.invalid', '{}', '{"role":"parent","full_name":"Parent A","phone_e164":"+27821234567","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000602', 'authenticated', 'authenticated', 'fee-parent-b@example.invalid', '{}', '{"role":"parent","full_name":"Parent B","phone_e164":"+27821234568","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000603', 'authenticated', 'authenticated', 'fee-driver@example.invalid', '{}', '{"role":"driver","full_name":"Driver Test","phone_e164":"+27821234569","consent":true}', now(), now());
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000603","role":"authenticated"}', true);
select public.register_driver_profile('{"full_name":"Driver Test","phone_e164":"+27821234569","pdp_number":"PDP12345","pdp_expiry_date":"2099-12-31","service_suburbs":["Fourways"]}', '{"registration_number":"FEE00001","make_model":"Toyota Quantum","seating_capacity":4,"roadworthy_expiry_date":"2099-12-31"}');
insert into public.routes (id, driver_id, vehicle_id, name, direction, departure_time, invite_code)
select '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000603', id, 'Fee route', 'morning', '07:00', 'FEEABCDE'
from public.vehicles where driver_id = '00000000-0000-0000-0000-000000000603';
insert into public.learners (id,parent_id,full_name,school_name,grade,home_address,school_address,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone)
values
  ('00000000-0000-0000-0000-000000000621','00000000-0000-0000-0000-000000000601','Child A','Test School','3','10 Main Road','20 School Road','Parent A','Parent','+27821234567'),
  ('00000000-0000-0000-0000-000000000622','00000000-0000-0000-0000-000000000602','Child B','Test School','3','11 Main Road','20 School Road','Parent B','Parent','+27821234568');
insert into public.route_enrollments (route_id,direction,learner_id,status,decided_at)
values ('00000000-0000-0000-0000-000000000611','morning','00000000-0000-0000-0000-000000000621','active',now());

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.fee_records'::regclass), 'fees use forced RLS');
set local role authenticated;
select lives_ok($$select set_config('test.fee_id', public.create_fee('00000000-0000-0000-0000-000000000621','2026-11-01',150000,'2026-11-07')::text, true)$$, 'driver can create a fee for an active learner');
select throws_ok($$select public.create_fee('00000000-0000-0000-0000-000000000622','2026-11-01',150000,'2026-11-07')$$, '42501', 'learner_not_enrolled', 'driver cannot bill an unrelated learner');
select throws_ok($$select public.create_fee('00000000-0000-0000-0000-000000000621','2026-11-01',150000,'2026-11-07')$$, '23505', null, 'duplicate driver learner and month are rejected');
select throws_ok($$select public.create_fee('00000000-0000-0000-0000-000000000621','2026-12-01',0,'2026-12-07')$$, '23514', null, 'zero fee is rejected');
select is((public.generate_monthly_fees('2026-12-01',150000,'2026-12-07') ->> 'created')::integer, 1, 'monthly generation creates one fee');
select is((public.generate_monthly_fees('2026-12-01',150000,'2026-12-07') ->> 'skipped')::integer, 1, 'monthly generation skips duplicates');
select throws_ok($$select public.set_fee_status(current_setting('test.fee_id')::uuid,'paid')$$, 'P0001', 'invalid_payment', 'payment method is required');
select lives_ok($$select public.set_fee_status(current_setting('test.fee_id')::uuid,'paid','eft','TEST',now())$$, 'driver can mark a fee paid');
select throws_ok($$select public.set_fee_status(current_setting('test.fee_id')::uuid,'overdue')$$, 'P0001', 'invalid_fee_transition', 'paid fee cannot become overdue');
select lives_ok($$select public.set_fee_status(current_setting('test.fee_id')::uuid,'pending')$$, 'driver can correct a paid fee to pending');
select throws_ok($$select public.delete_pending_fee(current_setting('test.fee_id')::uuid)$$, '42501', 'fee_not_deletable', 'previously paid fee cannot be deleted');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
select is((select count(*)::int from public.fee_records), 0, 'unrelated parent cannot read another family fees');
select throws_ok($$update public.fee_records set status='paid'$$, '42501', null, 'parents cannot modify fee records directly');
reset role;
select * from finish();
rollback;