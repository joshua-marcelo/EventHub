# EventHub final QA checklist — 2026-10-13

EventHub: A QR-Based Event Management and Attendance System with Automated Digital Certificate Generation for the College Local Council of Wesleyan University–Philippines

All results below were produced in this session against the **development** project `ldhpbfujqnyovovabvcg` and a local **production build** (`next build` + `next start -p 3100`). Disposable `@eventhub.test` fixtures were removed after every run. Development finished with one account (the admin), no events, and no test policies.

## 1. Implemented and tested

| Area | Evidence | Result |
|---|---|---|
| TypeScript, ESLint, production build | `npm run typecheck`, `npm run lint`, `npm run build` | pass |
| Unit tests (Vitest) | `npm test` | 108/108 |
| Database/RLS (pgTAP, rolled back) | suites 001–009 via `scripts/tap-batch.mjs` + MCP | 269/269 |
| Sign-up confirmation, login/logout, session, protected routes, open-redirect blocking, avatar Storage isolation | `scripts/phase2-auth-check.mjs` | 37/37 |
| Auth and onboarding Server Actions (privacy consent, profile, student-ID uniqueness, photo, password change, sign out other devices, sign out everywhere) | `scripts/phase2-actions-check.mjs` | 23/23 |
| Password recovery: fresh, expired, reused, PKCE with and without the verifier, scanner-safe GET, new-password login | `scripts/email-recovery-check.mjs` | 11/11 |
| Password recovery in real Chrome (390 px): fragment link, address bar cleared, mismatch, success, reuse rejected; email templates fit narrow screens | `scripts/email-recovery-browser-check.mjs` | 10/10 |
| Role routing and admin: participant 404 on `/admin`, organizer gating, suspended/revoked read-only, incomplete admin → `/admin`, lookups CRUD + audit, every app route renders, admin user search | `scripts/phase3-check.mjs` | 67/67 |
| Organizer application → admin approval → event create/edit/publish, QR/link sharing, concurrent capacity (exactly one admitted), duplicate registration, manual approval, unlisted events, foreign-organizer denial, admin cancellation, suspension | `scripts/mvp-stage1-check.mjs` | 43/43 |
| Attendance → certificates → reports: rotating QR, concurrent scans (one time-in), tampered QR, realtime, time-out, completion, eligibility, concurrent issuance, PDF download/denial, public verification, revocation, CSV and its authorization | `scripts/mvp-core-check.mjs` | 32/32 |
| Attendance in real Chrome: display QR rotates over a full 30 s window, phone-sized link check-in, live organizer update, no runtime errors | `scripts/mvp-browser-check.mjs` | 7/7 |
| UI audit, 360 px and 1280 px, 12 public and 26 signed-in pages across three roles: no horizontal overflow, no error boundary or stubs, labeled controls, image alt text, one `h1` per page, no console errors, no broken internal links | scratch audit (CDP) | pass after fixes |
| Security headers on live responses | `curl -I` | pass |

Edge cases covered by the suites above: duplicate registration; capacity limits under concurrency; unauthorized access per role; invalid, tampered, expired, future and wrong-event QR tokens; duplicate scans and time-outs; attendance outside the event window or after completion; ineligible certificates (absent, missing time-out, flags, identity review, revoked attendance, pending); duplicate issuance; revoked verification; RLS isolation for profiles, registrations, attendance, certificates, reports and Storage.

## 2. Implemented but not fully verified

- **Hosted email templates.** Auth logs from 2026-10-12 09:02Z show the development project still sends Supabase's default templates. That reset completed successfully end to end through the PKCE fallback. The branded templates are tested only as local HTML renders until pasted into the dashboard.
- **Actual email delivery** of confirmation and reset messages to a real inbox after the templates change.
- **The real admin account** (`lestertan110@gmail.com`) was not signed into by the agent; its password is the owner's. Admin capabilities were verified with disposable admin fixtures that run the same code paths.
- **Certificate preview iframe** under `X-Frame-Options: SAMEORIGIN`: same-origin framing is allowed by the standard, but the preview was not opened in a browser after the header change.
- **Ten page titles** added this session were verified by the audit; screen-reader behavior was not tested with an actual screen reader.
- **Session persistence across days** (refresh-token rotation) relies on Supabase defaults; only same-session persistence was tested.

## 3. Requires manual configuration

| Item | Where | Status |
|---|---|---|
| Paste branded **Confirm signup** and **Reset password** templates and subjects | Supabase → Authentication → Emails (dev and prod) | **not applied** (CLI not logged in; MCP has no Auth-config tool) |
| Site URL and Redirect URLs | Supabase → Authentication → URL Configuration | dev: documented as `http://localhost:3000` / `http://localhost:3000/**`, not readable here; prod: see DEPLOYMENT §3 |
| Custom SMTP, sender domain SPF/DKIM, link tracking off, rate limit | Supabase → Authentication → SMTP | not configured |
| Leaked password protection | Supabase → Authentication | off on development (advisor warning) |
| CAPTCHA (optional) | Supabase + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | not enabled |
| Second administrator (spec requires ≥ 2) | maintainer SQL, DEPLOYMENT §7 | only one admin on development |
| Official colleges, programs, categories | Admin → Lookups | development has placeholder `DEV-A`/`DEV-B` only |
| Privacy notice controller/contact (K-06) | `/privacy`, `lib/privacy.ts` | draft `2026-10-draft` |
| Production Supabase project, migrations, Vercel env, domain | DEPLOYMENT §1–6 | not created (approval required) |
| Remove unused `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` lines from local `.env.local` | developer machine | recommended; no code reads them |

Verified read-only on development via `/auth/v1/settings`: email confirmation required, sign-ups open, anonymous sign-ins off, email is the only provider.

## 4. Requires physical devices or production

- Camera QR scanning on real Android and iOS phones over HTTPS. Headless tests followed the QR **link**, not the camera.
- Attendance display legibility on a projector, and scanning from a distance and in venue lighting.
- Realtime under a full room of simultaneous check-ins on venue Wi-Fi or mobile data.
- PDF download and opening on mobile browsers; certificate printing.
- Email rendering in Gmail, Outlook and the Apple Mail apps.
- Production smoke tests (DEPLOYMENT §9).

## Not implemented (documented scope gaps)

- Admin identity-dispute resolution and identity-flag clearing (spec §5.5); `/admin/users` is a read-only search and summary.
- Admin event ownership transfer (spec §5.6).
- Items deferred by D-024: bulk workflows, certificate template editing, advanced analytics, station pairing, anonymous attendance.

## Rerunning the live checks

1. `npm run build && npx next start -p 3100`; for browser checks also start isolated Chrome:
   `chrome --headless=new --remote-debugging-port=9223 --user-data-dir=<temp dir>`.
2. Confirm the MCP project is `ldhpbfujqnyovovabvcg`, then seed the matching `supabase/tests/*-fixtures.sql`.
3. Run `node --env-file=.env.local scripts/<check>.mjs http://localhost:3100`.
4. Always apply the matching `*-cleanup.sql`.

Order and reuse: each fixture set supports one run. `mvp-browser-check` checks in `core-live-2`, so run `mvp-core-check` on **fresh** core fixtures (otherwise its concurrent-scan check correctly sees `already_timed_in`). Run `phase2-auth-check` before `phase2-actions-check` on the same phase2 fixtures. The recovery browser check needs a fresh `email-recovery-fresh` token.
