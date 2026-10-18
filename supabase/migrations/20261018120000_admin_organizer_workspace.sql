-- EventHub · Admins may use the Organizer workspace for their own events.
--
-- PENDING APPROVAL — not applied. Apply with the Supabase CLI (`supabase db push`) so the
-- migration version matches this filename.
--
-- Before: every organizer RPC (save_event, publish_event, attendance, certificates, reports,
-- banner storage) requires private.is_active_organizer(), which is true only for
-- organizer_status = 'active'. Admins with organizer_status = 'none' are refused.
--
-- After: organizer capability = active organizer OR admin. Nothing else changes:
--   * Every RPC using is_active_organizer() also requires organizer_id = auth.uid(), so an admin
--     acting as organizer manages only events they own; other organizers' events stay as before
--     (admins keep only their existing admin powers, e.g. cancel_event).
--   * organizer_status is not modified, so admins do not appear in the Organizers list and the
--     organizer status RPCs/transitions are untouched.
--   * Suspended/revoked organizers without is_admin remain refused.

-- Organizer capability for any user id (used where the acting user is not the event owner).
create function private.has_organizer_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.organizer_status = 'active' or p.is_admin from public.profiles p where p.id = p_user_id),
    false
  );
$$;
revoke all on function private.has_organizer_access(uuid) from public, anon, authenticated;

-- Same name and signature, so every existing policy and RPC picks up the new rule.
create or replace function private.is_active_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_organizer_access((select auth.uid()));
$$;

-- Participant QR scans checked the event owner's organizer_status inline; use the shared rule so
-- attendance works for admin-owned events. Body is otherwise identical to 20261011131818.
create or replace function public.submit_attendance_scan(p_token text,p_device_id text,p_expected_event_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if s.status<>'open' or now()>=s.closes_at or e.status<>'published' or not private.has_organizer_access(e.organizer_id) then return jsonb_build_object('code','attendance_closed');end if;
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

-- Close open sessions when the owner loses organizer capability, now including losing admin.
create or replace function private.close_invalid_attendance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='events' then
  if new.status<>'published' or new.organizer_id is distinct from old.organizer_id then update public.attendance_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where event_id=new.id and status='open';end if;
 else
  if not (new.organizer_status='active' or new.is_admin) then update public.attendance_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where event_id in(select id from public.events where organizer_id=new.id) and status='open';end if;
 end if;return new;
end;$$;
drop trigger profiles_close_attendance on public.profiles;
create trigger profiles_close_attendance after update of organizer_status, is_admin on public.profiles for each row execute function private.close_invalid_attendance();
