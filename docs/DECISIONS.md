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
- Supabase "Confirm email" is on. No session before confirmation. Flows: check-email page with resend, confirmation success (including a link opened on another device), expired link with resend, "email not confirmed" at login with resend, password recovery. Links valid 24 h (P-03). CAPTCHA (Turnstile, P-01) and password policy (P-02); other sessions signed out after a reset (P-05).
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
