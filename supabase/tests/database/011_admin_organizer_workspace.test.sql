-- ISOLATED DATABASE ONLY. Never run the linked test script without approval.
-- Requires migration 20261018120000_admin_organizer_workspace. All fixtures are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- 1 admin (organizer_status none), 2 active organizer, 3 participant, 4 suspended, 5 revoked, 6 suspended admin.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('f2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','workspace-fixture-'||n||'@example.test',now(),'{}','{"first_name":"Test","last_name":"Workspace"}',false,now(),now()
from generate_series(1,6) n;
update public.profiles set is_admin=true where id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000006');
update public.profiles set organizer_status=case right(id::text,1) when '2' then 'active'::public.organizer_status when '4' then 'suspended'::public.organizer_status
  when '5' then 'revoked'::public.organizer_status else 'suspended'::public.organizer_status end, organizer_since=now()
where id in ('f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000005','f2000000-0000-4000-8000-000000000006');

set local role authenticated;

-- Active organizer creates an event the admin must not be able to edit as organizer.
select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
select is(public.save_event(null,'{"title":"Organizer owned draft"}')->>'code','ok','active organizer still creates events');
select set_config('eventhub.organizer_event',(select id::text from public.events where title='Organizer owned draft'),true);

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select ok((select private.is_active_organizer()),'admin has organizer capability');
select is(public.save_event(null,'{"title":"Admin owned draft"}')->>'code','ok','admin creates an event without an invitation');
select is((select organizer_id from public.events where title='Admin owned draft'),auth.uid(),'admin-created event is owned by the admin');
select is(public.save_event(current_setting('eventhub.organizer_event')::uuid,'{"title":"Admin takeover"}')->>'code','not_found','admin cannot edit another organizer''s event as organizer');
select is((select organizer_id::text from public.events where id=current_setting('eventhub.organizer_event')::uuid),'f2000000-0000-4000-8000-000000000002','ownership of the other organizer''s event is unchanged');
select is((select organizer_status::text from public.profiles where id=auth.uid()),'none','admin organizer_status is not modified');

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',true);
select ok(not (select private.is_active_organizer()),'participant has no organizer capability');
select is(public.save_event(null,'{"title":"Participant draft"}')->>'code','not_permitted','participant still cannot create events');

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',true);
select is(public.save_event(null,'{"title":"Suspended draft"}')->>'code','not_permitted','suspended organizer still refused');
select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',true);
select is(public.save_event(null,'{"title":"Revoked draft"}')->>'code','not_permitted','revoked organizer still refused');

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":false}',true);
select ok((select private.is_active_organizer()),'suspended organizer who is independently an admin keeps organizer capability');

reset role;
select ok(not private.has_organizer_access('f2000000-0000-4000-8000-000000000003'),'has_organizer_access false for participant');
select ok(private.has_organizer_access('f2000000-0000-4000-8000-000000000001'),'has_organizer_access true for admin');
select ok(not has_function_privilege('authenticated','private.has_organizer_access(uuid)','execute'),'clients cannot call has_organizer_access directly');

select * from finish();
rollback;
