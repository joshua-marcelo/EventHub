-- DEVELOPMENT ONLY (ldhpbfujqnyovovabvcg). Temporary integration-test identities.
-- Run through MCP after confirming the project, then run phase3-cleanup.sql.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_anonymous, confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('a3000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'authenticated', 'authenticated', 'p3-' || label || '@eventhub.test', extensions.crypt('Phase3test123',extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('first_name',label,'last_name','Test'), false, '', '', '', '', now(), now()
from (values (1,'participant'),(2,'admin'),(3,'admin-two'),(4,'organizer'),(5,'suspended'),(6,'revoked'),(7,'incomplete')) as fixture(n,label);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select extensions.gen_random_uuid(), id, id::text, jsonb_build_object('sub',id::text,'email',email,'email_verified',true), 'email', now(), now(), now()
from auth.users where id in (select ('a3000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,7) n);
update public.profiles set student_id = 'P3-' || right(id::text,4), college_id = (select id from public.colleges where code = 'DEV-A'),
  program_id = (select id from public.programs where college_id = (select id from public.colleges where code = 'DEV-A') order by id limit 1),
  year_level = 1, avatar_path = id::text || '/test.webp', privacy_consented_at = now(), privacy_notice_version = '2026-10-draft'
where id in ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000006');
update public.profiles set is_admin = true where id in ('a3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000003');
update public.profiles set organizer_since = now(), organizer_status_reason = 'Phase 3 test fixture', organizer_status = case right(id::text,1) when '4' then 'active'::public.organizer_status when '5' then 'suspended'::public.organizer_status else 'revoked'::public.organizer_status end
where id in ('a3000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000006');
