# College and program catalogue update

## Source of truth and existing behavior

`public.colleges` stores identity `smallint` IDs, a unique code, the full name and an active flag. `public.programs` stores identity IDs, `college_id`, the full name and an active flag. Programs have no separate code column.

`profiles.college_id` references colleges. The composite `profiles_program_fk` references `(programs.college_id, programs.id)`, preventing a program from being saved with the wrong college. Events also reference college IDs through `host_college_id`.

Onboarding and profile editing share `getProfileOptions` and `ProfileForm`. Programs are disabled until a college is selected, filtered by its ID, and cleared when the college changes. Required-field validation and the database FK remain unchanged. Event creation and Admin Lookups read the same database records; there is no frontend catalogue array.

College and program labels use full database names. Admin's college filter and program table show full college names, and the reference tables and college editor do not expose codes. Existing college codes are retained on edit; adding a college generates a unique internal code automatically. This does not change stored identifiers, relationships or lookup validation.

## Read-only development audit, 2026-10-15

The configured Supabase database returned these active records:

| Table | ID | Parent college ID / code | Name |
| --- | --- | --- | --- |
| colleges | 15 | DEV-A | Development College A (test data) |
| colleges | 16 | DEV-B | Development College B (test data) |
| programs | 8 | 15 | BS Development Testing |
| programs | 9 | 15 | BS Sample Studies |
| programs | 10 | 16 | BS Placeholder Science |

There were no official catalogue rows or duplicate college/program names in that response. A subsequent privileged, read-only audit against the configured development project `ldhpbfujqnyovovabvcg` confirmed zero profile references to each of the two placeholder colleges and three placeholder programs, and zero event references to either college. **No live data was changed.** These counts are a point-in-time observation; the migration rechecks dependencies under locks before deactivation.

Before applying anything, run [the read-only preflight audit](../supabase/reference-data-preflight.sql) with privileged database access. It reports college/program IDs, names, duplicate normalized names, profile-reference counts, event-reference counts and invalid profile pairs without returning student names or email addresses.

## Prepared manual data operation

The canonical official catalogue definition is embedded in [the new migration](../supabase/migrations/20261015030000_official_colleges_programs.sql). Do not maintain another seed or frontend list.

| College | New-row code default | Active programs |
| --- | --- | --- |
| College of Arts and Sciences | CAS | 4 |
| College of Allied Medical Sciences | CAMS | 5 |
| College of Business and Accountancy | CBA | 5 |
| College of Criminal Justice Education | CCJE | 1 |
| College of Engineering and Computer Technology | CECT | 3 |
| College of Hospitality and Tourism Management | CHTM | 3 |
| College of Education | COED | 2 |
| College of Nursing | CON | 1 |

Against the audited development state, the migration inserts eight colleges and 24 programs and deactivates the two placeholder colleges and three placeholder programs. It does not delete them, rename them into unrelated colleges, or reassign existing profiles or events.

If official full-name records already exist when applied, it reuses their IDs and preserves college codes. It can rename a uniquely matched full program label with an appended parenthetical abbreviation to its approved full name while retaining the program ID and college. Ambiguous matches, code collisions and unexpected active records abort the transaction for manual review.

Before inserting anything, the operation discovers every incoming foreign key to colleges and programs through PostgreSQL's constraint catalogue. It locks all referencing tables against writes and checks references to active placeholders, including profiles, events, composite foreign keys, and any additional tables. A reference aborts the entire transaction and identifies its source table, constraint and count without exposing participant data. Stop and obtain further approval if this happens; do not remove the guard or reassign references automatically.

The only exception is a known placeholder program's own `college_id` link to its known placeholder college: both rows are retained, so that structural relationship must remain. Any other program referencing a placeholder college, including an inactive program, blocks college deactivation. All other foreign-key references block deactivation. Already inactive placeholders are not deactivated again.

The operation locks the lookup tables against concurrent writes and briefly takes shared locks on profiles and all referencing tables. In-memory JSONB snapshots scoped to the single `DO` statement assert that all prior college IDs/codes, program IDs/college ownership, and profile college/program links are preserved. All changes are atomic. Reapplying it to the resulting catalogue produces no additional row writes. Existing lookup audit triggers remain enabled. There is no `TRUNCATE`, `DELETE`, schema change, or disabling of triggers or constraints.

There are eight **active** colleges and 24 **active** programs after successful application. The migration verifies exact full names and every program-to-college pairing against its embedded catalogue, as well as total active counts. Historical inactive rows remain in Admin Lookups. Onboarding loads active options from these same tables and displays complete names; it has no separate catalogue to update. Existing saved inactive selections remain visible only to their own profile editor, as before. This migration will not deactivate an active placeholder used by any participant.

No schema, RLS, permissions, authentication, role or registration changes are included. The user approved this development catalogue update subject to the reference guard, and will execute it manually. This preparation does not execute it or record it in Supabase migration history.

## Manual execution in Supabase SQL Editor

1. Open the intended **development** project in the Supabase dashboard. Verify its project reference is **`ldhpbfujqnyovovabvcg`** in the dashboard project settings/URL before opening SQL Editor. SQL alone cannot reliably identify a hosted project from the generic database name `postgres`. Do not run this in production or rely only on the local app URL.
2. Use the database-owner `postgres` SQL Editor role, so the dependency audit is not limited by RLS. No credential needs to be copied into this repository or chat. The migration sets `row_security = off` locally so that restricted visibility causes an error rather than silently bypassing the audit.
3. Run the complete read-only file `supabase/reference-data-preflight.sql` and review the results. If a placeholder has profile or event references, stop and request further approval. The migration additionally checks other incoming foreign keys at execution time.
4. Open **`supabase/migrations/20261015030000_official_colleges_programs.sql`** locally. Copy the **entire corrected file**, including `BEGIN`, the complete `DO $update_catalogue$ ... $update_catalogue$;` statement, and final `COMMIT`, into a new SQL Editor query. Clear any selection and run all of it together. No other migration or seed file is needed for this already provisioned development database. All setup, locks, snapshots, guards, writes and assertions are inside the one DO statement; there are no temporary tables or dependencies on previous executions. Do not run an inner fragment of the DO body.
5. Confirm the execution and final commit succeed. The DO statement raises a notice only after checking eight active official colleges, 24 active official programs, exact names/ownership, and preserved prior identifiers/profile links. A notice is not proof of commit: deferred constraints or later errors can still prevent it.
6. In a **separate execution**, run the complete read-only file [`supabase/reference-data-postflight.sql`](../supabase/reference-data-postflight.sql). It requires no earlier session or temporary tables. Its summary must report `active_colleges = 8`, `active_programs = 24`, `active_official_colleges = 8`, `active_official_programs = 24`, `catalogue_relationship_mismatches = 0`, and `active_programs_without_active_college = 0`. It also lists complete names, all program assignments, active counts per college, and retained historical IDs/statuses. The expected-label fixture is copied from the migration; the local test checks they remain identical.
7. Refresh Participant Onboarding and Admin Reference Data. Confirm full names, college-filtered programs, and inactive placeholders in Admin only. This requires manual browser verification after execution; it has not been claimed as tested against an updated live database.

If a statement fails, do not continue with selected later statements. If SQL Editor leaves that same connection in an aborted transaction, run `ROLLBACK;` before retrying. A rollback in another pooled session cannot resolve an earlier connection's transaction. Close/reconnect the failed query session if necessary. Resolve the reported issue first, rerun read-only preflight, then rerun the complete corrected migration only if needed. A **5-second lock timeout**, configured within the DO statement, avoids prolonged lock waits; retry during a quiet period instead of bypassing guards. A deadlock or editor/server statement timeout also causes rollback. Identity sequences can advance during unsuccessful attempts, leaving harmless gaps; existing IDs are not reassigned.

Remaining limits: the dynamic audit covers declared foreign keys, not undocumented references embedded in JSON/text or external systems. Review any such integrations before execution. Runtime constraints and audit triggers remain enabled and may abort the operation. SQL Editor execution does not automatically add an entry to `supabase_migrations.schema_migrations`; reconcile migration history through the normal process separately. Do not run a blanket CLI migration push to do that. JSONB snapshots use memory proportional to the existing lookup/profile relationship rows; very large databases require separate capacity review.

## Missing temporary relation: diagnosis and current state

The previous revision created four temporary tables in statements preceding the DO block:

| Old temporary table | Purpose and references |
| --- | --- |
| `eventhub_colleges_before` | Created before DO; read twice by the final ID/code preservation assertion. |
| `eventhub_programs_before` | Created before DO; read twice by the final ID/college preservation assertion. |
| `eventhub_profiles_before` | Created before DO; read in both directions of the final profile-set comparison. |
| `eventhub_expected_programs` | Created before DO; populated at DO entry; read by ownership validation and the later result queries. |

All four used `ON COMMIT DROP`. They exist only in the creating database session, and are removed when that transaction commits. The exact reported `42P01` means the snapshot relation was unavailable when its reference was planned/executed. Committing the setup then running assertions, using a new session, or selecting an assertion without setup can cause this. The old complete file **passes locally as one transaction**; the error alone does not prove that Supabase splits a correctly submitted batch. The actual submitted statement selection, error context and connection/transaction history were not available, so the particular SQL Editor boundary is unconfirmed. Do not attribute this to RLS, PWA or frontend code.

A local regression reproduces `42P01` by creating `eventhub_colleges_before ON COMMIT DROP`, committing, and then querying it. The corrected migration removes every temporary-table creation/reference and stores snapshots in local JSONB variables instead. It derives the expected catalogue within DO directly from the embedded JSON. Even a standalone complete DO runs atomically without a previous transaction/session; the full file keeps the explicit transaction wrapper for manual execution.

**Read-only verification after the reported failure:** the development API currently returns eight active official colleges (IDs 71?78), 24 active official programs (IDs 50?73), and inactive placeholders (college IDs 15/16; program IDs 8/9/10). An automated comparison confirmed every active full name and program-to-college relationship exactly matches the migration. Therefore committed catalogue changes are present; it is incorrect to assume the failed attempt left the original two/three active placeholders. The API cannot attribute that state to a particular SQL Editor run, inspect an open uncommitted editor transaction, or prove earlier profile history was unchanged. No database writes were performed during this investigation.

An error inside the original DO statement rolls back that statement's catalogue writes; with the complete outer BEGIN/COMMIT, any error prevents that transaction from committing. Separately committed prior executions remain committed. A failure in later validation after an earlier commit does not undo that earlier commit. Sequence gaps alone are not evidence of partial catalogue writes. The currently observed catalogue has no partial/missing official rows or incorrect mappings.

**What to rerun now:** first run the standalone read-only preflight and postflight files against the verified development project. If all postflight results match, no data repair is needed. Rerunning the complete corrected migration is optional; it reuses the existing official IDs and produces no additional lookup writes for this matching state. If results differ, review the discrepancy before executing changes; guards will reject referenced active placeholders, unexpected active records, duplicate matches and code conflicts. Never rerun only a snapshot assertion, create permanent replacement snapshot tables, or disable the guards.

PostgreSQL references: [temporary table/ON COMMIT lifetime](https://www.postgresql.org/docs/current/sql-createtable.html), [DO statement](https://www.postgresql.org/docs/current/sql-do.html), [transaction atomicity](https://www.postgresql.org/docs/current/tutorial-transactions.html).

## Validation

Catalogue quality tests read the migration's definition directly and check the exact eight names, 24 full program labels, ownership, uniqueness and existing lookup-validation limits:

```text
npm test -- lib/lookups/catalogue.test.ts
```

The isolated migration check uses an in-memory PostgreSQL engine, [PGlite](https://pglite.dev/docs/), installed only in the ignored QA folder. Application dependencies and lockfiles are unchanged:

```text
npm install --prefix .next/reference-db-qa --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
node scripts/reference-data-check.mjs
```

It executes the actual SQL with the existing lookup table definitions and minimal related FK fixtures. It also executes the standalone preflight/postflight files, verifies their expected labels match the migration, reproduces the old temporary-table lifetime failure, and exercises the corrected standalone DO with late-error rollback. It checks a fresh database, unreferenced development placeholders, preservation of referenced official records, reuse of an official ID/code and abbreviated label, a no-write second run, valid and invalid profile pair saves, and atomic rejection of unexpected records, duplicate matches and conflicting codes. It also checks rollback for placeholder references from profiles, events, additional single/composite-FK tables, and unexpected inactive child programs. These local fixtures do not replace full Supabase/RLS, concurrency or browser integration tests. No live migration or live profile save has been performed.
