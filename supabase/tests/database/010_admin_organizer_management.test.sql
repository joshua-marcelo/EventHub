-- ISOLATED DATABASE ONLY. Never run the linked test script without approval.
-- All fixtures and grants below are rolled back. No Auth API calls or emails.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.colleges(code,name) values('ORG-TEST','Organizer Test College');
insert into public.programs(college_id,name) select id,'Organizer Test Program' from public.colleges where code='ORG-TEST';
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('f1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','org-fixture-'||n||'@example.test',now(),'{}','{"first_name":"Test","last_name":"Organizer","organizer_status":"active"}',false,now(),now()
from generate_series(1,5) n;
update public.profiles set is_admin=true where id='f1000000-0000-4000-8000-000000000001';
update public.profiles set student_id='ORG-TEST-2',college_id=(select id from public.colleges where code='ORG-TEST'),
  program_id=(select id from public.programs where name='Organizer Test Program'),year_level=1,
  avatar_path=id::text||'/avatar.png',privacy_consented_at=now(),privacy_notice_version='2026-10-draft'
where id='f1000000-0000-4000-8000-000000000002';
create temporary table participant_snapshot as
select to_jsonb(p)-'organizer_status'-'organizer_since'-'organizer_status_reason'-'updated_at' as profile
from public.profiles p where id='f1000000-0000-4000-8000-000000000002';
grant select on participant_snapshot to authenticated;
update public.profiles set organizer_status=case right(id::text,1) when '3' then 'suspended'::public.organizer_status
  when '4' then 'revoked'::public.organizer_status else 'active'::public.organizer_status end,organizer_since=now()
where id in ('f1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000005');

select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select is(public.reserve_organizer_invitation('new-organizer@example.test','New','Organizer')->>'code','not_permitted','Participant cannot invite');
select is(public.promote_participant_to_organizer(auth.uid()),'not_permitted','Participant cannot self-promote');
select is((select count(*)::int from public.organizer_invitations),0,'invitation directory hidden from Participants');
select throws_ok($$select acceptance_hash from public.organizer_invitations$$,'42501',null,'browser clients cannot read acceptance proofs');
select throws_ok($$select public.complete_organizer_acceptance(auth.uid(),repeat('a',64))$$,'42501',null,'browser clients cannot activate invites directly');
select throws_ok($$insert into public.organizer_invitations(email,first_name,last_name,invited_by) values('bad@example.test','Bad','Actor',auth.uid())$$,'42501',null,'clients cannot create invitation rows directly');
select is((select organizer_status::text from public.profiles where id=auth.uid()),'none','user metadata did not grant a role');

select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.reserve_organizer_invitation('org-fixture-2@example.test','Existing','Participant')->>'code','existing_account','existing identity must use promotion');
select is(public.reserve_organizer_invitation('not-an-email','New','Organizer')->>'code','invalid_input','database validates invite input');
select set_config('eventhub.test_invitation_id',public.reserve_organizer_invitation('new-organizer@example.test','New','Organizer')->>'id',true);
select ok(current_setting('eventhub.test_invitation_id') is not null,'Admin reserves invitation');
select is(public.reserve_organizer_invitation('NEW-ORGANIZER@example.test','New','Organizer')->>'code','already_invited','case-insensitive duplicate reservation refused');
select is(public.promote_participant_to_organizer('f1000000-0000-4000-8000-000000000002'),'ok','Admin promotes existing complete Participant');
select is((select organizer_status::text from public.profiles where id='f1000000-0000-4000-8000-000000000002'),'active','promotion uses existing role authority');
select is((select to_jsonb(p)-'organizer_status'-'organizer_since'-'organizer_status_reason'-'updated_at' from public.profiles p where id='f1000000-0000-4000-8000-000000000002'),(select profile from participant_snapshot),'promotion preserves all non-role profile data and identity');
select is(public.promote_participant_to_organizer('f1000000-0000-4000-8000-000000000002'),'already_active','repeat promotion does not create another grant');
select is(public.promote_participant_to_organizer('f1000000-0000-4000-8000-000000000003'),'inactive_organizer','promotion cannot reinstate suspended Organizer');
select is(public.promote_participant_to_organizer('f1000000-0000-4000-8000-000000000004'),'inactive_organizer','promotion cannot revive revoked Organizer');
select is((select count(*)::int from public.audit_logs where action='organizer.promoted' and entity_id='f1000000-0000-4000-8000-000000000002'),1,'promotion audited exactly once');
select set_config('eventhub.test_attempt_id',public.acquire_organizer_invitation(current_setting('eventhub.test_invitation_id')::uuid)->>'attempt_id',true);
select is(public.acquire_organizer_invitation(current_setting('eventhub.test_invitation_id')::uuid)->>'code','retry_later','concurrent delivery lease refused');

reset role;
-- Mimic the native Admin-created identity. Ordinary signup cannot select this reserved ID.
insert into auth.users(instance_id,id,aud,role,email,invited_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000',current_setting('eventhub.test_invitation_id')::uuid,'authenticated','authenticated',
  'new-organizer@example.test',now(),'{}','{"first_name":"New","last_name":"Organizer"}',false,now(),now());
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.finish_organizer_invitation(current_setting('eventhub.test_invitation_id')::uuid,current_setting('eventhub.test_attempt_id')::uuid,'f1000000-0000-4000-8000-000000000001',false),'ok','failed email delivery recorded without a role');
reset role;
select is((select organizer_status::text from public.profiles where id=current_setting('eventhub.test_invitation_id')::uuid),'none','failed email never activates Organizer access');
update public.organizer_invitations set last_attempt_at=now()-interval '6 minutes' where id=current_setting('eventhub.test_invitation_id')::uuid;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select set_config('eventhub.test_attempt_id',public.acquire_organizer_invitation(current_setting('eventhub.test_invitation_id')::uuid)->>'attempt_id',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.finish_organizer_invitation(current_setting('eventhub.test_invitation_id')::uuid,current_setting('eventhub.test_attempt_id')::uuid,'f1000000-0000-4000-8000-000000000001',true),'ok','provider acceptance persisted for the bound identity');
select is(public.begin_organizer_acceptance(current_setting('eventhub.test_invitation_id')::uuid,'new-organizer@example.test',repeat('a',64)),'invitation_invalid','unverified identity cannot begin activation');
reset role;
update auth.users set email_confirmed_at=now() where id=current_setting('eventhub.test_invitation_id')::uuid;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.begin_organizer_acceptance(current_setting('eventhub.test_invitation_id')::uuid,'other@example.test',repeat('a',64)),'invitation_invalid','acceptance bound to intended email');
select is(public.begin_organizer_acceptance(current_setting('eventhub.test_invitation_id')::uuid,'new-organizer@example.test',repeat('a',64)),'ok','verified invite establishes a protected retry proof');
select is(public.check_organizer_acceptance(current_setting('eventhub.test_invitation_id')::uuid,repeat('b',64)),'invitation_invalid','wrong acceptance proof rejected');
select is(public.complete_organizer_acceptance(current_setting('eventhub.test_invitation_id')::uuid,repeat('a',64)),'password_required','password must be established before activation');
reset role;
update auth.users set encrypted_password=extensions.crypt('IsolatedTestPassword42',extensions.gen_salt('bf')) where id=current_setting('eventhub.test_invitation_id')::uuid;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.complete_organizer_acceptance(current_setting('eventhub.test_invitation_id')::uuid,repeat('a',64)),'ok','verified password setup activates Organizer atomically');
select is(public.complete_organizer_acceptance(current_setting('eventhub.test_invitation_id')::uuid,repeat('a',64)),'invitation_invalid','accepted proof cannot be reused');
reset role;
select is((select state from public.organizer_invitations where id=current_setting('eventhub.test_invitation_id')::uuid),'accepted','acceptance is persisted');
select is((select is_complete from public.profiles where id=current_setting('eventhub.test_invitation_id')::uuid),false,'activation does not fabricate student profile completeness');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('eventhub.test_invitation_id'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
select ok(private.is_active_organizer(),'invited user has existing database Organizer authorization');
select is(public.save_event(null,'{"title":"Invited Organizer draft"}')->>'code','ok','active invited Organizer can create a draft without Student Onboarding');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.set_organizer_status(current_setting('eventhub.test_invitation_id')::uuid,'suspended','Security review'),'ok','Admin can suspend invited Organizer');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('eventhub.test_invitation_id'),'role','authenticated','is_anonymous',false)::text,true);
select is(public.save_event(null,'{"title":"Suspended Organizer draft"}')->>'code','not_permitted','suspension still blocks privileged database operations');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.set_organizer_status(current_setting('eventhub.test_invitation_id')::uuid,'revoked','Access removed'),'ok','Admin can revoke invited Organizer');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('eventhub.test_invitation_id'),'role','authenticated','is_anonymous',false)::text,true);
select is(public.save_event(null,'{"title":"Revoked Organizer draft"}')->>'code','not_permitted','revocation still blocks privileged database operations');

reset role;
-- Expiration is checked independently of Supabase's own token expiration.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,invited_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000006','authenticated','authenticated','expired-org@example.test',now(),now(),'{}','{}',false,now(),now());
insert into public.organizer_invitations(id,user_id,email,first_name,last_name,invited_by,state,expires_at,attempt_id,acceptance_attempt,acceptance_hash)
values('f1000000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000006','expired-org@example.test','Expired','Organizer','f1000000-0000-4000-8000-000000000001','pending',now()-interval '1 second','f1000000-0000-4000-8000-000000000007','f1000000-0000-4000-8000-000000000007',repeat('c',64));
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(public.check_organizer_acceptance('f1000000-0000-4000-8000-000000000006',repeat('c',64)),'invitation_invalid','expired persisted invitation cannot activate');
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_ok($$select public.promote_participant_to_organizer('f1000000-0000-4000-8000-000000000006')$$,'42501',null,'signed-out promotion forbidden');
select throws_ok($$select public.reserve_organizer_invitation('guest@example.test','Guest','Actor')$$,'42501',null,'signed-out invitation forbidden');
reset role;
select * from finish();
rollback;
