-- EventHub · Phase 1 · Profiles RLS (SYSTEM_SPEC §13.2).
-- Organizer visibility of registrants (`can_view_profile`) is added in Phase 6,
-- once registrations exist.

create policy "Profiles: users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Profiles: admins read all profiles"
  on public.profiles for select
  to authenticated
  using ((select private.is_admin()));

create policy "Profiles: users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
