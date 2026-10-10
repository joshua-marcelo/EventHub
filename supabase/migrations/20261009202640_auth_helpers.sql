-- EventHub · Phase 1 · Authorization helpers (SYSTEM_SPEC §12.5, §13.1).
-- SECURITY DEFINER so they can read `profiles` without recursive RLS evaluation.
-- Policies call them as `(select private.fn())` so they run once per statement.

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function private.is_active_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.organizer_status = 'active' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_active_organizer() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_organizer() to authenticated;

-- Display name, e.g. "Juan P. Dela Cruz, Jr.". Exposed to PostgREST as a computed
-- field (`select=*,profile_full_name`) because it takes the table row type.
create function public.profile_full_name(p public.profiles)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    concat_ws(
      ', ',
      nullif(concat_ws(
        ' ',
        p.first_name,
        case when p.middle_name is not null then left(p.middle_name, 1) || '.' end,
        p.last_name
      ), ''),
      p.suffix
    ),
    ''
  );
$$;

revoke all on function public.profile_full_name(public.profiles) from public, anon;
grant execute on function public.profile_full_name(public.profiles) to authenticated;
