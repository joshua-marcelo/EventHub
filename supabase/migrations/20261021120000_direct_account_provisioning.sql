-- EventHub · Direct account provisioning and Admin-issued temporary passwords.
--
-- PENDING APPROVAL — not applied. Apply with the Supabase CLI (`supabase db push --linked`) so the
-- migration version matches this filename.
--
-- Replaces email invitations for new accounts: an Admin reserves an account, the server creates the
-- Auth user through the Admin API with a generated temporary password (email already confirmed), and
-- the existing on_auth_user_created trigger provisions the profile and role in the SAME transaction
-- as the Auth insert. A failed provisioning step therefore never leaves a half-created account.
--
--   * Roles stay where they were: profiles.is_admin and profiles.organizer_status. No new role system.
--   * The reservation id becomes the Auth user id. Public sign-up cannot choose its id, so only the
--     server-side Admin API can claim a reservation; user-controlled metadata is never read for roles.
--   * profiles.must_change_password is outside the column-level UPDATE grant: clients cannot clear it.
--     It is cleared only by an actual password change (trigger on auth.users.encrypted_password), and
--     set again by an Admin-requested reset.
--   * Plaintext passwords never reach the database or the audit log; Supabase Auth stores the hash.
--   * Existing accounts, organizer invitations and their functions are not modified.

-- 1. First-login password-change flag -----------------------------------------------------------
alter table public.profiles add column must_change_password boolean not null default false;
comment on column public.profiles.must_change_password is
  'True for Admin-created or Admin-reset accounts until the user sets their own password. Never writable by clients.';

-- 2. Account reservations --------------------------------------------------------------------------
create table public.account_provisions (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  role text not null check (role in ('organizer', 'participant')),
  created_by uuid not null references public.profiles (id),
  state text not null default 'reserved' check (state in ('reserved', 'created')),
  reserved_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state = 'created') = (completed_at is not null))
);
create index account_provisions_created_by_idx on public.account_provisions (created_by, reserved_at desc);
alter table public.account_provisions enable row level security;
revoke all on public.account_provisions from public, anon, authenticated;
grant select on public.account_provisions to authenticated;
grant all on public.account_provisions to service_role;
create policy "Account provisions: permanent admins read" on public.account_provisions for select to authenticated
  using ((select private.is_permanent_user()) and (select private.is_admin()));

-- Pending Admin-requested password resets, consumed by the password-change trigger below.
create table private.password_resets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  requested_at timestamptz not null default now()
);
revoke all on private.password_resets from public, anon, authenticated;
-- authenticated has USAGE on the private schema; RLS with no policies is a second barrier (only the
-- SECURITY DEFINER owner functions below touch this table).
alter table private.password_resets enable row level security;

-- 3. Reserve an account (Admin only). Returns the id the server must give the new Auth user. -------
create function public.reserve_account(p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(p_email)); v public.account_provisions; v_id uuid;
begin
  if not private.is_permanent_user() or not private.is_admin() then return jsonb_build_object('code', 'not_permitted'); end if;
  if p_role is null or p_role not in ('organizer', 'participant') or v_email is null
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email) > 254
    then return jsonb_build_object('code', 'invalid_input'); end if;
  if exists (select 1 from auth.users where lower(email) = v_email)
    or exists (select 1 from public.profiles where lower(email) = v_email)
    then return jsonb_build_object('code', 'existing_account'); end if;
  if exists (select 1 from public.organizer_invitations where email = v_email and state <> 'accepted')
    then return jsonb_build_object('code', 'pending_invitation'); end if;
  -- Rate limit per Admin: at most 20 reservations in 10 minutes.
  if (select count(*) from public.account_provisions where created_by = auth.uid() and reserved_at > now() - interval '10 minutes') >= 20
    then return jsonb_build_object('code', 'retry_later'); end if;

  select * into v from public.account_provisions where email = v_email for update;
  -- Another Admin is creating this account right now: do not take over their reservation.
  if found and v.state = 'reserved' and v.created_by <> auth.uid() and v.reserved_at > now() - interval '2 minutes'
    then return jsonb_build_object('code', 'retry_later'); end if;
  if found then
    -- Retry of an unfinished reservation (or one whose Auth user no longer exists): reuse the row,
    -- with a fresh id when the old one was already consumed, so no duplicate account is possible.
    update public.account_provisions
      set id = case when v.state = 'created' then extensions.gen_random_uuid() else v.id end,
          role = p_role, created_by = auth.uid(), state = 'reserved', reserved_at = now(), completed_at = null
      where email = v_email returning id into v_id;
  else
    insert into public.account_provisions (email, role, created_by) values (v_email, p_role, auth.uid()) returning id into v_id;
  end if;
  perform private.log_audit('account.provision_reserved', 'account_provisions', v_id, jsonb_build_object('role', p_role));
  return jsonb_build_object('code', 'ok', 'id', v_id);
exception when unique_violation then return jsonb_build_object('code', 'retry_later');
end; $$;

-- 4. Profile creation now also completes a matching reservation, atomically with the Auth insert. --
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v public.account_provisions;
begin
  if new.is_anonymous then
    return new;
  end if;

  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    nullif(left(btrim(new.raw_user_meta_data ->> 'first_name'), 80), ''),
    nullif(left(btrim(new.raw_user_meta_data ->> 'last_name'), 80), '')
  );

  -- Only the Admin API can create a user with a reserved id; the email must match and the reserving
  -- account must still be an Admin. Anything else is an ordinary self-registered Participant.
  select * into v from public.account_provisions
    where id = new.id and state = 'reserved' and email = lower(new.email) and reserved_at > now() - interval '15 minutes'
    for update;
  if found and exists (select 1 from public.profiles where id = v.created_by and is_admin) then
    update public.profiles set
      must_change_password = true,
      organizer_status = case when v.role = 'organizer' then 'active'::public.organizer_status else organizer_status end,
      organizer_since = case when v.role = 'organizer' then now() else organizer_since end,
      organizer_status_reason = case when v.role = 'organizer' then 'Created by Admin' else organizer_status_reason end
      where id = new.id;
    update public.account_provisions set state = 'created', completed_at = now() where id = v.id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      values (v.created_by, 'account.created', 'profiles', new.id, jsonb_build_object('role', v.role));
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- 5. Admin-issued password reset (no email recovery in the MVP) ------------------------------------
create function public.request_password_reset(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.profiles;
begin
  if not private.is_permanent_user() or not private.is_admin() then return jsonb_build_object('code', 'not_permitted'); end if;
  if p_user_id = auth.uid() then return jsonb_build_object('code', 'self_reset'); end if;
  select * into v from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('code', 'not_found'); end if;
  -- Administrator accounts are not managed here, which prevents Admin-to-Admin takeover.
  if v.is_admin then return jsonb_build_object('code', 'not_permitted'); end if;
  if not exists (select 1 from auth.users where id = p_user_id and not is_anonymous) then return jsonb_build_object('code', 'not_found'); end if;
  if exists (select 1 from private.password_resets where user_id = p_user_id and requested_at > now() - interval '60 seconds')
    then return jsonb_build_object('code', 'retry_later'); end if;
  insert into private.password_resets (user_id, requested_by) values (p_user_id, auth.uid())
    on conflict (user_id) do update set requested_by = excluded.requested_by, requested_at = now();
  perform private.log_audit('account.password_reset_requested', 'profiles', p_user_id);
  return jsonb_build_object('code', 'ok', 'email', v.email);
end; $$;

-- Withdraw a reset whose Admin API password update failed, so it cannot flag a later self-change.
create function public.cancel_password_reset(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_permanent_user() or not private.is_admin() then return 'not_permitted'; end if;
  delete from private.password_resets where user_id = p_user_id and requested_by = auth.uid();
  return 'ok';
end; $$;

-- 6. Password changes keep the flag honest -----------------------------------------------------------
-- An Admin reset (pending row, at most 5 minutes old) sets the flag; any other password change by the
-- account itself clears it. The flag is therefore cleared only when the password really changed.
create function private.handle_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v private.password_resets;
begin
  delete from private.password_resets where user_id = new.id returning * into v;
  if v.user_id is not null and v.requested_at > now() - interval '5 minutes' then
    update public.profiles set must_change_password = true where id = new.id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id)
      values (v.requested_by, 'account.password_reset', 'profiles', new.id);
  else
    update public.profiles set must_change_password = false where id = new.id and must_change_password;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function private.handle_password_change();

revoke all on function private.handle_password_change() from public, anon, authenticated;

-- 7. Organizer capability is Organizer membership only ----------------------------------------------
-- Administrators are not automatically Organizers. Restates the rule explicitly (the retired, never-applied
-- 20261018120000_admin_organizer_workspace draft made admins organizers); a no-op change on the remote today.
create or replace function private.has_organizer_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.organizer_status = 'active' from public.profiles p where p.id = p_user_id), false);
$$;
revoke all on function private.has_organizer_access(uuid) from public, anon, authenticated;

create or replace function private.is_active_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_organizer_access((select auth.uid()));
$$;
revoke all on function public.reserve_account(text, text), public.request_password_reset(uuid),
  public.cancel_password_reset(uuid) from public, anon;
grant execute on function public.reserve_account(text, text), public.request_password_reset(uuid),
  public.cancel_password_reset(uuid) to authenticated;
