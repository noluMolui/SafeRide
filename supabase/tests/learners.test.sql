begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(8);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'parent-a-learner@example.invalid', '{}', '{"role":"parent","full_name":"Parent A","phone_e164":"+27821234567","consent":true}', now(), now()),
  ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'parent-b-learner@example.invalid', '{}', '{"role":"parent","full_name":"Parent B","phone_e164":"+27821234568","consent":true}', now(), now());

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.learners'::regclass), 'learner RLS is enabled and forced');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated"}', true);
select lives_ok($$insert into public.learners (id,parent_id,full_name,school_name,grade,home_address,school_address,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone) values ('00000000-0000-0000-0000-000000000211','00000000-0000-0000-0000-000000000201','Child A','Test School','3','10 Main Road','20 School Road','Parent A','Parent','+27821234567')$$, 'parent can create their own learner');
select is((select count(*)::int from public.learners), 1, 'parent can read their own learner');
select throws_ok($$insert into public.learners (parent_id,full_name,school_name,grade,home_address,school_address,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone) values ('00000000-0000-0000-0000-000000000202','Child B','Test School','3','10 Main Road','20 School Road','Parent B','Parent','+27821234568')$$, '42501', null, 'parent cannot create a learner for another parent');
select throws_ok($$update public.learners set parent_id = '00000000-0000-0000-0000-000000000202' where id = '00000000-0000-0000-0000-000000000211'$$, '42501', null, 'parent cannot change learner ownership');
select throws_ok($$delete from public.learners where id = '00000000-0000-0000-0000-000000000211'$$, '42501', null, 'parent cannot hard-delete a learner');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}', true);
select is((select count(*)::int from public.learners), 0, 'another parent cannot read the learner');
with changed as (update public.learners set full_name = 'Changed Child' where id = '00000000-0000-0000-0000-000000000211' returning id)
select is((select count(*)::int from changed), 0, 'another parent cannot update the learner');
reset role;
select * from finish();
rollback;