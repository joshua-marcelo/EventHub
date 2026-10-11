begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
insert into auth.users(id,email,raw_user_meta_data) values('d0000000-0000-4000-8000-000000000001','landing-check@eventhub.test','{"first_name":"Landing","last_name":"Check"}');
insert into public.event_categories(name,slug) values('Landing Check','landing-check');
insert into public.events(id,organizer_id,title,description,venue,category_id,starts_at,registration_opens_at,registration_closes_at,status,visibility)
select ('d1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'d0000000-0000-4000-8000-000000000001','Landing Check ' || n,repeat('Description ',3),'Campus Hall',(select id from public.event_categories where slug = 'landing-check'),now()+interval '30 minutes',now()-interval '1 hour',now()+interval '10 minutes',case when n = 1 then 'draft'::public.event_status when n = 2 then 'cancelled'::public.event_status else 'published'::public.event_status end,case when n = 3 then 'unlisted'::public.event_visibility else 'public'::public.event_visibility end from generate_series(1,4) n where n <> 2;
set local role anon;
select is((select count(*)::int from public.get_upcoming_public_events() where id = 'd1000000-0000-4000-8000-000000000004'),1,'upcoming public event listed');
select is((select count(*)::int from public.get_upcoming_public_events() where id in ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000003')),0,'draft and unlisted events hidden');
select is((select registration_state from public.get_upcoming_public_events() where id = 'd1000000-0000-4000-8000-000000000004'),'Registration open','database supplies registration status');
select ok((select count(*) <= 6 from public.get_upcoming_public_events()),'public listing bounded');
select throws_ok($$ select * from public.events $$,'42501',null,'public listing does not grant event table access');
select throws_ok($$ select public.set_event_banner('d1000000-0000-4000-8000-000000000004','other/poster.png') $$,'42501',null,'anonymous cannot mutate banners');
reset role;
select is((select proargnames[1:]::text from pg_proc where oid = 'public.get_upcoming_public_events()'::regprocedure),'{id,title,category_name,starts_at,venue,banner_path,registration_state}','public listing has exact whitelist');
select is((select public from storage.buckets where id = 'event-banners'),true,'posters are explicitly public');
select * from finish();
rollback;
