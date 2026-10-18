# Organizer management implementation proposal

Status: historical proposal, superseded by the approved local implementation.
See [current implementation and setup](./ORGANIZER_MANAGEMENT_IMPLEMENTATION.md).
Invited Organizers do NOT require Student Onboarding; applications are fully retired
rather than finishing existing pending reviews. Decisions below are proposal history,
not the current policy.
No live database, Auth configuration, accounts, privileges, or email delivery changed.

## Existing architecture

- `profiles.organizer_status` is the authorization source of truth: `none`, `active`,
  `suspended`, `revoked`. It is not writable through participant profile updates.
- `private.is_admin()`, `private.is_permanent_user()`, and
  `private.is_active_organizer()` enforce database authorization. Privileged event,
  registration-management, attendance, and certificate mutations check active status.
- `requireOrganizer()` also requires a complete participant profile. Inactive organizers
  may view their workspace with a read-only banner; existing mutation checks remain.
- Applications are submitted through `submit_organizer_application`, reviewed through
  `review_organizer_application`, and retained with private supporting documents.
  Approval currently activates the applicant. The existing status-change RPC cannot
  promote a `none` account, and only reinstates `suspended` accounts explicitly.
- The Admin participant directory already searches `profiles` by name, email, and
  student ID. The Organizers table can select email from the same source.
- Server session utilities, role-aware navigation, audit logging, dialog/form components,
  password validation, and centered authentication cards can be reused.

## Decisions requiring approval before implementation

1. Close new self-applications in both the UI and database; remove the requirements
   bucket's self-upload policy. Keep all application rows, documents, own-history reads,
   and withdrawal support. Proposed handling of existing pending applications: allow
   Admin review to finish, but reject approval if the account is already active,
   suspended, or revoked. Keep the Applications module for this backlog and history;
   later rename it Application History when the backlog is resolved.
2. Preserve the current complete-profile requirement. An invited account sets its own
   password and activates its authorized Organizer grant, then completes the existing
   onboarding with `next=/organizer` before workspace access. This requires student ID,
   college, program, year level, avatar, and privacy consent, in addition to names.
   If staff/non-student organizers must enter the workspace immediately after password
   setup, approve that alternative explicitly: it changes the existing onboarding/access
   policy and needs a separate review of organizer operations. Do not fake student data
   or mark incomplete profiles complete.
3. Introduce a server-only Supabase Admin client for invitations. `.env.example` and
   deployment documentation currently explicitly say the app needs no privileged key.
   This assumption must be updated to document one narrowly used, non-public server
   credential. Participant promotion continues through caller-authorized database RPCs.

## Proposed local implementation

1. Update the existing Organizers page with the requested description, navy Add Organizer
   button, email, View Details, existing status actions, and existing filters.
2. Add a compact dialog with Invite New Organizer and Promote Participant modes. Reuse
   the participant directory query pattern and existing validation/form components.
   Only `none` accounts qualify for promotion; show other statuses without offering a
   hidden reinstatement path. Preserve the explicit Suspend/Reinstate/Revoke workflows.
3. Prepare a versioned migration adding `organizer_invitations` as workflow bookkeeping,
   never a second role system. Include normalized email, invited Auth user ID, inviter,
   timestamps/expiry, state, and provider-accepted timestamp. Add foreign keys, state
   constraints, expiry indexes, and a partial unique index preventing concurrent live
   invitations to one email. Persist no passwords, raw links, or bearer tokens.
4. Add caller-authorized, audited promotion and invitation reservation RPCs with row
   locking. Add restricted server finalization and acceptance operations. Invitation
   state is admin-readable through RLS; clients cannot insert/update grants or states
   directly. Each privileged entry verifies the current permanent Admin; the server
   credential never substitutes for that check.
5. Before sending, check for an existing Auth identity as well as its profile. Existing
   accounts are directed to promotion. Reserve the email before the external request,
   call Supabase `auth.admin.inviteUserByEmail`, and bind the returned identity securely.
   Duplicate/concurrent requests and a signup racing an invitation must fail closed:
   do not adopt an unrelated existing identity as an invitation recipient.
6. Use Supabase Auth's existing SMTP integration and a branded invite template with the
   requested subject. Record provider acceptance only after the Auth invitation request
   succeeds; do not call that inbox delivery. Auth/email and Postgres are separate
   transactions: persist failure/reconciliation states and never grant access on partial
   failure. Retry/resend must target only the original eligible unaccepted invite and
   use a supported Supabase mechanism; do not fall back to sending passwords or creating
   another user. Show Pending Invitations and Resend only after real persisted support.
7. Add an invitation setup route using the existing auth card and password controls.
   Verify Supabase `type=invite` credentials on submission, bind the verified user ID and
   email to the unexpired persisted invitation, and update the password before final
   activation. An ambient session alone is not invitation proof. Define a protected
   retry step for password rejection after verification. Atomically consume the invite,
   update `profiles.organizer_status`/`organizer_since`, and audit once; duplicate or
   invalid activation cannot grant access. Preserve participant identity and history.
8. Keep the existing recovery flow separate in purpose while reusing its credential
   hygiene: no token logging, no verification on scanner GET, remove credentials from
   browser history, same-origin redirects, safe invalid/expired-link errors.
9. Prepare focused unit/action tests and isolated SQL tests, then run TypeScript,
   ESLint, the relevant suite, and a production build. Cover unauthorized calls, email
   conflicts, races, duplicate requests, email failures, expiration, mismatched identity,
   password failure/retry, one-time activation, status transitions, and closed submission
   paths. Browser-check the dialog and keyboard/mobile behavior if a browser is available.
   No live accounts, privilege changes, or invitation emails are needed for these tests.

## Dependencies and configuration findings

- Local Supabase configuration has email confirmation enabled, a 3600-second OTP expiry,
  localhost development redirect allowlists, confirmation/recovery templates, and no
  enabled custom invite template. Its SMTP block is commented example configuration.
- No application-level Brevo integration was found. Brevo might be configured as hosted
  Supabase SMTP; hosted SMTP, templates, URL allowlists, and effective schema have not
  been inspected or verified. Local files do not establish hosted configuration.
- Current `/auth/confirm` deliberately rejects `invite`; recovery parsing accepts
  `recovery`. An invite-specific acceptance route and public-route classification are
  needed rather than treating an invitation as ordinary signup/recovery.
- Certificates already fall back to `EventHub Organizer` when there is no approved
  application organization. Invitations/promotions must not manufacture applications
  just to fill that field; certificate generation remains unchanged.
- Existing SQL tests assert that complete participants can apply. Update those policy
  assertions when preparing the new migration, without deleting historical test coverage.

## Live approval boundary and verification

Local implementation approval is separate from permission to operate the hosted system.
Before any hosted change, present the exact migration, affected grants/policies,
configuration changes, verification queries, and recovery instructions for approval.
Do not run database pushes, linked database tests, invitation requests, account creation,
or privilege changes without that explicit approval. No deployment or Git write actions.

After an approved migration, read-only verification should check table constraints,
indexes, RLS, RPC execute grants, closed application/upload paths, and unchanged existing
user IDs/statuses. Inspect hosted SMTP and redirect configuration without exposing secrets.
Any real inbox/end-to-end test requires separate approval and named test identities.

Rollback planning: disable new invitation/promotion entry points first, preserve invitation
and audit history, and restore prior application function/policy definitions only with
explicit policy approval. Do not drop accounts or automatically revoke/reinstate users
whose grants were legitimately accepted. Correct individual grants through audited Admin
operations. Provide exact rollback SQL alongside the final migration before live approval.

## Supabase references

- [Admin invitation API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
- [Invite templates and token-hash verification](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Existing SMTP integration](https://supabase.com/docs/guides/auth/auth-smtp)
