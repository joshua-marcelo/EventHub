-- EventHub · Phase 1b · Revision 2 corrections (SYSTEM_SPEC §12.6, PLAN Phase 1b, DECISIONS D-009 – D-016).
-- Corrects Phase 1 objects in place. Applied while every table was empty (no real users).
-- Earlier migrations are not edited.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
-- `attendance_status` was created in Phase 1 with the Revision 1 values and is used by no
-- table or function yet. Recreate it with the Revision 2 values (D-012).
drop type public.attendance_status;
create type public.attendance_status as enum ('present', 'revoked');

create type public.attendance_session_kind as enum ('time_in', 'time_out');
create type public.attendance_policy as enum ('time_in_only', 'time_in_and_out');
create type public.attendance_flag as enum ('shared_device');
create type public.flag_resolution as enum ('cleared', 'revoked');
create type public.registration_channel as enum ('online', 'onsite');

-- ---------------------------------------------------------------------------
-- 2. Anonymous-user guard (D-013)
-- ---------------------------------------------------------------------------
-- Station devices sign in anonymously and share the `authenticated` role. This helper is
-- true only for a signed-in, non-anonymous user. It reads the JWT only, so it does not
-- need SECURITY DEFINER.
create function private.is_permanent_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false;
$$;

revoke all on function private.is_permanent_user() from public, anon;
grant execute on function private.is_permanent_user() to authenticated;

-- Anonymous auth users (station devices) never get a profile row.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Restrictive policies: whatever permissive policies exist (now or later), anonymous
-- station users can never read or write these tables.
create policy "Profiles: permanent users only"
  on public.profiles as restrictive for all
  to authenticated
  using ((select private.is_permanent_user()))
  with check ((select private.is_permanent_user()));

create policy "Audit logs: permanent users only"
  on public.audit_logs as restrictive for select
  to authenticated
  using ((select private.is_permanent_user()));

-- ---------------------------------------------------------------------------
-- 3. Programs lookup (D-011)
-- ---------------------------------------------------------------------------
create table public.programs (
  id smallint generated always as identity primary key,
  college_id smallint not null references public.colleges (id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programs_college_name_key unique (college_id, name),
  -- Target of the composite FK on profiles, which keeps a profile's program inside its college.
  constraint programs_college_id_id_key unique (college_id, id),
  constraint programs_name_length check (char_length(name) between 2 and 120)
);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function private.set_updated_at();

alter table public.programs enable row level security;

revoke all on table public.programs from anon, authenticated;
grant select on table public.programs to anon, authenticated;

create policy "Lookup: programs are readable by everyone"
  on public.programs for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 4. Admin-managed lookups: add and update, never delete (D-011, P-09)
-- ---------------------------------------------------------------------------
grant insert (code, name, is_active), update (code, name, is_active)
  on table public.colleges to authenticated;
-- A program never moves to another college (profiles reference (college_id, program_id)).
grant insert (college_id, name, is_active), update (name, is_active)
  on table public.programs to authenticated;
grant insert (slug, name, sort_order, is_active), update (slug, name, sort_order, is_active)
  on table public.event_categories to authenticated;

create policy "Lookup: admins add colleges"
  on public.colleges for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Lookup: admins update colleges"
  on public.colleges for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Lookup: admins add programs"
  on public.programs for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Lookup: admins update programs"
  on public.programs for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Lookup: admins add event categories"
  on public.event_categories for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "Lookup: admins update event categories"
  on public.event_categories for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 5. Profiles: program lookup, privacy consent, identity flag (D-011, D-015)
-- ---------------------------------------------------------------------------
-- The generated column depends on `program`, so it is dropped first and recreated below.
alter table public.profiles drop column is_complete;
alter table public.profiles drop constraint profiles_program_length;
alter table public.profiles drop column program;

alter table public.profiles
  add column program_id smallint,
  add column privacy_consented_at timestamptz,
  add column privacy_notice_version text,
  add column identity_flagged_at timestamptz,
  add column identity_flag_reason text;

alter table public.profiles
  add constraint profiles_program_fk foreign key (college_id, program_id)
    references public.programs (college_id, id),
  -- With MATCH SIMPLE a NULL college would skip the FK check, so require it explicitly.
  add constraint profiles_program_requires_college check (program_id is null or college_id is not null),
  add constraint profiles_privacy_consent_pair check ((privacy_consented_at is null) = (privacy_notice_version is null)),
  add constraint profiles_privacy_notice_version_length check (privacy_notice_version is null or char_length(privacy_notice_version) between 1 and 20),
  add constraint profiles_identity_flag_pair check ((identity_flagged_at is null) = (identity_flag_reason is null)),
  add constraint profiles_identity_flag_reason_length check (identity_flag_reason is null or char_length(identity_flag_reason) between 3 and 500);

alter table public.profiles
  add column is_complete boolean generated always as (
    first_name is not null
    and last_name is not null
    and student_id is not null
    and college_id is not null
    and program_id is not null
    and year_level is not null
    and avatar_path is not null
    and privacy_consented_at is not null
  ) stored;

-- The composite index covers both the composite FK and the college FK (leading column).
create index profiles_college_program_idx on public.profiles (college_id, program_id);
drop index public.profiles_college_id_idx;

comment on column public.profiles.privacy_consented_at is 'Set only by accept_privacy_notice(). Never writable by clients.';
comment on column public.profiles.identity_flagged_at is 'Set only by admin dispute RPCs (Phase 4). Never writable by clients.';

-- Dropping `program` removed its column grant; `program_id` replaces it. Consent and
-- identity-flag columns are not client-writable.
grant update (program_id) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Privacy consent RPC (P-06)
-- ---------------------------------------------------------------------------
create function public.accept_privacy_notice(p_version text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := btrim(p_version);
begin
  if not (select private.is_permanent_user()) then
    return 'not_permitted';
  end if;

  if v_version is null or char_length(v_version) not between 1 and 20 then
    return 'invalid_version';
  end if;

  update public.profiles
     set privacy_consented_at = now(),
         privacy_notice_version = v_version
   where id = (select auth.uid());

  if not found then
    return 'profile_not_found';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.accept_privacy_notice(text) from public, anon;
grant execute on function public.accept_privacy_notice(text) to authenticated;
