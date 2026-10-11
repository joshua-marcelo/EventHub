-- Only disposable fixtures created by mvp-core-fixtures.sql.
begin;
delete from public.certificates where event_id='fe000000-0000-4000-8000-000000000001';
delete from public.attendance_device_signals where event_id='fe000000-0000-4000-8000-000000000001';
delete from public.attendance_records where event_id='fe000000-0000-4000-8000-000000000001';
delete from public.attendance_sessions where event_id='fe000000-0000-4000-8000-000000000001';
delete from public.events where id='fe000000-0000-4000-8000-000000000001' and organizer_id='f1000000-0000-4000-8000-000000000001';
delete from public.audit_logs where actor_id in (select ('f1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,4)n);
delete from auth.users where id in (select ('f1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,4)n) and email like 'core-live-%@eventhub.test';
delete from public.programs where name='Core Live Program' and college_id=(select id from public.colleges where code='CORE-LIVE');
delete from public.colleges where code='CORE-LIVE' and name='Core Live College';
delete from public.event_categories where slug='core-live' and name='Core Live Category';
commit;
