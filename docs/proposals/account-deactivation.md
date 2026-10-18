# Proposal: Admin account deactivation (instead of hard delete)

Status: **draft — requires approval. Nothing here has been applied.** The SQL below is deliberately
kept out of `supabase/migrations/` so `supabase db push` cannot pick it up.

## 1. Can an Admin safely hard-delete an account today?

No. Findings from the current migrations (as of 2026-10-18):

| Data | Relationship to the user | On `auth.users` delete |
| --- | --- | --- |
| `profiles` | `id → auth.users(id) on delete cascade` | Profile row deleted |
| `events` | `organizer_id`, `cancelled_by → profiles` (no action) | **Blocks deletion** for any organizer with events or admin who cancelled one |
| `event_registrations` | `user_id`, `decided_by → profiles` (no action) | **Blocks deletion** for any participant who ever registered |
| `attendance_sessions` | `opened_by`, `closed_by` (no action) | **Blocks deletion** |
| `attendance_records`, `attendance_device_signals` | `user_id`, `flag_resolved_by`, `revoked_by` (no action) | **Blocks deletion** |
| `certificates` | `user_id`, `issued_by`, `revoked_by` (no action); certificates are publicly verifiable at `/verify/[code]` | **Blocks deletion**; deleting would break issued certificate verification |
| `organizer_applications` (retired) | `applicant_id`, `reviewed_by` (no action) | **Blocks deletion** |
| `organizer_invitations` | `invited_by`, `user_id` (no action) | **Blocks deletion** |
| `audit_logs` | `actor_id … on delete set null`; `entity_id` has no FK | Actor becomes anonymous; entries about the user point at a missing id |
| Storage `avatars`, `organizer-requirements` | Objects under `{user_id}/…`, no FK | **Orphaned files** (personal data left behind) |
| Storage `event-banners` | Under `{event_id}/…` | Kept with the event |

Consequences:

- For almost every real account, `auth.admin.deleteUser` fails with a foreign-key error, so a Delete
  button would mostly just error.
- Where it succeeds (an account with no activity), it leaves orphaned storage objects and audit
  entries, and is irreversible.
- Changing the FKs to `cascade` would silently destroy event history, attendance and issued
  certificates belonging to *other* people's events. That is not acceptable.
- Organizer **Revoke Access** is not account deletion: it only sets `profiles.organizer_status = 'revoked'`.

There is also no participant-level suspend/deactivate state today, so the Participants table offers
only View details (plus organizer actions for users who hold organizer access).

## 2. Recommended alternative: deactivation, then (optionally) anonymization

**Phase A — Deactivate account (reversible).**

- Add `profiles.account_status` (`active` | `deactivated`), `account_status_reason`, `deactivated_at`, `deactivated_by`.
- Add an RPC `set_account_status(p_user_id, p_status, p_reason)`, `security definer`, admin-only.
  - Refuses the caller's own account (`p_user_id = auth.uid()`).
  - Refuses the last remaining active admin.
  - Requires a reason, takes a row lock, and writes `private.log_audit('account.status_changed', …)`.
- Enforce it in three places:
  - `private.is_permanent_user()` (and therefore RLS) returns false for deactivated accounts.
  - The server action also bans the Auth user with the service-role client: `auth.admin.updateUserById(id, { ban_duration: '876000h' })` to deactivate, `'none'` to reactivate. Existing sessions stop refreshing.
  - `getCurrentUser()` treats a deactivated profile as signed out.
- Records (events, registrations, attendance, certificates) are kept and stay valid.

**Phase B — Anonymize (irreversible; separate approval).**

For data-subject erasure requests only, and only for already-deactivated accounts:

- Clear the profile's personal fields and set the email to `deleted+{id}@invalid`.
- Delete the avatar and requirement storage objects.
- Keep the row ids so foreign keys and certificates remain intact.
- Log the anonymization.
- The UI requires typing the account's email address, not `CONFIRM`.

## 3. Draft migration (do not apply without review)

```sql
-- EventHub · Account deactivation (DRAFT — not applied)
create type public.account_status as enum ('active', 'deactivated');

alter table public.profiles
  add column account_status public.account_status not null default 'active',
  add column account_status_reason text check (account_status_reason is null or char_length(account_status_reason) <= 1000),
  add column deactivated_at timestamptz,
  add column deactivated_by uuid references public.profiles (id);

create function public.set_account_status(p_user_id uuid, p_status text, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_current public.account_status; v_is_admin boolean;
begin
  if not (select private.is_permanent_user()) or not (select private.is_admin()) then return 'not_permitted'; end if;
  if p_user_id = (select auth.uid()) then return 'not_permitted'; end if;
  if p_status is null or p_status not in ('active', 'deactivated') then return 'invalid_input'; end if;
  if nullif(btrim(p_reason), '') is null or char_length(p_reason) > 1000 then return 'reason_required'; end if;
  select account_status, is_admin into v_current, v_is_admin from public.profiles where id = p_user_id for update;
  if not found then return 'not_found'; end if;
  if v_current::text = p_status then return 'invalid_status'; end if;
  if p_status = 'deactivated' and v_is_admin and (select count(*) from public.profiles where is_admin and account_status = 'active') <= 1 then return 'last_admin'; end if;
  update public.profiles set
    account_status = p_status::public.account_status,
    account_status_reason = btrim(p_reason),
    deactivated_at = case when p_status = 'deactivated' then now() end,
    deactivated_by = case when p_status = 'deactivated' then (select auth.uid()) end
  where id = p_user_id;
  perform private.log_audit('account.status_changed', 'profiles', p_user_id, jsonb_build_object('before', v_current, 'after', p_status, 'reason', p_reason));
  return 'ok';
end; $$;
revoke all on function public.set_account_status(uuid, text, text) from public, anon;
grant execute on function public.set_account_status(uuid, text, text) to authenticated;

-- Then redefine private.is_permanent_user() to also require
--   exists (select 1 from public.profiles where id = auth.uid() and account_status = 'active')
-- after reviewing every policy and RPC that relies on it, and add pgTAP coverage in
-- supabase/tests/database/ for: admin-only, self refusal, last-admin refusal, audit entry,
-- RLS denial for a deactivated user, and records preserved.
```

## 4. App work after approval

- Add `lib/admin/account-actions.ts` (`setAccountStatus`): it calls `requireAdmin`, the RPC, then the Auth ban/unban through the service-role client.
- Add "Deactivate account" / "Reactivate account" to `UserRowActions` and the user details page, behind the existing `ConfirmActionDialog`.
  - Deactivate is destructive and goes in the bottom group.
  - Use the account email as the typed phrase for anonymization.
