-- DEVELOPMENT ONLY. Run after removing uploaded proof through Storage's API.
begin;
drop policy if exists "MVP stage1 fixture cleanup" on storage.objects;
delete from public.events where organizer_id in ('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000006');
delete from public.organizer_applications where applicant_id in (select ('c1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,6) n);
delete from public.audit_logs where actor_id in (select ('c1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,6) n);
delete from auth.users where id in (select ('c1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,6) n) and email like 'mvp-live-%@eventhub.test';
delete from public.programs where name = 'MVP Live Program' and college_id = (select id from public.colleges where code = 'MVP-LIVE');
delete from public.colleges where code = 'MVP-LIVE' and name = 'MVP Live College';
delete from public.event_categories where slug = 'mvp-live' and name = 'MVP Live Category';
commit;
