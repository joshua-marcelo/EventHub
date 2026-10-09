# EventHub — Implementation Plan

Companion to [SYSTEM_SPEC.md](./SYSTEM_SPEC.md). The spec defines *what*; this plan defines *in what order* and *how we know each step is done*. Section references like "§9.3" point to the spec.

Status: DRAFT. **No implementation starts until the plan is approved and the [CONFIRM] items in spec §20 are answered** (or explicitly accepted as recommended).

---

## Ground Rules for Every Phase

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (Next 16.4: `proxy.ts`, async request APIs, `cacheComponents` → session reads inside `<Suspense>`).
- shadcn components are **Base UI**-based (`base-nova`); use the `render` prop pattern, not Radix `asChild`.
- Never hardcode secrets; never edit `.env.local`; document new variables in `.env.example`.
- Every schema change is a migration file in `supabase/migrations/`, applied first to the dev database, then to the client project only after review.
- After every migration: regenerate `lib/database.types.ts`, run Supabase security + performance advisors, and fix findings before continuing.
- Every RPC: `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified names, `auth.uid()` check first, typed result codes instead of raw exceptions for expected failures, `GRANT EXECUTE` only to the intended role (`REVOKE ... FROM public, anon` by default).
- Server Actions: Zod-validate input → call RPC with the user-scoped client → map result code to a typed `ActionResult` → refresh UI. No business rule exists only in TypeScript.
- Keep UI functional and clean during feature phases; the Impeccable polish pass is Phase 12.
- One phase = one or more small PR-sized commits. Do not mix phases.

---

## Phase Dependency Graph

```
P0 Foundation
 └─ P1 Core schema (profiles, lookups, helpers) + RLS
     └─ P2 Auth + profile
         └─ P3 App shell + navigation + guards
             ├─ P4 Organizer applications + admin
             │   └─ P5 Events (organizer CRUD + lifecycle)
             │       └─ P6 Discovery + invites + registration (participant)
             │           └─ P7 Registration management (organizer, bulk)
             │               └─ P8 Attendance (sessions, dynamic QR, realtime station)
             │                   └─ P9 Certificates
             │                       └─ P10 Reports + exports
             └─────────────────────────── P11 Dashboards (needs P4–P10 data)
P12 QA, security, polish, deployment (after all)
```

Milestones:
- **M1 — Accounts** (end of P3): users sign up, complete profile, see role-aware shell.
- **M2 — Organizers** (end of P5): admin approves organizers; organizers create and publish events.
- **M3 — Registration** (end of P7): full registration loop incl. manual approval and bulk actions.
- **M4 — Attendance** (end of P8): live check-in demo works end-to-end on a phone + laptop.
- **M5 — Certificates & Reports** (end of P10): thesis-complete feature set.
- **M6 — Release candidate** (end of P12): tested, audited, polished, deployed to Vercel.

---

## Phase 0 — Foundation and Decisions

Goal: answer open questions and prepare tooling; no features.

**Status: ✅ Complete (2026-10-10).** Decisions recorded in [DECISIONS.md](./DECISIONS.md) D-001 – D-005.

- [x] Get answers for spec §20 items C1–C20 (or written acceptance of recommendations). Update SYSTEM_SPEC.md accordingly. — Recommendations accepted; C1/C2/C3 still need client data (D-001).
- [x] Resolve git branch (`master` vs `main`) and whether `.agent/`, `.agents/`, `.claude/`, `.codex/`, `.gemini/`, `.pixel-agents/`, `.impeccable/` are committed or added to `.gitignore`. — Local `master`, no remote; tool folders git-ignored (D-002).
- [x] Commit the current uncommitted baseline (deps, shadcn components, `globals.css`) as its own commit.
- [x] Decide dev database (separate Supabase dev project recommended, or local Supabase via Docker Desktop). — No Docker; empty client project used with additive migrations + rolled-back tests (D-004).
- [x] Install dev tooling:
  - [x] `supabase` CLI as devDependency; `supabase init` → `supabase/config.toml`, `supabase/migrations/`, `supabase/seed.sql`.
  - [x] `server-only`, `@date-fns/tz`.
  - [x] `vitest` (+ `@vitejs/plugin-react` only if component tests are added).
  - [x] Optional: `@playwright/test` for E2E (decide in P0). — Deferred to Phase 12 (D-003).
- [x] Add npm scripts: `db:types` (generate types to `lib/database.types.ts`), `db:push`, `test`, `test:db`, `typecheck` (`tsc --noEmit`).
- [x] Add `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`. Ask client to add `NEXT_PUBLIC_APP_URL` to their env.
- [x] Add missing shadcn components: `sidebar`, `sonner`, `radio-group`, `field` (or form helpers), `scroll-area`, `breadcrumb`, `toggle-group` (all via shadcn CLI so they match `base-nova`).
- [x] Replace root `metadata` (title template `%s · EventHub`, description), set `lang="en"`.
- [x] Create `lib/datetime.ts` (Asia/Manila formatting/combining helpers) with unit tests.

**Verification**
- [x] `npm run build`, `npm run lint`, `npm run typecheck` pass.
- [x] `npm test` runs (datetime tests pass, incl. a UTC-server case formatting to Manila time).
- [ ] `supabase` CLI can connect to the dev database (`supabase migration list`). — **Blocked:** needs `supabase login` with the client's access token; MCP integration used instead (D-004).
- [x] No secrets in git (`git grep -i "service_role\|sb_secret"` returns nothing).

---

## Phase 1 — Core Schema, Helpers, RLS Foundation

Goal: identity tables and authorization primitives everything else depends on.

### Migration order (files are applied in this order)

1. `0001_extensions_and_enums.sql`
   - [ ] Ensure `pgcrypto` (in `extensions` schema) is available.
   - [ ] Create all enums from spec §12.1 (created up front so later migrations don't alter types).
   - [ ] `set_updated_at()` trigger function.
2. `0002_lookups.sql`
   - [ ] `colleges`, `event_categories` + RLS (select for anon/authenticated) + seed rows (from C3).
3. `0003_profiles.sql`
   - [ ] `profiles` table per §12.2 incl. generated `is_complete`, constraints, indexes.
   - [ ] `handle_new_user()` trigger on `auth.users` (copies id, email, name metadata if present).
   - [ ] Email-sync trigger on `auth.users` update of email.
   - [ ] `REVOKE UPDATE ON profiles FROM authenticated; GRANT UPDATE (first_name, middle_name, last_name, suffix, student_id, college_id, program, year_level, avatar_path) ON profiles TO authenticated;`
   - [ ] Trigger blocking `student_id` change once certificates exist (add the check body in P9; create stub now or add trigger in P9 — choose P9 to avoid forward references).
4. `0004_auth_helpers.sql`
   - [ ] `is_admin()`, `is_active_organizer()` (STABLE, SECURITY DEFINER, `search_path=''`).
   - [ ] `profile_full_name(profiles)`.
5. `0005_profiles_rls.sql`
   - [ ] Policies: select own; select all if admin; update own. (Organizer visibility via `can_view_profile` added in P6 once registrations exist.)
6. `0006_audit_logs.sql`
   - [ ] `audit_logs` table, RLS (admin select), internal `log_audit(action, entity_type, entity_id, metadata)` helper (not granted to clients).

### Tests (`supabase/tests/` SQL, run via `npm run test:db`)
- [ ] Test harness: helper to create test users in `auth.users` and impersonate (`set local role authenticated; set local request.jwt.claims`).
- [ ] New auth user → profile row created with email.
- [ ] User can read/update own profile; cannot read another's; cannot update `is_admin` or `organizer_status` (permission denied).
- [ ] Admin can read all profiles.
- [ ] `is_complete` flips true only when all required fields set.

**Verification**
- [ ] All SQL tests pass.
- [ ] Supabase security advisor: no "RLS disabled", no "function search_path mutable" warnings.
- [ ] Types generated and committed.

---

## Phase 2 — Authentication and Profile

Goal: sign up, confirm, log in/out, reset password, complete profile with photo.

### Auth setup order
1. [ ] Supabase dashboard config (client performs or approves): Site URL, redirect URLs (localhost + Vercel preview + prod), email confirmation ON, email templates using `token_hash` confirm link to `/auth/confirm`. Domain restriction per C1 (Auth hook or sign-up validation).
2. [ ] `lib/supabase/server.ts` (`createServerClient` with async `cookies()`), `lib/supabase/client.ts` (`createBrowserClient`), `lib/supabase/proxy.ts` (session refresh helper) — follow current `@supabase/ssr` docs.
3. [ ] `proxy.ts` at project root: refresh session; redirect unauthenticated requests for `(app)`/`(station)` paths to `/login?next=…`; matcher excludes static assets.
4. [ ] `lib/auth/dal.ts` (`server-only`): `getCurrentUser()` (uses `getClaims()`/`getUser()`, returns narrow `{ id, email, profile, isAdmin, organizerStatus }`), `requireUser()`, `requireAdmin()`, `requireOrganizer({ allowInactive })`. Use the `cacheComponents` auth pattern (session read inside Suspense; `use cache: private` only if measured useful).
5. [ ] Route handlers: `/auth/confirm` (verifyOtp with token_hash), `/auth/callback` (exchangeCodeForSession), `/auth/signout` (POST).
6. [ ] Pages in `(auth)`: login, signup, forgot-password, reset-password. React Hook Form + Zod; field errors; pending states; `next` param preserved (validated as same-origin relative path).
7. [ ] Storage bucket `avatars` (private, 2 MB, jpeg/png/webp) + storage RLS (owner folder write; owner read; admin read).
8. [ ] Profile page `/profile`: personal fields, college select, program, year level, avatar upload (client-side resize to 512 px, then upload, then update `avatar_path`, then delete old file). Banner "Complete your profile to register for events" when incomplete.
9. [ ] `lib/validation/profile.ts` Zod schema shared by form and Server Action.

**Verification**
- [ ] Manual: sign up → email → confirm → login → profile completion → logout → login again.
- [ ] Forgot/reset password works end-to-end.
- [ ] Visiting `/dashboard` logged-out redirects to `/login?next=/dashboard` and returns after login.
- [ ] Open-redirect check: `?next=https://evil.com` is ignored.
- [ ] Avatar of user A not readable by user B (signed URL request denied).
- [ ] Build passes with `cacheComponents` (no "cookies outside Suspense" errors).

---

## Phase 3 — App Shell, Navigation, Guards

Goal: one authenticated shell with role-aware navigation. **Milestone M1.**

- [ ] `(app)/layout.tsx`: static shell (sidebar frame, top bar) with session-dependent parts (nav sections, user menu) streamed in `<Suspense>`.
- [ ] Sidebar sections per spec §16.1 (Participant / Organizer / Admin), active-route highlighting.
- [ ] Mobile: bottom nav (Home, Explore, Scan, My Events, Certificates) + Sheet menu for the rest.
- [ ] `organizer/layout.tsx` guard via `requireOrganizer({ allowInactive: true })`; inactive banner "Your organizer access is suspended — read-only".
- [ ] `admin/layout.tsx` guard via `requireAdmin()` → `notFound()` for non-admins (don't reveal admin routes).
- [ ] `(station)` route group layout (full-screen, no sidebar) + guard.
- [ ] Placeholder pages for every route in spec §16.1 with correct titles and empty states.
- [ ] Shared components: `StatusBadge` (single mapping for all enums), `EmptyState`, `PageHeader`, `ConfirmDialog`, `DataTable` basics (compact table + pagination).
- [ ] Global `error.tsx`, `not-found.tsx`, `loading` skeletons for main segments.
- [ ] Seed one admin account in dev via SQL (`update profiles set is_admin = true where email = …`), documented in README (not in migrations).

**Verification**
- [ ] Participant sees only participant nav; admin sees admin nav; manually setting `organizer_status='active'` in dev shows organizer nav.
- [ ] Non-admin hitting `/admin` gets 404; non-organizer hitting `/organizer` is redirected to `/become-organizer`.
- [ ] Layout works at 360 px, 768 px, 1280 px widths; keyboard navigation through sidebar works.

---

## Phase 4 — Organizer Applications and Admin Management

Goal: participants apply; admins approve/reject/suspend/revoke. Depends on P3.

### Database (`0007_organizer_applications.sql`)
- [ ] `organizer_applications` table, partial unique pending index, checks, indexes.
- [ ] RLS: select own; select all for admin. No direct insert/update grants.
- [ ] RPCs: `submit_organizer_application`, `withdraw_organizer_application`, `review_organizer_application` (atomic approve: application + profile + audit), `set_organizer_status` (suspend/reinstate/revoke + reason + audit; on suspend/revoke close any open attendance sessions — add that body in P8 or write it defensively now).
- [ ] `get_admin_overview()` (counts; extend in later phases as tables appear).
- [ ] Storage bucket `organizer-requirements` (private, 5 MB, pdf/jpeg/png) + policies (owner insert into own folder; owner + admin select; no update/delete).

### UI
- [ ] `/become-organizer`: eligibility checks (profile complete, status), form (spec §4.1) with file uploads, data-privacy consent, status view (pending/rejected with notes/approved/suspended/revoked), withdraw, reapply.
- [ ] `/admin/applications`: status tabs, compact table, oldest-first.
- [ ] `/admin/applications/[id]`: applicant info, fields, document links (signed URL, 60 s, generated on click), history, Approve/Reject dialogs.
- [ ] `/admin/organizers`: table + Suspend/Reinstate/Revoke dialogs with reason.
- [ ] `/admin` overview tiles (users, active organizers, pending applications).

### Tests
- [ ] SQL: second pending application rejected; incomplete profile cannot apply; non-admin cannot review; admin cannot review own; reject without notes fails; approve sets `organizer_status='active'`; double review returns `already_reviewed`; reinstate only from `suspended`; revoked user can apply again.
- [ ] Storage: user B cannot read user A's requirement files; admin can.

**Verification**
- [ ] Manual E2E: participant applies with files → admin reviews documents → approves → participant sees organizer nav after refresh.
- [ ] Rejection notes appear to participant; reapply works.
- [ ] Audit log rows exist for approve/reject/suspend/revoke.

---

## Phase 5 — Events: Organizer CRUD and Lifecycle

Goal: organizers create, edit, publish, cancel, complete, delete drafts. **Milestone M2.** Depends on P4.

### Database (`0008_events.sql`)
- [ ] `events` table per §12.2 (incl. publish-completeness CHECK, generated `search`, invite code default via `generate_invite_code()` with collision retry).
- [ ] Column grants: insert/update content columns only.
- [ ] `events_guard` trigger: terminal-state lock, capacity ≥ approved count (count query becomes meaningful after P6; write it now), date sanity beyond CHECKs.
- [ ] `event_phase(events)` SQL function + matching `lib/events/phase.ts` with unit tests on boundary times.
- [ ] RLS: select non-draft for authenticated; select own; admin select; insert own as active organizer with `status='draft'`; update own as active organizer; delete own drafts.
- [ ] RPCs: `publish_event` (re-validates required fields + future start), `cancel_event` (reason), `complete_event` (only after `starts_at`; closes session — body extended in P8), `regenerate_invite_code`.
- [ ] Storage bucket `event-banners` (public, 5 MB) + write policies via `owns_event()`.

### UI
- [ ] `lib/validation/event.ts`: Zod schema with draft vs publish refinements (spec §7.1), shared by form and action.
- [ ] `/organizer/events/new` and `/organizer/events/[id]/settings`: form sections (Basics, Schedule, Registration, Certificates), Manila-time date/time pickers, banner upload with preview, capacity "Unlimited" toggle, approval mode radio, visibility radio, save draft / publish.
- [ ] Event workspace layout `/organizer/events/[id]/layout.tsx`: header (title, status badge, phase), tabs (Overview, Registrations, Attendance, Certificates, Reports, Settings); 404 if not owner.
- [ ] Overview tab: key facts, share panel (invite code, copy link, invite QR PNG download via `qrcode`, regenerate code with warning).
- [ ] Settings tab: edit form, Cancel event (dialog with reason), Delete draft, Mark as completed (visible when phase ≥ ongoing).
- [ ] `/organizer/events`: compact table with status/phase filters.

### Tests
- [ ] SQL: participant cannot insert event; suspended organizer cannot insert/update; organizer A cannot update organizer B's event; cannot set `status` directly; cannot publish incomplete event; cannot edit cancelled/completed; cannot delete published.
- [ ] Unit: event Zod schema (deadline after start rejected, end before start rejected, etc.); phase helper boundaries.

**Verification**
- [ ] Manual: create draft → publish → appears for participants (after P6) → edit → cancel; separate event → complete after start time (use dev data with past times).
- [ ] Times entered as 9:00 AM Manila display as 9:00 AM on a UTC server build (`TZ=UTC npm run build && npm start`).

---

## Phase 6 — Discovery, Invites, Participant Registration

Goal: participants find events and register. Depends on P5.

### Database (`0009_registrations.sql`)
- [ ] `event_registrations` table, unique `(event_id, user_id)`, unique `(id, event_id, user_id)` (for attendance composite FK), indexes.
- [ ] RLS: select own; select for event owner. No direct writes.
- [ ] `can_view_profile(profile_id)` helper + profiles select policy for event owners; avatars storage select policy using it.
- [ ] RPCs: `register_for_event` (lock event row `FOR UPDATE`, all checks in spec §8 rule 2, capacity, idempotent existing-row handling, own-event refusal), `cancel_registration`, `get_event_by_invite_code`.
- [ ] Explore query: either a SQL function `search_events(tab, q, category_ids, college_id, from, to, page, page_size)` returning rows + total, or PostgREST queries built server-side. **Recommendation:** SQL function (keeps phase logic in one place).

### UI
- [ ] `/events` Explore: tabs (Upcoming, Open for registration, My college, Past), search (debounced, URL-driven), filters, 12/page pagination, cards, skeletons, empty/no-result states.
- [ ] `/events/[id]` details with the action button state machine (spec §18), capacity indicator, register/cancel with confirm, result toasts mapped from RPC codes.
- [ ] `/events/join`: invite code input (case-insensitive, strips spaces) → redirect.
- [ ] `/e/[code]` route handler → redirect to `/events/[id]` (login first if needed, preserving `next`).
- [ ] `/my-events`: tabs Upcoming / Pending / Past / Cancelled & rejected; registration + attendance status columns.

### Tests
- [ ] SQL: duplicate registration returns existing; deadline passed → `registration_closed`; incomplete profile refused; own event refused; cancelled event refused; unlisted not returned by Explore but readable by id.
- [ ] **Concurrency test**: capacity 1, two sessions call `register_for_event` concurrently (two psql connections or a script with two clients) → exactly one approved.
- [ ] Unit: invite code normalizer.

**Verification**
- [ ] Manual on a phone (real device or devtools 360 px): browse, filter, open invite QR with phone camera → event page → register.
- [ ] Explore returns correct results for each tab with seeded data spanning past/now/future.

---

## Phase 7 — Registration Management (Organizer)

Goal: manual approval with safe bulk actions. **Milestone M3.** Depends on P6.

### Database (`0010_registration_decisions.sql`)
- [ ] RPCs: `decide_registrations(event_id, ids[], decision, reason)` (≤ 500 ids, only pending rows of that event, oldest-first under capacity, returns counts), `approve_all_pending(event_id)`, approved→rejected path (blocked if attendance exists).
- [ ] Extend `events_guard` capacity check test now that registrations exist.

### UI
- [ ] Registrations tab: status tabs with counts, search (name / student ID), 50/page table (photo thumb, name, student ID, college, program/year, registered at, status, decided by/at).
- [ ] Checkbox selection: per row + "select all on this page"; **selection resets on filter/search/page change**; selection count bar.
- [ ] Bulk actions: Approve selected, Reject selected (optional reason), Approve all pending (dialog shows server count + remaining capacity).
- [ ] Result summary toast from returned counts.
- [ ] Capacity bar "57 / 100 approved".
- [ ] Participant side: pending/rejected/approved states reflect immediately on My Events.

### Tests
- [ ] SQL: decide ids from another event are ignored (`skipped_not_pending`); capacity 10 with 15 pending → approve all approves 10 oldest; non-owner cannot call; suspended owner cannot call.
- [ ] UI test (Vitest component test or Playwright): selection clears on filter change.

**Verification**
- [ ] Manual with 120 seeded registrants: bulk approve page 1, filter, approve all pending, reject selected with reason; numbers in tabs and reports match.

---

## Phase 8 — Dynamic QR Attendance with Realtime Verification

Goal: the core check-in feature. **Milestone M4.** Depends on P7.

### Implementation order
1. **Schema** (`0011_attendance.sql`)
   - [ ] `attendance_sessions` (+ partial unique open index), `attendance_session_secrets` (revoke all from anon/authenticated, RLS on, no policies), `attendance_records` (unique `registration_id`, composite FK to registrations, CHECKs, indexes).
   - [ ] RLS: sessions select for owner and for approved registrants of the event; records select own + owner.
   - [ ] `alter publication supabase_realtime add table attendance_records;`
2. **Session RPCs**
   - [ ] `open_attendance_session` (owner, active organizer, event published, time window C8, no open session; creates secret with `gen_random_bytes(32)`).
   - [ ] `close_attendance_session`.
   - [ ] Extend `complete_event`, `cancel_event`, `set_organizer_status` to close open sessions.
3. **Token RPCs**
   - [ ] `get_attendance_qr(session_id)` → `{ token, window_ends_at }` (HMAC via `extensions.hmac`, base64url encoding helper).
   - [ ] `submit_attendance_scan(token, expected_event_id)` → result code + context (event title, verified_at, record id) following spec §9.3 order exactly.
4. **Verification RPCs**
   - [ ] `confirm_attendance` (conditional update; `already_confirmed` with verifier name/time), `dismiss_attendance`, `manual_check_in`, `revoke_attendance` (+ audit).
5. **SQL tests** (before any UI)
   - [ ] Token from window w valid at w and w+1, invalid at w+2 (`expired_qr`) — make window length/now injectable in an internal function for testing.
   - [ ] Tampered token → `invalid_qr`; token of closed session → `attendance_closed`.
   - [ ] Not registered / pending / rejected / cancelled → correct codes; wrong event with `expected_event_id`.
   - [ ] Duplicate scan → no second row; dismissed → rescan resets to pending.
   - [ ] Confirm twice → second returns `already_confirmed`; non-owner cannot confirm; participant cannot read secrets table (permission denied).
   - [ ] Two open sessions for one event impossible.
6. **Organizer Attendance tab** (`/organizer/events/[id]/attendance`)
   - [ ] States: not started (countdown to `starts_at`), open, closed, completed.
   - [ ] Open/Close session buttons with confirm; "Launch check-in station" (opens `/station/[id]` in new tab).
   - [ ] Attendance table: approved registrants with attendance status (present / pending / not checked in), filters, manual check-in, revoke.
7. **Check-in Station** (`/station/[eventId]`)
   - [ ] Left panel: QR rendered with `qrcode` to canvas/SVG from `{APP_URL}/scan?t=…`; refetch at `window_ends_at`; countdown ring; counters; close button.
   - [ ] Right panel: waiting state → focus card (slide/fade ≤ 200 ms, respects `prefers-reduced-motion`) with photo, name, student ID, college/program/year, registration badge, scan time → Confirm (Enter) / Not this person (Esc).
   - [ ] Queue list of other pending check-ins (FIFO; click to focus).
   - [ ] Realtime subscription (`postgres_changes`, filter `event_id=eq.{id}`), status indicator, fallback 3 s polling on channel error, full queue refetch on (re)subscribe, cleanup on unmount.
   - [ ] Handle session closed from another tab (stop QR, show closed state).
   - [ ] Laptop (1366×768) and tablet (1024×768 landscape) layouts; QR at least 320 px.
8. **Participant scanner** (`/scan`)
   - [ ] `?t=` present → submit immediately (after login redirect if needed).
   - [ ] Camera scanner with `@zxing/browser` (`BrowserQRCodeReader`, back camera preferred, stop tracks on unmount/route change); parse URL or raw token; debounce repeated decodes.
   - [ ] Permission denied / no camera / insecure context (HTTPS required) states with guidance.
   - [ ] Result screens per code; waiting screen subscribes to own record (realtime + 4 s polling fallback) → "Attendance confirmed ✓ 9:14 AM".
   - [ ] Dashboard/My Events "Attendance open — Scan now" CTA for approved events with an open session.

### Verification
- [ ] All SQL tests pass.
- [ ] **Live demo test** (two physical devices): laptop station + phone participant on HTTPS (Vercel preview or `next dev --experimental-https`): scan → card appears on station < 2 s → confirm → phone shows confirmed.
- [ ] Wait 61 s with a screenshot of an old QR → `expired_qr`.
- [ ] Turn off Wi-Fi on station for 10 s → indicator shows reconnecting/polling → pending scans made meanwhile appear after reconnect.
- [ ] Two station tabs: confirming in one removes the card in the other with "already confirmed".
- [ ] 20 seeded scans in quick succession (script calling the RPC as 20 test users) → queue shows all 20, no duplicates.
- [ ] Manual check-in and revoke work and are audit-logged.

---

## Phase 9 — Certificates

Goal: template upload, constrained editor, preview, issuance, download, verification. Depends on P8.

### Implementation order
1. **Schema** (`0012_certificates.sql`)
   - [ ] `certificate_templates` (versioning, partial unique active, immutability trigger), `certificates` (unique registration, number, verification code), `certificate_number_seq`.
   - [ ] Profiles trigger: block `student_id` change once the user holds a certificate.
   - [ ] RLS: templates select owner; certificates select own (non-revoked) + owner.
   - [ ] Storage bucket `certificate-templates` (private, 10 MB, png/jpeg) + policies (owner insert; owner select; certificate holders select).
2. **RPCs**
   - [ ] `save_certificate_template` (new version if current is referenced, else update active), `issue_certificates` (eligibility per §10.3, single transaction, `ON CONFLICT DO NOTHING`, returns issued/skipped counts, audit), `revoke_certificate`, `refresh_certificate_name`, `apply_template_to_issued`, `verify_certificate` (grant to anon), `get_certificate_eligibility(event_id)` (counts for UI).
3. **Renderer** `lib/certificates/render.ts` (isomorphic, no Node-only APIs)
   - [ ] Input: background image bytes, page size, layout JSON, data (name, title, date, number, verify URL, signatory). Output: PDF bytes.
   - [ ] Coordinate conversion (top-left fractions → pdf-lib bottom-left points), alignment, auto-shrink name to max width, color parsing, QR via `qrcode.toDataURL` → `embedPng`.
   - [ ] Zod schema for layout JSON (`lib/validation/certificate-layout.ts`).
   - [ ] Unit tests: coordinate math, alignment, shrink-to-fit, "ñ"/accented names render without throwing, deterministic output for same input.
4. **Organizer Certificates tab**
   - [ ] States per spec §18 (disabled → enable toggle; not completed → locked explanation still allowing template setup).
   - [ ] Upload background (reads natural size, maps to A4/Letter landscape/portrait points).
   - [ ] Constrained editor: image at fit-width, draggable field chips (pointer events, keyboard arrow nudge), side panel per field (font, size, alignment, color, enabled), signatory text, QR size; snapping to center line.
   - [ ] Preview button → renders PDF in browser with sample data (or a chosen eligible participant) in an iframe/object.
   - [ ] Save → `save_certificate_template`.
   - [ ] Eligibility summary "N eligible · M issued"; **Generate certificates** with confirm; result summary; issued table (number, name, issued at, status, actions: view, revoke, refresh name); outdated-template banner + apply action.
5. **Delivery**
   - [ ] Route handler `/certificates/[id]/pdf` (Node runtime): `requireUser`, load certificate via RLS (owner or event owner), refuse revoked for participants, download template via user-scoped storage client, render, respond `application/pdf` with `inline` or `attachment` (`?download=1`) and `Cache-Control: private, no-store`.
   - [ ] `/certificates` list + `/certificates/[id]` preview page with Download and Copy verification link.
   - [ ] Public `/verify` form and `/verify/[code]` result page (no auth; `verify_certificate`); `noindex` meta.

### Tests
- [ ] SQL: not completed → nothing issued; absent/dismissed/pending → not eligible; rerun issues only new ones; numbers unique and sequential; referenced template update blocked; participant cannot read another's certificate; anon `verify_certificate` returns only whitelisted fields; revoked shows revoked.
- [ ] Storage: participant without certificate cannot read template; holder can.

### Verification
- [ ] Manual: design a Canva PNG → upload → place fields → preview matches downloaded PDF pixel-for-pixel layout.
- [ ] Complete event with 30 present / 10 absent → generate → 30 certificates; retry → 0 new.
- [ ] Scan certificate QR with a phone → public verify page shows Valid; after revoke → Revoked.
- [ ] Change profile name → certificate unchanged; refresh name → updated, same number.
- [ ] Download time for one certificate < 2 s on Vercel preview.

---

## Phase 10 — Reports and Exports

Goal: organizer reports with CSV + printable view. **Milestone M5.** Depends on P9.

- [ ] `get_event_report(event_id)` RPC: total registrations, pending, approved, rejected, cancelled, present, not checked in (approved − present, only meaningful after completion), attendance % (present / approved), certificates issued, revoked. Owner-only (suspended owner allowed, read-only).
- [ ] Reports tab: metric tiles, breakdown of approved vs present by college (one small table; no charts), attendance list.
- [ ] CSV route handler `reports/export/route.ts?type=registrations|attendance|certificates`: authorize, stream CSV with UTF-8 BOM (Excel-friendly), Manila timestamps, safe filename, CSV-injection escaping (prefix `'` for cells starting with `= + - @`).
- [ ] Printable report page (`?print=1` or print stylesheet): header with event info, metrics, attendance list; "Print / Save as PDF" button.
- [ ] `/organizer/reports`: cross-event table (event, date, status, approved, present, attendance %, certificates) with CSV export.

### Tests / Verification
- [ ] Report numbers equal direct SQL counts on seeded data (SQL test).
- [ ] CSV opens correctly in Excel and Google Sheets, including names with "ñ".
- [ ] Non-owner request to export route → 404.
- [ ] Printed PDF fits A4 portrait without clipped columns.

---

## Phase 11 — Dashboards

Goal: role dashboards using data from earlier phases. Depends on P4–P10.

- [ ] Participant `/dashboard`: next event card, "Attendance open — Scan now", pending registrations, recent certificates, incomplete-profile prompt.
- [ ] Organizer `/organizer`: upcoming events with pending counts, attendance open indicators, "Awaiting completion" list, "Certificates ready to generate" list.
- [ ] Admin `/admin`: extend `get_admin_overview()` with events by status and events this month.
- [ ] All dashboard data fetched server-side inside Suspense boundaries with skeletons.

**Verification**
- [ ] Each widget has an empty state; each count links to its filtered list; numbers match the lists they link to.

---

## Phase 12 — QA, Security, Polish, Deployment

Goal: release candidate. **Milestone M6.**

### Security
- [ ] Run Supabase security and performance advisors; resolve all findings.
- [ ] Review every RPC: `search_path = ''`, auth check first, execute grants, no dynamic SQL from inputs.
- [ ] Verify no table has RLS disabled and no unintended `anon` grants (`select * from information_schema.role_table_grants where grantee='anon'`).
- [ ] Storage: attempt cross-user reads for every private bucket.
- [ ] Next.js: every Server Action and Route Handler calls the DAL; no `service_role` anywhere; `next` redirect params validated; security headers (CSP per Next docs guide, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`); `Permissions-Policy` allows camera on `/scan` only.
- [ ] Rate-limit consideration: `submit_attendance_scan` and auth are protected by Supabase rate limits; document.
- [ ] Data privacy: privacy notice page, consent on application, minimal data in exports.

### Testing
- [ ] Full SQL test suite green.
- [ ] Unit tests green.
- [ ] E2E (Playwright, if adopted) or scripted manual checklist for: sign-up → apply → approve → create/publish → register (auto & manual) → bulk approve → attendance (scan, confirm, duplicate, expired) → complete → generate → download → verify.
- [ ] Walk every row of spec §19 edge-case table and record pass/fail.
- [ ] Device matrix: Android Chrome, iOS Safari (camera + native camera QR), desktop Chrome/Edge/Firefox; station on 1366×768 laptop and a tablet.
- [ ] Load sanity: 200 seeded registrants, 50 scans within 1 minute → station keeps up.

### Polish
- [ ] Impeccable pass (audit → polish) on: Explore, Event details, Scan, Station, Registrations table, Certificate editor, Dashboards. Constraints from brief: no excessive gradients/shadows/radii, no card-in-card, compact tables, purposeful motion only.
- [ ] Accessibility: labels, focus states, color contrast AA, status not conveyed by color alone, `prefers-reduced-motion`.
- [ ] Copy review: consistent status names (use the `StatusBadge` mapping everywhere).

### Deployment
- [ ] Vercel project (client-owned) with env vars set by the client.
- [ ] Supabase Auth redirect URLs updated for production domain.
- [ ] Apply migrations to the client project (`supabase db push`) after final review; regenerate types; smoke test.
- [ ] README: setup, env vars, scripts, how to create the first admin, migration workflow.

**Verification**
- [ ] Production smoke test of the full flow with real devices.
- [ ] Client sign-off checklist completed.

---

## Cross-Cutting Orders (summary views)

**Database migration order:** extensions/enums → lookups → profiles (+ trigger, grants) → auth helpers → profiles RLS → audit logs → organizer applications (+ bucket) → events (+ phase fn, guard, bucket) → registrations (+ can_view_profile, avatars policy, search fn) → registration decision RPCs → attendance (sessions, secrets, records, realtime publication, RPCs) → certificates (templates, certificates, sequence, bucket, RPCs, student_id lock) → reports/overview RPCs.

**Authentication setup order:** Supabase Auth settings → SSR clients → `proxy.ts` → DAL → auth route handlers → auth pages → avatars bucket → profile completion gate.

**RLS implementation order:** helpers (`is_admin`, `is_active_organizer`) → profiles → organizer_applications → events (`owns_event`) → registrations (`can_view_profile`) → attendance sessions/records (+ secrets lockdown) → certificate templates/certificates → storage policies per bucket as each bucket is introduced. Each set lands with its SQL tests in the same phase.

**UI implementation order:** auth pages → shell/nav → profile → become-organizer → admin applications/organizers → event form + workspace shell → explore/details/join/my-events → registrations table + bulk → attendance tab → station → scanner → certificate editor/preview → certificates list/verify → reports → dashboards → polish.

**Realtime attendance order:** schema + publication → session/token RPCs → scan/confirm RPCs → SQL tests → attendance tab (no realtime) → station with polling only → add realtime subscription + fallback → participant waiting screen realtime → two-device live test.

**Certificate order:** schema + bucket → RPCs + SQL tests → isomorphic renderer + unit tests → upload + editor → in-browser preview → issuance UI → PDF route handler → participant list/preview → public verify → revoke/refresh/apply-template actions.

**Reporting order:** report RPC + SQL test → reports tab tiles → CSV exports → printable view → cross-event organizer reports → dashboards consume the same RPCs.
