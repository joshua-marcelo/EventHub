-- EventHub · Organizer-controlled attendance.
--
-- PENDING APPROVAL — not applied. Apply with the Supabase CLI (`supabase db push --linked`).
--
-- Product decision: attendance opens when the event's Organizer deliberately selects Start Attendance
-- and stops when they select Close Attendance, even if the scheduled start has not arrived or has
-- changed. Only the scheduled-window check is removed. Everything else is unchanged:
--   * published events only (not draft, cancelled or completed), owned by the caller, active Organizer;
--   * session identity, rotating HMAC QR tokens, registration and approval checks, duplicate-scan
--     prevention and device signals stay in submit_attendance_scan, which is not modified;
--   * row locking (events FOR UPDATE) and the audit entry are kept.
-- A session still has closes_at: now it is a 12-hour safety cap from opening (a forgotten session
-- cannot stay open for days) instead of the scheduled end. The Organizer can close it at any time.
create or replace function public.open_attendance_session(p_event_id uuid,p_kind text) returns text language plpgsql security definer set search_path='' as $$
declare e public.events; v_id uuid;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted'; end if;
 select * into e from public.events where id=p_event_id and organizer_id=auth.uid() for update;
 if not found then return 'not_permitted'; end if;
 if e.status<>'published' or p_kind not in ('time_in','time_out') or p_kind is null then return 'invalid_status'; end if;
 if p_kind='time_out' and e.attendance_policy<>'time_in_and_out' then return 'invalid_status'; end if;
 if p_kind='time_in' and exists(select 1 from public.attendance_sessions where event_id=e.id and kind='time_out') then return 'time_out_started'; end if;
 update public.attendance_sessions set status='closed',closed_at=now(),closed_by=auth.uid() where event_id=e.id and status='open';
 insert into public.attendance_sessions(event_id,kind,opened_by,closes_at) values(e.id,p_kind,auth.uid(),now()+interval '12 hours') returning id into v_id;
 insert into public.attendance_session_secrets values(v_id,extensions.gen_random_bytes(32));
 perform private.log_audit('attendance.session_opened','events',e.id,jsonb_build_object('kind',p_kind,'manual',true));return 'ok';
end;$$;
