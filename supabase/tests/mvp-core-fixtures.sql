-- DEVELOPMENT ONLY. Disposable accounts for the local end-to-end check.
begin;
insert into public.colleges(code,name) values('CORE-LIVE','Core Live College');
insert into public.programs(college_id,name) select id,'Core Live Program' from public.colleges where code='CORE-LIVE';
insert into public.event_categories(name,slug) values('Core Live Category','core-live');
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('f1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','core-live-'||n||'@eventhub.test',extensions.crypt('CoreMvpTest123',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('first_name','Core Live '||n,'last_name','Test'),false,'','','','',now(),now() from generate_series(1,4)n;
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select extensions.gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now(),now() from auth.users where id::text like 'f1000000-%';
update public.profiles set student_id='CORE-'||right(id::text,4),college_id=(select id from public.colleges where code='CORE-LIVE'),program_id=(select id from public.programs where name='Core Live Program'),year_level=1,avatar_path=id::text||'/test.png',privacy_consented_at=now(),privacy_notice_version='2026-10-draft' where id::text like 'f1000000-%';
update public.profiles set organizer_status='active',organizer_since=now() where id in ('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000004');
insert into public.events(id,organizer_id,title,description,venue,category_id,starts_at,ends_at,registration_opens_at,registration_closes_at,status,attendance_policy,certificates_enabled)
values('fe000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Core Live Campus Seminar','A disposable university seminar for end-to-end checks.','University Hall',(select id from public.event_categories where slug='core-live'),now()-interval '1 hour',now()+interval '1 hour',now()-interval '1 day',now()-interval '2 hours','published','time_in_and_out',true);
insert into public.event_registrations(id,event_id,user_id,status) select ('fa000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fe000000-0000-4000-8000-000000000001',('f1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'approved' from generate_series(2,3)n;
commit;
