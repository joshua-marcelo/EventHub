-- EventHub · Phase 1 · Profiles (SYSTEM_SPEC §2.1, §12.2).
-- One row per auth user. Role flags (`is_admin`, `organizer_status`) are NOT
-- user-writable: only explicitly granted columns can be updated by `authenticated`.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text,
  middle_name text,
  last_name text,
  suffix text,
  student_id text,
  college_id smallint references public.colleges (id),
  program text,
  year_level smallint,
  avatar_path text,
  is_complete boolean generated always as (
    first_name is not null
    and last_name is not null
    and student_id is not null
    and college_id is not null
    and program is not null
    and year_level is not null
    and avatar_path is not null
  ) stored,
  is_admin boolean not null default false,
  organizer_status public.organizer_status not null default 'none',
  organizer_since timestamptz,
  organizer_status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_student_id_key unique (student_id),
  constraint profiles_first_name_length check (first_name is null or char_length(first_name) between 1 and 80),
  constraint profiles_middle_name_length check (middle_name is null or char_length(middle_name) between 1 and 80),
  constraint profiles_last_name_length check (last_name is null or char_length(last_name) between 1 and 80),
  constraint profiles_suffix_length check (suffix is null or char_length(suffix) between 1 and 10),
  -- Provisional pattern until the official format is confirmed (SYSTEM_SPEC §20 C2).
  constraint profiles_student_id_format check (student_id is null or student_id ~ '^[A-Za-z0-9-]{4,20}$'),
  constraint profiles_program_length check (program is null or char_length(program) between 2 and 120),
  constraint profiles_year_level_range check (year_level is null or year_level between 1 and 6),
  -- Avatars must live in the owner's own storage folder.
  constraint profiles_avatar_path_owner check (avatar_path is null or avatar_path like (id::text || '/%')),
  constraint profiles_organizer_since_required check (organizer_status = 'none' or organizer_since is not null)
);

comment on column public.profiles.is_admin is 'Set manually via SQL by the system maintainer. Never writable by clients.';
comment on column public.profiles.organizer_status is 'Changed only by admin RPCs (Phase 4). Never writable by clients.';

create index profiles_college_id_idx on public.profiles (college_id);
create index profiles_email_idx on public.profiles (email);
create index profiles_organizer_status_idx on public.profiles (organizer_status)
  where organizer_status <> 'none';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Privileges: read via RLS; update only personal columns. Inserts happen only through
-- the auth trigger below. No deletes (cascade from auth.users only).
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (first_name, middle_name, last_name, suffix, student_id, college_id, program, year_level, avatar_path)
  on table public.profiles to authenticated;

alter table public.profiles enable row level security;

-- Create a profile for every new auth user. Every account starts as a Participant:
-- role flags are never read from user-controlled metadata.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep the copied email in sync when a user changes it through Supabase Auth.
create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.handle_user_email_change() from public, anon, authenticated;
