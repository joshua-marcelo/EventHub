-- EventHub · Phase 1b · Revision 2 corrections: anonymous-user guard, admin-managed lookups,
-- programs within colleges, privacy consent, corrected enums.
-- Runs inside a transaction and rolls back: no data is left behind.
-- Run with `npm run test:db` (pgTAP via `supabase test db`).

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration owner)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'paula@test.local', '', now(), '{}', '{"first_name":"Paula","last_name":"Cruz"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'admin2@test.local', '', now(), '{}', '{"first_name":"Ana","last_name":"Admin"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
   null, '', null, '{}', '{}', true, now(), now());

update public.profiles set is_admin = true where id = 'e0000000-0000-4000-8000-000000000005';
insert into public.colleges (code, name) values ('TST-A', 'Test College A'), ('TST-B', 'Test College B');
insert into public.programs (college_id, name)
  select id, 'Program A' from public.colleges where code = 'TST-A'
  union all
  select id, 'Program B' from public.colleges where code = 'TST-B';
select private.log_audit('test.created', 'profile', 'd0000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select enum_has_labels('public', 'attendance_status', array['present', 'revoked'],
  'attendance_status has the Revision 2 values');
select enum_has_labels('public', 'attendance_session_kind', array['time_in', 'time_out'],
  'attendance_session_kind exists');
select enum_has_labels('public', 'registration_channel', array['online', 'onsite'],
  'registration_channel exists');
select hasnt_column('public', 'profiles', 'program', 'free-text program column is gone');
select is((select count(*)::int from public.profiles where id = 'f0000000-0000-4000-8000-000000000006'),
  0, 'an anonymous auth user (station device) gets no profile row');
select is((select count(*)::int from public.profiles where id = 'd0000000-0000-4000-8000-000000000004'),
  1, 'a permanent auth user still gets a profile row');

-- ---------------------------------------------------------------------------
-- As Paula (participant)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

select is((select private.is_permanent_user()), true, 'is_permanent_user() is true for a signed-in permanent user');
select lives_ok($$ select * from public.programs $$, 'participants can read programs');
select throws_ok($$ insert into public.colleges (code, name) values ('HACK', 'Hack College') $$,
  '42501', null, 'participant cannot add a college');
select throws_ok($$ insert into public.programs (college_id, name)
                    select id, 'Hack Program' from public.colleges where code = 'TST-A' $$,
  '42501', null, 'participant cannot add a program');
update public.colleges set name = 'Renamed by participant' where code = 'TST-A';
select throws_ok($$ delete from public.colleges where code = 'TST-A' $$,
  '42501', null, 'participant cannot delete a college');
select throws_ok($$ update public.profiles
                      set program_id = (select id from public.programs where name = 'Program A')
                    where id = 'd0000000-0000-4000-8000-000000000004' $$,
  '23514', null, 'a program cannot be set without a college');
select throws_ok($$ update public.profiles
                      set college_id = (select id from public.colleges where code = 'TST-A'),
                          program_id = (select id from public.programs where name = 'Program B')
                    where id = 'd0000000-0000-4000-8000-000000000004' $$,
  '23503', null, 'the program must belong to the chosen college');
select lives_ok($$ update public.profiles
                     set college_id = (select id from public.colleges where code = 'TST-A'),
                         program_id = (select id from public.programs where name = 'Program A'),
                         student_id = 'PAULA-01',
                         year_level = 2,
                         avatar_path = 'd0000000-0000-4000-8000-000000000004/avatar.webp'
                   where id = 'd0000000-0000-4000-8000-000000000004' $$,
  'participant can set college, program and the other personal columns');
select throws_ok($$ update public.profiles set privacy_consented_at = now()
                    where id = 'd0000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'participant cannot write privacy_consented_at directly');
select throws_ok($$ update public.profiles set identity_flagged_at = now(), identity_flag_reason = 'self'
                    where id = 'd0000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'participant cannot set an identity flag');
select is((select is_complete from public.profiles where id = 'd0000000-0000-4000-8000-000000000004'),
  false, 'profile is incomplete without privacy consent');
select is((select public.accept_privacy_notice('   ')), 'invalid_version', 'blank notice version is refused');
select is((select public.accept_privacy_notice('2026-10')), 'ok', 'participant can accept the privacy notice');
select is((select privacy_notice_version from public.profiles where id = 'd0000000-0000-4000-8000-000000000004'),
  '2026-10', 'consent records the notice version');
select is((select is_complete from public.profiles where id = 'd0000000-0000-4000-8000-000000000004'),
  true, 'profile is complete with program and consent');

-- ---------------------------------------------------------------------------
-- As Ana (admin)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

select lives_ok($$ insert into public.colleges (code, name) values ('TST-C', 'Test College C') $$,
  'admin can add a college');
select lives_ok($$ update public.programs set name = 'Program A (renamed)' where name = 'Program A' $$,
  'admin can rename a program');
select throws_ok($$ update public.programs set college_id = (select id from public.colleges where code = 'TST-B')
                    where name = 'Program A (renamed)' $$,
  '42501', null, 'a program cannot be moved to another college');
select throws_ok($$ delete from public.programs where name = 'Program B' $$,
  '42501', null, 'admin cannot delete a program (deactivate instead)');
select is((select count(*)::int from public.programs where name = 'Program A (renamed)'),
  1, 'the admin''s rename took effect');

-- ---------------------------------------------------------------------------
-- As an anonymous station user. The JWT deliberately carries the admin's id: the
-- restrictive policies must hide profiles and audit logs even when a permissive
-- policy would allow them.
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;

select is((select private.is_permanent_user()), false, 'is_permanent_user() is false for an anonymous user');
select is((select count(*)::int from public.profiles), 0, 'anonymous users cannot read any profile');
select is((select count(*)::int from public.audit_logs), 0, 'anonymous users cannot read audit logs');
select is((select public.accept_privacy_notice('2026-10')), 'not_permitted', 'anonymous users cannot record consent');

-- ---------------------------------------------------------------------------
-- As anon (signed out)
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ insert into public.programs (college_id, name) values (1, 'Anon Program') $$,
  '42501', null, 'anon cannot add a program');

-- ---------------------------------------------------------------------------
-- Writes that must have had no effect
-- ---------------------------------------------------------------------------
reset role;
select is((select name from public.colleges where code = 'TST-A'),
  'Test College A', 'a participant''s college update had no effect');

select * from finish();
rollback;
