-- DEVELOPMENT ONLY. Temporary identities for scripts/mvp-stage1-check.mjs.
insert into public.colleges(code,name) values('MVP-LIVE','MVP Live College');
insert into public.programs(college_id,name) select id,'MVP Live Program' from public.colleges where code = 'MVP-LIVE';
insert into public.event_categories(name,slug) values('MVP Live Category','mvp-live');
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('c1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','mvp-live-' || n || '@eventhub.test',extensions.crypt('MvpStage1test123',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('first_name','MVP Live ' || n,'last_name','Test'),false,'','','','',now(),now() from generate_series(1,6) n;
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select extensions.gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now(),now() from auth.users where id::text like 'c1000000-%';
update public.profiles set student_id = 'MVP-LIVE-' || right(id::text,4),college_id = (select id from public.colleges where code = 'MVP-LIVE'),program_id = (select id from public.programs where name = 'MVP Live Program'),year_level = 1,avatar_path = id::text || '/test.png',privacy_consented_at = now(),privacy_notice_version = '2026-10-draft' where id::text like 'c1000000-%' and id not in ('c1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000005');
update public.profiles set is_admin = true where id = 'c1000000-0000-4000-8000-000000000002';
update public.profiles set organizer_status = 'active',organizer_since = now() where id = 'c1000000-0000-4000-8000-000000000006';
-- One disposable development fixture only; removed by mvp-stage1-cleanup.sql.
create policy "MVP stage1 fixture cleanup" on storage.objects for delete to authenticated using (bucket_id = 'organizer-requirements' and name = 'c1000000-0000-4000-8000-000000000001/proof.pdf' and (select auth.uid()) = 'c1000000-0000-4000-8000-000000000001');
