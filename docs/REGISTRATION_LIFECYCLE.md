# Registration and attendance lifecycle

Implementation is local. Migration `20261022110000_registration_lifecycle.sql` requires user approval and has NOT been applied. No linked database tests, QA accounts/events, commits, pushes or deployments were performed.

## Read-only audit

MCP returned `https://ldhpbfujqnyovovabvcg.supabase.co`, and PostgreSQL reported `transaction_read_only = on`. Inspected event columns, constraints, triggers, registration/publish/save/cancel RPCs, invite lookup, attendance open/close/complete/scan/QR RPCs, public listing, policies, grants and migration history.

The existing registration dates are required on published events, opening precedes closing, and the deadline cannot exceed the event start. The simplified form defaults opening to save time and closing to event start; these remain bounds, with an additional explicit organizer permission. Capacity counts approved registrations; automatic/manual approval, cancellation rules and re-registration using the existing row remain unchanged. `save_event` accepts neither lifecycle state nor invite-code changes.

The old `register_for_event` accepted registrations during its date window and optionally on-site during time-in. Navigation links only opened management pages. There was no manual registration state to reuse. Events, registrations and sessions have RLS enabled, and authenticated clients have no direct lifecycle/registration/session write grants. Fixed, unique eight-character invite codes already work.

Both registration and attendance start lock the event row. The proposed RPCs retain that lock through their transaction, serialize open/close operations on it, and check deadlines using `clock_timestamp()` after acquiring it. Attendance start updates registration to closed and inserts the session in the same transaction. If registration owns the lock first, it can finish before attendance starts; if attendance owns it first, the waiting registration must fail. Session history prevents reopening even after closing or expiry. No second attendance-start flag is added.

## Transition requiring approval

- New events and existing drafts default to `registration_open = false`; publishing does not change it.
- Existing published events without attendance history are grandfathered with the manual permission enabled. Their existing opening/deadline still applies. This avoids silently locking legitimate ongoing registrations.
- Existing published events with any attendance session transition permanently to closed registration. This is the explicit transition to the requested rule, including previously closed/expired sessions.
- Read-only inspection found two published events: both were within their registration windows; one had attendance history and one did not. Approval therefore changes registration availability for one currently published event. Re-run the impact query before approval because live state may change.
- Existing registration rows, approvals, attendance records, visibility, invite codes, schedules and deadlines are untouched. No future on-site registrations are allowed after attendance starts, even if a legacy setting remains true.
- Invite lookup accepts published events, including when registration is closed; it only locates the page. Draft, cancelled and completed events are unavailable through invite lookup. Published public events remain in the feed. Public landing-page labels also respect manual registration state.

```sql
select e.id, e.title, e.status,
  exists(select 1 from public.attendance_sessions s where s.event_id=e.id) as attendance_started,
  now() >= e.registration_opens_at and now() < e.registration_closes_at as within_window,
  e.allow_onsite_registration
from public.events e where status='published';
```

## Application and database rollout

After approval, inspect the linked CLI migration list and a dry run before applying through the CLI. There is another pre-existing local migration, `20261022100000_event_description_any_length.sql`; a blanket database push may include it. Approval of this lifecycle migration must not be treated as approval of unrelated pending files. Resolve the exact CLI application set before applying anything. Deploy application changes only after the lifecycle migration succeeds and postflight checks pass.

Until the RPC is installed, lifecycle controls fail closed with an unavailable message and event discovery remains readable. The server registration action still delegates to the database; deploying application changes alone does not upgrade the old database's rules.

The scan page checks eligibility for event-specific URLs. The general scanner must first read a token to identify its event; the existing `submit_attendance_scan` remains the final authority for its signature, expiry, expected event, session status, organizer status, participant profile, approval, revocation and duplicate checks. Its SQL and the rotating HMAC implementation are unchanged. The scanner no longer offers on-site registration. Attendance Display, verified participant feed, ownership checks and the 12-hour cap are preserved.

## Tests

`014_registration_lifecycle.test.sql` is a rollback-only pgTAP regression for an isolated database. Existing registration/landing/attendance database tests were updated for explicit opening and the removal of on-site admission. Never use the existing `npm run test:db` script for this validation: it targets the linked project.

On a disposable local Supabase stack with all migrations installed:

```powershell
npx.cmd supabase test db --local
```

`isolation/registration-attendance.spec` tests two real concurrent transactions with both event-lock orderings. The assertions reject an unexpected registration result, open registration after attendance or a successful reopening. It needs PostgreSQL's `isolationtester` executable on PATH. The local runner rejects remote database URLs and URL parameters:

```powershell
$env:EVENTHUB_LOCAL_TEST_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
node supabase/tests/run-registration-race.mjs
```

Vitest covers lifecycle action authorization/delegation, database-state parsing and failure handling, all four custom dialog copies/actions, initial Cancel focus, state-dependent controls, time-out resumption, fixed invite-code copying and the shared responsive participant links. Existing shared-dialog tests cover focus return, keyboard use, duplicate submits, pending dismissal prevention and server refusals.

No local PostgreSQL, Docker or isolationtester executable was available during implementation, so database and concurrency tests are prepared but unexecuted. They must pass locally before applying the migration. See the task handoff for TypeScript, ESLint, Vitest and build results.

Validation: `npx.cmd tsc --noEmit` and `npx.cmd eslint .` passed. The complete Vitest suite passed 342 tests across 42 files with `npx.cmd vitest run --maxWorkers=4`. Default-worker runs intermittently exceeded the existing certificate PDF test's five-second timeout; a prior default-worker run passed all 335 tests that existed at that point. No timeout settings or PDF code were changed. The Impeccable detector returned no findings for the changed UI targets. Route and interaction regressions ran in jsdom; an authenticated browser smoke test was not performed.

The final `npx.cmd next build` passed, including TypeScript and generation of all 55 pages.
