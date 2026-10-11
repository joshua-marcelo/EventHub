# EventHub — Implementation Plan

Companion to [SYSTEM_SPEC.md](./SYSTEM_SPEC.md). The spec defines *what*; this plan defines *in what order* and *how we know each step is done*. Section references like "§9.3" point to the spec.

Status: **REVISION 2 — APPROVED (2026-10-11).** Phases 0 and 1 are complete (built from Revision 1). Revision 2 adds Phase 1b and revises Phases 2–12 after the 2026-10-11 design review (DECISIONS.md D-009 – D-016). Phase 1b is complete (2026-10-11). Phase 2 is implemented (2026-10-11); email delivery and dashboard settings are pending (D-022). Phase 3 code is implemented (2026-10-11); permanent admin provisioning and browser verification remain pending (D-023). Decision IDs (P-xx) and client items (K-xx) are listed in spec §20.
**Amendment A1 — Event Registration QR Sharing (spec §7.5, P-24 – P-26): APPROVED (2026-10-11)**, with P-26 modified to a limited public preview (D-017). Its tasks are marked **[A1]** in Phases 2, 5, 6, 8 and 12. No new phase, table or column; one read-only public function (`get_public_event_preview`, Phase 6).
**Amendment A2 — Attendance Display Mode (spec §9.6, P-27 – P-31): APPROVED (2026-10-11).** Phase 8 no longer builds an anonymous station or pairing; the organizer's own session shows the attendance display. Anonymous sign-ins stay disabled (D-019). P-30 (no per-event approval) and P-31 (admin cancellation, D-020) are part of Phase 5.

---

## Ground Rules for Every Phase

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (Next 16.4: `proxy.ts`, async request APIs, `cacheComponents` → session reads inside `<Suspense>`).
- shadcn components are **Base UI**-based (`base-nova`); use the `render` prop pattern, not Radix `asChild`.
- Never hardcode secrets; never edit `.env.local`; document new variables in `.env.example`.
- **Environments:** all development and testing happens on the **development** Supabase project (`ldhpbfujqnyovovabvcg`). The **production** project is created separately before deployment (Phase 12) and receives only reviewed migrations (`supabase db push`) and documented settings. No tests, experiments or MCP write access on production (spec §22).
- Every schema change is a migration file in `supabase/migrations/`. After every migration: regenerate `lib/database.types.ts`, run the security and performance advisors, fix findings.
- Every RPC: `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified names, caller checks first (`private.is_permanent_user()` first as defense in depth, except the public read functions `verify_certificate` and `get_public_event_preview`), typed result codes for expected failures, `GRANT EXECUTE` only to the intended role (`REVOKE … FROM public, anon` by default).
- Anonymous sign-ins stay **disabled** in every environment (D-019); new tables need no extra restrictive policy while that holds (spec §13.1 rule 7).
- Every phase's SQL tests include: unprivileged user denied; role columns not writable; new RPCs refuse anonymous claims.
- Server Actions: Zod-validate → DAL check → RPC with the user-scoped client → typed `ActionResult` → refresh UI. No business rule exists only in TypeScript.
- Keep UI functional and clean during feature phases; the Impeccable polish pass is Phase 12.
- One phase = one or more small PR-sized commits. Do not mix phases.
- Items marked **[DEFERRED]** are not part of the MVP build; nothing marked **[CLIENT]** is assumed.

---

## Phase Dependency Graph

```
P0 Foundation ✅
 └─ P1 Core schema + RLS ✅
     └─ P1b Environments + schema corrections
         └─ P2 Auth (email confirmation) + onboarding
             └─ P3 Shell, three dashboards, switcher, guards, admin lookups
                 ├─ P4 Organizer applications + admin users/disputes
                 │   └─ P5 Events (+ attendance settings, ownership transfer)
                 │       └─ P6 Discovery + registration (+ identity lock, on-site rules)
                 │           └─ P7 Registration management (bulk)
                 │               └─ P8 Attendance: sessions, tokens, display mode, self-scan, flags
                 │                   └─ P9 Certificates
                 │                       └─ P10 Reports + exports
                 └────────────────────────── P11 Dashboards (needs P4–P10 data)
P12 QA, security, privacy, polish, production deployment (after all)
```

Milestones:
- **M1 — Accounts** (end of P3): sign up → confirm email → onboarding → role-aware dashboards with switcher; admins manage lookups.
- **M2 — Organizers** (end of P5): admin approves organizers; organizers create and publish events; admin can transfer ownership.
- **M3 — Registration** (end of P7): full registration loop incl. manual approval and bulk actions.
- **M4 — Attendance** (end of P8): self-service time-in/time-out on a phone against the organizer's Attendance Display Mode; flags and revocation work.
- **M5 — Certificates & Reports** (end of P10): thesis-complete feature set.
- **M6 — Release candidate** (end of P12): tested, audited, polished, deployed with production SMTP.

---

## Phase 0 — Foundation and Decisions ✅

**Status: Complete (2026-10-10).** Decisions in [DECISIONS.md](./DECISIONS.md) D-001 – D-005.

- [x] Spec §20 C1–C20 recommendations accepted (C1–C3 pending client data; C1 later closed in Revision 2).
- [x] Git and tool folders resolved. — D-002 corrected on 2026-10-11: the repository works on `main` with remote `origin`.
- [x] Baseline committed.
- [x] Dev database decision. — **Updated by Revision 2 (D-016):** the D-004 project `ldhpbfujqnyovovabvcg` remains the **development** project; a separate production project is created in Phase 12.
- [x] Tooling: `supabase` CLI, `server-only`, `@date-fns/tz`, `vitest`. Playwright deferred to Phase 12 (D-003).
- [x] npm scripts `db:types`, `db:push`, `test`, `test:db`, `typecheck`.
- [x] `.env.example`; shadcn components; root metadata; `lib/datetime.ts` with tests.

Verification: build, lint, typecheck, unit tests pass; no secrets in git. CLI connection still blocked on an access token (D-004); optional in Phase 1b (MCP remains the fallback, D-006).

---

## Phase 1 — Core Schema, Helpers, RLS Foundation ✅

**Status: Complete (2026-10-10)** on project `ldhpbfujqnyovovabvcg`; see D-006 – D-008.

Applied migrations: `20261009202616_extensions_and_enums`, `…202618_lookups`, `…202637_profiles`, `…202640_auth_helpers`, `…202651_profiles_rls`, `…202653_audit_logs`, `20261010012943_profiles_select_policy_consolidation`.

- [x] `pgcrypto`, `private` schema, all Revision 1 enums, `set_updated_at()`.
- [x] `colleges`, `event_categories` + read policies. Seed rows not created (C3).
- [x] `profiles` with generated `is_complete`, constraints, column grants, `handle_new_user()`, email-sync trigger.
- [x] `is_admin()`, `is_active_organizer()`, `profile_full_name()`.
- [x] Profiles RLS (consolidated select policy, D-007), `audit_logs` + `log_audit()`.
- [x] pgTAP suite `001_profiles.test.sql` 32/32 (run through MCP, rolled back).
- [x] Advisors clean; types generated.

Revision 2 changes several of these objects; they are corrected in Phase 1b (spec §12.6), not by editing applied migrations.

---

## Phase 1b — Environments and Schema Corrections

Goal: a clearly designated development environment and a Phase 1 schema that matches Revision 2. No client dependency.

**Status: Complete (2026-10-11)**, except the development Auth settings in the live project, which need a dashboard change by the team (see below and D-018). Migration `20261011102140_revision2_corrections.sql` is applied to development.

### Environments
- [x] Record `ldhpbfujqnyovovabvcg` as the **development** project (P-23 reversed) in README and `.env.example` comments. Verified before the migration: 0 auth users, 0 sessions, 0 rows in every table, 0 storage objects.
- [ ] Optional: CLI access to development (`supabase login`, `supabase link`) so `npm run test:db`/`db:types` work. Not available (no access token); tests and types run through MCP (D-006, D-018).
- [ ] Development Auth settings (spec §22) in the live project — **team action in the Supabase dashboard** (no tool in this environment can change Auth configuration; D-018): Confirm email **on**; email OTP/link expiry **3600 s** (P-03, D-021); anonymous sign-ins **off** (D-019; reverses the earlier Phase 1b instruction); manual linking off. The same values are recorded in `supabase/config.toml`. Email templates and redirect URLs move to Phase 2 step 2, because they depend on the `/auth/confirm` route and the `next` return path built there.
- [x] No production project exists yet; it is created in Phase 12 (K-08).

### Corrective migration (development first; spec §12.6)
- [x] Drop and recreate `attendance_status` as `('present','revoked')`; create `attendance_session_kind`, `attendance_policy`, `attendance_flag`, `flag_resolution`, and (P-12) `registration_channel`.
- [x] `programs` table (`UNIQUE (college_id, name)`, `UNIQUE (college_id, id)`) + read policy.
- [x] `profiles`: replace `program` with `program_id` + composite FK; add `identity_flagged_at`, `identity_flag_reason`; (P-06) `privacy_consented_at`, `privacy_notice_version`; recreate `is_complete`; update column grants.
- [x] Admin insert/update policies and grants on `colleges`, `programs`, and (P-09) `event_categories` (no delete; a program cannot move to another college).
- [x] `private.is_permanent_user()`; restrictive permanent-user policies on `profiles` and `audit_logs`.
- [x] `handle_new_user()` skips anonymous users.
- [x] (P-06) `accept_privacy_notice(version)` RPC.

### Tests
- [x] Update `001_profiles.test.sql` for `program_id` and the new `is_complete` (34 assertions).
- [x] New `002_revision2_corrections.test.sql`: anonymous auth user gets no profile row; anonymous claims cannot read `profiles`, `audit_logs` (even with an admin's id); non-admin cannot write lookups; admin can insert/update but not delete; program must belong to the chosen college; consent RPC (32 assertions).
- [ ] Extract the shared test helper. **Not done on purpose (D-018):** neither runner can include a shared file (the MCP runner sends one SQL string; `supabase test db` runs each file on its own), so test files stay self-contained.

### Documentation
- [x] DECISIONS.md: D-002 corrected, D-004 updated, Revision 2 entries D-009 – D-016 added (done with the Revision 2 approval, 2026-10-11).
- [x] DECISIONS.md D-018 (Phase 1b results); `scripts/tap-batch.mjs` runner committed.

**Verification**
- [x] Database tests pass on development: `001_profiles` 34/34, `002_revision2_corrections` 32/32, run through MCP with `scripts/tap-batch.mjs` (rolled back; no rows or `pgtap` left behind). `npm run test:db` via the linked CLI remains unavailable without an access token.
- [x] Advisors on development: performance — only expected `unused_index` INFO notices; security — one WARN (`authenticated_security_definer_function_executable` for `accept_privacy_notice`), accepted as the intended RPC pattern (D-018).
- [x] Corrective migration committed with the regenerated `lib/database.types.ts`; it reaches production only through the Phase 12 `supabase db push` of all reviewed migrations.
- [x] `npm run typecheck`, `npm run lint`, `npm test` (17/17), `npm run build` pass.

---

## Phase 2 — Authentication (Email Confirmation) and Onboarding

Goal: sign up, confirm email, log in/out, resend confirmation, recover password, complete the student profile with photo. Depends on P1b.

**Status: Implemented (2026-10-11); email delivery and dashboard settings pending (D-022).** Code, migration `20261011111054_avatars_storage` and tests are done and verified on development. What remains needs the Supabase dashboard or an SMTP provider, which no tool here can configure.

### Auth setup order
1. [ ] **Team action in the Supabase dashboard (development):** paste the two email templates; Site URL `http://localhost:3000` and redirect URL `http://localhost:3000/**`; email OTP expiry 3600 s (D-021); password policy "letters and digits", minimum 8 (P-02); CAPTCHA only once Turnstile keys exist (P-01, K-10). Verified from the public settings endpoint on 2026-10-11: confirm email **on**, anonymous sign-ins **off**, sign-ups open.
2. [x] Email templates in `supabase/templates/confirmation.html` and `recovery.html` (links to `/auth/confirm?token_hash=…&type=email|recovery`; confirmation passes `next={{ .RedirectTo }}`), referenced from `supabase/config.toml`.
3. [x] `lib/supabase/server.ts`, `client.ts`, `proxy.ts` (current `@supabase/ssr` pattern, `getClaims()`).
4. [x] `proxy.ts`: refresh session; signed-out users → `/login?next=…` except public paths and `/events/{uuid}` (A1); anonymous sessions treated as signed out; signed-in users on `/login` or `/signup` → `/dashboard`.
5. [x] `lib/auth/dal.ts`: `getCurrentUser()`, `requireUser({ allowIncomplete, next })`, `requireAdmin()`, `requireOrganizer({ allowInactive })`; session reads inside `<Suspense>`.
6. [x] Route handlers `/auth/confirm` (types `email`, `signup`, `recovery`; same-origin `next`; recovery always → `/reset-password`) and `/auth/signout` (POST, 303); `/auth/error` page with resend.
7. [x] Pages: `signup`; `signup/check-email` (masked address from an httpOnly cookie, resend with 60 s cooldown); `login` (email-not-confirmed with inline resend, event-aware wording, `next` kept); `forgot-password` (generic answer); `reset-password` (P-05 sign out others); **Sign out of all devices** on `/profile` (P-29). **[A1]** `next` travels through sign-up (`emailRedirectTo`), resend, the email link and onboarding.
8. [x] `/privacy` draft notice (controller, contact and retention pending **[CLIENT K-06, K-07]**), version `2026-10-draft`.
9. [x] `/onboarding` (consent → details with college → program cascade → photo resized to 512 px, uploaded to the own folder, old photo deleted) and `/profile`; student-ID-taken message with admin hint; complete profile → `next` or dashboard. Minimal `/dashboard` placeholder and `(app)` frame until Phase 3.
10. [x] Storage bucket `avatars` (private, 2 MB, jpeg/png/webp) + owner insert/read/delete and admin read policies.
11. [x] `lib/validation/auth.ts`, `lib/validation/profile.ts` shared by forms and Server Actions.
12. [x] Dev-only lookup rows (`DEV-A`, `DEV-B`, three programs, labelled "test data") inserted directly in the development database.
13. [x] Turnstile widget (P-01) renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set (documented in `.env.example`).

### Tests
- [x] Unit (Vitest): auth/profile schemas, `next` sanitizer, public-path rules, error messages — 48/48 including Phase 0.
- [x] SQL: `003_avatars_storage` 10/10 (bucket settings, own-folder upload, no cross-user read, admin read, anonymous and signed-out denied). Consent and `is_complete` are covered by `001`/`002` (Phase 1b).
- [x] Live route check `scripts/phase2-auth-check.mjs` against a production build: 39/39.
- [x] Live Server Action check `scripts/phase2-actions-check.mjs` against a production build: 24/24.

**Verification**
- [ ] Sign up → email arrives → link → onboarding → dashboard. **Blocked:** the built-in Supabase sender only delivers to project-team addresses and was rate-limited during testing; needs SMTP (a team sandbox for development, K-01 for production). The rest of the chain was verified with a simulated link (seeded token hash through the real `/auth/confirm`).
- [x] Login before confirming → "Email not confirmed" with resend offered (live resend delivery blocked as above).
- [x] Expired, used or invalid link → `/auth/error` (Supabase reports all three as `otp_expired`; the page says "expired or already used").
- [ ] Sign-up with an existing email reveals nothing — Supabase behaviour with confirmation on; not observable while the built-in sender is rate-limited.
- [x] Forgot/reset via recovery link; weak password refused; other sessions signed out (P-05); old password fails, new works.
- [x] Signed-out `/dashboard` → `/login?next=/dashboard`; off-site `next` ignored at login and at `/auth/confirm`.
- [x] **[A1]** Confirmation link with `next` lands on that path from a fresh cookie jar (= another device).
- [x] Anonymous sessions: proxy and DAL treat them as signed out; SQL tests deny them (sign-ins are disabled, so none can be created).
- [x] Avatar of user A not readable by user B (SQL and Storage API).
- [x] Build passes with `cacheComponents`.
- [ ] Visual check of every page in a browser at 360 / 768 / 1280 px — not done (the Chrome automation extension was not connected); do it manually or in Phase 3.

---

## Phase 3 — App Shell, Three Dashboards, Switcher, Guards, Admin Lookups

**Status: Implemented (2026-10-11); permanent admin provisioning and browser checks pending (D-023).**

Goal: one authenticated shell with Participant, Organizer and Admin dashboards and a dashboard switcher; admins can enter real lookup data. **Milestone M1.**

- [x] `(app)/layout.tsx`: static frame; session-dependent parts (switcher, nav, user menu) in `<Suspense>`.
- [x] **Dashboard switcher** in the top bar listing only permitted dashboards (Participant; Organizer when `organizer_status <> 'none'`; Admin when `is_admin`). Navigation only; no role state.
- [x] Sidebar per dashboard (spec §16.1) + compact links to the others; active-route highlighting.
- [x] Mobile: participant bottom nav (Home, Explore, Scan, My Events, Certificates) + Sheet menu; switcher in the Sheet.
- [x] `organizer/layout.tsx`: `requireOrganizer({ allowInactive: true })`; suspended/revoked banner (read-only).
- [x] `admin/layout.tsx`: `requireAdmin()` → `notFound()` for non-admins. (P-08) admins without a student profile allowed here; default landing `/admin` for them.
- [x] Full-screen layout variant for `/organizer/events/[id]/attendance/display` (no sidebar or top bar; used in P8).
- [x] Placeholder pages for every route in §16.1 with titles and empty states.
- [x] Shared components: `StatusBadge` (single enum mapping), `EmptyState`, `PageHeader`, `ConfirmDialog`, `DataTable` basics.
- [x] Global `error.tsx`, `not-found.tsx`, loading skeletons.
- [x] **`/admin/lookups`**: colleges (code, name, active), programs per college (name, active), (P-09) categories (name, slug, order, active). Add/rename/deactivate; no delete; audit entries `lookup.created` / `lookup.updated`.
- [x] **Admin provisioning procedure** documented in README: account signs up and confirms email; maintainer verifies identity; SQL sets `is_admin = true` and inserts an `admin.granted` audit row.
- [ ] Two permanent admin accounts on development — awaiting verified identities. Two temporary admins were exercised successfully, then removed.

**Verification**
- [x] Participant sees only the Participant dashboard; admin sees Admin in the switcher; setting `organizer_status = 'active'` on dev shows Organizer.
- [x] Non-admin `/admin` → 404; non-organizer `/organizer` → redirect to `/become-organizer`.
- [x] No client path (sign-up metadata, profile update, RPC) can set `is_admin` or `organizer_status` (SQL tests from P1 still green + metadata test).
- [x] Lookup admin works; deactivated college/program hidden in onboarding but kept on existing profiles.
- [ ] 360 / 768 / 1280 px layouts; keyboard navigation — responsive implementation is complete, but browser automation is unavailable here.

**Validation:** `npm run typecheck`, `npm run lint`, `npm test` (68/68), `npm run build`; SQL suites 001–004 (105/105, rolled back through MCP); `scripts/phase3-check.mjs` against the production build (64/64). Temporary users, lookup rows and audit records removed. Existing Phase 2 email/settings limitations remain (D-022). No Phase 4 behavior implemented.

---

## Phase 4 — Organizer Applications and Admin Users

Goal: participants apply; admins approve/reject/suspend/revoke; admins resolve identity disputes. Depends on P3.

### Database
- [ ] `organizer_applications` (spec §12.2), partial unique pending index, checks, indexes; RLS select own/admin; restrictive permanent-user policy.
- [ ] RPCs: `submit_organizer_application`, `withdraw_organizer_application`, `review_organizer_application` (atomic approve + audit), `set_organizer_status` (suspend/reinstate/revoke + reason + audit; closes open attendance sessions once P8 tables exist — write defensively or extend in P8).
- [ ] RPCs: `resolve_student_id_dispute`, `clear_identity_flag`. The dispute RPC bypasses the student-ID/photo lock triggers via a transaction-local setting. (Deletion requests: maintainer procedure, spec §21.2 — no RPC, P-10.)
- [ ] `get_admin_overview()` (users, active organizers, pending applications, open identity flags).
- [ ] Storage bucket `organizer-requirements` (private, 5 MB, pdf/jpeg/png); owner insert into own folder; owner + admin select; no update/delete.

### UI
- [ ] `/become-organizer`: eligibility (confirmed + complete profile, status), form (§4.1), uploads, consent, status views, withdraw, reapply. Proof-document guidance text **[CLIENT K-03]**.
- [ ] `/admin/applications` and `/admin/applications/[id]` (signed URLs 60 s on click; Approve/Reject dialogs).
- [ ] `/admin/organizers`: Suspend/Reinstate/Revoke with reason.
- [ ] `/admin/users` and `/admin/users/[id]`: search; Resolve dispute; Clear flag.
- [ ] `/admin` overview tiles.

### Tests
- [ ] Second pending application rejected; incomplete profile cannot apply; non-admin cannot review; admin cannot review own; reject without notes fails; approve sets `active`; double review → `already_reviewed`; reinstate only from `suspended`; revoked user can reapply.
- [ ] Dispute: clears student ID, sets flag, audit row; non-admin denied; anonymous denied.
- [ ] Storage: user B cannot read A's documents; admin can.

**Verification**
- [ ] E2E: apply with files → admin reviews → approve → Organizer appears in the switcher.
- [ ] Rejection notes visible; reapply works; audit rows for approve/reject/suspend/revoke/dispute.

---

## Phase 5 — Events: Organizer CRUD, Lifecycle, Ownership Transfer

Goal: organizers create, edit, publish, cancel, complete, delete drafts; admins transfer ownership. There is **no admin approval step for events** (P-30): `publish_event` is the organizer's own action, and public published events appear in Explore immediately. **Milestone M2.**

### Database
- [ ] `events` table (spec §12.2) incl. `attendance_policy`, `attendance_opens_minutes_before` (P-11: 0–180), `allow_onsite_registration`; publish CHECK; `search`; invite code generator.
- [ ] Column grants; `events_guard` (terminal lock, capacity ≥ approved count, (P-11) attendance settings lock after first session — body completed in P8).
- [ ] `event_phase(events)` + `lib/events/phase.ts` with boundary tests.
- [ ] RLS per §13.2 + restrictive permanent-user policy.
- [ ] `events.cancelled_by` (FK → profiles, set with `cancelled_at`) (P-31).
- [ ] `cancel_event(id, reason)`: owner as active organizer **or admin** (P-31); published events only; reason required; sets `cancelled_by`; audit `event.cancelled` with `by_admin`; closes open attendance sessions once P8 exists.
- [ ] RPCs: `publish_event`, `complete_event`, **`transfer_event_ownership`** (admin; active organizer target without a registration for the event; reason; audit; closes open attendance sessions once P8 exists).
- [ ] Storage bucket `event-banners` (public, 5 MB) + owner write policies.

### UI
- [ ] `lib/validation/event.ts` (draft vs publish refinements).
- [ ] Event form sections: Basics, Schedule, Registration (incl. on-site switch), **Attendance** (policy, lead time), Certificates.
- [ ] Workspace layout + tabs; Overview with share panel; Settings with cancel/delete/complete.
- [ ] **[A1]** `lib/qr.ts`: one helper around `qrcode` (`toDataURL`/PNG at a given size, SVG string; error correction M; quiet zone 4), with unit tests. Reused later by the Attendance Display (P8) and certificates (P9).
- [ ] **[A1]** Share panel (spec §7.5): registration link `{APP_URL}/events/{id}` with Copy; QR preview; Download PNG (1024 px) and SVG; Copy QR image (falls back to download); Share… via Web Share API (hidden when unsupported); invite code + `/e/{code}` with copy. Only for `published`; draft/cancelled/completed notices. Invite code fixed at creation (P-25; no regenerate RPC or button).
- [ ] `/organizer/events` table.
- [ ] `/admin/events/[id]` minimal view with **Transfer ownership** dialog (searchable active organizers, reason) and **Cancel event** dialog (required reason; published events only) (P-31).
- [ ] Organizer workspace and event page show "Cancelled by an administrator" with the reason when `cancelled_by` is an admin.

### Tests
- [ ] Participant cannot insert; suspended organizer cannot write; A cannot update B's event; cannot set `status`, `organizer_id` or `invite_code` directly (A1: the code never changes after creation); cannot publish incomplete; cannot edit terminal events; cannot delete published.
- [ ] Transfer: non-admin denied; target not active → refused; target registered → refused; audit row; old owner loses access.
- [ ] Cancel (P-31): admin can cancel a published event of any organizer with a reason; without a reason refused; draft or completed refused; other organizers and participants refused; registrations kept unchanged; `cancelled_by` and audit row (`by_admin = true`) set.
- [ ] Unit: event schema, phase helper.

**Verification**
- [ ] Draft → publish → edit → cancel; complete after start (dev data with past times).
- [ ] **[A1]** Downloaded PNG and SVG decode (phone camera) to exactly `{APP_URL}/events/{id}`; the QR still works after editing the event and after an ownership transfer; Share… opens Messenger on Android/iOS; copy-image falls back to download on Firefox.
- [ ] 9:00 AM Manila displays as 9:00 AM on a UTC build.
- [ ] Transfer a completed event; new owner sees it, old owner gets 404.
- [ ] Admin cancels a published event with registrations → organizer sees "Cancelled by an administrator" and the reason; registrants see the cancellation notice; registrations still listed.

---

## Phase 6 — Discovery, Invites, Participant Registration

Goal: participants find events and register. Depends on P5.

### Database
- [ ] `event_registrations` (§12.2) incl. (P-12) `registration_channel`; uniques; indexes; RLS own + owner; no direct writes.
- [ ] `can_view_profile(profile_id)` — event owner of a registration; (P-20) until 30 days after completion or cancellation; add to the profiles select policy (D-007) and the avatars select policy.
- [ ] **Identity-lock trigger body** on `profiles`: blocks changes to `student_id` and `avatar_path` (P-07, narrowed; names stay editable) while an approved registration for a published, not-yet-ended event exists.
- [ ] **[A1]** `get_public_event_preview(event_id)` (P-26): `SECURITY DEFINER`, `search_path = ''`, `STABLE`, granted to `anon` and `authenticated`. Returns title, description, category name, host college name, `starts_at`, `ends_at`, venue, banner path, organization name and a server-derived status label — only for `visibility = 'public'` and status `published`/`completed`/`cancelled`. Returns the same empty result for draft, unlisted and unknown ids. No counts, capacity, registrants, invite code, organizer personal data or cancellation reason.
- [ ] RPCs: `register_for_event` (row lock, §8 rules incl. on-site branch — the session check activates in P8), `cancel_registration`, `get_event_by_invite_code`.
- [ ] `search_events(...)` SQL function.

### UI
- [ ] `/events` Explore (unchanged scope); `/events/[id]` details with the action state machine; `/events/join`; `/e/[code]`; `/my-events`.
- [ ] **[A1]** `/events/[id]` as the canonical registration URL, rendering without a session:
  - Signed out: validate the UUID format, call `get_public_event_preview`; public preview with **Register → `/login?next=/events/{id}`**; otherwise one neutral "Log in to view this event" screen (identical for draft, unlisted, unknown and malformed ids). No organizer controls, no counts.
  - `generateMetadata`: Open Graph title/description/banner for public events, generic EventHub metadata otherwise; `robots: noindex`.
  - Signed in: full details through RLS; neutral "This event isn't available" for another organizer's draft, unknown and malformed ids (same response); owner's draft banner; cancelled notice with reason; "This event has ended" for completed.
  - Register: signed out → login with `next`; incomplete profile → onboarding with `next`; returning never registers automatically.
  - `/e/[code]` and `/events/join` (signed in) resolve via `get_event_by_invite_code` and redirect to the canonical URL, keeping `next` when login is needed.
- [ ] Profile page shows the identity lock reason.

### Tests
- [ ] Duplicate registration returns existing; deadline passed → `registration_closed`; incomplete profile refused; own event refused; cancelled event refused; unlisted hidden from Explore but readable by id.
- [ ] Identity lock: photo change blocked during an approved upcoming registration; allowed after the event ends.
- [ ] `can_view_profile` window (P-20).
- [ ] Concurrency: capacity 1, two concurrent registrations → exactly one approved.
- [ ] **[A1]** `get_public_event_preview` as `anon`: public published/completed/cancelled → whitelisted columns only (assert the exact column set); draft, unlisted, unknown id → identical empty result; `anon` still has no SELECT on `events`, `event_registrations` or `profiles`.

**Verification**
- [ ] Phone (360 px): browse, filter, open invite QR → event → register.
- [ ] **[A1]** Signed-out phone scans a printed registration QR → public preview → Register → login/sign-up → confirm → onboarding → same event → explicit Register; the registration row exists only after the button press. Repeat for an unlisted event (neutral screen until login), a cancelled event, a full event, a manual-approval event (→ pending), and a deleted draft (→ neutral/unavailable).
- [ ] **[A1]** Pasting the link in Messenger shows the event title and banner for a public event, and only generic EventHub text for an unlisted event.

---

## Phase 7 — Registration Management (Organizer)

Goal: manual approval with safe bulk actions. **Milestone M3.**

- [ ] RPCs `decide_registrations`, `approve_all_pending`, approved → rejected path (blocked if an attendance record exists).
- [ ] Registrations tab: status tabs with counts, search, channel filter, 50/page table, page-only select-all, **selection clears on filter/search/page change**, bulk actions with result summary, capacity bar.
- [ ] Tests: foreign ids ignored; capacity 10 with 15 pending → 10 oldest approved; non-owner and suspended owner denied; UI test for selection reset.
- [ ] Verification: 120 seeded registrants; numbers in tabs and reports match.

---

## Phase 8 — Self-Service Attendance with Attendance Display Mode

Goal: time-in/time-out by participant self-scan against the QR on the organizer's Attendance Display, with flags and organizer corrections. **Milestone M4.** Depends on P7.

### Implementation order
1. **Schema**
   - [ ] `attendance_sessions` (+ `kind`, `closes_at`), `attendance_session_secrets` (no grants), `attendance_records` (reshaped, §12.2, no free-text columns), `attendance_device_signals` (no grants).
   - [ ] RLS: sessions (owner, approved registrants); records (own, owner).
   - [ ] `alter publication supabase_realtime add table attendance_records;`
   - [ ] Complete `events_guard` attendance-settings lock (P-11).
2. **Session RPCs**
   - [ ] `open_attendance_session(event_id, kind)`: owner, active organizer, published, policy allows `kind`, `now()` inside the attendance window (`starts_at − lead time` … `effective_end + 60 min`, P-14); sets `closes_at` to the window end; time-out closes time-in (P-15); refuses `time_in` once any time-out session exists (`time_out_started`); creates the secret.
   - [ ] `close_attendance_session`.
   - [ ] Extend `complete_event`, `cancel_event`, `set_organizer_status`, `transfer_event_ownership` to close open sessions.
3. **Display RPCs** (owner, active organizer)
   - [ ] `get_attendance_qr(event_id)` → current + 2 upcoming tokens with `valid_from`/`valid_until`, server time, event title, session state.
   - [ ] `get_attendance_feed(event_id, since)` → display fields only (record id, status, times, flag, name, college, `avatar_path`).
4. **Scan RPC**
   - [ ] `submit_attendance_scan(token, device_id, expected_event_id)` exactly per §9.3, incl. `onsite_available` and device-signal flagging.
5. **Organizer RPCs**
   - [ ] `manual_time_in`, `manual_time_out`, `revoke_attendance`, `resolve_attendance_flag`: reason/note required and written only to `audit_logs`; allowed while published **and after completion** for registrations without a certificate (P-17); refused on cancelled events.
   - [ ] `get_attendance_list(event_id)`: owner-only Attendance tab data incl. reasons read from `audit_logs`.
   - [ ] Activate the on-site branch of `register_for_event` (time-in session open + switch on). On-site approvals reuse `decide_registrations` (P-13; no separate RPC).
   - [ ] `complete_event` warning data: open flags, attendees without time-out (P-15).
6. **SQL tests** (before UI)
   - [ ] Token accepted in its window and the next; future (prefetched) token rejected before its window; tampered → `invalid_qr`; closed or past `closes_at` → `attendance_closed`.
   - [ ] Every §9.3 code incl. `not_participant`, `profile_incomplete`, `attendance_revoked`, `time_in_required`, `already_timed_out`.
   - [ ] Time-out impossible for `time_in_only`; opening time-out closes time-in; time-in refused after time-out started (`time_out_started`); opening allowed until effective end + 60 min and refused after.
   - [ ] Corrections after completion: allowed for a registration without a certificate, refused once a certificate exists, refused on cancelled events; reasons appear in `audit_logs` only.
   - [ ] `attendance_records` has no free-text columns (schema assertion).
   - [ ] Same device hash + two users + same event → both flagged; different events → not flagged.
   - [ ] `get_attendance_qr` / `get_attendance_feed`: owner and active only; other organizer, participant, suspended owner (QR) and anonymous claims denied; feed returns only the whitelisted columns.
   - [ ] Manual corrections require a reason, are owner-only, blocked for suspended organizers, audited.
   - [ ] On-site: allowed only with switch on and time-in open; follows approval mode and capacity.
   - [ ] 20 scripted users scanning in one window → 20 records, no duplicates.
7. **Organizer Attendance tab** (`/organizer/events/[id]/attendance`)
   - [ ] States: not yet openable (countdown to lead time), time-in open, time-out open, closed/expired, completed.
   - [ ] **Start Attendance** → opens the time-in session → one-time reminder dialog (P-29: stay with the laptop, lock it with Windows+L when stepping away, prefer an external screen; acknowledge per browser) → Attendance Display Mode. **Open display** when a session is already open. Open time-out / Close session buttons stay in this tab.
   - [ ] Attendance table: approved registrants with time-in/out, method, flags; filters; manual time-in/out, revoke, resolve flag; "On-site, awaiting approval".
8. **Attendance Display Mode** (`/organizer/events/[id]/attendance/display`, P-27)
   - [ ] Same guard as the workspace (owner, active organizer); full-screen layout without sidebar or top bar; Fullscreen API when available; only control: **Exit display** (back to the Attendance tab).
   - [ ] Left panel: event name, QR from `{APP_URL}/scan?t=…` (≥ 320 px), switch tokens by server-time offset, countdown ring, session status, instructions.
   - [ ] Right panel: realtime feed (photo, name, college, status, ⚠), counters; no student IDs, errors, reasons, tables, exports or links. Photos via signed URLs with a **10-minute** expiry, re-signed as needed.
   - [ ] Realtime subscription (owner RLS) + 3 s polling fallback + full refetch on resubscribe + cleanup on unmount; connection indicator.
   - [ ] States: session not open, waiting for first scan, closed/expired, connection lost, fullscreen unavailable.
   - [ ] Layouts: 1366×768 laptop, 1024×768 tablet landscape, 1920×1080 external screen.
9. **Participant scanner** (`/scan`)
   - [ ] `?t=` → submit immediately when signed in; when signed out → login → `/scan` with camera open and "scan again" message.
   - [ ] Camera scanner (`@zxing/browser`, back camera, stop tracks on unmount, debounce); device ID (localStorage + cookie).
   - [ ] **[A1]** Payload routing: only `{APP_URL}/scan?t=…` or a raw token goes to `submit_attendance_scan`; an EventHub `/events/{id}` or `/e/{code}` URL shows "This is an event registration code, not an attendance code" + Open event; anything else shows "Not an EventHub attendance code". Unit-test the parser; SQL test that a registration URL string submitted as a token returns `invalid_qr`.
   - [ ] Result screen per code; **Register on-site** path; permission denied / no camera / insecure context states.
   - [ ] Dashboard and My Events "Attendance open — Scan now" CTA.
10. **Scheduled jobs** (`pg_cron`)
    - [ ] Enable the `pg_cron` extension on development (migration). Job (P-21): purge device signals 30 days after completion. Period is a parameter pending K-07.

### Verification
- [ ] All SQL tests pass on development.
- [ ] **Live test:** organizer signed in on a laptop (with an external screen if available) → Start Attendance → reminder → display; participant phone over HTTPS scans → feed shows photo + name + college in < 2 s.
- [ ] Display shows no student IDs, emails, errors or management controls; leaving fullscreen keeps the display view.
- [ ] 61 s old screenshot → `expired_qr`.
- [ ] One phone signed into two accounts → both records ⚠ flagged.
- [ ] Display laptop Wi-Fi off 60 s → QR still accepted; feed catches up.
- [ ] Close the session from the Attendance tab in another tab → display shows "Closed" within one realtime/poll cycle.
- [ ] Time-in + time-out event: time-out scan recorded; time-out without time-in refused.
- [ ] On-site registration (automatic and manual mode) → scan again → timed in.
- [ ] Manual time-in, manual time-out, revoke, resolve flag are audit-logged.
- [ ] **Sign out of all devices** (P-29) from a phone → the display laptop's session can no longer refresh (access token expiry documented).

---

## Phase 9 — Certificates

Goal: template upload, constrained editor, preview, issuance, download, verification. Depends on P8.

1. **Schema**: `certificate_templates`, `certificates`, `certificate_number_seq`; student-ID lock trigger once a certificate exists; RLS; bucket `certificate-templates` + policies.
2. **RPCs**: `save_certificate_template`, `issue_certificates` (eligibility per §10.3 incl. time-out requirement, (P-17) unresolved flags, (P-18) identity flags; returns issued + skipped counts by reason; audited), `revoke_certificate`, `refresh_certificate_name`, `apply_template_to_issued`, `verify_certificate` (anon), `get_certificate_eligibility`.
3. **Renderer** `lib/certificates/render.ts` (isomorphic pdf-lib) + layout Zod schema + unit tests (coordinates, alignment, shrink-to-fit, "ñ", determinism).
4. **Organizer Certificates tab**: states per §18; upload; editor; preview; eligibility counts with links (missing time-out, flags, identity review); Generate; issued table; outdated-template banner; identity review list.
5. **Delivery**: `/certificates/[id]/pdf` route (Node runtime, DAL, RLS, `no-store`); `/certificates` list and preview; `/verify` and `/verify/[code]` (P-19: wording; `noindex`).

### Tests
- [ ] Not completed → nothing issued; missing time-out under `time_in_and_out` → not eligible; revoked attendance → not eligible; unresolved flag → skipped (P-17); identity-flagged → skipped (P-18); rerun issues only new; numbers unique and sequential; referenced template immutable; cross-user certificate read denied; anon verify returns whitelisted fields; revoked shows Revoked.
- [ ] Storage: participant without certificate cannot read the template; holder can.

### Verification
- [ ] Canva PNG → fields → preview matches download.
- [ ] 30 eligible / 10 absent / 2 flagged → 30 issued; resolve flags → rerun → 2 more.
- [ ] Phone scan of certificate QR → Valid; after revoke → Revoked.
- [ ] Name change → snapshot unchanged; refresh → updated, same number.
- [ ] One certificate downloads in < 2 s on a Vercel preview.

---

## Phase 10 — Reports and Exports

Goal: organizer reports with CSV and printable view. **Milestone M5.**

- [ ] `get_event_report(event_id)`: registrations by status and channel; present; timed out; incomplete (no time-out where required); absent; attendance %; flags (open/resolved); revoked; certificates issued/revoked. Owner-only (suspended: read-only).
- [ ] Reports tab: tiles; approved vs present by college; attendance list with time-in/out and method.
- [ ] CSV route `?type=registrations|attendance|certificates`: DAL + owner check; UTF-8 BOM; Manila timestamps; safe filename; CSV-injection escaping; (P-22) minimal columns (name, student ID, college, program, year, registration and attendance data; no email, no photo links).
- [ ] Printable report (print stylesheet).
- [ ] `/organizer/reports` cross-event table + CSV.

Tests/verification: report numbers equal direct SQL counts; CSV opens in Excel and Google Sheets with "ñ"; non-owner export → 404; print fits A4 portrait.

---

## Phase 11 — Dashboards

- [ ] Participant `/dashboard`: next event, "Attendance open — Scan now", pending registrations, recent certificates, profile prompt.
- [ ] Organizer `/organizer`: upcoming events with pending counts, attendance open indicators, **flags to review**, on-site awaiting approval, awaiting completion, certificates ready to generate.
- [ ] Admin `/admin`: extend `get_admin_overview()` with events by status, events this month, open identity flags.
- [ ] Server-side data inside Suspense with skeletons. Every widget has an empty state; every count links to its filtered list; numbers match.

---

## Phase 12 — QA, Security, Privacy, Polish, Production Deployment

Goal: release candidate. **Milestone M6.**

### Security
- [ ] Advisors (security + performance) clean on development and production.
- [ ] Review every RPC: `search_path = ''`, permanent-user check, caller check, execute grants, no dynamic SQL from inputs.
- [ ] No table with RLS disabled; no unintended `anon` grants (expected: SELECT on lookups; EXECUTE on `verify_certificate` and `get_public_event_preview` only); restrictive permanent-user policies present wherever required.
- [ ] Storage cross-user reads attempted for every private bucket.
- [ ] Next.js: every Server Action/Route Handler calls the DAL; no service-role key; `next` validated; security headers (CSP, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` camera only on `/scan`).
- [ ] Rate limits documented: Auth email/sign-up/verification limits, CAPTCHA; confirm anonymous sign-ins are **off** in both environments (D-019).

### Privacy
- [ ] Privacy notice with controller and contact **[CLIENT K-06]**; retention periods approved **[CLIENT K-07]**.
- [ ] Scheduled jobs verified (device signals; unconfirmed accounts only if P-04 is picked up).
- [ ] README maintainer procedures: admin provisioning/removal, email correction, deletion/anonymization request (spec §21.2), retention jobs.
- [ ] **[DEFERRED P-04]** Optional: scheduled purge of unconfirmed accounts older than 7 days.

### Testing
- [ ] Full SQL suite and unit tests green on development.
- [ ] E2E (Playwright, if adopted) or scripted checklist: sign-up → confirm → onboarding → apply → approve → create/publish → share link/QR **[A1]** → open from QR while signed out → register (auto, manual, on-site) → bulk approve → Start Attendance / display mode → time-in/out (valid, duplicate, expired, shared device) → revoke/resolve → complete → generate → download → verify.
- [ ] Walk every row of spec §19 and record pass/fail.
- [ ] Device matrix: Android Chrome, iOS Safari (camera + native QR), desktop Chrome/Edge/Firefox; Attendance Display on a 1366×768 laptop, a tablet and an external screen.
- [ ] Load sanity: 200 registrants, 50 scans within one minute → the Attendance Display keeps up.

### Polish
- [ ] Impeccable pass on Explore, Event details, Scan, Attendance Display, Registrations, Attendance tab, Certificate editor, Dashboards, auth/confirmation pages.
- [ ] Accessibility: labels, focus, AA contrast, status not by color alone, `prefers-reduced-motion`.
- [ ] Copy review via the `StatusBadge` mapping.

### Production deployment
- [ ] **[CLIENT K-08]** Create the new, separate **production** Supabase project (client-owned); link the CLI to it; never connect AI/MCP tooling with write access.
- [ ] Enable `pg_cron`; push **all** reviewed migrations from the repository (`supabase db push`); verify `supabase migration list` matches the repository.
- [ ] **[CLIENT K-01]** Custom SMTP configured on production (sender address/domain per K-11); SPF/DKIM per provider; email rate limit raised; confirmation and recovery tested to a non-team address.
- [ ] Production Auth settings per spec §22 (Confirm email on, templates, link expiry, anonymous sign-ins **off**, CAPTCHA keys **[K-10]**, password policy, redirect URLs **[K-11]**).
- [ ] Vercel project (client-owned) with env vars set by the client, incl. `NEXT_PUBLIC_APP_URL`.
- [ ] Reviewed migrations pushed to production; types regenerated; advisors clean.
- [ ] Admin accounts provisioned **[CLIENT K-02]**; lookups entered **[CLIENT K-04]**.
- [ ] Defense-period plan **[CLIENT K-09]**.

**Verification**
- [ ] Production smoke test of the full flow with real devices and a real (non-team) email address.
- [ ] Client sign-off checklist completed.

---

## Cross-Cutting Orders (summary views)

**Environment order:** development project (existing) → corrective migration on development → each phase's migrations on development with tests → review → (Phase 12) create production project → push all reviewed migrations → production settings → smoke test.

**Database migration order:** extensions/enums ✅ → lookups ✅ → profiles ✅ → auth helpers ✅ → profiles RLS ✅ → audit logs ✅ → **corrections (enums, programs, profile columns, admin lookup writes, permanent-user guard)** → organizer applications + disputes → events (+ attendance settings, transfer) → registrations (+ channel, can_view_profile, identity lock) → registration decisions → attendance (sessions, secrets, records, device signals, realtime, jobs) → certificates → reports/overview.

**Authentication order:** dev Auth settings (confirm email, templates, CAPTCHA; anonymous sign-ins off) → SSR clients → `proxy.ts` → DAL → `/auth/confirm` + `/auth/error` → sign-up / check-email / resend → login (unconfirmed handling) → forgot/reset → privacy page → onboarding + avatars bucket → production SMTP and settings (P12).

**RLS order:** helpers ✅ → permanent-user guard → lookups admin writes → organizer_applications → events → registrations (`can_view_profile`) → attendance (sessions, records, secrets/signals lockdown) → certificates → storage policies per bucket as introduced. Each set lands with its SQL tests.

**UI order:** auth + confirmation pages → onboarding → shell, dashboards, switcher → admin lookups → become-organizer → admin applications/organizers/users → event form + workspace + transfer → explore/details/join/my-events → registrations table → attendance tab → Attendance Display Mode → scanner → certificate editor/preview → certificates/verify → reports → dashboards → polish.

**Attendance order:** schema + publication → session RPCs → display token/feed RPCs → scan RPC → organizer RPCs → SQL tests → attendance tab (no realtime) → Attendance Display Mode with polling → realtime + fallback → scanner → jobs → two-device live test.

**Certificate order:** schema + bucket → RPCs + SQL tests → renderer + unit tests → upload + editor → preview → issuance UI with skip reasons → PDF route → participant list/preview → public verify → revoke/refresh/apply-template → identity review list.

**Reporting order:** report RPC + SQL test → tiles → CSV → printable view → cross-event reports → dashboards reuse the same RPCs.
