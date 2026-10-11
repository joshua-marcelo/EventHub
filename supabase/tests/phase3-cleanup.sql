-- DEVELOPMENT ONLY. Remove only the exact Phase 3 integration-test fixtures.
update public.profiles set college_id = null, program_id = null
where id = 'a3000000-0000-4000-8000-000000000001' and email = 'p3-participant@eventhub.test';
delete from public.programs where name in ('P3 Live Program','P3 Live Program Renamed') and college_id in (select id from public.colleges where code = 'P3-LIVE');
delete from public.colleges where code = 'P3-LIVE' and name in ('P3 Live College','P3 Live College Renamed');
delete from public.event_categories where slug = 'p3-live-category' and name in ('P3 Live Category','P3 Live Category Renamed');
delete from public.audit_logs where actor_id in ('a3000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000003')
  and action in ('lookup.created','lookup.updated');
delete from auth.users where id in (select ('a3000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,7) n)
  and email in ('p3-participant@eventhub.test','p3-admin@eventhub.test','p3-admin-two@eventhub.test','p3-organizer@eventhub.test','p3-suspended@eventhub.test','p3-revoked@eventhub.test','p3-incomplete@eventhub.test');
