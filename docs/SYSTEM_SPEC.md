# EventHub — System Specification

**EventHub: A QR-Based Event Management and Attendance System with Automated Digital Certificate Generation for the College Local Council of Wesleyan University–Philippines**

Status: **REVISION 2 — APPROVED (2026-10-11).** Revision 1 was approved on 2026-10-10 and Phases 0–1 were built from it. Revision 2 records the design review of 2026-10-11 and was approved by the project team the same day, including the final consistency-review fixes (DECISIONS.md D-009 – D-016). Nothing new in this revision is implemented yet.
Companion documents: [PLAN.md](./PLAN.md) (build order, phases, verification), [DECISIONS.md](./DECISIONS.md) (decisions log).

### Markers used in this document

| Marker | Meaning |
|---|---|
| *(no marker)* | Decided by the project team. |
| **[DEFERRED]** | Approved as a later, optional item; not part of the MVP build. |
| **[CLIENT]** | Depends on the client (CLC / university). Not assumed approved. The design lets the answer be added later, usually without schema changes. |

The decision record (P-01 – P-23) and all client items are in §20.

---

## 0. Repository Baseline (inspected 2026-10-11)

| Item | Finding | Implication |
|---|---|---|
| Framework | Next.js **16.4.0**, React 19.3, App Router, Turbopack | `middleware.ts` is now **`proxy.ts`**. Request APIs (`cookies()`, `headers()`, `params`, `searchParams`) are async. |
| `next.config.ts` | `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback` | Components that read the session/cookies **must sit inside `<Suspense>`**. Follow `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`. |
| UI kit | shadcn/ui **`base-nova`** (Base UI), Tailwind v4, lucide icons; sidebar, sonner, radio-group, field, scroll-area, breadcrumb, toggle-group installed in Phase 0 | Base UI uses a `render` prop instead of Radix `asChild`. |
| Supabase libs | `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.117 | No service-role key in the app runtime; the design does not need one. |
| Database | Project `ldhpbfujqnyovovabvcg`: 7 migrations (Phase 1), **0 rows in every table**, security advisor clean | Because no data exists, Phase 1 objects can still be corrected in place by new migrations (§12.6). |
| Environments | Only one Supabase project exists today | It is designated the **development** project. A separate **production** project is created before deployment (§22). |
| Tests | Vitest (unit), pgTAP SQL suite run through the Supabase MCP integration (D-006) | `npm run test:db` needs the CLI link. |
| Git | Branch `main`, remote `origin/main` | DECISIONS.md D-002 was corrected on 2026-10-11 (it previously described a local branch without a remote). |

---

## 1. System Overview

EventHub lets students of Wesleyan University–Philippines discover and register for council events, check themselves in by scanning a rotating QR code at an attendance station, and receive verifiable digital certificates.

Core principles:

1. **One account, layered permissions.** Every user signs up the same way and is a Participant. Organizer is an extra permission granted by an Admin after an application. Admin is a flag set only by the maintainer. Each permission has its own dashboard.
2. **The database is the authority.** Authorization is enforced by PostgreSQL Row Level Security and `SECURITY DEFINER` functions. Next.js route guards and the server-side Data Access Layer improve UX and add a second check; they never replace RLS.
3. **State machines live in the database.** Status transitions happen only through database functions (RPCs) that validate them. Clients never write status or role columns.
4. **Store facts, derive the rest.** "Registration open", "ongoing", "absent", report totals and eligibility are computed, not stored.
5. **Self-service attendance with organizer oversight.** A valid scan of the station's rotating QR records attendance immediately. Organizers review risk flags and can revoke records. Certificates follow the event's attendance policy.
6. **Verified email, self-declared identity.** Every account must confirm its email address before using the app, which proves control of the inbox. It does **not** prove university enrollment: student IDs and names are self-declared. Uniqueness, identity locks, device signals, disputes and revocation reduce impersonation and proxy attendance but do not eliminate them.

---

## 2. Roles and Permissions

### 2.1 Role model

| Role | Storage | How it is obtained | Dashboard |
|---|---|---|---|
| Participant | Implicit: every confirmed account with a `profiles` row | Public sign-up + email confirmation + profile completion | `/dashboard` |
| Organizer | `profiles.organizer_status = 'active'` | Participant applies; an Admin approves | `/organizer` |
| Admin | `profiles.is_admin = true` | Set by the maintainer via SQL on an existing, email-confirmed account. **Never** through the UI or sign-up | `/admin` |
| Station device | `attendance_stations` row bound to an anonymous Supabase user | Organizer pairs a device with a one-time code | `/station/[eventId]` |

- **No public organizer or admin sign-up.** Sign-up always creates a Participant. Role columns (`is_admin`, `organizer_status`, `organizer_since`) are not writable by any client role, and `handle_new_user()` never reads roles from sign-up metadata.
- `organizer_status` values: `none`, `active`, `suspended` (admin can reinstate), `revoked` (must apply again).
- **Participants are WU-P students only** in the MVP. Faculty, staff, alumni and guests are out of scope.
- Organizer status is a column on `profiles`, not a separate roles table. There is exactly one organizer permission and it is checked in nearly every policy; history lives in `organizer_applications` and `audit_logs`.
- An approved organizer keeps full participant access and may register for events they do **not** own. Nobody may register for their own event.
- **Admin provisioning procedure:** the person signs up and confirms their email like everyone else; the maintainer verifies the person's identity outside the system, then runs a documented SQL statement on the production database that sets `is_admin = true` and writes an `admin.granted` audit entry. Removing admin access is the reverse procedure. At least **two** admin accounts exist so that an admin's own organizer application can be reviewed by another admin. Who the admins are is **[CLIENT]**.
- **Admins and the student profile:** an admin (for example a faculty adviser) is not forced through student onboarding and can use the Admin Dashboard without a complete profile. Participant actions (registering, applying, scanning) still require a complete student profile.
- **Station device:** an anonymous Supabase user created on the station laptop, bound to one event by a pairing code. It can only fetch QR tokens and read that event's check-in feed (§9.6). It is not a user role and has no dashboard navigation.

### 2.2 Dashboards and switching

- One authenticated shell (`(app)` route group) with three dashboards: **Participant** (`/dashboard`), **Organizer** (`/organizer`), **Admin** (`/admin`).
- A **dashboard switcher** in the top bar lists only the dashboards the user can open (Participant always; Organizer when `organizer_status <> 'none'`; Admin when `is_admin`). Switching is plain navigation; there is no "active role" state that changes permissions.
- The sidebar shows the navigation of the current dashboard plus a compact link to the others.
- Default landing after sign-in: Participant dashboard; an admin without a complete student profile lands on `/admin`.
- Each dashboard's layout calls the matching DAL guard (`requireUser`, `requireOrganizer`, `requireAdmin`). RLS and RPC checks apply regardless of which dashboard the request came from.

### 2.3 Permission matrix

| Capability | Participant | Organizer (active) | Organizer (suspended/revoked) | Admin | Station device |
|---|---|---|---|---|---|
| Manage own profile | ✓ | ✓ | ✓ | ✓ | — |
| Browse/search published events | ✓ | ✓ | ✓ | ✓ | — |
| Register / cancel own registration (not own events) | ✓ | ✓ | ✓ | ✓ (with complete profile) | — |
| Scan attendance QR | ✓ | ✓ | ✓ | ✓ (with complete profile) | — |
| View/download own certificates | ✓ | ✓ | ✓ | ✓ | — |
| Apply for organizer access | ✓ (status `none` or `revoked`, no pending application) | — | revoked only | ✓ (reviewed by another admin) | — |
| Create/edit/publish own events | — | ✓ | — | — | — |
| Manage registrations, attendance sessions, stations, flags, certificates of own events | — | ✓ | read-only + exports | — | — |
| Show QR + read check-in feed of one paired event | — | — | — | — | ✓ |
| Review organizer applications; suspend/reinstate/revoke organizers | — | — | — | ✓ | — |
| Manage colleges, programs, event categories | — | — | — | ✓ | — |
| Resolve student-ID disputes; identity flags | — | — | — | ✓ | — |
| Transfer event ownership (audited) | — | — | — | ✓ | — |
| View system overview | — | — | — | ✓ | — |
| Manage another organizer's event registrations/attendance | — | — | — | ✗ (out of scope) | — |
| Grant admin | — | — | — | ✗ (maintainer only, SQL) | — |

---

## 3. Account and Participant Flow

### 3.1 Sign-up and email confirmation

1. **Sign up** at `/signup`: first name, last name, personal email, password, CAPTCHA (Cloudflare Turnstile). Any email domain is accepted (C1 closed: students use personal emails). Password: at least 8 characters with letters and digits.
2. Supabase Auth creates the user **unconfirmed** and sends a confirmation email through the client-owned SMTP provider. No session is issued.
3. `/signup/check-email` page: "We sent a confirmation link to {email}." with **Resend email** (cooldown 60 s, CAPTCHA) and "Wrong address? Sign up again."
4. The user clicks the link → `/auth/confirm?token_hash=…&type=email&next=/onboarding` → server verifies the token → session created **on the device where the link was opened** → redirect to onboarding with a "Email confirmed" toast.
5. **Expired or already-used link** → `/auth/error?reason=link_expired` with an email field and **Resend confirmation**. Link validity: Supabase `otp_expiry`, default 1 hour; set to 24 hours.
6. **Signing in before confirming** → Supabase returns "Email not confirmed" → the login form shows "Confirm your email first" with **Resend confirmation**.
7. Unconfirmed accounts cannot obtain a session, so they cannot reach any app page or call any RPC. **[DEFERRED]** A scheduled purge of unconfirmed accounts older than 7 days is optional hygiene for Phase 12; it is not needed for correctness because unconfirmed accounts cannot log in or claim a student ID.

Supabase sign-up does not reveal whether an email is already registered when confirmation is enabled (it returns an obfuscated user and sends nothing). The UI therefore always shows the same "check your email" page.

### 3.2 Onboarding (profile completion)

Required after confirmation and before any participant action:

1. **Privacy notice and consent** (Data Privacy Act of 2012) → records `privacy_consented_at` and the notice version.
2. Student ID (format check + uniqueness), college, program (filtered by college), year level, optional middle name and suffix.
3. **Profile photo** (required): JPG/PNG/WEBP, resized client-side to 512 px.

When all are present, `profiles.is_complete` becomes true and the Participant Dashboard unlocks registration.

- **Student ID already taken:** "This student ID is already registered. If it is yours, contact an admin." → dispute flow (§5).
- **Identity lock:** while the user has an *approved* registration for a published event that has not ended, they cannot change their **student ID** or **profile photo**. Names stay editable so typos can be corrected (issued certificates keep their snapshot; organizers can refresh it). The profile page explains which event holds the lock.

### 3.3 Sign-in, recovery, sign-out

- **Sign in:** email + password (+ CAPTCHA). `next` parameter restored after login (same-origin relative paths only).
- **Forgot password:** email (+ CAPTCHA) → always "If an account exists, we sent a link." → email → `/auth/confirm?token_hash=…&type=recovery&next=/reset-password` → new password → `signOut({ scope: 'others' })` so any other sessions end.
- **Expired recovery link:** `/auth/error?reason=link_expired` with "Send a new reset link".
- **Email change:** not offered in the MVP; the maintainer corrects addresses on request through the Supabase dashboard and records an `account.email_corrected` audit entry. Supabase's secure email change (confirmation to both addresses) can enable self-service later.
- **Sign out:** POST `/auth/signout`.

### 3.4 Participant journey

1. **Participant Dashboard**: next registered event, registrations awaiting approval, an "Attendance open — Scan now" banner when an event they are approved for has an open session, recent certificates, incomplete-profile prompt.
2. **Explore Events** (§17): tabs, search, filters, pagination.
3. **Event details**: banner, title, category, host college, date/time, venue, description, capacity indicator, registration window, approval mode, attendance policy ("Time-in and time-out required"), certificate availability, context-aware action (§18).
4. **Register** — explicit button. Result: `approved` (automatic mode), `pending` (manual mode), or a clear error.
5. **Join via invite**: invite QR or link opens event details; codes typed at `/events/join`. Never auto-registers.
6. **My Events**: Upcoming / Pending approval / Past / Cancelled-or-rejected, with registration status and attendance (timed in / timed out / absent / revoked).
7. **Attendance**: at the venue, scan the station QR with the in-app scanner or the phone camera. The result appears on the phone immediately (§9.3). If on-site registration is enabled and the user is not registered, the result offers **Register on-site**, then asks them to scan again.
8. **My Certificates**: list, preview, download PDF, copy verification link.
9. **Become an Organizer**: apply, track status, see rejection notes, reapply.

---

## 4. Organizer Application Flow

### 4.1 Fields

Pulled from the profile and shown read-only: full name, student ID, college, program, account email (confirmed).

| Field | Type | Validation |
|---|---|---|
| Organization / council name | text | required, 3–150 chars |
| Position / role in organization | text | required, 2–100 chars |
| Contact number | text | required, PH mobile `^(\+63\|0)9\d{9}$` |
| Reason for requesting access | textarea | required, 50–1000 chars |
| Proof of authorization / appointment | file | **required**; PDF/JPG/PNG; ≤ 5 MB. Acceptable documents **[CLIENT]** |
| Supporting document | file | optional; PDF/JPG/PNG; ≤ 5 MB |
| Data-privacy consent | boolean | required |

Not collected: home address, birthdate, government IDs, parents' info.

### 4.2 Statuses and rules

`pending` → `approved` | `rejected`; `pending` → `withdrawn` (by applicant).

- Eligible to apply: confirmed email, complete profile, `organizer_status IN ('none','revoked')`, no pending application.
- At most one pending application per user (partial unique index).
- Rejection requires `review_notes`. The user may reapply immediately; history is kept.
- An admin cannot review their own application (CHECK + RPC).
- Approval atomically sets the application `approved`, `profiles.organizer_status = 'active'`, `organizer_since = now()`, and writes an audit entry. The Organizer Dashboard appears in the switcher on the next navigation.
- Submitted documents are immutable.

---

## 5. Admin Flow (Admin Dashboard `/admin`)

1. **Overview**: total users, active organizers, pending applications, events by status, events this month, open identity disputes.
2. **Applications**: table by status (default `pending`, oldest first); detail page with applicant profile, fields, documents via 60 s signed URLs, prior applications; **Approve** / **Reject** (reason required).
3. **Organizers**: users with `organizer_status <> 'none'`; Suspend (reason), Reinstate (from suspended), Revoke (reason, permanent). Suspend/revoke closes the organizer's open attendance sessions and revokes their station devices. The dialog shows the number of affected upcoming events and offers **Transfer ownership**.
4. **Lookups** (`/admin/lookups`): colleges, programs per college, event categories — add, rename, deactivate; never delete. Deactivated items stay on existing records and disappear from pickers. The list contents are **[CLIENT]**.
5. **Users** (`/admin/users`): search by name, email or student ID.
   - **Resolve student-ID dispute**: clears `student_id` on the holding account (its profile becomes incomplete), sets an **identity flag** with a reason, and lists that account's issued certificates for review by the respective event owners. Audit-logged.
   - **Clear identity flag** with a note. Audit-logged.
   - Deletion/anonymization requests are **not** handled in the UI; they follow the maintainer-assisted procedure in §21.2.
6. **Transfer event ownership** (from the event's admin view or the organizer dialog): new owner must be an active organizer with no registration for that event; reason required; allowed for any status, including completed; closes open sessions and revokes station devices; previous owner loses access immediately; audit entry `event.ownership_transferred` with old and new owner.
7. Admins do **not** manage registrations, attendance or certificates of events.

---

## 6. Organizer Flow (Organizer Dashboard `/organizer`)

1. After approval the Organizer Dashboard is available from the switcher; participant features remain.
2. **Dashboard**: upcoming own events, pending registration counts, attendance open indicators, flags to review, events awaiting **Mark as completed**, completed events with certificates not yet generated.
3. **Create event** → `draft`. **Publish** validates required fields.
4. **Event workspace** tabs: Overview · Registrations · Attendance · Certificates · Reports · Settings.
5. **Share**: invite code, invite QR (PNG), direct link; regenerate code.
6. **Registrations**: review, approve/reject (single and bulk).
7. **Attendance**: settings (policy, lead time, on-site registration) in event settings; on the day: open a time-in session, **pair station devices** with a one-time code, watch the live feed, review ⚠ flags, approve on-site registrants (manual mode), open the time-out session if required, close. Manual time-in/time-out and revocation with reasons.
8. **Mark as completed** after the event.
9. **Certificates**: template, field placement, preview, Generate Certificates; review list for identity-flagged holders.
10. **Reports**: summary, CSV exports, printable report.
11. **Cancel event** (reason) at any time before completion.

---

## 7. Event Specification

### 7.1 Fields and validation

All times are `timestamptz`, displayed in **Asia/Manila**. The form combines date + time pickers in the Asia/Manila zone.

| Field | Column | Draft | Publish | Validation |
|---|---|---|---|---|
| Title | `title` | ✓ | ✓ | 5–150 chars, trimmed |
| Description | `description` | — | ✓ | 20–5000 chars, plain text |
| Banner | `banner_path` | — | — | JPG/PNG/WEBP ≤ 5 MB, 16:9 recommended |
| Category | `category_id` | — | ✓ | FK `event_categories` |
| Host college | `host_college_id` | — | — | FK `colleges`; NULL = university-wide |
| Venue | `venue` | — | ✓ | 3–200 chars |
| Start | `starts_at` | — | ✓ | In the future at publish time |
| End | `ends_at` | — | — | `> starts_at`; max 7 days after start |
| Registration opens | `registration_opens_at` | — | ✓ | `< registration_closes_at` |
| Registration deadline | `registration_closes_at` | — | ✓ | `<= starts_at` |
| Max participants | `capacity` | — | — | NULL = unlimited, else 1–5000 |
| Approval mode | `approval_mode` | ✓ (default `automatic`) | ✓ | `automatic` \| `manual` |
| Visibility | `visibility` | ✓ (default `public`) | ✓ | `public` \| `unlisted` |
| Certificates enabled | `certificates_enabled` | ✓ (default `false`) | ✓ | boolean |
| Attendance policy | `attendance_policy` | ✓ (default `time_in_only`) | ✓ | `time_in_only` \| `time_in_and_out` |
| Attendance lead time | `attendance_opens_minutes_before` | ✓ (default 60) | ✓ | 0–180 minutes |
| On-site registration | `allow_onsite_registration` | ✓ (default `false`) | ✓ | boolean |

Draft checks are enforced by Zod; publish checks again in `publish_event`.

**Effective end**: `ends_at`, or 23:59:59 Asia/Manila of the start day when `ends_at` is NULL.

### 7.2 Event status (stored)

| Status | Meaning |
|---|---|
| `draft` | Owner only. Editable. Deletable. |
| `published` | Visible to participants. Editable with restrictions (§7.4). |
| `completed` | Finished. No new attendance sessions. Certificates may be generated. Read-only except certificate settings and **audited attendance corrections** (§9.4) for registrations that have no certificate yet. |
| `cancelled` | Will not happen. Read-only. No attendance or certificates. |

Transitions: `draft → published`, `draft → deleted`, `published → completed` (only after `starts_at`), `published → cancelled` (reason). Completed and cancelled are terminal. No `archived` status.

### 7.3 Event phase (derived, never stored)

| Phase | Condition |
|---|---|
| `upcoming` | `now < registration_opens_at` |
| `registration_open` | window open and not full |
| `registration_full` | window open, approved count ≥ capacity |
| `registration_closed` | `registration_closes_at ≤ now < starts_at` |
| `ongoing` | `starts_at ≤ now ≤ effective_end` |
| `awaiting_completion` | `now > effective_end`, still `published` |

Implemented as SQL `event_phase(events)` and mirrored in TypeScript for display only. Event phase and attendance session status are independent.

### 7.4 Editing a published event

- Cannot change `organizer_id` (only via the admin transfer RPC), `status`, `invite_code` (only via `regenerate_invite_code`).
- `capacity` cannot go below the approved count.
- manual → automatic does not auto-approve pending registrations.
- Dates may change while no attendance session has ever been opened; the UI warns that registrants are not notified.
- `attendance_policy` and `attendance_opens_minutes_before` are locked once the first attendance session is opened.
- `certificates_enabled` can be toggled until certificates are issued.

---

## 8. Registration Lifecycle

Statuses: `pending`, `approved`, `rejected`, `cancelled`. Channel: `online` | `onsite`.

```
               (automatic mode)
register ─────────────────────────► approved ─┐
   │                                   ▲      │ organizer rejects (only if no attendance record)
   │ (manual mode)                     │      ▼
   └──► pending ──── organizer ────────┘   rejected
           │  └──── organizer rejects ───────►┘
           └── participant cancels ──► cancelled ◄── participant cancels approved (before start, no attendance)
cancelled ──► re-register (same row reused) ──► pending/approved
```

Rules (all enforced in RPCs):

1. One row per (event, user). Re-registering after `cancelled` reuses the row. A duplicate press returns the existing status.
2. Register allowed only if: event `published`; phase `registration_open` **or** (on-site registration enabled **and** a time-in session of the event is open); profile complete; user is not the event owner; no existing `pending`/`approved`/`rejected` row.
3. Rejected users cannot re-register for the same event.
4. Capacity counts approved registrations only, under `SELECT … FOR UPDATE` on the event row. Manual mode refuses new pending registrations once approved = capacity.
5. No waitlist.
6. Organizer decisions are allowed while the event is `published` and before `effective_end`.
7. Approved → rejected only without an attendance record; reason required.
8. Participant cancellation until `starts_at`, only without an attendance record.
9. Registrations of a cancelled event are kept for history.
10. **On-site registrations** follow the event's normal approval mode and capacity. In manual mode the registrant must be approved before checking in; the Attendance tab lists "On-site, awaiting approval" (a filtered view) whose Approve button uses the same `decide_registrations` RPC as the Registrations tab. A new walk-in still needs a confirmed email and complete profile, so on-site sign-up depends on timely email delivery at the venue.

### 8.1 Bulk actions (manual approval)

- Status tabs (Pending default, Approved, Rejected, Cancelled, All), search by name/student ID, channel filter, 50 rows per page.
- Row checkboxes; header checkbox selects the current page only. **Selection clears on any filter, search or page change.**
- **Approve selected**, **Reject selected** (optional reason), **Approve all pending (N)** with server count and remaining capacity.
- `decide_registrations(event_id, ids[], decision, reason)` (≤ 500 ids; only pending rows of that event; approvals oldest-first up to capacity) and `approve_all_pending(event_id)` return `{ approved, rejected, skipped_not_pending, skipped_capacity }`.

---

## 9. Attendance Lifecycle

### 9.1 Attendance policy and sessions

- Each event has an **attendance policy**: `time_in_only` or `time_in_and_out`.
- `attendance_sessions` have a `kind` (`time_in` | `time_out`), a `status` (`open` | `closed`) and a `closes_at`.
- **One open session per event** (partial unique index).
- **Attendance window:** from `starts_at − attendance_opens_minutes_before` until `effective_end + 60 minutes` (the grace lets organizers open time-out when an event runs late). A session can be opened anywhere inside this window, while the event is `published`, by the owner as an active organizer.
- Every session gets `closes_at` = the end of the attendance window. A session past `closes_at` is treated as closed by every RPC, so no background job is required for expiry.
- **Opening a time-out session closes the time-in session.** Time-out sessions exist only for `time_in_and_out` events.
- **No time-in after time-out has started:** once any time-out session has been opened for the event, `open_attendance_session(…, 'time_in')` is refused (`time_out_started`). Late arrivals after that point can only be added by an audited manual time-in.
- A closed time-in session may be followed by another time-in session (accidental close) as long as no time-out session has been opened. A closed time-out session may be followed by another time-out session. There is still exactly one attendance record per registration.
- **Completion warning:** before `complete_event`, the dialog shows open flags and, for `time_in_and_out` events, the number of attendees without a time-out ("Policy requires time-out; N attendees have none. Open time-out or record manual time-outs first."). Completion is allowed after confirmation.
- Completing or cancelling the event, transferring ownership, and suspending/revoking the organizer close open sessions and revoke station devices.
- Multi-day or AM/PM attendance remains out of scope.

### 9.2 Dynamic QR token

- On session open the database generates a 32-byte secret in `attendance_session_secrets` (no client grants).
- 30-second windows: `w = floor(epoch(now) / 30)`.
- Token = `base64url( session_id[16] ‖ w[4] ‖ HMAC-SHA256(secret, session_id ‖ w)[first 16] )`.
- QR payload: `{NEXT_PUBLIC_APP_URL}/scan?t=<token>`.
- A token is accepted **only during its own window and the next one** (≤ 60 s). A token for a future window is rejected until that window begins.
- `station_get_qr(event_id)` returns tokens for the **current window and the next two** (`{ token, valid_from, valid_until }[]`) plus the server time, so the station can keep displaying a valid code through a network drop of up to ~90 s. The secret never leaves the database. Closing the session invalidates every token immediately (check 3 below).
- All time checks use the database clock.

### 9.3 Scan

`submit_attendance_scan(token, device_id, expected_event_id default null)` — called by the signed-in participant; checks in order:

| Order | Check | Result code | Participant message |
|---|---|---|---|
| 1 | Signed in with a permanent (non-anonymous) account | `unauthenticated` / `not_participant` | Redirect to login, then back to `/scan` with the camera open: "You're signed in — scan the code again." |
| 2 | Token decodes, HMAC valid | `invalid_qr` | "This is not a valid EventHub attendance code." |
| 3 | Session `open` and `now() < closes_at` | `attendance_closed` | "Attendance for {event} is closed." |
| 4 | Window current or previous | `expired_qr` | "This code has expired. Scan the code on the screen now." |
| 5 | `expected_event_id` matches (if given) | `wrong_event` | "This code is for {other event}." |
| 6 | Profile complete | `profile_incomplete` | "Complete your profile first." |
| 7 | Registration exists | `not_registered` (+ `onsite_available`) | "You are not registered for {event}." / **Register on-site** |
| 8 | Registration approved | `registration_not_approved` | "Your registration is {pending/rejected/cancelled}." |
| 9 | Record not revoked | `attendance_revoked` | "Your attendance was revoked. Please see the organizer." |
| 10a | *Time-in session:* no time-in yet | `timed_in` / `already_timed_in` | "Timed in at 9:14 AM." / "Already timed in at 9:14 AM." |
| 10b | *Time-out session:* time-in exists, no time-out yet | `timed_out` / `time_in_required` / `already_timed_out` | "Timed out at 11:02 AM." / "No time-in recorded. See the organizer." / "Already timed out at 11:02 AM." |

- The result is final; there is no waiting or confirmation screen.
- `INSERT … ON CONFLICT (registration_id)` and conditional updates prevent duplicates.
- **Device signal:** the scan page creates a random device ID stored in the browser (localStorage + cookie) and sends it with every scan. After a successful 10a/10b the database stores `sha256(device_id ‖ event_id)` in `attendance_device_signals`. If the same hash is already linked to a **different user in the same event**, every affected record gets `flag = 'shared_device'`. The signal is evidence for review, not proof; clearing browser data evades it.
- **No post-login recovery ticket:** tokens are never stored; a participant who had to log in simply scans again.

### 9.4 Organizer actions

Owner + active organizer; every action requires a reason or note and is audit-logged:

| RPC | Effect |
|---|---|
| `manual_time_in(registration_id, reason)` | Creates/sets time-in with `method = 'manual'` (no phone, dead battery, late arrival after time-out started). |
| `manual_time_out(record_id, reason)` | Sets time-out with `method = 'manual'`. |
| `revoke_attendance(record_id, reason)` | `present → revoked`. If a certificate exists, it must be revoked first. |
| `resolve_attendance_flag(record_id, resolution, note)` | `cleared` (keep) or `revoked` (revokes the record). |
| `get_attendance_list(event_id)` | Owner-only list for the Attendance tab: registrant display data, times, methods, flags, and the reasons/notes read from `audit_logs`. |

**When corrections are allowed:** while the event is `published`, and **after completion** for any registration that has no certificate yet. This is how flags are reviewed and resolved before Generate Certificates. Not allowed on cancelled events or for registrations that already hold a certificate (revoke the certificate first).

**Reasons are private:** reasons and notes are stored only in `audit_logs` metadata, never on `attendance_records`, so nothing free-text is readable by station devices (§9.6).

Removed from Revision 1: `confirm_attendance`, `dismiss_attendance`, the pending state, the station focus card and "Not this person". On-site approvals reuse `decide_registrations` (no separate RPC).

### 9.5 Attendance statuses

Stored: `present`, `revoked`. Each record holds `time_in_at` and (if applicable) `time_out_at`.
Derived: **absent** = approved registration with no present record after completion; **incomplete** = time-in without time-out under `time_in_and_out`.

### 9.6 Attendance station

**Pairing (no organizer credentials on the station device):**
1. Organizer, in the Attendance tab on their own device, clicks **Add station** → `create_station_pairing(event_id, label)` returns an 8-character code valid for **5 minutes**, single use (stored hashed).
2. On the station laptop, `/station` signs in **anonymously** (CAPTCHA) using a **separate auth cookie name**, so an organizer session in the same browser is not replaced. The operator types the code → `claim_station_pairing(code)` binds the anonymous user to the event. The grant expires at the event's latest possible `closes_at`.
3. If the station browser also holds an organizer session, the station shows: "An organizer is signed in on this device. Sign out before leaving it unattended."
4. The organizer sees paired stations (label, last seen) and can **revoke** any. Transfer, cancel, completion, suspension and revocation revoke all.

**Station layout (laptop 1366×768 and tablet landscape):**
- **Left panel:** event name; large rotating QR (≥ 320 px); session status (Time-in open / Time-out open / Closed) and countdown ring; short participant instructions ("Open your camera or EventHub → Scan").
- **Right panel:** realtime feed of successful check-ins, newest first with a brief highlight (respects `prefers-reduced-motion`): profile photo, name, college, status (Timed in / Timed out), ⚠ marker for flagged records. Counters: Present / Approved, Timed out, Flagged.
- **Never shown:** student IDs, emails, programs/year, registration errors, revocation reasons or organizer notes. Failed scans show details only on the participant's phone.
- **Photos** are loaded through signed URLs that expire after **10 minutes** (the station re-signs as needed), so a revoked or expired station cannot keep using old links for long.
- **Data the station can read at all:** its own event's sessions and `attendance_records` rows (ids, times, methods, status, flag — no free text), and through `station_feed` the name, college and photo path of people with a present record. It cannot read `events`, `profiles`, registrations, device signals, secrets, audit logs or any other event. Event title and session state come from `station_get_qr`.
- The privacy notice states that check-ins are shown on the station screen (photo, name, college).
- Connection indicator (Live / Reconnecting / Polling); states for unpaired, session closed, grant revoked or expired.
- Session controls (open/close time-in, open time-out) are on the organizer's own device, not on the station.

### 9.7 Security formula and residual risk

Confirmed email + complete profile + approved registration + valid rotating QR (≤ 60 s) + device signal + organizer review/revocation (+ time-out when required) = recorded attendance.

Residual risk, accepted and documented: a registrant who is absent can still be checked in if someone at the venue relays the live QR to them within 60 s and they use their own device. Time-out, flags and organizer review reduce this; nothing short of human or biometric verification removes it.

---

## 10. Certificate Lifecycle

### 10.1 Template configuration

1. Organizer enables certificates on the event.
2. Uploads a PNG/JPG background (≤ 10 MB, A4/Letter, 150–300 DPI). PDF backgrounds are out of MVP scope.
3. Constrained editor with draggable fields:

| Field key | Content | Default |
|---|---|---|
| `recipient_name` | Participant full name (snapshot) | ✓ (cannot be disabled) |
| `event_title` | Event title | ✓ |
| `event_date` | e.g. "October 10, 2026" | ✓ |
| `certificate_number` | e.g. `CLC-2026-000123` | ✓ |
| `signatory_text` | Free text, up to 2 lines | — |
| `verification_qr` | QR to the public verify page | ✓ |

Per text field: position (0–1 fractions), pdf-lib standard font, size 8–96 pt, alignment, color; name auto-shrinks to a max width. QR: position and size. Standard PDF fonts only in the MVP.

4. **Preview** renders a real PDF with the same renderer as final certificates.
5. **Save** creates a template version.

### 10.2 Template versioning

Versions per event; one active; a version referenced by any certificate is immutable; editing creates a new version; **Apply current template to issued certificates** updates `template_id` only.

### 10.3 Eligibility

A participant is eligible when all hold:
- Event `completed`, `certificates_enabled`, active template.
- Registration `approved`.
- Attendance record `present` with `time_in_at`, **and** `time_out_at` when the policy is `time_in_and_out`.
- No unresolved `shared_device` flag on the record.
- Holder not under an identity flag.
- No existing certificate for the registration.

`get_certificate_eligibility(event_id)` returns: eligible, issued, missing_time_out, blocked_by_flags, identity_review, revoked_attendance. The Certificates tab shows each count with a link to the affected list.

### 10.4 Generation

**Generate certificates** → `issue_certificates(event_id)` issues all eligible in one transaction with `ON CONFLICT (registration_id) DO NOTHING`; returns issued and skipped counts by reason. Each row snapshots `recipient_name`, `event_title`, `event_date`, gets `CLC-{YYYY}-{NNNNNN}` from a sequence and a random ~22-char `verification_code`.

PDFs are rendered on demand from the immutable snapshot and template version; no generated files are stored.

### 10.5 Participant access

My Certificates: list, inline preview, download `EventHub-Certificate-{number}.pdf`. Visible only after issuance; revoked certificates cannot be downloaded.

### 10.6 Public verification

`/verify/[code]` (no login) calls `verify_certificate(code)` (anon) and shows only: recipient name, event title, event date, certificate number, issued date, organizer organization, status (Valid / Revoked). Wording: "Issued by {organization} through EventHub to the account holder named {name}." `/verify` also accepts number + code. `noindex`.

### 10.7 Revocation and corrections

- `revoke_certificate(id, reason)` — organizer; verify page shows Revoked.
- `refresh_certificate_name(id)` — organizer; replaces the name snapshot; number and code unchanged; audit-logged.
- **Identity-flagged holders:** their issued certificates appear in a review list on each affected event's Certificates tab; the organizer revokes or keeps them (audit-logged).

**Attendance QR = check-in. Certificate QR = authenticity verification.** They never share format or route.

---

## 11. Business Rules (consolidated)

1. Email must be confirmed before any app access.
2. Profile (photo, privacy consent, student fields) must be complete before registering, scanning or applying as organizer.
3. Sign-up always creates a Participant; organizer status only through admin approval; admin only through the maintainer.
4. One registration row per (event, user); one attendance record per registration (time-in and optional time-out); one certificate per registration.
5. One pending organizer application per user.
6. One open attendance session per event; sessions expire at `closes_at`.
7. One active certificate template per event; referenced templates are immutable.
8. Capacity counts approved registrations only, enforced under a row lock; never set below the approved count.
9. Nobody registers for their own event.
10. Organizers act only on their own events and only while `organizer_status = 'active'`; suspended/revoked organizers have read-only access to their own events.
11. Admins cannot review their own application.
12. Status and role columns are written only by RPCs (roles: admin RPCs and maintainer SQL).
13. Completed and cancelled events are terminal.
14. Certificates follow §10.3.
15. Invite links/QR/code only open event details; registration is always explicit.
16. Student ID and profile photo lock while an approved registration for a not-yet-ended published event exists; names stay editable.
17. Station devices act only through an active, unexpired grant for one event.
18. Anonymous users can never act as participants, organizers or admins.
19. Event ownership changes only through the admin transfer RPC.
20. All timestamps `timestamptz`; display timezone Asia/Manila.

---

## 12. Database Schema

Conventions: `snake_case`; `uuid` PKs for user-facing entities, `smallint`/`bigint identity` for lookups/logs; `created_at`/`updated_at` with `private.set_updated_at()`; RLS enabled on every `public` table; FKs indexed; internal helpers in schema `private` (not exposed through the Data API).

### 12.1 Enums

```sql
create type organizer_status          as enum ('none','active','suspended','revoked');          -- exists
create type application_status        as enum ('pending','approved','rejected','withdrawn');     -- exists
create type event_status              as enum ('draft','published','completed','cancelled');     -- exists
create type event_visibility          as enum ('public','unlisted');                             -- exists
create type approval_mode             as enum ('automatic','manual');                            -- exists
create type registration_status       as enum ('pending','approved','rejected','cancelled');     -- exists
create type attendance_session_status as enum ('open','closed');                                 -- exists
create type check_in_method           as enum ('qr','manual');                                   -- exists
create type attendance_status         as enum ('present','revoked');        -- CHANGED (was pending/present/dismissed)
create type attendance_session_kind   as enum ('time_in','time_out');       -- NEW
create type attendance_policy         as enum ('time_in_only','time_in_and_out'); -- NEW
create type attendance_flag           as enum ('shared_device');            -- NEW
create type flag_resolution           as enum ('cleared','revoked');        -- NEW
create type registration_channel      as enum ('online','onsite');          -- NEW
```

### 12.2 Tables

#### `colleges` (lookup, admin-managed) — exists
`id smallint identity`, `code` (2–15, `^[A-Z0-9-]+$`, unique), `name` (3–150, unique), `is_active`, `created_at`. **Change:** admin insert/update policies and grants; no delete.

#### `programs` (lookup, admin-managed) — NEW
`id smallint identity`, `college_id smallint FK → colleges`, `name text` (2–120), `is_active boolean default true`, `created_at`, `updated_at`. `UNIQUE (college_id, name)`, `UNIQUE (college_id, id)` (target of the profiles composite FK). Read: anon + authenticated. Write: admin insert/update only.

#### `event_categories` (lookup) — exists
`id`, `slug`, `name`, `sort_order`, `is_active`. **Change:** admin-managed like colleges.

#### `profiles` — exists, changes marked
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK `auth.users` ON DELETE CASCADE |
| `email` | text NOT NULL | Copied by trigger; not user-editable |
| `first_name`, `middle_name`, `last_name`, `suffix` | text | names 1–80 chars (middle name optional); suffix 1–10 (e.g. Jr., III) |
| `student_id` | text NULL UNIQUE | provisional format `^[A-Za-z0-9-]{4,20}$` until **[CLIENT]** C2 |
| `college_id` | smallint NULL FK | |
| `program_id` | smallint NULL | **NEW**, replaces `program text`; composite FK `(college_id, program_id) → programs(college_id, id)` |
| `year_level` | smallint NULL | 1–6 |
| `avatar_path` | text NULL | must start with `{id}/` |
| `privacy_consented_at` | timestamptz NULL | **NEW**, set by `accept_privacy_notice()` |
| `privacy_notice_version` | text NULL | **NEW** |
| `is_complete` | boolean GENERATED | **CHANGED:** names, student_id, college_id, program_id, year_level, avatar_path, privacy_consented_at all not null |
| `is_admin` | boolean NOT NULL default false | Maintainer SQL only |
| `organizer_status`, `organizer_since`, `organizer_status_reason` | | Admin RPCs only |
| `identity_flagged_at`, `identity_flag_reason` | | **NEW**, admin RPCs only |
| `created_at`, `updated_at` | | |

- Created by `handle_new_user()` on `auth.users` insert. **Change:** skips anonymous users (`new.is_anonymous`), so station devices never get a profile.
- Column UPDATE grants for `authenticated`: names, suffix, `student_id`, `college_id`, `program_id`, `year_level`, `avatar_path`.
- Triggers: identity lock on `student_id` and `avatar_path` (§11 rule 16; names stay editable); `student_id` locked once the user holds a certificate. The admin dispute RPC bypasses both via a transaction-local setting.

#### `organizer_applications` — unchanged
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `applicant_id` | uuid NOT NULL FK → profiles | |
| `organization_name` | text NOT NULL | 3–150 |
| `position_title` | text NOT NULL | 2–100 |
| `contact_number` | text NOT NULL | regex CHECK |
| `reason` | text NOT NULL | 50–1000 |
| `proof_document_path` | text NOT NULL | `organizer-requirements` bucket |
| `supporting_document_path` | text NULL | |
| `status` | application_status NOT NULL default `pending` | |
| `submitted_at` | timestamptz NOT NULL default now() | |
| `reviewed_by` | uuid NULL FK → profiles | CHECK `reviewed_by <> applicant_id` |
| `reviewed_at` | timestamptz NULL | |
| `review_notes` | text NULL | CHECK required when `rejected` |
| `created_at`, `updated_at` | | |

`UNIQUE (applicant_id) WHERE status = 'pending'`; indexes `(status, submitted_at)`, `(applicant_id, submitted_at desc)`. The latest approved application's `organization_name` is the organizer's displayed organization.

#### `events` — new columns marked
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organizer_id` | uuid NOT NULL FK → profiles | Default `auth.uid()`; changed only by `transfer_event_ownership` |
| `title` | text NOT NULL | |
| `description` | text NULL | |
| `banner_path` | text NULL | |
| `category_id` | smallint NULL FK | |
| `host_college_id` | smallint NULL FK | NULL = university-wide |
| `venue` | text NULL | |
| `starts_at` | timestamptz NULL | Required to publish |
| `ends_at` | timestamptz NULL | CHECK `> starts_at` |
| `registration_opens_at` | timestamptz NULL | |
| `registration_closes_at` | timestamptz NULL | CHECK `> registration_opens_at` and `<= starts_at` |
| `capacity` | integer NULL | 1–5000 |
| `approval_mode` | approval_mode NOT NULL default `automatic` | |
| `visibility` | event_visibility NOT NULL default `public` | |
| `certificates_enabled` | boolean NOT NULL default false | |
| `attendance_policy` | attendance_policy NOT NULL default `time_in_only` | **NEW**; locked after first session |
| `attendance_opens_minutes_before` | smallint NOT NULL default 60 | **NEW**; CHECK 0–180 |
| `allow_onsite_registration` | boolean NOT NULL default false | **NEW** |
| `invite_code` | text NOT NULL UNIQUE | 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` |
| `status` | event_status NOT NULL default `draft` | RPC-only |
| `published_at`, `completed_at`, `cancelled_at` | timestamptz NULL | |
| `cancellation_reason` | text NULL | required when cancelled |
| `search` | tsvector GENERATED (title A, venue B, description C, `simple`) | |
| `created_at`, `updated_at` | | |

- Publish-completeness CHECK: `status = 'draft' OR (description, category_id, venue, starts_at, registration_opens_at, registration_closes_at) are NOT NULL`.
- Indexes: `(status, starts_at)`, `(organizer_id, starts_at desc)`, `(category_id)`, `(host_college_id)`, GIN `(search)`.
- Column grants: `authenticated` inserts/updates content columns only (never `organizer_id` on update, `status`, status timestamps, `invite_code`).
- `events_guard` trigger: terminal-state lock (except the `certificates_enabled` rule), capacity ≥ approved count, attendance settings locked after the first session.

#### `event_registrations` — new column marked
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid NOT NULL FK → events ON DELETE CASCADE | only drafts are deleted, and drafts have no registrations |
| `user_id` | uuid NOT NULL FK → profiles | |
| `status` | registration_status NOT NULL | |
| `registration_channel` | registration_channel NOT NULL default `online` | **NEW** |
| `registered_at` | timestamptz NOT NULL default now() | reset on re-register |
| `decided_at`, `decided_by`, `decision_reason` | | `decided_by` NULL for automatic approvals |
| `cancelled_at` | timestamptz NULL | |
| `created_at`, `updated_at` | | |

`UNIQUE (event_id, user_id)`, `UNIQUE (id, event_id, user_id)`; indexes `(event_id, status, registered_at)`, `(user_id, registered_at desc)`; RPC-only writes.

#### `attendance_sessions` — new columns marked
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid NOT NULL FK | |
| `kind` | attendance_session_kind NOT NULL | **NEW** |
| `status` | attendance_session_status NOT NULL default `open` | |
| `opened_by`, `opened_at` | | |
| `closes_at` | timestamptz NOT NULL | **NEW**; automatic expiry |
| `closed_by`, `closed_at` | | CHECK consistent with status |

`UNIQUE (event_id) WHERE status = 'open'`; index `(event_id, opened_at desc)`; RPC-only writes.

#### `attendance_session_secrets` — unchanged
No policies; all privileges revoked from `anon`/`authenticated`.

#### `attendance_records` — RESHAPED
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `registration_id` | uuid NOT NULL UNIQUE | composite FK `(registration_id, event_id, user_id)` → registrations |
| `event_id`, `user_id` | uuid NOT NULL | denormalized for RLS and the realtime filter |
| `status` | attendance_status NOT NULL default `present` | |
| `time_in_at` | timestamptz NOT NULL | official check-in time |
| `time_in_method` | check_in_method NOT NULL | |
| `time_in_session_id` | uuid NULL FK | NULL for manual |
| `time_out_at` | timestamptz NULL | CHECK `time_out_at >= time_in_at` |
| `time_out_method` | check_in_method NULL | |
| `time_out_session_id` | uuid NULL FK | |
| `flag` | attendance_flag NULL | |
| `flag_resolution`, `flag_resolved_by`, `flag_resolved_at` | | set by `resolve_attendance_flag` |
| `revoked_by`, `revoked_at` | | CHECK consistent with `status` |
| `created_at`, `updated_at` | | |

**No free-text columns:** revocation reasons, manual time-in/out reasons and flag notes are written only to `audit_logs.metadata` (station devices can read this table's rows of their event).

Indexes `(event_id, time_in_at desc)`, `(event_id) WHERE flag IS NOT NULL AND flag_resolution IS NULL`, `(user_id)`. In the `supabase_realtime` publication. RPC-only writes.

#### `attendance_device_signals` — NEW
`id bigint identity`, `event_id`, `record_id`, `user_id`, `kind attendance_session_kind`, `device_hash text NOT NULL`, `created_at`. Index `(event_id, device_hash)`. RLS on, **no policies, no client grants** (read only inside RPCs). Purged 30 days after the event is completed (period confirmed under K-07).

#### `attendance_stations` — NEW
`id uuid`, `event_id FK`, `label text` (1–40), `created_by uuid`, `pairing_code_hash text`, `pairing_expires_at timestamptz`, `station_user_id uuid NULL` (anonymous auth user, set on claim), `claimed_at`, `expires_at`, `revoked_at`, `revoked_by`, `last_seen_at`, `created_at`. Unique active grant per `station_user_id`. Select: event owner. Writes: RPC only.

#### `certificate_templates` — unchanged
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid NOT NULL FK | |
| `version` | integer NOT NULL | |
| `background_path` | text NOT NULL | `certificate-templates` bucket |
| `page_width_pt`, `page_height_pt` | numeric NOT NULL | mapped to A4/Letter |
| `layout` | jsonb NOT NULL | field configs; Zod-validated; CHECK array |
| `signatory_text` | text NULL | ≤ 200 |
| `is_active` | boolean NOT NULL default true | |
| `created_by`, `created_at` | | |

`UNIQUE (event_id, version)`; `UNIQUE (event_id) WHERE is_active`; trigger blocks UPDATE/DELETE of referenced versions (except deactivating).

#### `certificates` — unchanged
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `certificate_number` | text NOT NULL UNIQUE | `certificate_number_seq` |
| `verification_code` | text NOT NULL UNIQUE | 16 random bytes, base64url |
| `event_id`, `user_id` | uuid NOT NULL FK | |
| `registration_id` | uuid NOT NULL UNIQUE FK | one per registration |
| `attendance_record_id` | uuid NOT NULL FK | |
| `template_id` | uuid NOT NULL FK | |
| `recipient_name`, `event_title` | text NOT NULL | snapshots |
| `event_date` | date NOT NULL | Asia/Manila date of `starts_at` |
| `issued_at`, `issued_by` | | |
| `revoked_at`, `revoked_by`, `revoke_reason` | NULL | |

Indexes `(user_id, issued_at desc)`, `(event_id)`; RPC-only writes. Eligibility (§10.3) is implemented once in `private.certificate_eligibility(event_id)`.

#### `audit_logs` — exists
`id bigint identity`, `actor_id` (NULL on delete), `action` (`^[a-z_]+(\.[a-z_]+)+$`), `entity_type`, `entity_id`, `metadata jsonb` object, `created_at`; written only through `private.log_audit()`. Admin read. Actions added in Revision 2: `admin.granted`, `admin.removed`, `account.email_corrected`, `profile.student_id_dispute_resolved`, `profile.identity_flag_cleared`, `profile.anonymized`, `event.ownership_transferred`, `attendance.manual_time_in`, `attendance.manual_time_out`, `attendance.revoked`, `attendance.flag_resolved`, `station.paired`, `station.revoked`, `lookup.created`, `lookup.updated`.

### 12.3 Tables evaluated and excluded

| Table | Decision | Reason |
|---|---|---|
| `event_invites` | Excluded | One reusable `invite_code` covers code, QR, link. |
| `notifications` | Excluded | No notification center; Auth emails only. |
| `generated_certificates` storage | Excluded | PDFs rendered on demand. |
| `event_staff` / co-organizers | Excluded | Station devices cover door duty; ownership transfer covers handover. |
| `organizations` | Excluded | Organization name stays free text on the application. |
| Scan attempt log | Excluded | Errors shown only on the participant's phone. |
| Stored counters | Excluded | Derived with indexed counts. |

### 12.4 Relationships

```
auth.users 1─1 profiles (permanent users only)      auth.users 1─0..1 attendance_stations (anonymous station user)
colleges 1─* programs        profiles *─1 colleges, *─1 programs (composite FK keeps program within college)
profiles 1─* organizer_applications (applicant / reviewer)
profiles 1─* events (organizer)       events *─1 event_categories, *─1 colleges (host)
events 1─* event_registrations *─1 profiles
events 1─* attendance_sessions 1─1 attendance_session_secrets
events 1─* attendance_stations
event_registrations 1─0..1 attendance_records 1─* attendance_device_signals
events 1─* certificate_templates
event_registrations 1─0..1 certificates *─1 certificate_templates ; certificates *─1 attendance_records
```

### 12.5 RPC surface

All `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified, caller checks first, `EXECUTE` granted only to the intended role. Every RPC except the station RPCs and `verify_certificate` starts with `private.is_permanent_user()`.

| Function | Caller | Purpose |
|---|---|---|
| `is_admin()`, `is_active_organizer()`, `is_permanent_user()`, `owns_event(id)`, `can_view_profile(id)`, `is_station_for(event_id)` | internal / RLS | Helpers (`STABLE`) |
| `accept_privacy_notice(version)` | authenticated | Onboarding consent |
| `event_phase(events)` | authenticated | Derived phase |
| `profile_full_name(profiles)` | authenticated | Display name (exists; computed field) |
| `search_events(tab, q, category_ids, college_id, from, to, page, page_size)` | permanent authenticated | Explore query: rows + total, public non-draft events only (§17) |
| `submit_organizer_application`, `withdraw_organizer_application` | authenticated | |
| `review_organizer_application`, `set_organizer_status` | admin | |
| `resolve_student_id_dispute(user_id, reason)`, `clear_identity_flag(user_id, note)` | admin | Disputes (deletion requests follow the maintainer procedure, §21.2) |
| `transfer_event_ownership(event_id, new_owner_id, reason)` | admin | Audited handover |
| `publish_event`, `cancel_event`, `complete_event`, `regenerate_invite_code` | owner, active organizer | |
| `get_event_by_invite_code(code)` | authenticated | |
| `register_for_event(event_id)`, `cancel_registration(event_id)` | authenticated | Includes on-site branch |
| `decide_registrations`, `approve_all_pending` | owner | Also used for on-site approvals |
| `open_attendance_session(event_id, kind)`, `close_attendance_session(session_id)` | owner | |
| `create_station_pairing(event_id, label)`, `revoke_station(station_id)` | owner | |
| `claim_station_pairing(code)` | anonymous station user only | |
| `station_get_qr(event_id)`, `station_feed(event_id, since)` | active station of the event (owner may also call) | Tokens (current + 2), display fields |
| `submit_attendance_scan(token, device_id, expected_event_id)` | permanent authenticated | |
| `manual_time_in`, `manual_time_out`, `revoke_attendance`, `resolve_attendance_flag` | owner | Also after completion until a certificate exists (§9.4) |
| `get_attendance_list(event_id)` | owner (suspended: read-only) | Attendance tab data incl. reasons from `audit_logs` |
| `save_certificate_template`, `issue_certificates`, `revoke_certificate`, `refresh_certificate_name`, `apply_template_to_issued`, `get_certificate_eligibility` | owner | |
| `verify_certificate(code)` | anon + authenticated | Whitelisted fields |
| `get_event_report(event_id)` | owner (suspended: read-only) | |
| `get_admin_overview()` | admin | |

### 12.6 Corrections to deployed Phase 1 objects

The database holds no rows, so these are made by a new corrective migration (PLAN Phase 1b), first on development:

| Deployed today | Revision 2 |
|---|---|
| `attendance_status ('pending','present','dismissed')` (unused) | Drop and recreate as `('present','revoked')` |
| — | New enums (§12.1) |
| `profiles.program text` | `profiles.program_id` + composite FK; new `programs` table |
| `is_complete` without consent/program_id | Recreated generated column |
| — | `privacy_consented_at`, `privacy_notice_version`, `identity_flagged_at`, `identity_flag_reason` |
| `handle_new_user()` creates a profile for every auth user | Skips anonymous users |
| No admin writes on lookups | Admin insert/update policies + grants on `colleges`, `programs`, `event_categories` |
| — | `private.is_permanent_user()`; restrictive permanent-user policies on `profiles` and `audit_logs` |

---

## 13. Supabase RLS Strategy

### 13.1 Principles

1. RLS on every `public` table; default deny.
2. Policies per role (`TO authenticated` / `TO anon`) and per command.
3. Helpers are `SECURITY DEFINER STABLE` and called as `(select private.fn())`.
4. Status and role columns are never written through table policies; column grants restrict direct updates.
5. No service-role key in the Next.js runtime.
6. Realtime `postgres_changes` honors the same SELECT policies.
7. **Anonymous users** (station devices) share the `authenticated` role. Every table that stations must not read has a **restrictive** policy `using ((select private.is_permanent_user()))`; every RPC except station RPCs and `verify_certificate` refuses them.
8. Unconfirmed users never receive a session, so no policy needs to handle them.

### 13.2 Policy table

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `colleges`, `programs`, `event_categories` | anon + authenticated | admin | admin | — |
| `profiles` | own; admin all; organizer for registrants of own events via `can_view_profile` (until 30 days after completion/cancellation) | trigger only | own row, allowed columns, identity-lock trigger | — |
| `organizer_applications` | own; admin | RPC | RPC | — |
| `events` | non-draft for permanent users; own; admin | active organizer, own, `draft` | owner + active organizer; content columns; guard | owner, `draft` |
| `event_registrations` | own; event owner | RPC | RPC | — |
| `attendance_sessions` | event owner; approved registrants of the event; active station of the event | RPC | RPC | — |
| `attendance_session_secrets` | none | none | none | none |
| `attendance_records` | own; event owner; active station of the event (table has no free-text columns) | RPC | RPC | — |
| `attendance_device_signals` | none | RPC | — | job |
| `attendance_stations` | event owner | RPC | RPC | — |
| `certificate_templates` | event owner | RPC | RPC | — |
| `certificates` | own (non-revoked for download); event owner | RPC | RPC | — |
| `audit_logs` | admin | RPC | — | — |

Unlisted events are hidden from Explore but readable by any permanent user with the link/code. Suspended/revoked organizers keep SELECT on their own events (read-only reports/exports).

### 13.3 RLS testing

Every policy and RPC is tested by impersonating users with `set local role authenticated; set local request.jwt.claims = '{"sub":"…","is_anonymous":…}'`: owner allowed, other organizer denied, participant denied, suspended organizer denied for writes, admin allowed where intended, **anonymous station user denied everywhere except its own event's station surface**.

---

## 14. Storage Strategy

| Bucket | Access | Path | Read | Write | Limits |
|---|---|---|---|---|---|
| `avatars` | Private, signed URLs (1 h; **10 min for stations**) | `{user_id}/{uuid}.{ext}` | owner; event owner via `can_view_profile` (until 30 days after completion/cancellation); admin; **active station of an event where the owner has a present record** | owner folder; new file + update `avatar_path` + delete old; blocked by identity lock | 2 MB; jpeg/png/webp; 512 px |
| `event-banners` | Public | `{event_id}/{uuid}.{ext}` | public | owner + active organizer | 5 MB; jpeg/png/webp |
| `organizer-requirements` | Private, signed URLs (60 s) | `{user_id}/{uuid}.{ext}` | owner; admin | owner folder, insert only | 5 MB; pdf/jpeg/png |
| `certificate-templates` | Private | `{event_id}/{uuid}.{ext}` | event owner; holders of a non-revoked certificate of the event | owner + active organizer, insert only | 10 MB; png/jpeg |

Avatars are private (student photos are personal data); banners are public marketing material. Bucket limits are mirrored in Zod.

---

## 15. Realtime Strategy

| Use | Mechanism | Subscriber | Fallback |
|---|---|---|---|
| Station feed | `postgres_changes` on `attendance_records` (INSERT + UPDATE), filter `event_id=eq.{id}`; each change triggers `station_feed(event_id, since)` for display fields, then signed avatar URLs | Station (RLS: active grant) | "Reconnecting" → poll `station_feed` every 3 s; full refetch on resubscribe |
| Organizer Attendance tab | Same channel | Owner | Manual refresh |

No participant realtime (results are final on the phone). Not realtime: Explore, registrations table, dashboards, reports, certificates. `postgres_changes` is sufficient at thesis scale; Broadcast-from-database is a future optimization.

---

## 16. Routing / Page Architecture

### 16.1 Structure

```
app/
  layout.tsx                          root: fonts, <html lang="en">, Toaster
  (public)/
    page.tsx                          /  landing
    privacy/page.tsx                  /privacy  privacy notice
    verify/page.tsx, verify/[code]/page.tsx
  (auth)/
    layout.tsx                        centered card layout
    login/page.tsx                    incl. "Email not confirmed" + resend
    signup/page.tsx
    signup/check-email/page.tsx       "Check your email" + resend
    forgot-password/page.tsx
    reset-password/page.tsx
  auth/
    confirm/route.ts                  verifyOtp(token_hash, type = email | recovery) → redirect `next`
    error/page.tsx                    expired/invalid link + resend
    signout/route.ts                  POST
  (app)/                              authenticated shell: top bar with dashboard switcher; sidebar per dashboard
    layout.tsx                        static shell; session-dependent parts inside <Suspense>
    onboarding/page.tsx               privacy consent + student profile + photo
    dashboard/page.tsx                Participant Dashboard
    profile/page.tsx
    events/page.tsx, events/join/page.tsx, events/[eventId]/page.tsx
    my-events/page.tsx
    certificates/page.tsx, certificates/[certificateId]/page.tsx, certificates/[certificateId]/pdf/route.ts
    scan/page.tsx                     scanner, ?t= handling, results, on-site registration path
    become-organizer/page.tsx
    organizer/                        Organizer Dashboard (guard: requireOrganizer({ allowInactive: true }))
      layout.tsx, page.tsx, events/page.tsx, events/new/page.tsx
      events/[eventId]/ layout.tsx, page.tsx, registrations/, attendance/, certificates/, reports/ (+ export/route.ts), settings/
      reports/page.tsx
    admin/                            Admin Dashboard (guard: requireAdmin() → notFound())
      layout.tsx, page.tsx
      applications/page.tsx, applications/[applicationId]/page.tsx
      organizers/page.tsx
      users/page.tsx, users/[userId]/page.tsx
      lookups/page.tsx
      events/[eventId]/page.tsx       admin event view (ownership transfer only)
  (station)/
    station/page.tsx                  anonymous sign-in + pairing code
    station/[eventId]/page.tsx        full-screen station
  e/[code]/route.ts                   invite short link
proxy.ts
lib/
  supabase/{server.ts, client.ts, proxy.ts, station-client.ts}   station client uses a separate cookie name
  auth/dal.ts                         getCurrentUser(), requireUser({ allowIncomplete }), requireOrganizer(), requireAdmin()
  validation/*.ts, events/phase.ts, datetime.ts, attendance/*.ts, certificates/render.ts
  database.types.ts
supabase/ migrations/, seed.sql, tests/
```

### 16.2 Guards and Next.js 16 specifics

- `proxy.ts`: refreshes the session cookie; redirects signed-out users from `(app)`/`(station)/station/[eventId]` to `/login?next=…`; redirects **anonymous** sessions away from `(app)` to `/station`; optimistic only.
- DAL (`server-only`): `getCurrentUser()` uses `getClaims()`/`getUser()` and returns `{ id, email, isAnonymous, profile, isAdmin, organizerStatus }`. `requireUser()` refuses anonymous users and sends users with incomplete profiles to `/onboarding` (except pages marked `allowIncomplete`, and admins on `/admin`).
- Every Server Action and Route Handler calls the DAL; RLS remains the final check.
- Session-reading components inside `<Suspense>`; layouts never await the session at top level.
- Mutations: Zod → RPC with the user-scoped client → typed `ActionResult` → `refresh()`/`revalidatePath`.

---

## 17. Event Discovery Design

- **Event is the unit**; the organizer appears as a byline ("by Supreme Student Council – CECT").
- Tabs: **Upcoming** (published, public, `effective_end ≥ now`, by `starts_at`), **Open for registration** (phase `registration_open`), **My college** (`host_college_id = my college OR NULL`), **Past** (completed, last 90 days).
- Search: full-text on `search` with `websearch_to_tsquery('simple', q)`, minimum 2 characters.
- Filters: category (multi), host college, date range (This week / This month / custom).
- Offset pagination, 12 cards per page, URL-driven (`?page=`). Card grid on desktop, single column on mobile.
- Card: banner thumbnail, date chip, title, venue, category badge, phase badge ("Open", "Closing soon" < 48 h, "Full", "Closed", "On-site registration"), "Registered" badge.
- Empty state: "No events match your filters — Clear filters". Login is required to browse (C4).

---

## 18. Important UI States

| Area | States |
|---|---|
| Sign-up / confirmation | check your email; resend sent; resend cooldown; confirmation success; link expired/invalid (+ resend); email not confirmed at login (+ resend); CAPTCHA failed |
| Recovery | reset link sent (generic); link expired (+ new link); password updated (other sessions signed out) |
| Onboarding | consent; student ID taken (→ contact admin); program list empty for a college; photo upload/resize errors |
| Profile | identity locked until {event} ends; identity flagged (contact admin) |
| Dashboard switcher | only dashboards the user may open; suspended organizer banner "read-only" |
| Event details action | Log in · Complete profile · Opens {date} · Register · Registered · Pending approval · Rejected (reason) · Cancelled — Register again · Full · Registration closed · Cancelled event · Attendance open — Scan · On-site registration open · Completed |
| Explore | skeletons, empty, no-results, error + retry |
| Registrations (org) | empty + share CTA, filtered empty, bulk-result summary, capacity bar, on-site badge |
| Attendance (org) | not yet openable (countdown to lead time), time-in open, time-out open, closed, expired, completed; stations list (last seen, revoke); flags to review; on-site awaiting approval; manual corrections |
| Station | unpaired; code entry (invalid/expired); waiting; live feed; flagged item; reconnecting/polling; session closed; grant revoked/expired; organizer signed in on this device |
| Scan (participant) | camera permission prompt/denied/no camera/insecure context; scanning; submitting; each §9.3 result; on-site registration path |
| Certificates (org) | disabled, no template, preview, locked until completed, eligibility counts (missing time-out, flags, identity review), generating, issued list, outdated template, identity review list |
| Certificates (participant) | none yet; available; revoked |
| Applications | none, pending, rejected (+ reapply), approved, suspended/revoked |
| Admin users | dispute resolved; identity flagged; flag cleared |
| Global | toasts; AlertDialog for destructive actions; field-level errors |

---

## 19. Edge Cases and Safe Behavior

| # | Case | Behavior |
|---|---|---|
| 1 | Registration deadline passed | `registration_closed`, unless on-site registration applies. |
| 2 | Event full | `event_full`; concurrent last-slot attempts serialized; exactly one succeeds. |
| 3 | Double registration | Unique `(event_id, user_id)`; existing status returned. |
| 4 | Organizer rejects | `rejected` + optional reason; no re-registration; blocked if an attendance record exists. |
| 5 | Capacity changed | ≥ approved count; raising does not auto-approve. |
| 6 | Event cancelled | Reason; terminal; sessions closed; stations revoked; no certificates. |
| 7 | Participant becomes organizer | Same account; Organizer Dashboard appears in the switcher. |
| 8 | Organizer suspended/revoked | Write RPCs refuse; read-only workspace; sessions closed; stations revoked; admin may transfer ownership. Auto-cancelling upcoming events: not done (C14). |
| 9 | Expired QR | `expired_qr`; camera stays open. |
| 10 | QR from another event | `not_registered` or `wrong_event`. |
| 11 | Attendance not open | No token exists; Scan page shows "Attendance hasn't started" for today's events. |
| 12 | Attendance closed/expired | `attendance_closed`. |
| 13 | Duplicate scan | `already_timed_in` / `already_timed_out` with recorded time. |
| 14 | Proxy suspected | Organizer revokes with reason; certificate revoked first if issued. |
| 15 | Event completed with sessions open, open flags, or missing time-outs | Completion dialog warns first; on confirmation sessions are closed. Flags and missing time-outs can still be corrected afterwards (audited) until certificates are issued. |
| 16 | Certificate generation retried | Idempotent. |
| 17 | Template changed after generation | New version; explicit apply action. |
| 18 | Name changed after generation | Snapshot kept; `refresh_certificate_name`. |
| 19 | Registrations never hard-deleted | Only drafts are deleted. |
| 20 | Realtime failure at station | Polling fallback; refetch on reconnect. |
| 21 | Several stations or tabs | Same session tokens; independent feeds; no conflicting writes (stations are read-only). |
| 22 | Station Wi-Fi drops ≤ 90 s | Prefetched tokens keep the QR valid; feed catches up. |
| 23 | Screenshot/relayed QR | Valid ≤ 60 s; residual risk (§9.7). |
| 24 | No phone/camera | `manual_time_in` with reason. |
| 25 | Camera permission denied | Instructions; use the phone camera app (QR is a URL). |
| 26 | Logged-out scan | Login → `/scan` with camera open → scan again. |
| 27 | Register for own event | `own_event`. |
| 28 | Admin reviews own application | Refused. |
| 29 | Two admins review the same application | Second gets `already_reviewed`. |
| 30 | Event edited after registrations | Allowed with warnings; locked after completion/cancellation; attendance settings locked after first session. |
| 31 | Device clock drift | Irrelevant; database clock. |
| 32 | One phone, several accounts | All affected records `shared_device`; certificates blocked until resolved. |
| 33 | Time-in, left before time-out | Not eligible under `time_in_and_out`; manual time-out with reason if justified. |
| 34 | Time-out scan without time-in | `time_in_required`. |
| 35 | Walk-in, on-site off | `not_registered`. |
| 36 | Walk-in, on-site on, manual mode | Pending → "On-site, awaiting approval" → approved → scan again. |
| 37 | Walk-in without an account | Sign up → confirm email (needs delivery at the venue) → onboarding → register → scan. |
| 38 | Station laptop left unattended or stolen | No organizer session on it; organizer revokes; grant expires anyway. |
| 39 | Confirmation link opened on another device | Session created on that device; the original device shows "Email confirmed? Log in" after the user returns. |
| 40 | Confirmation link expired | `/auth/error` with resend. |
| 41 | Sign-up with an already registered email | Same "check your email" page; no email is sent to reveal existence; the owner can use "Forgot password". |
| 42 | Mistyped email at sign-up | Never confirmed; user signs up again with the right address. The unconfirmed account cannot log in or claim a student ID (purge job **[DEFERRED]**). |
| 43 | Student ID already taken | Message + admin dispute flow. |
| 44 | Organizer graduates | Admin transfers ownership of their events. |
| 45 | Many sign-ups on venue Wi-Fi | Per-IP and email rate limits raised before the event (§22). |
| 46 | SMTP outage | Sign-ups and resets wait; existing users unaffected; organizers can still `manual_time_in` registered attendees. |
| 47 | Admin without student profile | Uses Admin Dashboard; cannot register or scan. |
| 48 | Late arrival after time-out started | Time-in sessions can no longer be opened; organizer records an audited manual time-in if appropriate. |
| 49 | Organizer forgot to open time-out | Completion warning; after completion, audited manual time-outs are still possible until certificates are issued. |

---

## 20. Decision Status

### 20.1 Revision 1 items (C1–C20)

| # | Topic | Status |
|---|---|---|
| C1 | Email domain restriction | **Closed:** personal emails allowed; ownership proven by confirmation. |
| C2 | Student ID format | **[CLIENT]** provisional pattern in use. |
| C3 | College, program, category lists | **[CLIENT]** contents; entered by admins through `/admin/lookups`. |
| C4 | Login required to view events | Accepted. |
| C5 | `unlisted` visibility | Accepted. |
| C6 | Rejected users re-registering | Not allowed. |
| C7 | Registering for own events | Not allowed. |
| C8 | Session opening window | Replaced: per-event lead time, default 60 min. |
| C9 | One attendance per event | Replaced: time-in only or time-in + time-out per event; still one record per registration. |
| C10 | Manual check-in | Kept as manual time-in/time-out with reason. |
| C11 | Certificate prefix | `CLC-{YYYY}-{NNNNNN}`. |
| C12 | PDF templates/custom fonts | Excluded. |
| C13 | On-demand PDF rendering | Adopted. |
| C14 | Suspension effect on upcoming events | Frozen + admin transfer option. |
| C15 | Co-organizers | Excluded; station devices cover door duty. |
| C16 | Notifications | Excluded (Auth emails only). |
| C17 | Development database | Replaced: separate development and production projects (§22). |
| C18 | Git | `main` with `origin`; tool folders git-ignored. |
| C19 | `NEXT_PUBLIC_APP_URL` | Required in every environment. |
| C20 | Reports PDF | Print stylesheet; CSV server-side. |

### 20.2 Revision 2 decision record (P-01 – P-23, approved 2026-10-11)

| ID | Decision | Outcome |
|---|---|---|
| P-01 | Cloudflare Turnstile CAPTCHA (project-wide: sign-up, sign-in, resend, recovery, anonymous station sign-in) | Approved. Test keys in development; production keys at deployment (K-10). |
| P-02 | Password policy: ≥ 8 characters, letters + digits | Approved |
| P-03 | Confirmation/recovery link validity 24 h | Approved |
| P-04 | Purge unconfirmed accounts after 7 days | **Deferred** (optional Phase 12 hygiene) |
| P-05 | Sign out other sessions after password reset | Approved |
| P-06 | Privacy consent recorded in onboarding (`privacy_consented_at`, version) | Approved |
| P-07 | Identity lock | Approved **narrowed**: student ID + profile photo only; names editable |
| P-08 | Admins use the Admin Dashboard without a student profile; default landing `/admin` | Approved |
| P-09 | Event categories admin-managed like colleges/programs | Approved |
| P-10 | Account deletion/anonymization | Approved **simplified**: maintainer-assisted procedure (§21.2), no RPC/UI |
| P-11 | Lead time 0–180 min; attendance settings locked after first session | Approved |
| P-12 | `registration_channel` (online/onsite) | Approved |
| P-13 | On-site approvals from the Attendance tab | Approved **simplified**: filtered view reusing `decide_registrations`; no separate RPC |
| P-14 | Attendance window ends at effective end + 60 min; sessions can be opened anywhere inside it | Approved (with opening-window correction) |
| P-15 | Time-out closes time-in; no time-in after time-out has started; completion warning | Approved |
| P-16 | Session controls only on the organizer's own device | Approved |
| P-17 | Unresolved device flags block issuance; audited corrections allowed after completion until a certificate exists | Approved |
| P-18 | Identity-flagged holders skipped at issuance + review list | Approved |
| P-19 | Verify-page wording ("account holder named …") | Approved |
| P-20 | Organizer access to registrant profiles/photos ends 30 days after completion/cancellation | Approved (period confirmed by client under K-07) |
| P-21 | `pg_cron` jobs: purge device signals 30 days after completion; delete anonymous station users 7 days after grant expiry | Approved (periods confirmed under K-07) |
| P-22 | Minimal CSV export columns | Approved |
| P-23 | Environments | **Reversed**: existing project `ldhpbfujqnyovovabvcg` = **development**; a new **production** project is created before deployment |

Consistency-review fixes approved with Revision 2: no free-text reasons on station-readable rows (reasons live in `audit_logs`); 10-minute signed photo URLs for stations; privacy notice mentions the station display; `pg_cron` enabled in both environments.

### 20.3 [CLIENT] items

| ID | Item | Needed by |
|---|---|---|
| K-01 | **Client-owned SMTP provider**, sender address, owner after handoff | **Production deployment** (Phase 12). Development uses the built-in sender for team addresses or a team-owned sandbox. |
| K-02 | Names of the (≥ 2) admins; identity verification by the maintainer | Production deployment |
| K-03 | Acceptable organizer proof documents | Phase 4 copy (placeholder text until then) |
| K-04 | College, program, category lists | Production go-live (development uses dev-only rows) |
| K-05 | Official student-ID format | Optional tightening, any time |
| K-06 | Data controller, privacy contact, privacy notice text | Launch (placeholder notice in development) |
| K-07 | Retention periods (device signals, organizer access window, anonymous users, inactive accounts) | Launch |
| K-08 | Creation and ownership of the **production** Supabase project; CLI access token for it | Production deployment |
| K-09 | Supabase plan around the defense (free-tier pausing) | Final demo |
| K-10 | Cloudflare account for Turnstile production keys | Production deployment |
| K-11 | Production domain (Site URL, redirect URLs, email links, sender domain) | Production deployment |

**No client item blocks the start of implementation.** CLI access to the development project (for `npm run test:db`/`db:push`) is a team convenience; until it exists, tests run through the Supabase MCP integration as in D-006.

---

## 21. Scope

### 21.1 Out of scope

- Organizer confirmation of each scan; facial recognition, biometrics, geofencing/GPS.
- Verification of university enrollment; guests and non-students.
- Self-service email change and self-service account deletion.
- Canva integration, free-form certificate editor, custom fonts, PDF backgrounds.
- Waitlists; notifications beyond Supabase Auth emails.
- Co-organizers, staff roles, organization entities.
- Admin management of event registrations/attendance.
- Multi-session/multi-day attendance beyond one time-in and one time-out.
- Post-login scan recovery tickets; scan attempt logs.
- Payments, native apps, extended analytics, comments/ratings/chat, recurring events.

### 21.2 Data privacy (Data Privacy Act of 2012)

- **Minimization:** no address, birthdate, government IDs. The station shows only photo, name, college and status; no free-text reasons are stored on station-readable rows. CSV exports contain name, student ID, college, program, year, registration and attendance data only (no email, no photo links).
- **Restricted access:** private avatars and documents; organizers see registrant profiles only for their own events and only until 30 days after completion/cancellation; stations see only their event's checked-in attendees, through 10-minute photo links, while their grant is active.
- **Retention (periods confirmed by the controller, K-07):** device signals purged 30 days after completion; anonymous station users deleted 7 days after grant expiry.
- **Notice and consent:** `/privacy` page; consent at onboarding and on the organizer application. The notice states that check-ins are displayed on the station screen (photo, name, college). Controller and contact **[CLIENT K-06]**.
- **Deletion/anonymization procedure (maintainer-assisted):**
  1. The request reaches an admin; the admin verifies it comes from the account's email address.
  2. The maintainer, in the Supabase dashboard SQL editor of the affected environment, clears personal fields on `profiles` (names replaced with "Deleted user"; student ID, college, program, year and photo path set to NULL), deletes the avatar object through the Storage UI, and writes a `profile.anonymized` audit entry with `private.log_audit`.
  3. Issued certificates keep their snapshot name so verification links remain truthful; the organizer may revoke them on request.
  4. The auth user is deleted from the dashboard only if no registrations reference it; otherwise the anonymized profile remains and the maintainer replaces the auth user's email with a non-routable placeholder.
  5. The steps are documented in the README and in the privacy notice.

---

## 22. Environments and Operations

- **Development:** existing project `ldhpbfujqnyovovabvcg` (Phase 1 migrations already applied, no real users). AI/MCP tooling and local `.env.local` point here. All migrations and tests run here first.
- **Production:** a **new, separate** Supabase project created before deployment (K-08). It receives all migrations from the repository via `supabase db push` after review, plus the documented settings below. It never receives test runs, MCP write access or experiments.
- Nothing in development is promoted by copying data; production starts empty, then admins and lookups are set up there (K-02, K-04).
- **Auth and platform settings per environment:**

| Setting | Development (now) | Production (Phase 12) |
|---|---|---|
| Confirm email | On | On |
| SMTP | Built-in sender (team addresses only) or a team-owned sandbox | **Client-owned custom SMTP (K-01)** |
| Email rate limit | Default | Raised from Supabase's initial 30/hour to match expected sign-ups |
| OTP/link expiry | 24 h | 24 h |
| Email templates | `token_hash` links to `/auth/confirm` (`type=email` / `type=recovery`) | same |
| Anonymous sign-ins | On (stations) | On |
| CAPTCHA | Turnstile test keys | Turnstile production keys (K-10) |
| Password policy | ≥ 8, letters + digits | same |
| Manual identity linking | Off | Off |
| `pg_cron` extension | Enabled (Phase 8) | Enabled |
| Site URL / redirect URLs | localhost + preview | production domain (K-11) |

- **Pre-event checklist:** SMTP healthy; email and per-IP sign-up limits raised for expected walk-ins; station pairing tested on the venue network; organizer phone signed in.
- **Free-tier pausing:** plan per K-09.
