-- EventHub · Phase 1 · Consolidate profiles SELECT policies (performance advisor 0006).
-- Two permissive SELECT policies for `authenticated` were OR-ed by Postgres and both
-- evaluated per row. One policy with the same OR condition keeps behavior identical:
-- own row, or every row for admins. Organizer access is added in Phase 6.

drop policy "Profiles: users read their own profile" on public.profiles;
drop policy "Profiles: admins read all profiles" on public.profiles;

create policy "Profiles: users read their own profile; admins read all"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  );
