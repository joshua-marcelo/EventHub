-- Condensed MVP stage 1. No attendance or certificate tables/workflows.
create table public.organizer_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id),
  organization_name text not null check (char_length(organization_name) between 3 and 150),
  position_title text not null check (char_length(position_title) between 2 and 100),
  contact_number text not null check (contact_number ~ '^(\+63|0)9[0-9]{9}$'),
  reason text not null check (char_length(reason) between 50 and 1000),
  proof_document_path text not null,
  supporting_document_path text,
  privacy_notice_version text not null,
  privacy_consented_at timestamptz not null default now(),
  status public.application_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by <> applicant_id),
  check (status <> 'rejected' or nullif(btrim(review_notes),'') is not null)
);
create unique index organizer_applications_pending_idx on public.organizer_applications(applicant_id) where status = 'pending';
create index organizer_applications_status_idx on public.organizer_applications(status,submitted_at);
create index organizer_applications_applicant_idx on public.organizer_applications(applicant_id,submitted_at desc);
create index organizer_applications_reviewer_idx on public.organizer_applications(reviewed_by);
create trigger organizer_applications_updated before update on public.organizer_applications for each row execute function private.set_updated_at();
alter table public.organizer_applications enable row level security;
revoke all on public.organizer_applications from anon, authenticated;
grant select on public.organizer_applications to authenticated;
create policy "Applications: own or admin" on public.organizer_applications for select to authenticated using ((select private.is_permanent_user()) and (applicant_id = (select auth.uid()) or (select private.is_admin())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('organizer-requirements','organizer-requirements',false,5242880,array['application/pdf','image/jpeg','image/png']);
create policy "Requirements: own upload" on storage.objects for insert to authenticated with check (bucket_id = 'organizer-requirements' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_permanent_user()));
create policy "Requirements: own or admin read" on storage.objects for select to authenticated using (bucket_id = 'organizer-requirements' and (select private.is_permanent_user()) and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
-- No update/delete grants: submitted proofs are immutable.

create function public.submit_organizer_application(p_values jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_profile public.profiles; v_proof text; v_support text;
begin
  if not (select private.is_permanent_user()) then return jsonb_build_object('code','not_permitted'); end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found or not v_profile.is_complete or v_profile.organizer_status not in ('none','revoked') then return jsonb_build_object('code','not_eligible'); end if;
  if p_values->>'privacy_notice_version' is distinct from '2026-10-draft' or p_values->>'consent' is distinct from 'true' then return jsonb_build_object('code','consent_required'); end if;
  if exists(select 1 from public.organizer_applications where applicant_id = auth.uid() and status = 'pending') then return jsonb_build_object('code','already_pending'); end if;
  v_proof := p_values->>'proof_document_path'; v_support := nullif(p_values->>'supporting_document_path','');
  if not exists(select 1 from storage.objects where bucket_id = 'organizer-requirements' and name = v_proof and (storage.foldername(name))[1] = auth.uid()::text)
    or (v_support is not null and not exists(select 1 from storage.objects where bucket_id = 'organizer-requirements' and name = v_support and (storage.foldername(name))[1] = auth.uid()::text)) then return jsonb_build_object('code','invalid_document'); end if;
  insert into public.organizer_applications(applicant_id,organization_name,position_title,contact_number,reason,proof_document_path,supporting_document_path,privacy_notice_version)
  values(auth.uid(),btrim(p_values->>'organization_name'),btrim(p_values->>'position_title'),btrim(p_values->>'contact_number'),btrim(p_values->>'reason'),v_proof,v_support,p_values->>'privacy_notice_version') returning id into v_id;
  perform private.log_audit('organizer.applied','organizer_applications',v_id);
  return jsonb_build_object('code','ok','id',v_id);
exception when check_violation or not_null_violation then return jsonb_build_object('code','invalid_input');
end; $$;

create function public.withdraw_organizer_application(p_id uuid) returns text language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_permanent_user()) then return 'not_permitted'; end if;
  update public.organizer_applications set status = 'withdrawn' where id = p_id and applicant_id = auth.uid() and status = 'pending';
  if not found then return 'not_pending'; end if;
  perform private.log_audit('organizer.withdrawn','organizer_applications',p_id); return 'ok';
end; $$;

create function public.review_organizer_application(p_id uuid,p_decision text,p_reason text default null) returns text language plpgsql security definer set search_path = '' as $$
declare v_app public.organizer_applications;
begin
  if not (select private.is_permanent_user()) or not (select private.is_admin()) then return 'not_permitted'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') then return 'invalid_input'; end if;
  if p_decision = 'rejected' and nullif(btrim(p_reason),'') is null then return 'reason_required'; end if;
  if char_length(p_reason) > 1000 then return 'invalid_input'; end if;
  select * into v_app from public.organizer_applications where id = p_id for update;
  if not found then return 'not_found'; end if;
  if v_app.applicant_id = auth.uid() then return 'self_review'; end if;
  if v_app.status <> 'pending' then return 'already_reviewed'; end if;
  update public.organizer_applications set status = p_decision::public.application_status,reviewed_by = auth.uid(),reviewed_at = now(),review_notes = nullif(btrim(p_reason),'') where id = p_id;
  if p_decision = 'approved' then update public.profiles set organizer_status = 'active',organizer_since = now() where id = v_app.applicant_id; end if;
  perform private.log_audit('organizer.' || p_decision,'organizer_applications',p_id,jsonb_build_object('reason',p_reason)); return 'ok';
end; $$;

create function public.set_organizer_status(p_user_id uuid,p_status text,p_reason text default null) returns text language plpgsql security definer set search_path = '' as $$
declare v_current public.organizer_status;
begin
  if not (select private.is_permanent_user()) or not (select private.is_admin()) then return 'not_permitted'; end if;
  if p_status is null or p_status not in ('active','suspended','revoked') then return 'invalid_input'; end if;
  if nullif(btrim(p_reason),'') is null or char_length(p_reason) > 1000 then return 'reason_required'; end if;
  select organizer_status into v_current from public.profiles where id = p_user_id for update;
  if not found or v_current = 'none' or (p_status = 'active' and v_current <> 'suspended') or (p_status <> 'active' and v_current not in ('active','suspended')) then return 'invalid_status'; end if;
  update public.profiles set organizer_status = p_status::public.organizer_status,organizer_status_reason = btrim(p_reason) where id = p_user_id;
  perform private.log_audit('organizer.status_changed','profiles',p_user_id,jsonb_build_object('before',v_current,'after',p_status,'reason',p_reason));
  -- Stage 2 will extend this RPC to close attendance sessions.
  return 'ok';
end; $$;

create function private.new_invite_code() returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',1 + (get_byte(b.bytes,n) % 30),1),'') from (select extensions.gen_random_bytes(8) as bytes) b cross join generate_series(0,7) n;
$$;
revoke all on function private.new_invite_code() from public,anon,authenticated;
create table public.events (
  id uuid primary key default extensions.gen_random_uuid(), organizer_id uuid not null references public.profiles(id),
  title text not null check(char_length(title) between 5 and 150),
  description text check(description is null or char_length(description) between 20 and 5000), banner_path text,
  category_id smallint references public.event_categories(id), host_college_id smallint references public.colleges(id),
  venue text check(venue is null or char_length(venue) between 3 and 200),
  starts_at timestamptz, ends_at timestamptz, registration_opens_at timestamptz, registration_closes_at timestamptz,
  capacity integer check(capacity between 1 and 5000), approval_mode public.approval_mode not null default 'automatic',
  visibility public.event_visibility not null default 'public', certificates_enabled boolean not null default false,
  attendance_policy public.attendance_policy not null default 'time_in_only', attendance_opens_minutes_before smallint not null default 60 check(attendance_opens_minutes_before between 0 and 180), allow_onsite_registration boolean not null default false,
  invite_code text not null unique default private.new_invite_code(),
  status public.event_status not null default 'draft', published_at timestamptz, completed_at timestamptz,cancelled_at timestamptz,
  cancellation_reason text, cancelled_by uuid references public.profiles(id),
  search tsvector generated always as (setweight(to_tsvector('simple',coalesce(title,'')),'A') || setweight(to_tsvector('simple',coalesce(venue,'')),'B') || setweight(to_tsvector('simple',coalesce(description,'')),'C')) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at is null or (starts_at is not null and ends_at > starts_at and ends_at <= starts_at + interval '7 days')),
  check(registration_opens_at is null or registration_closes_at is null or registration_opens_at < registration_closes_at),
  check(registration_closes_at is null or starts_at is null or registration_closes_at <= starts_at),
  check(status = 'draft' or (description is not null and category_id is not null and venue is not null and starts_at is not null and registration_opens_at is not null and registration_closes_at is not null)),
  check(status <> 'cancelled' or (nullif(btrim(cancellation_reason),'') is not null and cancelled_by is not null))
);
create index events_status_idx on public.events(status,starts_at);
create index events_owner_idx on public.events(organizer_id,starts_at desc);
create index events_category_idx on public.events(category_id);
create index events_college_idx on public.events(host_college_id);
create index events_cancelled_by_idx on public.events(cancelled_by);
create index events_search_idx on public.events using gin(search);
create trigger events_updated before update on public.events for each row execute function private.set_updated_at();
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;
create policy "Events: owner admin or non-draft" on public.events for select to authenticated using ((select private.is_permanent_user()) and (organizer_id = (select auth.uid()) or (select private.is_admin()) or status <> 'draft'));

create table public.event_registrations (
  id uuid primary key default extensions.gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id), status public.registration_status not null,
  registration_channel public.registration_channel not null default 'online',registered_at timestamptz not null default now(),
  decided_at timestamptz,decided_by uuid references public.profiles(id),decision_reason text,cancelled_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(event_id,user_id),unique(id,event_id,user_id)
);
create index registrations_event_status_idx on public.event_registrations(event_id,status,registered_at);
create index registrations_user_idx on public.event_registrations(user_id,registered_at desc);
create index registrations_decided_by_idx on public.event_registrations(decided_by);
create trigger registrations_updated before update on public.event_registrations for each row execute function private.set_updated_at();
alter table public.event_registrations enable row level security;
revoke all on public.event_registrations from anon, authenticated;
grant select on public.event_registrations to authenticated;
create policy "Registrations: own or event owner" on public.event_registrations for select to authenticated using ((select private.is_permanent_user()) and (user_id = (select auth.uid()) or exists(select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid()))));

create function private.can_view_profile(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_permanent_user() and exists(select 1 from public.event_registrations r join public.events e on e.id = r.event_id where r.user_id = p_id and e.organizer_id = auth.uid() and (coalesce(e.completed_at,e.cancelled_at) is null or now() < coalesce(e.completed_at,e.cancelled_at) + interval '30 days'));
$$;
revoke all on function private.can_view_profile(uuid) from public, anon;
grant execute on function private.can_view_profile(uuid) to authenticated;
drop policy "Profiles: users read their own profile; admins read all" on public.profiles;
create policy "Profiles: own admin or event registrant" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()) or private.can_view_profile(id));
drop policy "Avatars: owners and admins read" on storage.objects;
create policy "Avatars: own admin or event registrant" on storage.objects for select to authenticated using (bucket_id = 'avatars' and (select private.is_permanent_user()) and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()) or private.can_view_profile(owner_id::uuid)));

create function private.registration_identity_lock() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.student_id is distinct from old.student_id or new.avatar_path is distinct from old.avatar_path) and exists(
    select 1 from public.event_registrations r join public.events e on e.id = r.event_id
    where r.user_id = old.id and r.status = 'approved' and e.status = 'published' and now() <= coalesce(e.ends_at,((e.starts_at at time zone 'Asia/Manila')::date + time '23:59:59') at time zone 'Asia/Manila')
  ) then raise exception 'Student ID and photo are locked by an approved event registration' using errcode = '23514'; end if;
  return new;
end; $$;
revoke all on function private.registration_identity_lock() from public,anon,authenticated;
create trigger profiles_registration_identity_lock before update on public.profiles for each row execute function private.registration_identity_lock();

-- RPC-only content writes preserve immutable ownership, invite code and state.
create function public.save_event(p_id uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event public.events; v_id uuid; v_capacity integer;
begin
  if not (select private.is_permanent_user()) or not (select private.is_active_organizer()) then return jsonb_build_object('code','not_permitted'); end if;
  if not exists(select 1 from public.profiles where id = auth.uid() and is_complete) then return jsonb_build_object('code','profile_incomplete'); end if;
  if p_id is not null then
    select * into v_event from public.events where id = p_id and organizer_id = auth.uid() for update;
    if not found then return jsonb_build_object('code','not_found'); end if;
    if v_event.status not in ('draft','published') then return jsonb_build_object('code','terminal_event'); end if;
  end if;
  v_capacity := nullif(p_values->>'capacity','')::integer;
  if p_id is not null and v_capacity < (select count(*) from public.event_registrations where event_id = p_id and status = 'approved') then return jsonb_build_object('code','capacity_too_small'); end if;
  if p_values->>'title' is null then return jsonb_build_object('code','invalid_input'); end if;
  if p_id is null then
    insert into public.events(organizer_id,title) values(auth.uid(),btrim(p_values->>'title')) returning id into v_id;
  else v_id := p_id; end if;
  update public.events set title = btrim(p_values->>'title'),description = nullif(btrim(p_values->>'description'),''),
    category_id = nullif(p_values->>'category_id','')::smallint,host_college_id = nullif(p_values->>'host_college_id','')::smallint,
    venue = nullif(btrim(p_values->>'venue'),''),starts_at = nullif(p_values->>'starts_at','')::timestamptz,ends_at = nullif(p_values->>'ends_at','')::timestamptz,
    registration_opens_at = nullif(p_values->>'registration_opens_at','')::timestamptz,registration_closes_at = nullif(p_values->>'registration_closes_at','')::timestamptz,
    capacity = v_capacity,approval_mode = coalesce(p_values->>'approval_mode','automatic')::public.approval_mode,
    visibility = coalesce(p_values->>'visibility','public')::public.event_visibility where id = v_id;
  perform private.log_audit(case when p_id is null then 'event.created' else 'event.updated' end,'events',v_id);
  return jsonb_build_object('code','ok','id',v_id);
exception when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or foreign_key_violation then return jsonb_build_object('code','invalid_input');
end; $$;

create function public.publish_event(p_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare v_event public.events;
begin
  if not (select private.is_permanent_user()) or not (select private.is_active_organizer()) then return 'not_permitted'; end if;
  select * into v_event from public.events where id = p_id and organizer_id = auth.uid() for update;
  if not found then return 'not_found'; end if;
  if v_event.status <> 'draft' then return 'invalid_status'; end if;
  if v_event.starts_at is null or v_event.starts_at <= now() or v_event.description is null or v_event.venue is null or v_event.category_id is null or v_event.registration_opens_at is null or v_event.registration_closes_at is null then return 'incomplete_event'; end if;
  if not exists(select 1 from public.event_categories where id = v_event.category_id and is_active) or (v_event.host_college_id is not null and not exists(select 1 from public.colleges where id = v_event.host_college_id and is_active)) then return 'inactive_lookup'; end if;
  update public.events set status = 'published',published_at = now() where id = p_id;
  perform private.log_audit('event.published','events',p_id); return 'ok';
end; $$;

create function public.cancel_event(p_id uuid,p_reason text) returns text language plpgsql security definer set search_path = '' as $$
declare v_event public.events;
begin
  if not (select private.is_permanent_user()) then return 'not_permitted'; end if;
  select * into v_event from public.events where id = p_id for update;
  if not found then return 'not_found'; end if;
  if not ((v_event.organizer_id = auth.uid() and private.is_active_organizer()) or private.is_admin()) then return 'not_permitted'; end if;
  if v_event.status <> 'published' then return 'invalid_status'; end if;
  if nullif(btrim(p_reason),'') is null or char_length(p_reason) > 1000 then return 'reason_required'; end if;
  update public.events set status = 'cancelled',cancelled_at = now(),cancelled_by = auth.uid(),cancellation_reason = btrim(p_reason) where id = p_id;
  perform private.log_audit('event.cancelled','events',p_id,jsonb_build_object('reason',p_reason,'by_admin',private.is_admin())); return 'ok';
end; $$;

create function public.delete_event_draft(p_id uuid) returns text language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_permanent_user()) or not (select private.is_active_organizer()) then return 'not_permitted'; end if;
  delete from public.events where id = p_id and organizer_id = auth.uid() and status = 'draft';
  if not found then return 'not_found'; end if;
  perform private.log_audit('event.draft_deleted','events',p_id); return 'ok';
end; $$;

create function public.register_for_event(p_event_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare v_event public.events; v_registration public.event_registrations; v_status public.registration_status;
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
  if now() < v_event.registration_opens_at or now() >= v_event.registration_closes_at then return 'registration_closed'; end if;
  if v_event.capacity is not null and (select count(*) from public.event_registrations where event_id = p_event_id and status = 'approved') >= v_event.capacity then return 'event_full'; end if;
  v_status := case when v_event.approval_mode = 'automatic' then 'approved'::public.registration_status else 'pending'::public.registration_status end;
  insert into public.event_registrations(event_id,user_id,status,decided_at) values(p_event_id,auth.uid(),v_status,case when v_status = 'approved' then now() end)
  on conflict(event_id,user_id) do update set status = excluded.status,registered_at = now(),registration_channel = 'online',decided_at = excluded.decided_at,decided_by = null,decision_reason = null,cancelled_at = null;
  perform private.log_audit('registration.created','events',p_event_id,jsonb_build_object('status',v_status)); return v_status::text;
end; $$;

create function public.cancel_registration(p_event_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare v_event public.events;
begin
  if not (select private.is_permanent_user()) then return 'not_permitted'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' or now() >= v_event.starts_at then return 'registration_closed'; end if;
  update public.event_registrations set status = 'cancelled',cancelled_at = now() where event_id = p_event_id and user_id = auth.uid() and status in ('pending','approved');
  if not found then return 'not_found'; end if;
  perform private.log_audit('registration.cancelled','events',p_event_id); return 'ok';
end; $$;

create function public.decide_registration(p_id uuid,p_decision text,p_reason text default null) returns text language plpgsql security definer set search_path = '' as $$
declare v_event public.events; v_registration public.event_registrations;
begin
  if not (select private.is_permanent_user()) or not (select private.is_active_organizer()) then return 'not_permitted'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') or char_length(p_reason) > 1000 then return 'invalid_input'; end if;
  select e.* into v_event from public.events e join public.event_registrations r on r.event_id = e.id where r.id = p_id and e.organizer_id = auth.uid() for update of e;
  if not found then return 'not_found'; end if;
  if v_event.status <> 'published' or now() > coalesce(v_event.ends_at,((v_event.starts_at at time zone 'Asia/Manila')::date + time '23:59:59') at time zone 'Asia/Manila') then return 'registration_closed'; end if;
  select * into v_registration from public.event_registrations where id = p_id for update;
  if v_registration.status <> 'pending' then return 'not_pending'; end if;
  if p_decision = 'approved' then
    perform 1 from public.profiles where id = v_registration.user_id and is_complete for update;
    if not found then return 'profile_incomplete'; end if;
    if v_event.capacity is not null and (select count(*) from public.event_registrations where event_id = v_event.id and status = 'approved') >= v_event.capacity then return 'event_full'; end if;
  end if;
  update public.event_registrations set status = p_decision::public.registration_status,decided_at = now(),decided_by = auth.uid(),decision_reason = nullif(btrim(p_reason),'') where id = p_id;
  perform private.log_audit('registration.' || p_decision,'event_registrations',p_id,jsonb_build_object('reason',p_reason)); return 'ok';
end; $$;

create function public.get_event_by_invite_code(p_code text) returns uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.events e where private.is_permanent_user() and auth.uid() is not null and e.invite_code = upper(btrim(p_code)) and e.status <> 'draft';
$$;

create function public.get_public_event_preview(p_event_id uuid)
returns table(title text,description text,category_name text,host_college_name text,starts_at timestamptz,ends_at timestamptz,venue text,banner_path text,organization_name text,status_label text)
language sql stable security definer set search_path = '' as $$
  select e.title,e.description,c.name,h.name,e.starts_at,e.ends_at,e.venue,e.banner_path,
    (select a.organization_name from public.organizer_applications a where a.applicant_id = e.organizer_id and a.status = 'approved' order by a.reviewed_at desc limit 1),e.status::text
  from public.events e left join public.event_categories c on c.id = e.category_id left join public.colleges h on h.id = e.host_college_id
  where e.id = p_event_id and e.visibility = 'public' and e.status in ('published','completed','cancelled');
$$;

revoke all on function public.submit_organizer_application(jsonb),public.withdraw_organizer_application(uuid),public.review_organizer_application(uuid,text,text),public.set_organizer_status(uuid,text,text),public.save_event(uuid,jsonb),public.publish_event(uuid),public.cancel_event(uuid,text),public.delete_event_draft(uuid),public.register_for_event(uuid),public.cancel_registration(uuid),public.decide_registration(uuid,text,text),public.get_event_by_invite_code(text) from public,anon;
grant execute on function public.submit_organizer_application(jsonb),public.withdraw_organizer_application(uuid),public.review_organizer_application(uuid,text,text),public.set_organizer_status(uuid,text,text),public.save_event(uuid,jsonb),public.publish_event(uuid),public.cancel_event(uuid,text),public.delete_event_draft(uuid),public.register_for_event(uuid),public.cancel_registration(uuid),public.decide_registration(uuid,text,text),public.get_event_by_invite_code(text) to authenticated;
revoke all on function public.get_public_event_preview(uuid) from public;
grant execute on function public.get_public_event_preview(uuid) to anon,authenticated;
