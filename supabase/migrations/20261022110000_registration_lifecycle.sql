-- PENDING USER APPROVAL. Forward-only; apply through the linked CLI only after approval.
-- Transition: preserve the existing window for published events without attendance history.
-- Events with attendance history transition permanently to closed registration. No registrations,
-- attendance records, invite codes, deadlines, visibility or approval settings are changed.
alter table public.events add column registration_open boolean not null default false;
update public.events e set registration_open = true
where status = 'published' and not exists (
  select 1 from public.attendance_sessions s where s.event_id = e.id
);

create function public.set_event_registration(p_event_id uuid, p_open boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare e public.events;
begin
  if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted'; end if;
  select * into e from public.events where id = p_event_id and organizer_id = auth.uid() for update;
  if not found then return 'not_permitted'; end if;
  if e.status <> 'published' or p_open is null then return 'invalid_status'; end if;
  if p_open and exists(select 1 from public.attendance_sessions where event_id = e.id) then return 'attendance_started'; end if;
  if p_open and (e.registration_closes_at is null or clock_timestamp() >= e.registration_closes_at) then return 'registration_closed'; end if;
  update public.events set registration_open = p_open where id = e.id;
  perform private.log_audit(case when p_open then 'registration.opened' else 'registration.closed' end, 'events', e.id);
  return 'ok';
end; $$;
revoke all on function public.set_event_registration(uuid,boolean) from public,anon;
grant execute on function public.set_event_registration(uuid,boolean) to authenticated;

create or replace function public.register_for_event(p_event_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.event_registrations; v_status public.registration_status;
begin
  if not private.is_permanent_user() then return 'not_permitted'; end if;
  -- The same lock is held by attendance start and registration controls until transaction commit.
  select * into e from public.events where id = p_event_id and status <> 'draft' for update;
  if not found then return 'not_found'; end if;
  if e.status <> 'published' or not e.registration_open
    or exists(select 1 from public.attendance_sessions where event_id = e.id)
    or e.registration_opens_at is null or e.registration_closes_at is null
    or clock_timestamp() < e.registration_opens_at or clock_timestamp() >= e.registration_closes_at
    then return 'registration_closed'; end if;
  if e.organizer_id = auth.uid() then return 'own_event'; end if;
  perform 1 from public.profiles where id = auth.uid() and is_complete for update;
  if not found then return 'profile_incomplete'; end if;
  select * into r from public.event_registrations where event_id = e.id and user_id = auth.uid();
  if found and r.status <> 'cancelled' then return r.status::text; end if;
  if e.capacity is not null and (select count(*) from public.event_registrations where event_id = e.id and status = 'approved') >= e.capacity then return 'event_full'; end if;
  v_status := case when e.approval_mode = 'automatic' then 'approved'::public.registration_status else 'pending'::public.registration_status end;
  insert into public.event_registrations(event_id,user_id,status,registration_channel,decided_at)
    values(e.id,auth.uid(),v_status,'online',case when v_status = 'approved' then now() end)
  on conflict(event_id,user_id) do update set status = excluded.status,registered_at = now(),registration_channel = excluded.registration_channel,
    decided_at = excluded.decided_at,decided_by = null,decision_reason = null,cancelled_at = null;
  perform private.log_audit('registration.created','events',e.id,jsonb_build_object('status',v_status));
  return v_status::text;
end; $$;

create or replace function public.open_attendance_session(p_event_id uuid,p_kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare e public.events; v_id uuid;
begin
  if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted'; end if;
  select * into e from public.events where id = p_event_id and organizer_id = auth.uid() for update;
  if not found then return 'not_permitted'; end if;
  if e.status <> 'published' or p_kind not in ('time_in','time_out') or p_kind is null then return 'invalid_status'; end if;
  if p_kind = 'time_out' and e.attendance_policy <> 'time_in_and_out' then return 'invalid_status'; end if;
  if p_kind = 'time_in' and exists(select 1 from public.attendance_sessions where event_id = e.id and kind = 'time_out') then return 'time_out_started'; end if;
  -- Atomic with the session insert. Any registration waiting for this lock sees closed state.
  update public.events set registration_open = false where id = e.id;
  update public.attendance_sessions set status = 'closed',closed_at = now(),closed_by = auth.uid() where event_id = e.id and status = 'open';
  insert into public.attendance_sessions(event_id,kind,opened_by,closes_at)
    values(e.id,p_kind,auth.uid(),clock_timestamp() + interval '12 hours') returning id into v_id;
  insert into public.attendance_session_secrets values(v_id,extensions.gen_random_bytes(32));
  perform private.log_audit('attendance.session_opened','events',e.id,jsonb_build_object('kind',p_kind,'manual',true));
  return 'ok';
end; $$;

-- Reads the participant's own eligibility without exposing session secrets or other registrations.
-- Explicit event visibility check matches event RLS; profile checks need definer access.
create function public.get_event_lifecycle(p_event_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'registration_open', e.status = 'published' and e.registration_open
      and now() >= e.registration_opens_at and now() < e.registration_closes_at,
    'registration_enabled', e.registration_open,
    'can_open_registration', e.status = 'published' and now() < e.registration_closes_at
      and not exists(select 1 from public.attendance_sessions where event_id = e.id),
    'attendance_started', exists(select 1 from public.attendance_sessions where event_id = e.id),
    'attendance_kind', s.kind,
    'next_attendance_kind', case when exists(select 1 from public.attendance_sessions where event_id = e.id and kind = 'time_out') then 'time_out' else 'time_in' end,
    'can_scan_attendance', coalesce(e.status = 'published' and s.id is not null
      and e.organizer_id <> auth.uid() and r.status = 'approved'
      and exists(select 1 from public.profiles where id = auth.uid() and is_complete)
      and exists(select 1 from public.profiles where id = e.organizer_id and organizer_status = 'active')
      and (a.id is null or a.status <> 'revoked')
      and case when s.kind = 'time_in' then a.id is null
        else a.id is not null and a.time_out_at is null end, false)
  ) from public.events e
  left join public.event_registrations r on r.event_id = e.id and r.user_id = auth.uid()
  left join public.attendance_records a on a.registration_id = r.id
  left join public.attendance_sessions s on s.event_id = e.id and s.status = 'open' and s.closes_at > now()
  where private.is_permanent_user() and e.id = p_event_id
    and (e.status <> 'draft' or e.organizer_id = auth.uid() or private.is_admin());
$$;

-- Keep landing-page registration labels consistent while preserving public discovery.
create or replace function public.get_upcoming_public_events()
returns table(id uuid,title text,category_name text,starts_at timestamptz,venue text,banner_path text,registration_state text)
language sql stable security definer set search_path = '' as $$
  select e.id,e.title,c.name,e.starts_at,e.venue,e.banner_path,
    case when not e.registration_open then 'Registration closed'
      when now() < e.registration_opens_at then 'Opening soon'
      when now() >= e.registration_closes_at then 'Registration closed'
      when e.capacity is not null and (select count(*) from public.event_registrations r where r.event_id = e.id and r.status = 'approved') >= e.capacity then 'Fully booked'
      else 'Registration open' end
  from public.events e left join public.event_categories c on c.id = e.category_id
  where e.visibility = 'public' and e.status = 'published' and e.starts_at > now()
  order by e.starts_at,e.id limit 6;
$$;
revoke all on function public.get_event_lifecycle(uuid) from public,anon;
grant execute on function public.get_event_lifecycle(uuid) to authenticated;

-- Fixed invite code still locates the page, including while registration is closed.
-- Terminal and draft events are no longer eligible invite-code destinations.
create or replace function public.get_event_by_invite_code(p_code text) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.events e where private.is_permanent_user() and auth.uid() is not null
    and e.invite_code = upper(btrim(p_code)) and e.status = 'published';
$$;
