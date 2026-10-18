# Admin-controlled Organizer management

Implemented locally under the approved policy. No live migrations, accounts,
promotions, invitation emails, hosted Auth configuration changes, or deployment occurred.

## Behavior

- Organizers contains Add Organizer with Invite New Organizer and Promote Participant
  modes, participant search/confirmation, email/details, existing status controls, and a
  Pending Invitations filter backed by persisted workflow state.
- Invited users submit their own password at `/accept-invitation`, activate their bound
  identity, and enter `/organizer` without Student Onboarding. Participant registration
  and attendance still require the existing student profile. No student data is fabricated.
- Promotion updates only Organizer fields on the existing complete, confirmed Participant
  profile. Passwords, identity, registrations, certificates, and personal data are preserved.
  Already-active, suspended, and revoked accounts cannot bypass existing status rules.
- Applications remains absent from navigation and Overview. Old URLs remain read-only
  history and stale submit/review/withdraw actions reject requests without database access.

## Security

`profiles.organizer_status` remains the only role authority. Invitation records track
workflow, not a second role system. User metadata never grants privileges.

All Admin actions verify `requireAdmin`; reservation, delivery leasing, and promotion
also verify permanent Admin status in database RPCs. The isolated `server-only` Admin
client has no caller cookies, session persistence, auto-refresh, or browser storage.
Promotion uses the caller-authorized client rather than a privileged key.

Reservation checks Auth users and profiles, uniquely normalizes the email, and preallocates
the intended Auth ID. The server creates that unconfirmed ID without supplying a password
or emailing credentials, then calls Supabase's native `inviteUserByEmail` through existing
SMTP. This prevents an unrelated unconfirmed signup from being adopted during a race.
Repeated attempts reuse only that reserved identity; conflicting accounts use promotion.

Delivery leases serialize attempts with a one-minute cooldown; stale sending leases can
be retried after five minutes. Provider acceptance is recorded only after a successful
native request and matching returned user ID. This does not claim inbox delivery.
Auth/email and application persistence are separate transactions: partial/uncertain failures
leave Organizer access inactive. Recovery must never delete accounts to retry an email.

The custom email places a Supabase invite token hash in a URL fragment. Only explicit
password submission verifies `type=invite`; scanner GETs cannot consume it through this
app. The verified ID/email must match an unexpired persisted invitation with successful
provider acceptance. A random HttpOnly retry proof is then bound to that identity,
attempt, and expiry. Only its hash is stored, inaccessible to browser clients.
Ordinary sessions or user metadata cannot substitute for invitation proof.

Service-only RPCs begin/check/finalize acceptance. The action checks a freshly verified
session and proof before setting the password. Finalization locks the invitation, Auth
identity, and profile; rechecks expiry/email/current status; consumes the proof; and updates
the existing role atomically. Approval/promotion/activation is audited without raw links,
passwords, tokens, or proof hashes. Consumed proofs cannot activate twice.

Organizer DAL/proxy guards and login destinations now allow authorized Organizers without
a complete student profile. Inactive workspaces retain read-only behavior, while mutations
still require active status. The `save_event` replacement removes only the student-profile
check, retaining ownership, event-state, capacity, input validation, and audit checks.
Participant registration, QR attendance, and certificate-generation logic remain unchanged.

## Required configuration (not applied)

- New server variable: `SUPABASE_SECRET_KEY` (Supabase secret key or legacy service-role
  key). Never prefix it with `NEXT_PUBLIC_`, return it to clients, or put real values in
  `.env.example`. `.env.local` was not modified; the example has an empty placeholder.
- Existing variables remain `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL`. Invitations require
  an explicit app origin. Production requires HTTPS; only local development permits
  HTTP localhost/127.0.0.1. There is no request-host or production-localhost fallback.
- Hosted Supabase Site URL must match the configured app origin, with
  `<origin>/accept-invitation` allowed as a redirect. Apply `supabase/templates/invite.html`
  to Invite user, subject `You're invited to EventHub as an Organizer`, and retain the
  one-hour OTP expiry. Local `config.toml` does not update hosted configuration.
- The default invite template/session-fragment format is deliberately not accepted as
  invitation proof. The custom explicit-submit template is required before live use.
- Email reuses Supabase Auth SMTP. No separate Brevo integration was added. Hosted
  SMTP/Brevo settings, templates, schema, and redirect allowlists remain unverified and
  need review. Disable email link tracking when configuring the provider.

## Migrations and approval boundary

Apply only after separate approval, in this order:

1. `20261016012245_retire_organizer_applications.sql`: no-write legacy submit/review/
   withdraw responses and closure of new proof uploads; preserves history and reads.
   Until applied, hosted legacy RPCs may still accept submissions/approvals.
2. `20261016012340_admin_organizer_management.sql`: invitation table, indexes, foreign
   keys, uniqueness/state constraints, Admin RLS and column-restricted reads;
   caller-authorized reservation/delivery leasing/promotion; service-only delivery
   completion/acceptance; existing `save_event` without its student prerequisite.
   This migration itself creates no Auth users or Organizer grants.

Before approval/execution, inspect hosted drift, grants, upload policies, function
definitions, and record counts. Save definitions as rollback inputs. Afterwards,
regenerate database types in an approved environment; local type additions currently
describe the prepared migration. Verify browser roles cannot read proof hashes or
execute acceptance/finalization RPCs and role-column grants remain unchanged.

Prepared SQL suites `005_mvp_registration.test.sql` and
`010_admin_organizer_management.test.sql` use rolled-back fixtures only. They cover
authorization, direct escalation, profile preservation, duplicates, send failures,
email mismatch, expiry, missing password, single activation, event creation without
student data, and suspension/revocation. Do not run the linked `test:db` command without
approval; no isolated PostgreSQL runner was available here, so these tests were not run.

Rollback requires a reviewed migration disabling the new actions/RPC grants first.
Preserve invitation/audit history, accepted identities, and legitimate grants. Do not
drop tables, delete Auth users, or automatically reverse promotions. Restore the previous
`save_event` only if the onboarding policy is explicitly reversed. Reopening applications
requires policy approval, not routine rollback.

Recovery boundary: verified users retry passwords with the protected proof until the
original expiry. Already-confirmed identities cannot receive native invitation resends.
If the proof is lost/expires, or provider acceptance cannot be finalized, access stays
inactive and needs Admin-reviewed reconciliation. Do not manufacture another identity
or activate through a generic recovery session. Failed password/activation responses
provide an actionable retry/contact-Admin message rather than claiming success.

## Validation

- TypeScript and ESLint passed, including separate checks of the final added tests.
- Vitest: 177 tests passed across 21 files. Privileged workflows are mocked; no real
  user creation, promotion, invitation send, or acceptance was performed.
- Production build passed, generating 49 routes including `/accept-invitation`.
- A scan of production browser assets found no `SUPABASE_SECRET_KEY` reference;
  the server-only client is excluded from the browser bundle.
- SQL integration tests are prepared, not executed. Hosted behavior is not claimed verified.
- Browser/mobile and keyboard checks were not performed because Chrome could not connect.
  The dialog uses existing accessible modal primitives, labeled inputs, native radios,
  responsive widths, wrapped method buttons, and scrollable results.

## Modified files in this implementation

- `.env.example`
- `app/(app)/admin/organizers/page.tsx`
- `app/(auth)/accept-invitation/page.tsx` (new)
- `components/admin/add-organizer-dialog.tsx` (new)
- `components/auth/accept-invitation-form.tsx` (new)
- `lib/auth/dal.ts`, `lib/auth/redirect.ts`, `lib/auth/redirect.test.ts`
- `lib/auth/organizer-access.test.ts` (new)
- `lib/database.types.ts`, `lib/mvp/actions.ts`, `lib/navigation.ts`, `lib/navigation.test.ts`
- `lib/organizers/actions.ts`, `validation.ts`, `accept-invitation.ts`,
  `acceptance-proof.ts`, `actions.test.ts`, `accept-invitation.test.ts` (new)
- `lib/supabase/admin.ts`, `admin.test.ts`, `organizer-proxy.test.ts` (new), `proxy.ts`
- `supabase/config.toml`, `supabase/templates/README.md`, `supabase/templates/invite.html` (new)
- `supabase/migrations/20261016012340_admin_organizer_management.sql` (new)
- `supabase/tests/database/010_admin_organizer_management.test.sql` (new)
- `docs/DEPLOYMENT.md`, `docs/ORGANIZER_MANAGEMENT_PLAN.md`,
  `docs/ORGANIZER_APPLICATIONS_RETIREMENT.md`, this report (new)

Prior local retirement changes remain: Admin Overview and application list/detail pages,
`/become-organizer`, four-module navigation, removal of the application-form component,
legacy-action rejection/tests, the retirement migration, and updated stage-1 SQL tests.
The retirement report lists those files. Earlier landing-page changes were not edited.

References: [Supabase invitation API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail),
[Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
