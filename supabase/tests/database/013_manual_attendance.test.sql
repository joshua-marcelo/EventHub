-- ISOLATED DATABASE ONLY. Requires migration 20261022090000. All fixtures are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into public.event_categories(name,slug) values('Manual Attendance Test','manual-attendance-test');
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('d4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','manual-att-'||n||'@test.local',now(),'{}','{}',false,now(),now() from generate_series(1,2) n;
update public.profiles set organizer_status='active',organizer_since=now() where id in ('d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002');
insert into public.events(id,organizer_id,title,description,venue,category_id,starts_at,registration_opens_at,registration_closes_at,status)
select ('d4e00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'d4000000-0000-4000-8000-000000000001','Manual attendance '||n,repeat('description ',3),'Hall',
  (select id from public.event_categories where slug='manual-attendance-test'),now()+interval '3 days',now()-interval '1 day',now()+interval '2 days',
  (array['published','draft','cancelled','completed'])[n]::public.event_status
from generate_series(1,4) n;
update public.events set cancelled_at=now(),cancellation_reason='test' where id='d4e00000-0000-4000-8000-000000000003';
update public.events set completed_at=now() where id='d4e00000-0000-4000-8000-000000000004';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d4000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
select is(public.open_attendance_session('d4e00000-0000-4000-8000-000000000001','time_in'),'not_permitted','another organizer cannot open attendance');
select set_config('request.jwt.claims','{"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select is(public.open_attendance_session('d4e00000-0000-4000-8000-000000000001','time_in'),'ok','owner opens attendance three days before the scheduled start');
select is(public.open_attendance_session('d4e00000-0000-4000-8000-000000000002','time_in'),'invalid_status','draft events cannot open attendance');
select is(public.open_attendance_session('d4e00000-0000-4000-8000-000000000003','time_in'),'invalid_status','cancelled events cannot open attendance');
select is(public.open_attendance_session('d4e00000-0000-4000-8000-000000000004','time_in'),'invalid_status','completed events stay read-only');
select ok((select jsonb_array_length(public.get_attendance_qr('d4e00000-0000-4000-8000-000000000001')->'tokens')) = 3,'rotating QR tokens are issued for the open session');
select is(public.close_attendance_session('d4e00000-0000-4000-8000-000000000001'),'ok','owner closes attendance');
select ok((select jsonb_array_length(public.get_attendance_qr('d4e00000-0000-4000-8000-000000000001')->'tokens')) = 0,'no QR tokens after closing');
reset role;
select ok((select closes_at between now()+interval '11 hours 59 minutes' and now()+interval '12 hours 1 minute' from public.attendance_sessions where event_id='d4e00000-0000-4000-8000-000000000001'),'sessions carry a 12-hour safety cap');
select * from finish();
rollback;
