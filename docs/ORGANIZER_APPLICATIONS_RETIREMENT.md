# Organizer Applications retirement

The finalized policy permits new Organizer access only through Admin invitations or
promotion of an existing Participant. The application workflow is retired locally.
The prepared database migration has not been executed.

## Local behavior

- Admin navigation has four modules: Overview, Organizers, Participants, Reference Data.
  Existing sidebar interactions, icons for those modules, and dashboard switching remain.
- Overview uses the existing real counts for active organizers, completed participant
  profiles, and published events, plus its existing recent-published-events list.
- `/become-organizer` is an authenticated, read-only access explanation and own-history
  page. Existing guard redirects still reach a useful page without offering an application.
- `/admin/applications` and `/admin/applications/[applicationId]` remain Admin-only
  read-only historical URLs. Pending records retain their status; View replaces Review.
  Original details and expiring private-document read links remain available.
- The application form/upload component is removed. `submitApplication`,
  `reviewApplication` (approval and rejection), and `withdrawApplication` reject all
  requests with `workflow_retired`, including malformed and stale client requests.
  They perform no database calls and cannot alter historical rows or grant a role.
- Existing Suspend, Reinstate, and Revoke actions remain in Organizers. They still
  require Admin authorization and call the same status-transition RPC. In particular,
  this RPC cannot promote a `none` account or reactivate a revoked organizer.

## Replacement workflow status

The approved local implementation now includes Add Organizer, invitation persistence
and acceptance, a server-only Admin client, and Participant promotion. Invited Organizers
do not require Student Onboarding. See the [current implementation report](./ORGANIZER_MANAGEMENT_IMPLEMENTATION.md)
for setup, security, validation, and the second unapplied migration. Hosted availability
still requires separately approved migrations and email configuration. Historical
application approval remains disabled and is not a substitute for the new workflows.

## Database change requiring approval

Prepared migration:
`supabase/migrations/20261016012245_retire_organizer_applications.sql`.

It replaces these function bodies with no-write `workflow_retired` responses while
preserving their signatures and authenticated execute access:

- `submit_organizer_application(jsonb)`
- `review_organizer_application(uuid,text,text)`
- `withdraw_organizer_application(uuid)`

It removes only the `Requirements: own upload` policy from `storage.objects`.
The private bucket, existing documents, own/Admin read policy, application constraints,
application table/read RLS, audit records, role flags, and status-change function remain.
No application or profile rows are inserted, updated, approved, rejected, or deleted.
Historical organization lookups used in event previews and certificate generation remain.

**Until this migration is approved and applied, direct calls to the hosted legacy
Supabase submission/review/withdrawal RPCs and proof uploads may still work.** Local
server-action rejection alone cannot disable a hosted Data API endpoint. No hosted
schema/configuration was verified or changed during this task.

Before applying, inspect the live function definitions and grants and the requirements
bucket's INSERT policies for drift. Save the original three function definitions and
upload policy definition for rollback. If other upload policies authorize the same
bucket, review them rather than assuming this migration closes those paths.

Capture counts grouped by application status, organizer status, relevant audit actions,
and requirements object counts before and after; these must remain unchanged. Verify
that application RLS and role-column grants remain unchanged and that all three RPCs
return retirement responses. Test direct submission/approval, anonymous callers, proof
uploads, status transitions, and historical reads only in an isolated database fixture.

`supabase/tests/database/005_mvp_registration.test.sql` has been updated for the new
policy, with preserved historical fixtures and independent rolled-back organizer fixtures
for existing event tests. It also checks direct write/upload denial, unchanged pending
history, and inability to promote through the existing status RPC. Do not use the
repository's linked database test script without approval: it executes SQL remotely.

Rollback, if explicitly authorized: restore only the three captured function definitions
and the captured upload policy through a new migration. Do not replay the original whole
MVP migration, drop tables/buckets, modify application statuses, or reverse existing role
grants. Reopening these endpoints changes the finalized policy and requires approval.

## Validation boundary

Local results: `npm.cmd run typecheck` passed; `npm.cmd run lint` passed;
`npm.cmd test` passed (131 tests across 16 files); `npm.cmd run build` passed after a
network-enabled retry fetched the existing Google Fonts. No font/auth styling changed.
`git diff --check` passed. Browser/mobile interaction and live end-to-end checks were
not performed. No isolated PostgreSQL runner was available, so SQL tests were not run.

Unit tests cover
retired action rejection without database access, unchanged Admin status authorization,
status-transition error propagation, four-module navigation, and existing role routing.
SQL integration coverage is prepared but must run in an approved isolated database.
No live account, privilege, email, deployment, or end-to-end changes are authorized here.

The historical `scripts/mvp-stage1-check.mjs` depends on the retired upload/submission/
approval flow and is no longer a valid current-policy integration runner. Do not run it
or its live fixture/cleanup scripts as part of this retirement. Earlier checkpoint
documents record historical validation, not verification of the new policy.

## Modified files

- `lib/navigation.ts` and `lib/navigation.test.ts`: four-module Admin navigation.
- `app/(app)/admin/page.tsx`: remove application queries, counters, list, and links.
- `app/(app)/admin/organizers/page.tsx`: remove obsolete approval-based descriptions.
- `app/(app)/become-organizer/page.tsx`: closed workflow with own-history reads.
- `app/(app)/admin/applications/page.tsx` and `[applicationId]/page.tsx`: read-only archive.
- `components/mvp/application-form.tsx`: removed application/upload UI.
- `lib/mvp/actions.ts` and `lib/mvp/application-retirement.test.ts`: reject retired actions,
  test no database access, and preserve status-management authorization.
- The versioned retirement migration and stage-1 SQL test file: prepare Data API closure
  and isolated policy/security checks without executing them.
- This report and `ORGANIZER_MANAGEMENT_PLAN.md`: current status and approval boundary.

Pre-existing landing-page changes from the earlier task were left untouched.
