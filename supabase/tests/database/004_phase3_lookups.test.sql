-- Development only, self-contained and rolled back. Covers RPC + direct RLS writes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
values
('00000000-0000-0000-0000-000000000000','a3000000-0000-4000-8000-000000000001','authenticated','authenticated','p3-participant@test.local',now(),'{}','{"first_name":"Participant","last_name":"Test","is_admin":true,"organizer_status":"active"}',false,now(),now()),
('00000000-0000-0000-0000-000000000000','a3000000-0000-4000-8000-000000000002','authenticated','authenticated','p3-admin@test.local',now(),'{}','{"first_name":"Admin","last_name":"Test"}',false,now(),now());
update public.profiles set is_admin = true where id = 'a3000000-0000-4000-8000-000000000002';
select is((select is_admin from public.profiles where id = 'a3000000-0000-4000-8000-000000000001'), false, 'signup metadata cannot grant admin');
select is((select organizer_status::text from public.profiles where id = 'a3000000-0000-4000-8000-000000000001'), 'none', 'signup metadata cannot grant organizer');
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
select is(public.save_lookup('colleges',null,'{"name":"Test College","code":"P3-A","is_active":true}'), 'not_permitted', 'participant RPC denied');
select throws_ok($$ insert into public.colleges (code,name) values ('P3-HACK','Hack College') $$,'42501',null,'participant direct insert denied');
select throws_ok($$ update public.profiles set is_admin = true where id = 'a3000000-0000-4000-8000-000000000001' $$,'42501',null,'role flag not writable');
select throws_ok($$ update public.profiles set organizer_status = 'active' where id = 'a3000000-0000-4000-8000-000000000001' $$,'42501',null,'organizer status not writable');
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',true);
select is(public.save_lookup('colleges',null,'{"name":"Phase Three A","code":"P3-A","is_active":true}'), 'ok', 'admin creates college');
select is(public.save_lookup('colleges',null,'{"name":"Phase Three B","code":"P3-B","is_active":true}'), 'ok', 'admin creates second college');
select is((select count(*)::int from public.audit_logs where action = 'lookup.created' and actor_id = 'a3000000-0000-4000-8000-000000000002'),2,'creates audited with actor');
select is(public.save_lookup('colleges',null,'{"name":"Duplicate Code","code":"P3-A","is_active":true}'), 'duplicate', 'duplicate returns typed result');
select is(public.save_lookup('colleges',null,'{"name":"Bad College","code":"bad","is_active":true}'), 'invalid_input', 'SQL validates code');
select is(public.save_lookup('profiles',null,'{}'), 'invalid_kind', 'RPC cannot target profiles');
select is(public.save_lookup('event_categories',null,'{"name":"Seminar","slug":"BAD","sort_order":0,"is_active":true}'), 'invalid_input', 'SQL validates slug');
select is(public.save_lookup('event_categories',null,'{"name":"P3 Seminar","slug":"p3-seminar","sort_order":2,"is_active":true}'), 'ok', 'admin creates category');
select is(public.save_lookup('event_categories',null,'{"name":"Overflow","slug":"p3-overflow","sort_order":32768,"is_active":true}'), 'invalid_input', 'SQL validates smallint order');
select is(public.save_lookup('programs',null,jsonb_build_object('name','P3 Computing','college_id',(select id from public.colleges where code = 'P3-A'),'is_active',true)), 'ok', 'admin creates program');
select is(public.save_lookup('programs',(select id from public.programs where name = 'P3 Computing'),jsonb_build_object('name','P3 Computing','college_id',(select id from public.colleges where code = 'P3-B'),'is_active',true)), 'college_locked', 'RPC cannot move program');
select is(public.save_lookup('colleges',(select id from public.colleges where code = 'P3-A'),' {"name":"Phase Three Renamed","code":"P3-A","is_active":false}'), 'ok', 'admin renames and deactivates college');
select is((select count(*)::int from public.audit_logs where action = 'lookup.updated' and metadata -> 'before' ->> 'name' = 'Phase Three A' and metadata -> 'after' ->> 'name' = 'Phase Three Renamed'),1,'update audited with before and after');
select is(public.save_lookup('programs',null,jsonb_build_object('name','P3 Inactive','college_id',(select id from public.colleges where code = 'P3-A'),'is_active',true)), 'inactive_college', 'new programs need active college');
select is(public.save_lookup('colleges',32767::smallint,'{"name":"Missing College","code":"P3-X","is_active":true}'),'not_found','missing update returns typed result');
select throws_ok($$ delete from public.colleges where code = 'P3-A' $$,'42501',null,'admin cannot delete lookup');
update public.event_categories set name = 'P3 Direct Rename' where slug = 'p3-seminar';
select is((select count(*)::int from public.audit_logs where action = 'lookup.updated' and metadata -> 'after' ->> 'name' = 'P3 Direct Rename'),1,'direct permitted writes also audited');
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
select is(public.save_lookup('colleges',null,'{"name":"Anonymous College","code":"P3-ANON","is_active":true}'), 'not_permitted', 'RPC refuses anonymous admin subject');
select throws_ok($$ insert into public.colleges (code,name) values ('P3-ANON','Anonymous College') $$,'42501',null,'direct writes refuse anonymous admin subject');
update public.colleges set name = 'Anonymous Rename' where code = 'P3-B';
select is((select name from public.colleges where code = 'P3-B'),'Phase Three B','anonymous update has no effect');
reset role;
set local role anon;
select throws_ok($$ select public.save_lookup('colleges',null,'{}') $$,'42501',null,'signed-out RPC denied');
reset role;
select is((select count(*)::int from public.colleges where code = 'P3-ANON'),0,'denied writes left no rows');
select is((select count(*)::int from public.audit_logs where action = 'lookup.created' and metadata -> 'after' ->> 'code' = 'P3-ANON'),0,'denied writes left no audit rows');
select * from finish();
rollback;
