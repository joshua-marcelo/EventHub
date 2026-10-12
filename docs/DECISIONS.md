# Engineering Decisions Log

Short records of implementation and design decisions, with their context. The specification itself is [SYSTEM_SPEC.md](./SYSTEM_SPEC.md); the build order is [PLAN.md](./PLAN.md).
Newest last. Each entry: context → decision → consequence. Superseded entries are kept and marked, so the history stays readable.

## Phase 0 (2026-10-10)

**D-001 — Spec §20 [CONFIRM] items.**
The planning documents were approved without separate answers for C1–C20. The recommended options in §20 are treated as accepted, except for items that need client data:
- **C1 (email domain restriction)**: no domain is known, so sign-up is **not** restricted yet. A restriction can be added later without schema changes. *(Closed by D-010: personal emails are allowed; ownership is proven by email confirmation.)*
- **C2 (student ID format)**: no official pattern is known. A permissive pattern is used: 4–20 characters, letters, digits and hyphens (`^[A-Za-z0-9-]{4,20}$`). Tighten it in one place (`lib/validation/profile.ts` + the `profiles_student_id_format` CHECK) when the official format is provided.
- **C3 (college and category lists)**: no official lists are known, so **no seed rows are created by migrations**. Until the client supplies them, profile completion cannot pick a college. See the Phase 1/2 notes below.
- **C11 (certificate prefix)**: `CLC-{YYYY}-{NNNNNN}` (used in Phase 9).
- **C17 (development database)**: see D-004.
- **C18 (git)**: see D-002.

**D-002 — Git.** No remote is configured on this machine. Work stays on the local `master` branch; nothing is pushed. The client decides how to push to their repository (`main`).
*Correction (2026-10-11): this is no longer accurate. The repository now works on branch `main` with remote `origin` (`origin/main`). Commits are made locally on `main`; pushing remains a separate, explicit decision.*
Local AI/design tool folders (`.agent/`, `.agents/`, `.claude/`, `.codex/`, `.gemini/`, `.pixel-agents/`, `.impeccable/`) are git-ignored and excluded from ESLint. They are developer-machine tooling, not app code.

**D-003 — Dependencies.**
- Added: `server-only`, `@date-fns/tz` (runtime); `supabase` (CLI), `vitest` (dev).
- `@types/node` raised from 20 to 24 to match the Node 24 runtime and Vitest's peer range.
- `next-themes` (pulled in by the shadcn `sonner` component) was removed. The app has no theme switcher in scope, so the toaster uses the light theme directly.
- Playwright was **not** installed. Route-guard checks in Phase 3 are run with scripted HTTP requests and manual browser checks. Reconsider in Phase 12.

**D-004 — Development database.** Docker is not available on this machine, so a local Supabase stack cannot run. The only database is the client project configured in `.env.local` (ref `ldhpbfujqnyovovabvcg`). It was verified as empty (0 tables, 0 migrations) and created on 2026-10-09 for this project.
- Migrations are additive and are applied to that project with the Supabase MCP integration. The local files in `supabase/migrations/` are named with the exact versions recorded remotely, so `supabase db push` stays in sync later.
- Database tests in `supabase/tests/` run inside `BEGIN … ROLLBACK`, so they leave no data behind.
- `supabase migration list`/`db push`/`gen types --linked` need `supabase login` + `supabase link`, which need the client's access token. They were not run here. Database types are generated through the MCP integration instead. (Correction: an earlier version of this entry said the types had been generated during Phase 0. They had not; `lib/database.types.ts` was first generated in Phase 1, see D-006.)
- *Updated by D-016 (2026-10-11): this project is formally the **development** project. A separate production project is created before deployment.*

**D-005 — Baseline fixes.** `app/globals.css` mapped `--font-sans` to itself, so the Geist font never applied. It now maps to `--font-geist-sans`. The shadcn `use-mobile` hook was rewritten with `useSyncExternalStore` to satisfy the React Compiler lint rule.

## Phase 1 (2026-10-10)

**D-006 — Running database tests without the Supabase CLI.** `npm run test:db` (`supabase test db --linked`) needs the CLI link from D-004, so the pgTAP suite was run through the Supabase MCP `execute_sql` tool instead:
- The test body runs as one batch. Each assertion's TAP line is stored in a temporary table, and the batch ends with a `DO` block that raises an exception carrying all TAP lines. The exception rolls back the whole batch, including `create extension pgtap`, the test users and every row. Afterwards `pgtap` is not installed and `auth.users`, `profiles`, `colleges` and `audit_logs` are empty again. Only the `colleges` identity sequence advances, because sequences are not transactional.
- `pgtap` is therefore never left installed or exposed to `anon`/`authenticated`.
- Result: 32/32 assertions in `supabase/tests/database/001_profiles.test.sql` pass, before and after D-007.
- `lib/database.types.ts` was generated with the MCP `generate_typescript_types` tool from the deployed schema (not hand-written). Regenerate it after every migration.
- Once the CLI is linked, `npm run test:db` and `npm run db:types` replace these steps.

**D-007 — One SELECT policy on `profiles`.** The performance advisor flagged two permissive SELECT policies for `authenticated` (`multiple_permissive_policies`). Postgres combines permissive policies with OR, so one policy `id = (select auth.uid()) or (select private.is_admin())` has identical behavior: a user reads their own row, an admin reads every row, and nobody else reads other rows. Migration `20261010012943_profiles_select_policy_consolidation.sql` replaces the two policies. The pgTAP suite passes unchanged and the warning is gone. Phase 6 adds the organizer condition (`can_view_profile`) to this same policy instead of creating a new one.
The remaining `unused_index` INFO notices are expected on an empty database and are kept.

**D-008 — Information still needed from the client.** These items block later work. No placeholder values are committed for them.
- **C3, colleges** (blocks profile completion in Phase 2): the official list of Wesleyan University-Philippines colleges, each with its full name and a short code (2–15 characters, uppercase letters, digits or hyphens, for example the abbreviation used on campus), and which colleges are currently active.
- **C3, event categories** (blocks event creation in Phase 5): the list of category names (2–60 characters), the display order, and whether each one is active. Slugs are derived from the names.
- **C2, student ID format**: the official pattern with one or two real examples. Until then the provisional pattern `^[A-Za-z0-9-]{4,20}$` stays.
- **C1, email domain**: whether sign-up is limited to a school email domain, and which domain. Until then sign-up is open.
- **Supabase CLI access token** (or the client runs `supabase login` and `supabase link`) to enable `npm run test:db`, `db:types` and `db:push`.
When the C3 lists arrive, they are added as a new migration (data only), not through `seed.sql`, so the client project receives them.
*Updated by Revision 2 (2026-10-11): C1 is closed (D-010). C3 lists are no longer added by migration; admins enter them through `/admin/lookups` (D-011), so they no longer block development. The CLI token is a convenience for development, not a blocker (D-016). The full client list is SYSTEM_SPEC §20.3 (K-01 – K-11).*

## Revision 2 design review (2026-10-11)

The specification was reviewed end to end before Phase 2. The results are SYSTEM_SPEC.md and PLAN.md Revision 2, approved by the project team on 2026-10-11. The decision record is SYSTEM_SPEC §20.2 (P-01 – P-23). The entries below give the reasons.

**D-009 — One Auth system, three roles, three dashboards.**
- One Supabase Auth system for everyone. Sign-up always creates a Participant. Organizer is `profiles.organizer_status`, granted only by admin approval of an application; the same login is used. Admin is `profiles.is_admin`, set only by the maintainer with SQL on an account that has confirmed its email, after verifying the person outside the system; at least two admins.
- Separate Participant, Organizer and Admin dashboards in one shell, with a switcher listing only the dashboards a user may open. Switching is navigation only; authorization stays in the DAL, RLS and RPCs. Organizers keep participant access and may register for events they do not own.
- Admins do not need student fields: the Admin Dashboard works without a complete profile (P-08). Participant actions still require one.
- Reason: one account model keeps RLS simple and avoids duplicate identities; no client path can grant itself a role.

**D-010 — Mandatory email confirmation; client-owned SMTP.**
- Supabase "Confirm email" is on. No session before confirmation. Flows: check-email page with resend, confirmation success (including a link opened on another device), expired link with resend, "email not confirmed" at login with resend, password recovery. Links valid 24 h (P-03; *changed to 1 h by D-021*). CAPTCHA (Turnstile, P-01) and password policy (P-02); other sessions signed out after a reset (P-05).
- A version without confirmation was considered during the review and rejected: account security and reliable ownership of the email address matter more than a shorter sign-up.
- Consequence: every sign-up sends an email, so a client-owned SMTP provider is required before production (K-01). Supabase's built-in sender only delivers to project team addresses and is used for development only. Confirmation proves control of the inbox, not university enrollment.
- Purging unconfirmed accounts is deferred (P-04): they cannot log in or claim a student ID.

**D-011 — Self-declared student identity, admin-managed lookups.**
- Participants are WU-P students only. No university records are available, so student IDs are self-entered, checked for format and uniqueness only.
- Student ID and profile photo are locked while the user has an approved registration for a not-yet-ended event; names stay editable for typo fixes (P-07, narrowed).
- Admins resolve student-ID disputes: clear the ID, set an identity flag, trigger certificate review (audited).
- Colleges, programs (per college, new `programs` table) and event categories are managed by admins in `/admin/lookups` (P-09): add, rename, deactivate; never delete. This removes the dependency on client lists for development.
- Email corrections are made by the maintainer (no self-service email change in the MVP).

**D-012 — Self-service attendance with organizer oversight.**
- Participants scan the station's rotating QR; a valid scan records attendance immediately. The Revision 1 pending → organizer-confirm step is removed.
- Per-event policy `time_in_only` or `time_in_and_out`; lead time default 60 min (0–180, P-11); attendance window ends at effective end + 60 min, and sessions can be opened anywhere inside it (P-14); opening time-out closes time-in, and no time-in session can be opened after time-out has started (P-15); the completion dialog warns about open flags and missing time-outs.
- Device signal: a per-browser device ID, stored as a per-event hash; one device used by several accounts in one event flags all affected records. It is a risk signal, not proof.
- Organizers correct attendance with audited manual time-in/time-out, revocation and flag resolution, also **after completion** for registrations without a certificate (P-17). Reasons are stored only in `audit_logs`.
- On-site registration is an event setting, usable while a time-in session is open; it follows the event's approval mode and capacity, and approvals reuse `decide_registrations` (P-12, P-13).
- Residual risk accepted and documented: a live QR relayed to an absent registrant within 60 s.

**D-013 — Station access through anonymous sign-in and pairing.**
*Superseded by D-019 (2026-10-11): the anonymous station sign-in and pairing workflow are removed; the organizer's own session shows the Attendance Display. Kept below for the record.*
- The public station laptop never holds organizer credentials. It signs in anonymously and is bound to one event with a single-use, 5-minute pairing code. The grant expires with the attendance window and is revocable; transfer, cancellation, completion and organizer suspension revoke it.
- Compared with server-mediated access (station cookie + route handlers): that option could not show private profile photos without the service-role key or public avatars, and had no realtime. Anonymous sign-in keeps photos private and realtime working; its risk (anonymous users reaching participant features) is contained by `private.is_permanent_user()` in RPCs, restrictive RLS policies, `handle_new_user()` skipping anonymous users, and tests in every phase.
- The station receives the current and next two QR tokens (never the secret), reads only its event's records (no free-text columns) and display data (photo, name, college), with 10-minute signed photo URLs. Session controls stay on the organizer's own device (P-16).

**D-014 — Certificate eligibility follows the attendance policy.**
- Eligible: event completed, certificates enabled, active template, approved registration, present record with time-in (and time-out when required), no unresolved device flag (P-17), holder not identity-flagged (P-18), no existing certificate. Issuance reports skipped counts by reason; flags are reviewed and resolved (also after completion), then generation is re-run.
- The verify page states that the certificate was issued to "the account holder named …" (P-19), because identity is self-declared.

**D-015 — Privacy measures (Data Privacy Act of 2012).**
- Consent recorded at onboarding (P-06); privacy notice also explains the station display. Controller, contact and retention periods are client decisions (K-06, K-07).
- Minimization: station shows photo, name, college, status only; minimal CSV columns (P-22); organizer access to registrant profiles/photos ends 30 days after completion or cancellation (P-20).
- Retention jobs with `pg_cron` (P-21): device signals purged 30 days after completion; anonymous station users deleted 7 days after grant expiry.
- Deletion requests follow a documented maintainer-assisted procedure, not an RPC or UI (P-10).
- *Updated by D-019: "station display" now means the organizer's Attendance Display; there are no anonymous station users, so their cleanup job is dropped.*

**D-016 — Development and production environments.**
- The existing project `ldhpbfujqnyovovabvcg` (Phase 1 applied, no real users) is the **development** project (P-23, reversed from the first proposal). A new, separate, client-owned **production** project is created before deployment (K-08) and receives only reviewed migrations through `supabase db push`, never tests or AI/MCP write access.
- Reason: this removes the only client blocker for starting implementation and guarantees that production has never been used for testing.
- Phase 1 objects that Revision 2 changes (attendance enum values, `profiles.program`, new profile columns, lookup write policies, anonymous-user guard) are corrected by a new corrective migration on development (PLAN Phase 1b), not by editing applied migrations. No database has been changed by this review.

## Amendment A1 — Event Registration QR Sharing (2026-10-11)

**D-017 — Static registration link and QR, separate from attendance (P-24, P-25, P-26).**
Context: organizers need one link/QR to share an event through Messenger, Facebook and posters. Revision 2 already had an invite code, invite QR and `/e/{code}`, but the code could be regenerated (breaking printed material), sign-up lost the destination at the email-confirmation step, and nothing stopped the attendance scanner from being given an event link.
- **P-24 (approved):** the registration link and QR use the permanent canonical URL `/events/{eventId}`. The QR holds only that URL — no token — so possessing it grants nothing. No new table or column; one shared `lib/qr.ts` helper renders registration, station and certificate QR codes. Share panel: copy link, download PNG/SVG, copy image, device share sheet, invite code.
- **P-25 (approved):** invite codes are fixed at creation and `regenerate_invite_code` is removed. Regeneration gave no real secrecy (any signed-in user with the id link could already open the event) and would have broken printed short links.
- **P-26 (approved, modified from the proposal):** the proposal kept the login wall for event pages. The team chose a **limited public preview** instead, so a poster or chat link shows the event before login. `/events/{id}` renders without a session; signed-out visitors get only the whitelisted fields from `get_public_event_preview` (title, description, category, host college, date/time, venue, public banner, organization name, status label) for **public, non-draft** events. Drafts, unlisted events, unknown and malformed ids all produce the same neutral "Log in to view this event" screen, so nothing leaks. `anon` still has no table access. Explore and all other pages still require login (C4 otherwise unchanged). Link previews (Open Graph) use the same function; pages are `noindex`.
- Register always requires a signed-in permanent account with a complete profile. The original path travels as a validated same-origin `next` through login, sign-up, the email-confirmation link (also across devices) and onboarding; returning never registers automatically.
- Separation from attendance: the registration QR has no token, so `submit_attendance_scan` rejects it, and the in-app scanner shows "This is an event registration code, not an attendance code" for event links.
- Consequence: one additional anon-executable function, covered by SQL tests asserting its exact column set and identical empty results, and listed in the Phase 12 anon-grant audit.

## Phase 1b (2026-10-11)

**D-018 — Corrective migration, test runner, and what remained manual.**
- **Environment check before any change:** the MCP project and `.env.local` both point to `ldhpbfujqnyovovabvcg`; it had 0 auth users, 0 sessions, 0 rows in every public table, 0 storage buckets and objects. The only destructive statements (drop the unused `attendance_status` type, drop the empty `profiles.program` column) therefore removed no data.
- **Migration** `20261011102140_revision2_corrections.sql` (spec §12.6) was first executed as a dry run inside a batch that ended in an exception (verified rolled back), then applied with the MCP `apply_migration` tool. The local file uses the exact remote version. Earlier migrations are unchanged. Implementation details not spelled out in the spec:
  - `private.is_permanent_user()` is `SECURITY INVOKER` (it only reads the JWT) and treats a missing `is_anonymous` claim as permanent; Supabase always sets the claim.
  - `programs.college_id` is not updatable (column grant), so a program never moves to another college under existing profiles. `profiles_program_requires_college` closes the MATCH SIMPLE gap where a NULL college would skip the composite FK.
  - `profiles_college_id_idx` was replaced by `profiles_college_program_idx (college_id, program_id)`, which covers both foreign keys.
  - `accept_privacy_notice` returns `ok`, `invalid_version`, `not_permitted` or `profile_not_found`.
- **Security advisor:** one WARN, `authenticated_security_definer_function_executable` for `public.accept_privacy_notice`. This is the intended RPC pattern (spec §12.5): consent must be set by the database, not by a writable column. Every later RPC will appear in this lint; Phase 12 checks the list against §12.5 instead of treating each as a defect. Performance advisor: only `unused_index` INFO notices (empty database).
- **Test runner:** the Supabase-hosted pgTAP is 1.3.3, which keeps no results table, so the D-006 approach was rebuilt as `scripts/tap-batch.mjs`: each top-level assertion's TAP line is inserted into a temp table, and the batch ends by raising an exception carrying all lines, which rolls everything back (including `create extension pgtap`). Results: `001_profiles` 34/34, `002_revision2_corrections` 32/32. After the runs the database is empty again and `pgtap` is not installed.
- **Shared test helper not extracted:** the MCP runner sends one SQL string and `supabase test db` runs each file separately, so a shared include would break one of them. Test files stay self-contained (PLAN Phase 1b item left open on purpose).
- **Auth settings not applied by tooling:** the Supabase MCP tools available here cannot change Auth configuration, and the Supabase CLI has no access token. The required development values are recorded in `supabase/config.toml` (`enable_confirmations = true`, `otp_expiry = 86400` (*now 3600, D-021*), `enable_anonymous_sign_ins = true`, `enable_manual_linking = false`) and must be set once in the dashboard of the development project. Email templates and redirect URLs are done in Phase 2, with the `/auth/confirm` route they point to.
  *Correction (D-019, 2026-10-11): anonymous sign-ins must stay **off**. `supabase/config.toml` was reverted to `enable_anonymous_sign_ins = false`; the dashboard instruction to turn them on is withdrawn.*
- `lib/database.types.ts` was regenerated with the MCP `generate_typescript_types` tool. Typecheck, lint, unit tests (17/17) and build pass.

## Amendment A2 — Attendance Display Mode (2026-10-11)

**D-019 — The organizer's own session shows the attendance QR; no anonymous station (P-27, P-28, P-29).**
Context: D-013 designed a restricted station login (anonymous sign-in + pairing code) so that a public laptop would never hold organizer credentials. The team decided this is more machinery than the MVP needs: the organizer is at the venue anyway and will run the screen from their own account.
- **P-27:** the organizer opens Organizer Dashboard → My Organized Events → event → Attendance → **Start Attendance**, which opens a time-in session and shows **Attendance Display Mode** at `/organizer/events/{id}/attendance/display`, guarded like the event workspace (owner, active organizer). Left panel: event name, rotating QR, status, countdown, instructions. Right panel: realtime feed (photo, name, college, status, ⚠) and counters. The display has no management controls besides Exit; session controls and corrections stay in the Attendance tab. Data comes from two owner-only RPCs, `get_attendance_qr` (current + 2 tokens) and `get_attendance_feed` (display fields only), plus realtime on `attendance_records` under the owner's RLS. All other QR attendance rules (tokens, windows, scan checks, device flags, time-in/out, corrections, eligibility) are unchanged.
- **Removed:** `attendance_stations`, the pairing and station RPCs, the station RLS and storage policies, the `(station)` routes and station client, the anonymous-user cleanup job, and CAPTCHA on anonymous sign-in. None of these had been built, so no code or migration is affected.
- **P-28:** anonymous sign-ins stay **disabled** in development and production. `supabase/config.toml` is reverted to `enable_anonymous_sign_ins = false`, withdrawing the Phase 1b instruction (D-018). The deployed Phase 1b guard (`private.is_permanent_user()`, restrictive policies on `profiles` and `audit_logs`, `handle_new_user()` skipping anonymous users) stays as cheap defense in depth; removing it would need a migration and gain nothing. RPCs keep the one-line `is_permanent_user()` check; new tables do not need their own restrictive policy while anonymous sign-ins are off, and Phase 12 verifies the setting.
- **P-29 — accepted risk:** the display runs in a fully authenticated organizer session. Fullscreen and a control-free layout are presentation only and do **not** secure it. Anyone at an unattended, unlocked laptop can act as the organizer (manual time-ins, revocations, flag resolution, registration decisions, registrant data and exports, event edits or cancellation). Mitigations: a reminder before entering the display; the organizer stays with the laptop and never shares the password; an external screen faces participants while the laptop stays with the organizer; lock the OS when stepping away; **Sign out of all devices** (`signOut({ scope: 'global' })`, refresh tokens revoked at once, access token valid until expiry, default 1 hour); audit logging for traceability. Re-authentication for sensitive actions, inactivity time-outs and a restricted station login are out of scope for the MVP.
- Consequence: Phase 8 is simpler (no pairing, no anonymous-user policies or tests); the security posture of the attendance screen now depends on organizer behavior, which the thesis documents as a limitation.
- **P-30 — organizer autonomy (clarification, no design change):** admin approval applies only to the organizer application. An active organizer independently creates, drafts, edits, publishes, shares, cancels and completes their own events, manages registrations and attendance, and generates certificates; public published events appear in Explore immediately. The review found no conflicting requirement; the rule is now stated explicitly in SYSTEM_SPEC §5, §6 and §11 rule 21. Admin powers over an organizer's events remain limited to suspending/revoking the organizer and transferring ownership.

**D-020 — Admins may cancel a single published event (P-31, Option B).**
Context: with no per-event approval (P-30), admins had no way to take down one inappropriate, duplicate or unauthorized event short of suspending the whole organizer, which freezes management but leaves published events visible.
- An admin may cancel an individual **published** event with a required reason. Drafts (not visible) and completed events (terminal) cannot be cancelled.
- It reuses `cancel_event`: the RPC accepts the owner as an active organizer **or** an admin, so the effect is identical — status `cancelled`, open attendance sessions closed, registrations and attendance records kept for history, no certificates (they exist only for completed events).
- New column `events.cancelled_by` records who cancelled (organizers cannot read audit logs); the audit entry `event.cancelled` carries `by_admin`. The organizer and registrants see "Cancelled by an administrator" with the reason.
- Admins still cannot edit, unpublish or otherwise manage an organizer's event (P-30). There is no notification system, so the organizer learns of it in the workspace.

## Phase 2 (2026-10-11)

**D-021 — Confirmation and recovery links expire after 1 hour (P-03 changed).**
P-03 was approved in Revision 2 as 24 hours. The team set it to **3600 seconds (1 hour)**, the Supabase default, before Phase 2 started: a shorter window limits the use of a leaked or forwarded link, and the expired-link page already offers a one-click resend. `supabase/config.toml` uses `otp_expiry = 3600`; the development and production dashboards must match. Do not raise it to 24 hours.

**D-022 — Phase 2 implementation notes.**
- **Settings verified, settings not applied:** the public `/auth/v1/settings` endpoint of the development project shows email confirmation on, anonymous sign-ins off and sign-ups open. Templates, Site URL, redirect URLs, OTP expiry, password policy and CAPTCHA cannot be set or read with the tools available here; they are recorded in `supabase/config.toml` and `supabase/templates/` and must be applied in the dashboard (PLAN Phase 2 step 1).
- **Migration** `20261011111054_avatars_storage`: private `avatars` bucket (2 MB; jpeg, png, webp); owner insert into own folder (permanent users only), owner and admin read, owner delete; no update policy (replace = new file + delete old). Dry-run first, then applied to development.
- **Email links** use `token_hash` verified server-side in `/auth/confirm` (Supabase SSR guidance). The confirmation template passes `next={{ .RedirectTo }}`; `emailRedirectTo` is the app origin + the sanitized `next`, so the A1 return path survives the email, including when the link is opened on another device. Supabase only honours redirect URLs on its allow-list, so a spoofed Host header cannot redirect the email elsewhere. `NEXT_PUBLIC_APP_URL` is preferred when set; otherwise the request origin is used (it is not set in `.env.local` yet, C19).
- **Pending email address** for the check-email page is kept in an httpOnly cookie (1 hour), not in the URL.
- **Turnstile** is wired but inactive until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set and CAPTCHA is enabled in Supabase with the matching secret (K-10). Enabling CAPTCHA in Supabase without the site key would block every auth form.
- **Native `<select>`** for college, program and year (reliable with React Hook Form and mobile keyboards); the Base UI select remains available for richer pickers later.
- **Minimal `(app)` layout and `/dashboard`** exist only so Phase 2 has somewhere to land; Phase 3 replaces them.
- **Testing without email:** real emails cannot reach test addresses, and the built-in sender was rate-limited (`over_email_send_rate_limit`) during the session. Temporary users `p2-*@eventhub.test` were seeded in development with known confirmation/recovery token hashes (in `auth.users` and `auth.one_time_tokens`) so the real `/auth/confirm` route and Supabase verification could be exercised. `scripts/phase2-auth-check.mjs` (39 checks) and `scripts/phase2-actions-check.mjs` (24 checks, calling the built Server Actions over HTTP) passed against a production build on port 3100; all test users and files were deleted afterwards. Supabase returns `otp_expired` for expired, used and invalid tokens alike, so the 1-hour expiry itself was not proven by these tests.
- **Not verified:** actual email delivery, existing-address sign-up behaviour, and visual/responsive checks in a browser (the Chrome automation extension was not connected).

## Phase 3 (2026-10-11)

**D-023 — Phase 3 implementation and validation checkpoint.**
- Confirmed MCP connectivity to development `ldhpbfujqnyovovabvcg` before coding and applying SQL. Production remains untouched.
- Authenticated shell: route-based Participant, Organizer and Admin navigation, permitted-dashboard switcher, mobile Sheet and participant bottom navigation, account menu, active links and skip link. Session and pathname reads stay under Suspense. Attendance Display Mode has a fullscreen shell variant; its data and controls remain Phase 8 work.
- Each placeholder checks the DAL; admin and organizer layouts also check it. Organizer layouts allow suspended/revoked users to read, with a read-only banner. Admins without student profiles can use admin routes and land on `/admin`. Participant actions still require a complete profile.
- The proxy checks role routes before streaming, yielding actual HTTP 404 responses for non-admins (including Action POSTs), while DAL/RLS remain the authorization boundary. Guest-only auth pages and the sign-in action choose `/admin` for an incomplete admin. The `/dashboard` entry also handles that default for confirmation links.
- Migration `20261011114808_phase3_lookup_management.sql`: permanent-user write policies, an admin-checked `save_lookup` RPC with SQL validation and typed result codes, and audit triggers on all three lookup tables. Triggers audit direct permitted table writes as well as RPC writes, atomically. Numeric lookup IDs and before/after values live in audit metadata because `audit_logs.entity_id` is a UUID. No deletion; program college is immutable.
- Lookup UI supports add, rename/edit, activate/deactivate, program filtering by college, and category slug/order. Onboarding omits inactive selections; profiles keep their existing inactive college/program. No service-role client or authorization bypass is used.
- Supabase SSR Auth background initialization read the clock during speculative Next 16 prerendering in live tests. `createClient()` now waits for `connection()` before instantiating the library. Rebuilt live checks produce no prerender warnings.
- Generated database types refreshed. Advisors: expected authenticated SECURITY DEFINER warnings for the two intentional caller-checked RPCs; only unused-index INFO notices for performance. See [SECURITY DEFINER notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Verification: typecheck, lint, production build; Vitest 68/68; pgTAP suites 001–004, 105/105 through MCP using the existing rollback runner; production-build HTTP/Server Action checks 64/64. Both temporary admins, participant, active/suspended/revoked organizers and an incomplete participant were exercised. All seven temporary identities, live test lookups and their audit rows were removed afterwards.
- README documents identity-verified maintainer provisioning with `admin.granted`. Permanent development admins remain pending the team's verified identities; test identities are not retained as real administrators.
- Browser visual checks at 360/768/1280 and keyboard interaction could not be performed: no browser automation tools or installed Playwright browser are available. Phase 2 SMTP/templates/settings limitations remain (D-022). Placeholder routes do not implement Phase 4 or later business behavior.

**D-024 — Condensed university thesis MVP (approved 2026-10-11).** Remaining work uses three stages: organizer/event/registration workflows; QR attendance and live display; certificates/reports/release. Completed Phases 1b–3 stay intact. Bulk workflows, advanced management/editor/reporting UI, additional sharing formats and broad polish are deferred. Essential authorization, RLS, privacy and duplicate prevention remain. Stage 1 is authorized; Attendance and Certificates require another approval.

**D-025 — Stage 1 implementation (2026-10-11).** Organizer applications use private immutable proofs and admin-reviewed approval; active organizers publish their own events without event approval. Content and registration writes use caller-checked RPCs with row locking for capacity and idempotent registration. Static QR encodes only `/events/{id}`. Public preview exposes the D-017 whitelist; malformed, unknown, draft and unlisted IDs receive a neutral guest view. Individual manual registration decisions replace bulk UI. Profile/photo access expires 30 days after completion/cancellation; student ID/photo locks extend existing profiles without rewriting onboarding. See [stage checkpoint](./MVP_STAGE1_CHECKPOINT.md) for validation and remaining manual items.

## Final completion phase (2026-10-12/13)

**D-026 — Release-readiness audit and fixes.**
- **Password reset root cause.** Auth logs showed every failing click presented a superseded or used token (`One-time token not found`); before `1bc9efb` the page rendered that as the generic "missing, expired, or already used" message. The most recent real reset (2026-10-12 09:02Z) completed end to end. The hosted project still sends default PKCE templates, so a reset link opened in another browser lacked its code verifier and was misreported as expired. It now says to open the link in the requesting browser. Deploying the branded token-hash templates removes the browser dependency; that is a dashboard step (CLI not logged in; no MCP Auth-config tool).
- **Admin account.** `lestertan110@gmail.com` is confirmed, active and already `is_admin` with an `admin.granted` audit row (2026-10-11 16:43Z, maintainer-verified). Not re-granted; password untouched. Only one admin exists; D-009 requires two.
- **Admin Users.** The navigation linked to a "Coming soon" stub. Replaced with the spec §5.5 read-only search plus account summary under existing admin RLS. Search terms are reduced to name/email characters so PostgREST filter syntax cannot be injected. Dispute resolution, flag clearing and ownership transfer remain unimplemented (no RPCs exist); documented as scope gaps.
- **Migration history.** Renamed the local Phase 3 file to the recorded version `20261011114808` (SQL identical, 87/87 lines; the remote copy only adds a trailing CR line), so a fresh project replays migrations in development order.
- **Security headers** in `next.config.ts`; `SAMEORIGIN` because the certificate page frames its own PDF; `/auth/*` and `/reset-password` keep `no-referrer` (verified the global rule had overridden the route header before the fix).
- **Accessibility.** Auth pages lacked an `h1`; ten app pages lacked titles.
- **Test harnesses.** Phase 3 placeholder assertions and Phase 2 recovery assertions predated later work and were updated to current behavior. Phase 2 no longer sends real sign-up/reset email to undeliverable addresses, since bounces risk sender restrictions. Phase 2 fixtures are now saved files.
- **Secrets.** No secret appears in Git history or the client bundle. Local `.env.local` contains unused `SUPABASE_SECRET_KEY` (holding the publishable key) and `SUPABASE_SERVICE_ROLE_KEY` lines that no code reads; recommended for removal.
- Results and remaining manual items: [FINAL_QA.md](./FINAL_QA.md); deployment: [DEPLOYMENT.md](./DEPLOYMENT.md).
