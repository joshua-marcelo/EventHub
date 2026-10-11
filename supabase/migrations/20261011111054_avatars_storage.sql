-- EventHub · Phase 2 · Avatars bucket (SYSTEM_SPEC §14, PLAN Phase 2 step 10).
-- Private bucket; files live in the owner's folder: `{user_id}/{uuid}.{ext}`.
-- Replacing a photo = upload a new file, update profiles.avatar_path, delete the old file,
-- so no UPDATE policy is needed. Organizer read access is added in Phase 6 (can_view_profile).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Avatars: owners upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_permanent_user())
  );

create policy "Avatars: owners and admins read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

create policy "Avatars: owners delete their own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
