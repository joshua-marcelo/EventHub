-- Organizer-owned attendance. All mutations serialize on the event row.
create table public.attendance_sessions (
 id uuid primary key default extensions.gen_random_uuid(), event_id uuid not null references public.events(id),
 kind text not null check(kind in ('time_in','time_out')), status text not null default 'open' check(status in ('open','closed')),
 opened_by uuid not null references public.profiles(id), opened_at timestamptz not null default now(), closes_at timestamptz not null,
 closed_by uuid references public.profiles(id), closed_at timestamptz,
 check((status='open' and closed_at is null) or (status='closed' and closed_at is not null))
);
create unique index attendance_one_open on public.attendance_sessions(event_id) where status='open';
create index attendance_sessions_event on public.attendance_sessions(event_id,opened_at desc);
create table public.attendance_session_secrets(session_id uuid primary key references public.attendance_sessions(id) on delete cascade, secret bytea not null check(octet_length(secret)=32));
create table public.attendance_records (
 id uuid primary key default extensions.gen_random_uuid(), registration_id uuid not null unique, event_id uuid not null, user_id uuid not null,
 foreign key(registration_id,event_id,user_id) references public.event_registrations(id,event_id,user_id),
 status text not null default 'present' check(status in ('present','revoked')),
 time_in_at timestamptz not null default now(), time_in_method text not null check(time_in_method in ('qr','manual')), time_in_session_id uuid references public.attendance_sessions(id),
 time_out_at timestamptz, time_out_method text check(time_out_method in ('qr','manual')), time_out_session_id uuid references public.attendance_sessions(id),
 flag text check(flag='shared_device'), flag_resolution text check(flag_resolution in ('cleared','revoked')), flag_resolved_by uuid references public.profiles(id),flag_resolved_at timestamptz,
 revoked_by uuid references public.profiles(id),revoked_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(time_out_at is null or time_out_at>=time_in_at),check((time_out_at is null)=(time_out_method is null)),
 check((status='present' and revoked_at is null) or (status='revoked' and revoked_at is not null))
);
create index attendance_event on public.attendance_records(event_id,time_in_at desc);
create index attendance_user on public.attendance_records(user_id);
create index attendance_open_flags on public.attendance_records(event_id) where flag is not null and flag_resolution is null;
create trigger attendance_updated before update on public.attendance_records for each row execute function private.set_updated_at();
create table public.attendance_device_signals (
 id bigint generated always as identity primary key,event_id uuid not null references public.events(id),record_id uuid not null references public.attendance_records(id),user_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('time_in','time_out')), device_hash text not null,created_at timestamptz not null default now()
);
create index attendance_devices_event_hash on public.attendance_device_signals(event_id,device_hash);
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_session_secrets enable row level security;
alter table public.attendance_device_signals enable row level security;
revoke all on public.attendance_sessions,public.attendance_records,public.attendance_session_secrets,public.attendance_device_signals from anon,authenticated;
grant select on public.attendance_sessions,public.attendance_records to authenticated;
create policy "Attendance sessions: owner or approved registrant" on public.attendance_sessions for select to authenticated using ((select private.is_permanent_user()) and (exists(select 1 from public.events e where e.id=event_id and e.organizer_id=(select auth.uid())) or exists(select 1 from public.event_registrations r where r.event_id=attendance_sessions.event_id and r.user_id=(select auth.uid()) and r.status='approved')));
create policy "Attendance: own or event owner" on public.attendance_records for select to authenticated using ((select private.is_permanent_user()) and (user_id=(select auth.uid()) or exists(select 1 from public.events e where e.id=event_id and e.organizer_id=(select auth.uid()))));
alter publication supabase_realtime add table public.attendance_records;

create function private.attendance_end(e public.events) returns timestamptz language sql stable set search_path='' as $$
 select coalesce(e.ends_at,((e.starts_at at time zone 'Asia/Manila')::date+time '23:59:59') at time zone 'Asia/Manila')+interval '60 minutes';
$$;
create function private.attendance_token(p_id uuid,p_window integer) returns text language sql stable security definer set search_path='' as $$
 select translate(rtrim(encode(uuid_send(p_id)||int4send(p_window)||substring(extensions.hmac(uuid_send(p_id)||int4send(p_window),s.secret,'sha256') from 1 for 16),'base64'),'='),'+/','-_') from public.attendance_session_secrets s where s.session_id=p_id;
$$;
create function public.open_attendance_session(p_event_id uuid,p_kind text) returns text language plpgsql security definer set search_path='' as $$
declare e public.events; v_id uuid;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted'; end if;
 select * into e from public.events where id=p_event_id and organizer_id=auth.uid() for update;
 if not found then return 'not_permitted'; end if;
 if e.status<>'published' or p_kind not in ('time_in','time_out') or p_kind is null then return 'invalid_status'; end if;
 if now()<e.starts_at-make_interval(mins=>e.attendance_opens_minutes_before) or now()>=private.attendance_end(e) then return 'outside_window'; end if;
 if p_kind='time_out' and e.attendance_policy<>'time_in_and_out' then return 'invalid_status'; end if;
 if p_kind='time_in' and exists(select 1 from public.attendance_sessions where event_id=e.id and kind='time_out') then return 'time_out_started'; end if;
 update public.attendance_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where event_id=e.id and status='open';
 insert into public.attendance_sessions(event_id,kind,opened_by,closes_at) values(e.id,p_kind,auth.uid(),private.attendance_end(e)) returning id into v_id;
 insert into public.attendance_session_secrets values(v_id,extensions.gen_random_bytes(32));
 perform private.log_audit('attendance.session_opened','events',e.id,jsonb_build_object('kind',p_kind));return 'ok';
end;$$;
create function public.close_attendance_session(p_event_id uuid) returns text language plpgsql security definer set search_path='' as $$
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted';end if;
 perform 1 from public.events where id=p_event_id and organizer_id=auth.uid() for update;
 if not found then return 'not_permitted';end if;
 update public.attendance_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where event_id=p_event_id and status='open';
 perform private.log_audit('attendance.session_closed','events',p_event_id);return 'ok';
end;$$;
create function public.get_attendance_qr(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events;s public.attendance_sessions;w integer;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return null;end if;
 select * into e from public.events where id=p_event_id and organizer_id=auth.uid();if not found then return null;end if;
 select * into s from public.attendance_sessions where event_id=e.id and status='open' and closes_at>now() and e.status='published';
 w:=floor(extract(epoch from now())/30)::integer;
 return jsonb_build_object('server_time',now(),'title',e.title,'kind',s.kind,'closes_at',s.closes_at,'tokens',coalesce((select jsonb_agg(jsonb_build_object('token',private.attendance_token(s.id,w+n),'valid_from',to_timestamp((w+n)::bigint*30),'valid_until',to_timestamp((w+n+2)::bigint*30)) order by n) from generate_series(0,2)n where s.id is not null),'[]'::jsonb));
end;$$;
create function public.submit_attendance_scan(p_token text,p_device_id text,p_expected_event_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare b bytea;sid uuid;w bigint;current_w bigint;s public.attendance_sessions;e public.events;r public.event_registrations;a public.attendance_records;h text;code text;
begin
 if not private.is_permanent_user() then return jsonb_build_object('code','unauthenticated');end if;
 if p_token is null or p_token!~'^[A-Za-z0-9_-]{48}$' or p_device_id is null or p_device_id!~'^[A-Za-z0-9-]{16,100}$' then return jsonb_build_object('code','invalid_qr');end if;
 b:=decode(translate(p_token,'-_','+/'),'base64');sid:=encode(substring(b from 1 for 16),'hex')::uuid;
 w:=get_byte(b,16)::bigint*16777216+get_byte(b,17)::bigint*65536+get_byte(b,18)::bigint*256+get_byte(b,19);
 if private.attendance_token(sid,w::integer) is distinct from p_token then return jsonb_build_object('code','invalid_qr');end if;
 select * into s from public.attendance_sessions where id=sid;
 select * into e from public.events where id=s.event_id for update;
 select * into s from public.attendance_sessions where id=sid;
 if s.status<>'open' or now()>=s.closes_at or e.status<>'published' or not exists(select 1 from public.profiles where id=e.organizer_id and organizer_status='active') then return jsonb_build_object('code','attendance_closed');end if;
 current_w:=floor(extract(epoch from now())/30)::bigint;
 if w not in (current_w,current_w-1) then return jsonb_build_object('code','expired_qr');end if;
 if p_expected_event_id is not null and p_expected_event_id<>e.id then return jsonb_build_object('code','wrong_event');end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and is_complete) then return jsonb_build_object('code','profile_incomplete');end if;
 select * into r from public.event_registrations where event_id=e.id and user_id=auth.uid();
 if not found then return jsonb_build_object('code','not_registered','event_id',e.id,'onsite_available',e.allow_onsite_registration and s.kind='time_in');end if;
 if r.status<>'approved' then return jsonb_build_object('code','registration_not_approved');end if;
 select * into a from public.attendance_records where registration_id=r.id;
 if a.status='revoked' then return jsonb_build_object('code','attendance_revoked');end if;
 if s.kind='time_in' then
  if a.id is not null then return jsonb_build_object('code','already_timed_in','at',a.time_in_at);end if;
  insert into public.attendance_records(registration_id,event_id,user_id,time_in_method,time_in_session_id) values(r.id,e.id,auth.uid(),'qr',s.id) returning * into a;code:='timed_in';
 else
  if a.id is null then return jsonb_build_object('code','time_in_required');end if;
  if a.time_out_at is not null then return jsonb_build_object('code','already_timed_out','at',a.time_out_at);end if;
  update public.attendance_records set time_out_at=now(),time_out_method='qr',time_out_session_id=s.id where id=a.id returning * into a;code:='timed_out';
 end if;
 h:=encode(extensions.digest(p_device_id||e.id::text,'sha256'),'hex');
 insert into public.attendance_device_signals(event_id,record_id,user_id,kind,device_hash) values(e.id,a.id,auth.uid(),s.kind,h);
 if exists(select 1 from public.attendance_device_signals where event_id=e.id and device_hash=h and user_id<>auth.uid()) then
  update public.attendance_records set flag='shared_device',flag_resolution=null,flag_resolved_at=null,flag_resolved_by=null where id in (select record_id from public.attendance_device_signals where event_id=e.id and device_hash=h);
 end if;
 return jsonb_build_object('code',code,'at',now(),'event_id',e.id);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('code','invalid_qr');
end;$$;
create function public.get_attendance_feed(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_permanent_user() or not private.is_active_organizer() or not exists(select 1 from public.events where id=p_event_id and organizer_id=auth.uid()) then return null;end if;
 return jsonb_build_object('approved',(select count(*) from public.event_registrations where event_id=p_event_id and status='approved'),'present',(select count(*) from public.attendance_records where event_id=p_event_id and status='present'),'timed_out',(select count(*) from public.attendance_records where event_id=p_event_id and status='present' and time_out_at is not null),'flagged',(select count(*) from public.attendance_records where event_id=p_event_id and flag is not null and flag_resolution is null),'records',coalesce((select jsonb_agg(x order by x.latest desc) from (select a.id,public.profile_full_name(p) as name,p.avatar_path,c.name as college,a.time_in_at,a.time_out_at,a.flag,a.flag_resolution,greatest(a.time_in_at,a.time_out_at) as latest from public.attendance_records a join public.profiles p on p.id=a.user_id left join public.colleges c on c.id=p.college_id where a.event_id=p_event_id and a.status='present' order by greatest(a.time_in_at,a.time_out_at) desc limit 50)x),'[]'::jsonb));
end;$$;
-- Certificate milestone extends this one guard; no duplicate eligibility implementation.
create function private.attendance_correction_allowed(p_registration_id uuid) returns boolean language sql stable set search_path='' as $$select true;$$;
create function public.correct_attendance(p_registration_id uuid,p_action text,p_reason text) returns text language plpgsql security definer set search_path='' as $$
declare e public.events;r public.event_registrations;a public.attendance_records;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted';end if;
 if nullif(btrim(p_reason),'') is null or char_length(p_reason)>1000 then return 'reason_required';end if;
 select * into r from public.event_registrations where id=p_registration_id;
 select * into e from public.events where id=r.event_id and organizer_id=auth.uid() for update;
 if not found then return 'not_permitted';end if;
 if e.status not in ('published','completed') or r.status<>'approved' or not private.attendance_correction_allowed(r.id) then return 'invalid_status';end if;
 select * into a from public.attendance_records where registration_id=r.id;
 if p_action='time_in' then
  if a.id is not null then return 'already_timed_in';end if;
  insert into public.attendance_records(registration_id,event_id,user_id,time_in_method) values(r.id,e.id,r.user_id,'manual');
 elsif p_action='time_out' then
  if a.id is null or a.status<>'present' or a.time_out_at is not null or e.attendance_policy<>'time_in_and_out' then return 'invalid_status';end if;
  update public.attendance_records set time_out_at=now(),time_out_method='manual' where id=a.id;
 elsif p_action in ('revoke','clear_flag','revoke_flag') then
  if a.id is null or a.status<>'present' or (p_action<>'revoke' and (a.flag is null or a.flag_resolution is not null)) then return 'invalid_status';end if;
  update public.attendance_records set status=case when p_action='clear_flag' then 'present' else 'revoked' end,revoked_at=case when p_action='clear_flag' then null else now() end,revoked_by=case when p_action='clear_flag' then null else auth.uid() end,
   flag_resolution=case when p_action='clear_flag' then 'cleared' when p_action='revoke_flag' then 'revoked' else flag_resolution end,flag_resolved_at=case when p_action<>'revoke' then now() else flag_resolved_at end,flag_resolved_by=case when p_action<>'revoke' then auth.uid() else flag_resolved_by end where id=a.id;
 else return 'invalid_input';end if;
 perform private.log_audit('attendance.corrected','event_registrations',r.id,jsonb_build_object('action',p_action,'reason',p_reason));return 'ok';
end;$$;
create function public.set_attendance_settings(p_event_id uuid,p_policy text,p_lead integer,p_onsite boolean) returns text language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted';end if;
 select * into e from public.events where id=p_event_id and organizer_id=auth.uid() for update;if not found then return 'not_permitted';end if;
 if e.status not in ('draft','published') then return 'invalid_status';end if;
 if p_policy is null or p_policy not in ('time_in_only','time_in_and_out') or p_lead is null or p_lead not between 0 and 180 or p_onsite is null then return 'invalid_input';end if;
 if exists(select 1 from public.attendance_sessions where event_id=e.id) and (p_policy<>e.attendance_policy::text or p_lead<>e.attendance_opens_minutes_before) then return 'attendance_locked';end if;
 update public.events set attendance_policy=p_policy::public.attendance_policy,attendance_opens_minutes_before=p_lead,allow_onsite_registration=p_onsite where id=e.id;
 perform private.log_audit('attendance.settings_changed','events',e.id);return 'ok';
end;$$;
create function private.attendance_schedule_lock() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.attendance_policy is distinct from old.attendance_policy or new.attendance_opens_minutes_before is distinct from old.attendance_opens_minutes_before) and exists(select 1 from public.attendance_sessions where event_id=old.id) then raise exception 'Attendance schedule and policy are locked' using errcode='23514';end if;return new;
end;$$;
create trigger events_attendance_lock before update on public.events for each row execute function private.attendance_schedule_lock();
create function private.close_invalid_attendance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='events' then
  if new.status<>'published' or new.organizer_id is distinct from old.organizer_id then update public.attendance_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where event_id=new.id and status='open';end if;
 else
  if new.organizer_status<>'active' then update public.attendance_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where event_id in(select id from public.events where organizer_id=new.id) and status='open';end if;
 end if;return new;
end;$$;
create trigger events_close_attendance after update of status,organizer_id on public.events for each row execute function private.close_invalid_attendance();
create trigger profiles_close_attendance after update of organizer_status on public.profiles for each row execute function private.close_invalid_attendance();
create function public.complete_event(p_event_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted';end if;
 select * into e from public.events where id=p_event_id and organizer_id=auth.uid() for update;if not found then return 'not_permitted';end if;
 if e.status<>'published' or now()<e.starts_at then return 'invalid_status';end if;
 update public.events set status='completed',completed_at=now() where id=e.id;perform private.log_audit('event.completed','events',e.id);return 'ok';
end;$$;
create function private.registration_attendance_lock() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status and exists(select 1 from public.attendance_records where registration_id=old.id) then raise exception 'Registration has attendance' using errcode='23514';end if;return new;
end;$$;
create trigger registrations_attendance_lock before update on public.event_registrations for each row execute function private.registration_attendance_lock();
revoke all on function private.attendance_end(public.events),private.attendance_token(uuid,integer),private.attendance_correction_allowed(uuid),private.attendance_schedule_lock(),private.close_invalid_attendance(),private.registration_attendance_lock() from public,anon,authenticated;
revoke all on function public.open_attendance_session(uuid,text),public.close_attendance_session(uuid),public.get_attendance_qr(uuid),public.submit_attendance_scan(text,text,uuid),public.get_attendance_feed(uuid),public.correct_attendance(uuid,text,text),public.set_attendance_settings(uuid,text,integer,boolean),public.complete_event(uuid) from public,anon;
grant execute on function public.open_attendance_session(uuid,text),public.close_attendance_session(uuid),public.get_attendance_qr(uuid),public.submit_attendance_scan(text,text,uuid),public.get_attendance_feed(uuid),public.correct_attendance(uuid,text,text),public.set_attendance_settings(uuid,text,integer,boolean),public.complete_event(uuid) to authenticated;
create or replace function public.register_for_event(p_event_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare v_event public.events; v_registration public.event_registrations; v_status public.registration_status; v_channel public.registration_channel := 'online';
begin
  if not (select private.is_permanent_user()) then return 'not_permitted'; end if;
  select * into v_event from public.events where id = p_event_id and status <> 'draft' for update;
  if not found then return 'not_found'; end if;
  if v_event.status <> 'published' then return 'registration_closed'; end if;
  if v_event.organizer_id = auth.uid() then return 'own_event'; end if;
  perform 1 from public.profiles where id = auth.uid() and is_complete for update;
  if not found then return 'profile_incomplete'; end if;
  select * into v_registration from public.event_registrations where event_id = p_event_id and user_id = auth.uid();
  if found and v_registration.status <> 'cancelled' then return v_registration.status::text; end if;
  if now() < v_event.registration_opens_at or now() >= v_event.registration_closes_at then
    if not v_event.allow_onsite_registration or not exists(select 1 from public.attendance_sessions where event_id=p_event_id and kind='time_in' and status='open' and closes_at>now()) then return 'registration_closed';end if;
    v_channel := 'onsite';
  end if;
  if v_event.capacity is not null and (select count(*) from public.event_registrations where event_id = p_event_id and status = 'approved') >= v_event.capacity then return 'event_full'; end if;
  v_status := case when v_event.approval_mode = 'automatic' then 'approved'::public.registration_status else 'pending'::public.registration_status end;
  insert into public.event_registrations(event_id,user_id,status,registration_channel,decided_at) values(p_event_id,auth.uid(),v_status,v_channel,case when v_status = 'approved' then now() end)
  on conflict(event_id,user_id) do update set status = excluded.status,registered_at = now(),registration_channel = excluded.registration_channel,decided_at = excluded.decided_at,decided_by = null,decision_reason = null,cancelled_at = null;
  perform private.log_audit('registration.created','events',p_event_id,jsonb_build_object('status',v_status)); return v_status::text;
end; $$;

-- Only hashed device evidence, with bounded retention.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('eventhub-device-retention','15 3 * * *', $job$delete from public.attendance_device_signals s using public.events e where e.id=s.event_id and coalesce(e.completed_at,e.cancelled_at)<now()-interval '30 days'$job$);
