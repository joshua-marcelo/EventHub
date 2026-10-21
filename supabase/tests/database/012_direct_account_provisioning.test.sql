-- ISOLATED DATABASE ONLY. Never run the linked test script without approval.
-- Requires migrations 20261021120000 and 20261021120100. All fixtures are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- 1 admin, 2 participant (self-registered), 3 second admin.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at,encrypted_password)
select '00000000-0000-0000-0000-000000000000',('f3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','provision-fixture-'||n||'@example.test',now(),'{}','{"first_name":"Test","last_name":"Provision"}',false,now(),now(),'hash-'||n
from generate_series(1,3) n;
update public.profiles set is_admin=true where id in ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000003');
select ok(not (select must_change_password from public.profiles where id='f3000000-0000-4000-8000-000000000002'),'self-registered accounts are not forced to change password');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
select is(public.reserve_account('new-organizer@example.test','organizer')->>'code','not_permitted','participants cannot reserve accounts');
select is(public.request_password_reset('f3000000-0000-4000-8000-000000000001')->>'code','not_permitted','participants cannot reset passwords');
select throws_ok($$update public.profiles set must_change_password=false where id=auth.uid()$$,'42501',null,'clients cannot write the password-change flag');

select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.reserve_account('provision-fixture-2@example.test','participant')->>'code','existing_account','existing emails are refused');
select is(public.reserve_account('not-an-email','participant')->>'code','invalid_input','invalid emails are refused');
select is(public.reserve_account('x@example.test','admin')->>'code','invalid_input','the admin role cannot be provisioned');
select set_config('eventhub.org_id',public.reserve_account(' New-Organizer@Example.test ','organizer')->>'id',true);
select is(public.reserve_account('new-organizer@example.test','organizer')->>'id',current_setting('eventhub.org_id'),'retrying an unfinished reservation reuses the same id');
select set_config('eventhub.par_id',public.reserve_account('new-participant@example.test','participant')->>'id',true);
select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',true);
select is(public.reserve_account('new-participant@example.test','participant')->>'code','retry_later','another admin cannot take over an in-progress reservation');
select ok(not has_table_privilege('authenticated','private.password_resets','select'),'clients cannot read pending resets');
select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.request_password_reset(auth.uid())->>'code','self_reset','admins cannot reset their own password here');
select is(public.request_password_reset('f3000000-0000-4000-8000-000000000003')->>'code','not_permitted','admins cannot reset another admin');

reset role;
-- What the Admin API does: insert the Auth user with the reserved id.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at,encrypted_password)
values ('00000000-0000-0000-0000-000000000000',current_setting('eventhub.org_id')::uuid,'authenticated','authenticated','new-organizer@example.test',now(),'{}','{}',false,now(),now(),'temp-1'),
  ('00000000-0000-0000-0000-000000000000',current_setting('eventhub.par_id')::uuid,'authenticated','authenticated','new-participant@example.test',now(),'{}','{}',false,now(),now(),'temp-2');
select is((select organizer_status::text from public.profiles where id=current_setting('eventhub.org_id')::uuid),'active','created organizer is active immediately');
select ok((select must_change_password from public.profiles where id=current_setting('eventhub.org_id')::uuid),'created organizer must change password');
select is((select organizer_status::text from public.profiles where id=current_setting('eventhub.par_id')::uuid),'none','created participant has no organizer access');
select ok(not (select is_admin from public.profiles where id=current_setting('eventhub.par_id')::uuid),'created participant is not an admin');
select ok((select must_change_password from public.profiles where id=current_setting('eventhub.par_id')::uuid),'created participant must change password');
select is((select state from public.account_provisions where id=current_setting('eventhub.org_id')::uuid),'created','reservation is completed');
select is((select count(*)::int from public.audit_logs where action='account.created' and entity_id in (current_setting('eventhub.org_id')::uuid,current_setting('eventhub.par_id')::uuid)),2,'account creation is audited');

-- A sign-up with a reserved email but its own id never claims the reservation.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select set_config('eventhub.unclaimed',public.reserve_account('unclaimed@example.test','organizer')->>'id',true);
reset role;
insert into auth.users(instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','f3000000-0000-4000-8000-0000000000aa','authenticated','authenticated','unclaimed@example.test','{}','{}',false,now(),now());
select is((select organizer_status::text from public.profiles where id='f3000000-0000-4000-8000-0000000000aa'),'none','sign-up with another id gets no role');
select ok(not (select must_change_password from public.profiles where id='f3000000-0000-4000-8000-0000000000aa'),'sign-up with another id is not flagged');

-- A password change clears the flag; an Admin reset sets it again.
update auth.users set encrypted_password='own-1' where id=current_setting('eventhub.org_id')::uuid;
select ok(not (select must_change_password from public.profiles where id=current_setting('eventhub.org_id')::uuid),'changing the password clears the flag');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.request_password_reset(current_setting('eventhub.org_id')::uuid)->>'code','ok','admin requests a reset');
select is(public.request_password_reset(current_setting('eventhub.org_id')::uuid)->>'code','retry_later','resets are rate limited');
reset role;
update auth.users set encrypted_password='temp-3' where id=current_setting('eventhub.org_id')::uuid;
select ok((select must_change_password from public.profiles where id=current_setting('eventhub.org_id')::uuid),'an Admin reset requires another change');
select is((select count(*)::int from private.password_resets where user_id=current_setting('eventhub.org_id')::uuid),0,'the reset request is consumed');

-- Invitations are retired for new accounts.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f3000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.reserve_organizer_invitation('invitee@example.test','A','B')->>'code','workflow_retired','new invitations are retired');
select ok(not (select private.is_active_organizer()),'administrators are not automatically organizers');
select is(public.save_event(null,'{"title":"Admin draft"}')->>'code','not_permitted','an admin without organizer membership cannot create events');

select * from finish();
rollback;
