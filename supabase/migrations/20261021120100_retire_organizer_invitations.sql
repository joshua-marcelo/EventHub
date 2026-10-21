-- EventHub · Retire new Organizer email invitations.
--
-- PENDING APPROVAL — not applied. Apply with the Supabase CLI after 20261021120000.
--
-- Admins now create Organizer accounts directly (reserve_account). This stops NEW invitations only:
--   * organizer_invitations, its rows, RLS and audit history are kept unchanged.
--   * The acceptance functions are kept, so an invitation already sent can still be completed.
--   * Signatures are preserved so stale clients receive a stable 'workflow_retired' result.
create or replace function public.reserve_organizer_invitation(p_email text, p_first_name text, p_last_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object('code', 'workflow_retired');
end; $$;

create or replace function public.acquire_organizer_invitation(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object('code', 'workflow_retired');
end; $$;
