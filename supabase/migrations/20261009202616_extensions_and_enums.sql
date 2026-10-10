-- EventHub · Phase 1 · Extensions, schemas, enums, shared trigger function.
-- SYSTEM_SPEC §12.1. All enums are created up front so later migrations never alter types.

create extension if not exists pgcrypto with schema extensions;

-- Internal helpers live in `private`, which is NOT exposed through the Data API.
-- Functions there can be used by RLS policies but cannot be called as RPCs.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.organizer_status as enum ('none', 'active', 'suspended', 'revoked');
create type public.application_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.event_status as enum ('draft', 'published', 'completed', 'cancelled');
create type public.event_visibility as enum ('public', 'unlisted');
create type public.approval_mode as enum ('automatic', 'manual');
create type public.registration_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.attendance_session_status as enum ('open', 'closed');
create type public.attendance_status as enum ('pending', 'present', 'dismissed');
create type public.check_in_method as enum ('qr', 'manual');

-- Shared `updated_at` maintenance.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
