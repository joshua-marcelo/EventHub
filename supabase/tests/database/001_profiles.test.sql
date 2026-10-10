-- EventHub · Phase 1 · Profiles, helpers, lookups, audit log.
-- Runs inside a transaction and rolls back: no data is left behind.
-- Run with `npm run test:db` (pgTAP via `supabase test db`).

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration owner)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'alice@test.local', '', now(), '{}', '{"first_name":"  Alice ","last_name":"Reyes","is_admin":true,"organizer_status":"active"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'bob@test.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'admin@test.local', '', now(), '{}', '{"first_name":"Ada","last_name":"Admin"}', now(), now());

update public.profiles set is_admin = true where id = 'c0000000-0000-4000-8000-000000000003';
update public.profiles set student_id = 'BOB-0001', program = 'BS Nursing' where id = 'b0000000-0000-4000-8000-000000000002';
insert into public.colleges (code, name) values ('TEST', 'Test College');
select private.log_audit('test.created', 'profile', 'b0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Profile creation trigger
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.profiles where id in (
  'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003')),
  3, 'a profile row is created for every new auth user');
select is((select email from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'alice@test.local', 'profile email is copied from auth.users');
select is((select first_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'Alice', 'first name from sign-up metadata is trimmed and copied');
select is((select is_admin from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  false, 'is_admin in user metadata is ignored');
select is((select organizer_status::text from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'none', 'organizer_status in user metadata is ignored; every account starts as participant');
select is((select first_name from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  null, 'missing metadata leaves names empty');

-- Email sync
update auth.users set email = 'bob.new@test.local' where id = 'b0000000-0000-4000-8000-000000000002';
select is((select email from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  'bob.new@test.local', 'email change in auth.users is synced to profiles');

-- ---------------------------------------------------------------------------
-- As Alice (participant)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.profiles), 1, 'participant sees only their own profile');
select is((select count(*)::int from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  0, 'participant cannot read another profile');
select is((select private.is_admin()), false, 'is_admin() is false for a participant');
select is((select private.is_active_organizer()), false, 'is_active_organizer() is false for a participant');
select lives_ok($$ update public.profiles set program = 'BS Information Technology', year_level = 3
                   where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'participant can update personal columns');
select throws_ok($$ update public.profiles set is_admin = true where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'participant cannot update is_admin');
select throws_ok($$ update public.profiles set organizer_status = 'active' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'participant cannot update organizer_status');
select throws_ok($$ update public.profiles set email = 'x@test.local' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'participant cannot update email');
select throws_ok($$ insert into public.profiles (id, email) values (gen_random_uuid(), 'x@test.local') $$,
  '42501', null, 'participant cannot insert profiles');
select throws_ok($$ delete from public.profiles where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'participant cannot delete profiles');
update public.profiles set program = 'Hijacked' where id = 'b0000000-0000-4000-8000-000000000002';
select throws_ok($$ update public.profiles set avatar_path = 'b0000000-0000-4000-8000-000000000002/x.webp'
                    where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'avatar path must be inside the owner''s folder');
select throws_ok($$ update public.profiles set student_id = 'BOB-0001' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23505', null, 'student ID must be unique');
select throws_ok($$ update public.profiles set student_id = 'bad id!' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'student ID must match the allowed format');
select throws_ok($$ update public.profiles set year_level = 9 where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'year level must be between 1 and 6');
select is((select is_complete from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  false, 'profile is incomplete while required fields are missing');
update public.profiles
  set student_id = 'ALICE-01',
      college_id = (select id from public.colleges where code = 'TEST'),
      middle_name = 'Mendoza',
      suffix = 'Jr.',
      avatar_path = 'a0000000-0000-4000-8000-000000000001/avatar.webp'
  where id = 'a0000000-0000-4000-8000-000000000001';
select is((select is_complete from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  true, 'profile becomes complete when all required fields are set');
select is((select p.profile_full_name from public.profiles p where p.id = 'a0000000-0000-4000-8000-000000000001'),
  'Alice M. Reyes, Jr.', 'profile_full_name formats first, middle initial, last, suffix');
select is((select count(*)::int from public.audit_logs), 0, 'participant cannot read audit logs');
select throws_ok($$ insert into public.audit_logs (action, entity_type) values ('x.y', 'z') $$,
  '42501', null, 'participant cannot insert audit logs');
select throws_ok($$ select private.log_audit('x.y', 'z', null) $$,
  '42501', null, 'participant cannot call private.log_audit');
select lives_ok($$ select * from public.colleges $$, 'authenticated users can read colleges');

-- ---------------------------------------------------------------------------
-- As admin
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select ok((select count(*)::int from public.profiles) >= 3, 'admin can read all profiles');
select is((select count(*)::int from public.audit_logs where action = 'test.created'), 1, 'admin can read audit logs');
update public.profiles set program = 'Admin edit' where id = 'b0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- As anon
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');

-- ---------------------------------------------------------------------------
-- Cross-user writes had no effect
-- ---------------------------------------------------------------------------
reset role;
select is((select program from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  'BS Nursing', 'neither a participant nor an admin can update another user''s profile');

select * from finish();
rollback;
