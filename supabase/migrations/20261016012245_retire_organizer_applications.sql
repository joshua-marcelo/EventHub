-- Retire the application workflow without changing any historical records or role grants.
-- Prepare locally only; apply to a hosted database only after explicit approval.
-- Preserve signatures so stale PostgREST clients fail safely with a stable result.
create or replace function public.submit_organizer_application(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object('code', 'workflow_retired');
end;
$$;

create or replace function public.withdraw_organizer_application(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  return 'workflow_retired';
end;
$$;

create or replace function public.review_organizer_application(p_id uuid, p_decision text, p_reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
begin
  return 'workflow_retired';
end;
$$;

-- Keep existing authenticated callers able to receive the retirement response.
-- No function grants access or writes applications, profiles, documents, or audit history.
revoke all on function public.submit_organizer_application(jsonb),
  public.withdraw_organizer_application(uuid),
  public.review_organizer_application(uuid,text,text) from public, anon;
grant execute on function public.submit_organizer_application(jsonb),
  public.withdraw_organizer_application(uuid),
  public.review_organizer_application(uuid,text,text) to authenticated;

-- Stop uploads for new applications; preserve the private bucket and own/admin read policy.
drop policy if exists "Requirements: own upload" on storage.objects;

-- Do not alter organizer_applications, its constraints/read RLS, existing status RPCs,
-- audit logs, or the historical organization lookups used by previews and certificates.
