-- LOCAL PREPARATION ONLY. Apply only after separate approval.
-- Workflow records, not roles: profiles.organizer_status remains the only role authority.
create table public.organizer_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  invited_by uuid not null references public.profiles(id),
  user_id uuid unique references public.profiles(id),
  state text not null default 'reserved' check (state in ('reserved','sending','pending','failed','accepted')),
  attempt_id uuid,
  last_attempt_at timestamptz,
  provider_accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '1 hour',
  accepted_at timestamptz,
  verified_at timestamptz,
  acceptance_hash text check (acceptance_hash is null or acceptance_hash ~ '^[a-f0-9]{64}$'),
  acceptance_attempt uuid,
  created_at timestamptz not null default now(),
  check (user_id is null or user_id = id),
  check (state not in ('pending','accepted') or user_id is not null),
  check ((state = 'accepted') = (accepted_at is not null))
);
create index organizer_invitations_state_expiry_idx on public.organizer_invitations(state,expires_at);
create index organizer_invitations_inviter_idx on public.organizer_invitations(invited_by);
alter table public.organizer_invitations enable row level security;
revoke all on public.organizer_invitations from public, anon, authenticated;
-- Acceptance proofs are not readable even by Admin browser clients.
grant select (id,email,first_name,last_name,invited_by,user_id,state,last_attempt_at,provider_accepted_at,expires_at,accepted_at,verified_at,created_at)
  on public.organizer_invitations to authenticated;
grant all on public.organizer_invitations to service_role;
create policy "Invitations: permanent admins read" on public.organizer_invitations for select to authenticated
  using ((select private.is_permanent_user()) and (select private.is_admin()));

create function public.reserve_organizer_invitation(p_email text,p_first_name text,p_last_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text := lower(btrim(p_email));
begin
  if not private.is_permanent_user() or not private.is_admin() then return jsonb_build_object('code','not_permitted'); end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email) > 254
    or coalesce(char_length(btrim(p_first_name)),0) not between 1 and 80
    or coalesce(char_length(btrim(p_last_name)),0) not between 1 and 80 then return jsonb_build_object('code','invalid_input'); end if;
  if exists(select 1 from public.organizer_invitations where email=v_email) then return jsonb_build_object('code','already_invited'); end if;
  if exists(select 1 from auth.users where lower(email)=v_email) or exists(select 1 from public.profiles where lower(email)=v_email)
    then return jsonb_build_object('code','existing_account'); end if;
  insert into public.organizer_invitations(email,first_name,last_name,invited_by)
    values(v_email,btrim(p_first_name),btrim(p_last_name),auth.uid()) returning id into v_id;
  perform private.log_audit('organizer.invitation_reserved','organizer_invitations',v_id);
  return jsonb_build_object('code','ok','id',v_id);
exception when unique_violation then return jsonb_build_object('code','already_invited');
end; $$;

create function public.acquire_organizer_invitation(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.organizer_invitations; v_attempt uuid := extensions.gen_random_uuid();
begin
  if not private.is_permanent_user() or not private.is_admin() then return jsonb_build_object('code','not_permitted'); end if;
  select * into v from public.organizer_invitations where id=p_id for update;
  if not found then return jsonb_build_object('code','not_found'); end if;
  if v.state='accepted' or exists(select 1 from public.profiles where id=v.id and organizer_status<>'none')
    or exists(select 1 from auth.users where id=v.id and email_confirmed_at is not null)
    then return jsonb_build_object('code','not_eligible'); end if;
  if (v.state='sending' and v.last_attempt_at > now()-interval '5 minutes')
    or v.last_attempt_at > now()-interval '60 seconds' then return jsonb_build_object('code','retry_later'); end if;
  update public.organizer_invitations set state='sending',attempt_id=v_attempt,last_attempt_at=now(),
    acceptance_hash=null,acceptance_attempt=null where id=v.id;
  perform private.log_audit('organizer.invitation_sending','organizer_invitations',v.id);
  return jsonb_build_object('code','ok','id',v.id,'email',v.email,'first_name',v.first_name,'last_name',v.last_name,'attempt_id',v_attempt,'created_at',v.created_at);
end; $$;

-- Only the isolated server client may bind the preallocated Auth ID and record SMTP acceptance.
create function public.finish_organizer_invitation(p_id uuid,p_attempt_id uuid,p_actor_id uuid,p_sent boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.organizer_invitations; v_user auth.users;
begin
  if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_id and is_admin)
    then return 'not_permitted'; end if;
  select * into v from public.organizer_invitations where id=p_id for update;
  if not found or v.state<>'sending' or v.attempt_id is distinct from p_attempt_id then return 'invalid_status'; end if;
  select * into v_user from auth.users where id=v.id;
  if p_sent and (not found or lower(v_user.email) is distinct from v.email or v_user.created_at < v.created_at
    or v_user.invited_at is null or v_user.email_confirmed_at is not null) then return 'identity_mismatch'; end if;
  update public.organizer_invitations set state=case when p_sent then 'pending' else 'failed' end,
    user_id=case when p_sent then v.id else user_id end,
    provider_accepted_at=case when p_sent then now() else provider_accepted_at end,
    expires_at=case when p_sent then now()+interval '1 hour' else expires_at end where id=v.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
    values(p_actor_id,case when p_sent then 'organizer.invitation_sent' else 'organizer.invitation_failed' end,'organizer_invitations',v.id);
  return 'ok';
end; $$;

create function public.promote_participant_to_organizer(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.profiles;
begin
  if not private.is_permanent_user() or not private.is_admin() then return 'not_permitted'; end if;
  select * into v from public.profiles where id=p_user_id for update;
  if not found then return 'not_found'; end if;
  if v.organizer_status='active' then return 'already_active'; end if;
  if v.organizer_status<>'none' then return 'inactive_organizer'; end if;
  if not v.is_complete or not exists(select 1 from auth.users where id=v.id and email_confirmed_at is not null and not is_anonymous)
    or exists(select 1 from public.organizer_invitations where id=v.id and state<>'accepted') then return 'not_eligible'; end if;
  update public.profiles set organizer_status='active',organizer_since=now(),organizer_status_reason='Admin promotion' where id=v.id;
  perform private.log_audit('organizer.promoted','profiles',v.id);
  return 'ok';
end; $$;

-- Called ONLY after Supabase verifies a type=invite token. The random proof remains HttpOnly.
create function public.begin_organizer_acceptance(p_user_id uuid,p_email text,p_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.organizer_invitations;
begin
  if coalesce(auth.role(),'')<>'service_role' then return 'not_permitted'; end if;
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then return 'invalid_input'; end if;
  select * into v from public.organizer_invitations where user_id=p_user_id for update;
  if not found or v.state<>'pending' or v.expires_at<=now() or v.email is distinct from lower(p_email)
    or not exists(select 1 from auth.users where id=p_user_id and lower(email)=v.email and email_confirmed_at is not null and invited_at is not null)
    then return 'invitation_invalid'; end if;
  update public.organizer_invitations set acceptance_hash=p_hash,acceptance_attempt=attempt_id,verified_at=now() where id=v.id;
  return 'ok';
end; $$;

create function public.check_organizer_acceptance(p_user_id uuid,p_hash text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then return 'not_permitted'; end if;
  if not exists(select 1 from public.organizer_invitations i join auth.users u on u.id=i.user_id
    join public.profiles p on p.id=i.user_id
    where i.user_id=p_user_id and i.state='pending' and i.expires_at>now() and i.acceptance_hash=p_hash
    and i.acceptance_attempt=i.attempt_id and lower(u.email)=i.email and u.email_confirmed_at is not null
    and u.invited_at is not null and not u.is_anonymous and p.organizer_status='none') then return 'invitation_invalid'; end if;
  return 'ok';
end; $$;

create function public.complete_organizer_acceptance(p_user_id uuid,p_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.organizer_invitations;
begin
  if coalesce(auth.role(),'')<>'service_role' then return 'not_permitted'; end if;
  select * into v from public.organizer_invitations where user_id=p_user_id for update;
  if not found then return 'invitation_invalid'; end if;
  perform 1 from auth.users where id=p_user_id for update;
  perform 1 from public.profiles where id=p_user_id for update;
  if public.check_organizer_acceptance(p_user_id,p_hash)<>'ok' then return 'invitation_invalid'; end if;
  if not exists(select 1 from auth.users where id=p_user_id and coalesce(encrypted_password,'')<>'') then return 'password_required'; end if;
  update public.profiles set organizer_status='active',organizer_since=now(),organizer_status_reason='Accepted Admin invitation' where id=p_user_id;
  update public.organizer_invitations set state='accepted',accepted_at=now(),acceptance_hash=null,acceptance_attempt=null where id=v.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(p_user_id,'organizer.invitation_accepted','organizer_invitations',v.id,jsonb_build_object('invited_by',v.invited_by));
  return 'ok';
end; $$;

revoke all on function public.reserve_organizer_invitation(text,text,text),public.acquire_organizer_invitation(uuid),
  public.promote_participant_to_organizer(uuid) from public,anon;
grant execute on function public.reserve_organizer_invitation(text,text,text),public.acquire_organizer_invitation(uuid),
  public.promote_participant_to_organizer(uuid) to authenticated;
revoke all on function public.finish_organizer_invitation(uuid,uuid,uuid,boolean),
  public.begin_organizer_acceptance(uuid,text,text),public.check_organizer_acceptance(uuid,text),
  public.complete_organizer_acceptance(uuid,text) from public,anon,authenticated;
grant execute on function public.finish_organizer_invitation(uuid,uuid,uuid,boolean),
  public.begin_organizer_acceptance(uuid,text,text),public.check_organizer_acceptance(uuid,text),
  public.complete_organizer_acceptance(uuid,text) to service_role;

-- Preserve every existing event validation and ownership/state guard, removing only
-- the student-completion prerequisite from this active-Organizer-only operation.
create or replace function public.save_event(p_id uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event public.events; v_id uuid; v_capacity integer;
begin
  if not (select private.is_permanent_user()) or not (select private.is_active_organizer()) then return jsonb_build_object('code','not_permitted'); end if;
  -- Authorized Organizers do not need a student profile; Participant operations still do.
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

