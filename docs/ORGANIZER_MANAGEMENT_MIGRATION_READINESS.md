# Organizer migrations: read-only readiness review

Review date: 2026-10-16 (Asia/Manila). **NOT READY for live execution.**
No migration, permission change, account creation/promotion, Auth configuration update,
or email send was performed. Neither migration file nor `.env.local` was edited.

> **Status update (2026-10-16):** both migrations have since been applied to development
> project `ldhpbfujqnyovovabvcg` and recorded in remote history under the versions shown
> below. Local files were renamed to match; SHA-256 values in the manifest are unchanged.
> Do not rerun the apply steps in this document against that project.

## Exact order and current verification status

| Order | Migration | Live applied status |
|---|---|---|
| 1 | `20261016012245_retire_organizer_applications.sql` | Unknown: history and effective definitions could not be read |
| 2 | `20261016012340_admin_organizer_management.sql` | Unknown: history and effective definitions could not be read |

The implementation report says these are prepared/unapplied, but that statement has
not been independently confirmed against the database. A 404 from an unprivileged
Data API request does not establish that the invitation table is absent. Do not rerun
the second migration based on that response: its CREATE TABLE/FUNCTION statements
are not intended to be rerun over existing objects.

The exact reviewed file SHA-256 values and normalized source-body MD5 checks for all
11 created/replaced functions are saved in
`supabase/organizer-management-review-manifest.json`. The migration files are unchanged.

## Read-only development checks actually performed

- `.env.local`/process configuration and `.mcp.json` both target development project
  `ldhpbfujqnyovovabvcg`. No production target was used.
- The configured Supabase MCP connection failed startup during OAuth refresh, so it
  could not read migration history, PostgreSQL catalogs, function definitions, or policies.
- Fallback requests used only GET and HEAD against that project's Data API. Protected
  profile/application/event/registration/certificate reads returned HTTP 401. A zero-row
  profile GET returned PostgreSQL error `42501` (permission denied).
- The invitation-table HEAD returned 404, which is inconclusive under this credential.
- The migration-history schema request returned HTTP 406 / `PGRST106`: the
  `supabase_migrations` schema is not exposed by the Data API. **Do not expose it** as a fix.
- No protected row counts, histories, SQL definitions, trigger state, or RLS rules were
  obtained. The checked data/authorization state therefore remains unknown.

Sanitized evidence is in `docs/ORGANIZER_MANAGEMENT_READONLY_RESULTS.json`.
`scripts/organizer-management-readonly-audit.mjs` contains the fixed-development-project,
GET/HEAD-only diagnostic. It prints credential presence/type, never credential values
or account rows. It does not invoke application RPCs. No Auth user/email operation is used.

## Environment review: names and metadata only

| Variable | Observed status | Required correction |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Present; expected development host | Keep the development project target |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Present | Keep the public client key separate from the server key |
| `NEXT_PUBLIC_APP_URL` | Missing | Set the exact development application origin |
| `SUPABASE_SECRET_KEY` | Present, but value has **publishable-key format** | Replace with the same project's server secret or legacy service-role key |

No secret value was displayed, saved in the evidence, or changed. Presence alone is
not proof of a valid server credential. The currently misassigned key cannot authorize
the invitation Admin client. The API key is not a Management API personal access token
and cannot, by itself, make the private migration-history schema available.

After configuration is separately approved, put the server key only in the ignored
server environment (`SUPABASE_SECRET_KEY`, never a `NEXT_PUBLIC_` variable). Do not paste
it into SQL Editor, chat, browser code, or committed examples. Do not change public
client key variables to service-role credentials.

For a local `next dev` server actually running on port 3000, the app origin can be
`http://localhost:3000`; otherwise use the actual reachable origin. Invitation URLs
require an explicit configured origin. The implementation accepts HTTP loopback only
outside production mode; production requires HTTPS. Restart the development server after
environment changes. Do not test the invite/promote UI or send emails during setup.

## Static migration safety review

### Migration 1: retire applications

- Replaces submit/review/withdraw function bodies with no-write `workflow_retired`
  responses. Review can no longer grant Organizer access; pending/history rows are not
  approved, rejected, withdrawn, or deleted.
- Retains signatures, SECURITY DEFINER, empty search paths, and authenticated EXECUTE;
  revokes PUBLIC/anon EXECUTE. These retired functions do not need to mutate anything.
- Drops only the named `Requirements: own upload` Storage policy. Existing documents,
  bucket, own/Admin read policy, application table/RLS, and audit history remain.
- Other INSERT/ALL Storage policies could independently permit requirements uploads.
  Their effective live definitions must be inspected before claiming backend closure.

### Migration 2: Admin management

- Adds an initially empty invitation workflow table. Normalized email is unique; the
  bound user ID is unique and must equal the reserved invitation ID. Names, states,
  acceptance hashes, and accepted-state timestamps have constraints. Indexes support
  state/expiry and inviter lookups. No user or role is created merely by applying DDL.
- Enables invitation RLS. Browser roles get no table writes; authenticated users get
  SELECT only on explicit non-proof columns, with a permanent-Admin read policy. Proof
  hashes, acceptance attempts, and delivery attempt IDs are not browser-readable.
- Grants service_role table access. Reserve/acquire/promote RPCs are authenticated-
  executable but check permanent Admin authorization internally. Finish/begin/check/
  complete acceptance RPCs deny PUBLIC/anon/authenticated EXECUTE and are service-only.
- Functions use fully qualified objects and empty search paths. Promotion and activation
  lock rows and write the existing `profiles.organizer_status` authority with audit logs.
  No second role source is introduced. DML inside function definitions is not executed
  when the migration defines those functions.
- Replaces `save_event` with the original implementation minus its student-completion
  prerequisite. Local comparison confirmed every other original check/body is retained.
  This intentionally allows existing active Organizers with incomplete student profiles
  to create/edit events after application. Active role, permanent identity, ownership,
  event state, capacity, and input validation still apply. Participant operations are unchanged.
- Adds no triggers and replaces none. Existing Auth profile-creation/email-sync triggers,
  profile updated-at/identity-lock triggers, and Organizer-status attendance-closing
  triggers remain dependencies. Their actual live definitions still need verification.

### Dependencies and existing-data implications

Required objects include public profiles/applications/events/registrations/audit tables,
Auth users and identity helpers, Storage objects/buckets, `extensions.gen_random_uuid()`,
`private.is_admin`, `private.is_permanent_user`, `private.is_active_organizer`, and
`private.log_audit`. Existing profile creation must produce a Participant-only profile
for a newly created non-anonymous Auth identity. The executing SQL Editor role must be
able to replace the existing functions, create public objects, and remove the Storage policy.

Neither migration performs top-level data updates or deletes. Existing IDs, privileges,
application status/history, registrations, certificates, event records, documents, and
audit rows should remain unchanged. Compare saved counts/fingerprints in a quiet window;
concurrent normal app activity can otherwise make before/after fingerprints differ.

The invitation table's `invited_by` and `user_id` foreign keys use default NO ACTION,
not cascading deletion. After invitations are used, deleting an inviting Admin or invited
profile can be blocked by those audit/workflow references. Email uniqueness is lifetime
uniqueness, not just a pending-row constraint. Confirm those lifecycle choices before live use.

Known recovery limitation from the implementation report remains: verified/confirmed
invitees cannot receive native invite resends. Lost/expired retry proofs or uncertain
post-provider finalization need reviewed reconciliation; do not create another identity
or manually grant access as an unreviewed workaround. SQL integration tests have not run
in an isolated PostgreSQL environment; mocked unit tests are not live migration validation.

## Standalone SQL files

- `supabase/organizer-management-preflight.sql`: READ ONLY transaction, migration history
  and history-column inspection, dependency checks, effective definitions/grants, all
  relevant RLS/Storage policies, triggers, constraints/indexes, role counts, and deterministic
  aggregate fingerprints. No application RPCs, user rows, passwords, or tokens are printed.
- `supabase/organizer-management-postflight.sql`: READ ONLY transaction with the same
  comparison snapshots plus 11 exact source-body checks, SECURITY DEFINER/search-path
  checks, effective function permissions, invitation column grants/write denial, RLS
  metadata, removed policy check, and invitation-state counts.

Both end with ROLLBACK and contain no DDL/DML or application function invocation.
They are prepared and structurally checked locally, but **not executed in PostgreSQL**.
Run the complete file so the read-only transaction and timeouts remain in effect.
If a prerequisite is missing or any statement errors, stop, roll back, and inspect;
do not create missing dependencies or widen permissions automatically.

Interpret preflight before requesting migration approval:

1. Neither history row nor new table/functions exists: compare legacy definitions and
   required dependencies against the existing repository migrations, then queue 1 followed by 2.
2. Migration 1 is recorded AND its retired definitions/policy state match: skip 1 and
   evaluate 2 only. History without matching schema is drift, not a successful migration.
3. Both migrations are recorded AND postflight matches: do not rerun either.
4. Objects without history, history without matching objects, conflicting functions,
   reverse/partial application, missing dependencies, or extra broad grants/policies:
   **stop** and reconcile under separate approval. Never add IF NOT EXISTS or ON CONFLICT
   DO NOTHING to conceal a mismatched schema or migration ledger.

## Exact SQL Editor execution plan (future approval required)

1. Open the Supabase dashboard for development project **ldhpbfujqnyovovabvcg**. Verify
   the project ref in the URL, choose its primary database and the `postgres` SQL role.
   The database name `postgres` alone does not identify the right project.
2. In a fresh query, paste and run the **entire preflight file only**. Save all result
   sets privately, including existing function definitions, ACLs, policies, triggers,
   data fingerprints, and the actual migration-history column layout. Resolve the
   access/configuration blockers and report the results before asking to apply changes.
3. Confirm a recovery point/backup is available and retain the exact local migration
   files plus the SHA-256 manifest. Confirm a quiet application window and that no one
   will run Organizer invitations/promotions/application mutations during the change.
4. Obtain explicit approval covering both pending migration DDL/ACL changes **and their
   migration-history entries**. SQL Editor does not automatically register migration files.
5. If preflight confirms the standard history table has `version`, `name`, and a nullable
   `statements text[]` column, run migration 1 once in a new query using this wrapper.
   Paste its full unchanged file at the marked location, not just selected lines:

   ```sql
   BEGIN;
   SET LOCAL lock_timeout = '5s';
   SET LOCAL statement_timeout = '60s';
   -- Paste all of 20261016012245_retire_organizer_applications.sql here.
   INSERT INTO supabase_migrations.schema_migrations(version,name)
   VALUES ('20261016012245','retire_organizer_applications');
   COMMIT;
   ```

   This minimal history entry leaves `statements` null; preserve the exact original SQL
   file and checksum separately. If tooling requires migration source in the ledger,
   instead populate `statements` with the full reviewed source as a quoted text-array
   element under a reviewed wrapper. Do not assume the history schema or create/alter it.
   If the table/columns differ, stop and prepare project-specific bookkeeping first.
6. If any statement fails, do not run the next migration. Issue ROLLBACK if the session
   remains in a transaction, confirm effective state with preflight, and investigate.
   Do not manually mark a failed migration applied. A duplicate version is a stop condition.
7. Confirm the three retired bodies match and the named upload policy is absent using
   the relevant read-only query sections. Pending application records must be unchanged.
8. Apply migration 2 in a separate new query using the same BEGIN/timeouts/COMMIT wrapper,
   pasting the complete `20261016012340_admin_organizer_management.sql` and recording:

   ```sql
   -- Inside the same transaction, after all of migration 2's statements:
   INSERT INTO supabase_migrations.schema_migrations(version,name)
   VALUES ('20261016012340','admin_organizer_management');
   ```

   The transaction keeps temporary default function grants unobservable until the
   intended revocations/grants are in place. Do not run individual highlighted statements.
9. Run the **entire postflight file** in a fresh query. Compare preflight fingerprints,
   role/application counts, read policies, and existing triggers. All new function body,
   permission, and safe-column checks must match. Review ALL remaining Storage INSERT/ALL
   policies. The invitation table should be empty before any separately approved use.
10. Confirm both migration versions now appear with the intended names, preserve the
    execution results, and regenerate types only through an approved read-only process.
    If schema-cache propagation delays new REST objects, wait/retry read-only introspection;
    do not reapply CREATE TABLE or silently repair the ledger.

These steps are instructions only and were NOT executed. Supabase recommends migration-
file deployment; manual SQL Editor work bypasses its ledger unless explicitly reconciled.
See [Supabase migration guidance](https://supabase.com/docs/guides/deployment/database-migrations).

## Invitation URL, template, and SMTP setup (separate live-config approval)

1. Correct the two local environment issues described above. Keep the public and server
   keys on the same development project. Do not try an invitation to test a key.
2. In Authentication / URL Configuration, inspect the current Site URL and redirect
   allowlist. The Site URL must equal `NEXT_PUBLIC_APP_URL`, without an extra path.
   Add `<actual-origin>/accept-invitation` if absent; retain approved signup/recovery
   entries. Configure only this development project, not production.
3. In Authentication / Emails / Templates / Invite user, set the subject to
   **You're invited to EventHub as an Organizer** and paste all of
   `supabase/templates/invite.html`. Its setup link is:

   ```text
   {{ .SiteURL }}/accept-invitation#token_hash={{ .TokenHash }}&type=invite
   ```

   The HTML file correctly escapes the ampersand as `&amp;`. Do not substitute
   `ConfirmationURL`, an ordinary recovery link, or a default implicit-session template.
   Local `config.toml` does not update hosted templates. The fragment is verified only
   after explicit password submission, not on a GET.
4. Inspect hosted email OTP expiry and keep it at **3600 seconds**, matching the email
   and persisted invitation expiry. Do not change password policy or confirmation rules.
5. Inspect existing custom SMTP first. Reuse it (including Brevo if already configured),
   with a verified sender/domain, valid SPF/DKIM, suitable limits, and disabled click
   tracking. No SMTP password or API key needs to be displayed or copied into this report.
   The built-in sender is restricted and is not a substitute for production SMTP.
6. Do not click Send test email, Invite user, Send Invitation, Resend, or Promote during
   this review. Configuration saves are themselves live changes and need approval;
   actual delivery/acceptance or promotion tests require separate named test approval.

The hosted Site URL, allowlist, template, OTP expiry, and SMTP configuration could not
be read through the failed MCP/limited API connection and remain **unverified**.
Sources: [email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Stop state

No live mutation is authorized by this report. Restore read-only catalog access (for
example reconnect the existing Supabase MCP) or review the SQL Editor preflight results,
correct local environment configuration, and resolve any drift before migration approval.
No Git operation, deployment, account/permission change, or email send was performed.
