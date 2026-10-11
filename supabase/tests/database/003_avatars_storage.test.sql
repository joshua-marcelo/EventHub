-- EventHub · Phase 2 · Avatars bucket and Storage policies.
-- Runs inside a transaction and rolls back: no data is left behind.
-- Deleting through SQL is blocked by Supabase (Storage API only), so delete is covered by the
-- API-level test in scripts/phase2-auth-check.mjs.

begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'ava@test.local', '', now(), '{}', '{}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'ben@test.local', '', now(), '{}', '{}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'adm@test.local', '', now(), '{}', '{}', false, now(), now());
update public.profiles set is_admin = true where id = 'c1000000-0000-4000-8000-000000000003';

select is((select public from storage.buckets where id = 'avatars'), false, 'avatars bucket is private');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 2097152::bigint, 'avatars bucket limit is 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'avatars'),
  array['image/jpeg', 'image/png', 'image/webp'], 'avatars bucket accepts jpeg, png and webp');

-- Ava
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$ insert into storage.objects (bucket_id, name)
                   values ('avatars', 'a1000000-0000-4000-8000-000000000001/0f8fad5b-d9cb-469f-a165-70867728950e.webp') $$,
  'a user can upload into their own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name)
                    values ('avatars', 'b1000000-0000-4000-8000-000000000002/0f8fad5b-d9cb-469f-a165-70867728950e.webp') $$,
  '42501', null, 'a user cannot upload into another user''s folder');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1, 'a user sees their own photo');

-- Ben
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0, 'another user cannot see someone else''s photo');

-- Admin
reset role;
select set_config('request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1, 'an admin can see photos');

-- Anonymous session (sign-ins are disabled; defense in depth)
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$ insert into storage.objects (bucket_id, name)
                    values ('avatars', 'a1000000-0000-4000-8000-000000000001/1f8fad5b-d9cb-469f-a165-70867728950e.webp') $$,
  '42501', null, 'an anonymous session cannot upload');

-- Signed out
reset role;
set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0, 'signed-out visitors see no photos');

reset role;
select * from finish();
rollback;
