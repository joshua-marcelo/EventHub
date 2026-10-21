# Disposable LOCAL database only. PostgreSQL isolationtester runs both lock orderings.
setup
{
  insert into public.colleges(code,name) values('RACE-TEST','Race Test College');
  insert into public.programs(college_id,name) select id,'Race Test Program' from public.colleges where code='RACE-TEST';
  insert into public.event_categories(name,slug) values('Race Test','race-test');
  insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
  select '00000000-0000-0000-0000-000000000000',('d6000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','race-'||n||'@test.local',now(),'{}','{"first_name":"Race","last_name":"Test"}',false,now(),now() from generate_series(1,2)n;
  update public.profiles set student_id='RACE-'||right(id::text,4),college_id=(select id from public.colleges where code='RACE-TEST'),program_id=(select id from public.programs where name='Race Test Program'),year_level=1,avatar_path=id::text||'/photo.png',privacy_consented_at=now(),privacy_notice_version='2026-10-draft' where id::text like 'd6000000-%';
  update public.profiles set organizer_status='active',organizer_since=now() where id='d6000000-0000-4000-8000-000000000001';
  insert into public.events(id,organizer_id,title,description,venue,category_id,starts_at,registration_opens_at,registration_closes_at,status,registration_open)
  values('d6e00000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','Race test event',repeat('description ',3),'Hall',(select id from public.event_categories where slug='race-test'),now()+interval '3 days',now()-interval '1 day',now()+interval '2 days','published',true);
}
teardown
{
  delete from public.attendance_sessions where event_id='d6e00000-0000-4000-8000-000000000001';
  delete from public.event_registrations where event_id='d6e00000-0000-4000-8000-000000000001';
  delete from public.events where id='d6e00000-0000-4000-8000-000000000001';
  delete from public.audit_logs where actor_id::text like 'd6000000-%';
  delete from public.profiles where id::text like 'd6000000-%';
  delete from auth.users where id::text like 'd6000000-%';
  delete from public.programs where name='Race Test Program';
  delete from public.colleges where code='RACE-TEST';
  delete from public.event_categories where slug='race-test';
}

session "participant"
setup { set role authenticated; set request.jwt.claims='{"sub":"d6000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}'; }
step "p_begin" { begin; set local request.jwt.claims='{"sub":"d6000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}'; }
step "p_approved"
{
  do $$ begin
    if public.register_for_event('d6e00000-0000-4000-8000-000000000001') <> 'approved' then raise exception 'Registration that owns the lock first must succeed'; end if;
    if (select count(*) from public.event_registrations where event_id='d6e00000-0000-4000-8000-000000000001') <> 1 then raise exception 'Expected exactly one registration'; end if;
  end $$;
}
step "p_denied"
{
  do $$ begin
    if public.register_for_event('d6e00000-0000-4000-8000-000000000001') <> 'registration_closed' then raise exception 'Registration waiting behind attendance must fail'; end if;
    if exists(select 1 from public.event_registrations where event_id='d6e00000-0000-4000-8000-000000000001') then raise exception 'Rejected registration inserted a row'; end if;
  end $$;
}
step "p_commit" { commit; }

session "organizer"
setup { set role authenticated; set request.jwt.claims='{"sub":"d6000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}'; }
step "o_begin" { begin; set local request.jwt.claims='{"sub":"d6000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}'; }
step "o_start"
{
  do $$ begin
    if public.open_attendance_session('d6e00000-0000-4000-8000-000000000001','time_in') <> 'ok' then raise exception 'Attendance must start'; end if;
  end $$;
}
step "o_commit" { commit; }
step "verify"
{
  do $$ begin
    if (select registration_open from public.events where id='d6e00000-0000-4000-8000-000000000001') then raise exception 'Attendance left registration open'; end if;
    if public.set_event_registration('d6e00000-0000-4000-8000-000000000001',true) <> 'attendance_started' then raise exception 'Reopening after race was allowed'; end if;
    if (select count(*) from public.attendance_sessions where event_id='d6e00000-0000-4000-8000-000000000001') <> 1 then raise exception 'Expected exactly one session'; end if;
  end $$;
}

# The runner waits until the blocked step acquires the event lock after the other transaction commits.
permutation "p_begin" "o_begin" "p_approved" "o_start" "p_commit" "o_commit" "verify"
permutation "p_begin" "o_begin" "o_start" "p_denied" "o_commit" "p_commit" "verify"
