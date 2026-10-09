# EventHub — System Specification

**EventHub: A QR-Based Event Management and Attendance System with Automated Digital Certificate Generation for the College Local Council of Wesleyan University–Philippines**

Status: DRAFT for review. Nothing in this document is implemented yet.
Companion document: [PLAN.md](./PLAN.md) (build order, phases, verification).

Decisions marked **[DECISION]** are recommendations made where the brief was ambiguous. Items marked **[CONFIRM]** must be confirmed by the client/team before the relevant phase starts. A consolidated list is in §20.

---

## 0. Repository Baseline (inspected 2026-10-10)

| Item | Finding | Implication |
|---|---|---|
| Framework | Next.js **16.4.0**, React 19.3, App Router, Turbopack | `middleware.ts` is now **`proxy.ts`**. Request APIs (`cookies()`, `headers()`, `params`, `searchParams`) are async. |
| `next.config.ts` | `cacheComponents: true`, `partialPrefetching: true`, `experimental.agentFeedback` | Any component that reads the session/cookies **must sit inside a `<Suspense>` boundary**; reading cookies at the top level of a layout blocks the whole segment. Follow `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`. |
| UI kit | shadcn/ui style **`base-nova`** (built on **Base UI**, not Radix), Tailwind v4, `tw-animate-css`, lucide icons | Base UI components use a `render` prop instead of Radix `asChild`. Do not copy Radix-era shadcn snippets blindly. |
| Installed UI components | alert-dialog, avatar, badge, button, calendar, card, checkbox, command, dialog, dropdown-menu, input, input-group, label, pagination, popover, progress, select, separator, sheet, skeleton, switch, table, tabs, textarea, tooltip | Still needed: sidebar, sonner (toasts), radio-group, field/form helpers, scroll-area, breadcrumb. |
| `lib/utils.ts` | `export { cn } from "cn"` (shadcn's compiled clsx + tailwind-merge replacement) | Fine; keep. |
| Supabase | `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.117; `.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only | No service-role key present — the design below **does not require one** in the app runtime. |
| Remote database | Project `ldhpbfujqnyovovabvcg`: **0 tables in `public`, 0 migrations** | Greenfield schema. |
| Migrations folder | None (`supabase/` absent); Supabase CLI not installed | Add CLI as dev dependency; migrations live in `supabase/migrations/`. |
| Tests | No test tooling installed | Add Vitest (unit), SQL-level RLS tests, Playwright (optional E2E). |
| Other libs | `qrcode`, `@zxing/browser`, `pdf-lib`, `date-fns` v4, `react-hook-form`, `zod` v4, `@hookform/resolvers` | `@date-fns/tz` needed for Asia/Manila formatting on UTC servers (Vercel). |
| Git | On branch `master`; default branch reported as `main`. Uncommitted: `package.json`, `package-lock.json`, `app/globals.css`, `components/`, `lib/`, `components.json`; tool folders (`.agent/`, `.agents/`, `.claude/`, `.codex/`, `.gemini/`, `.pixel-agents/`) untracked | **[CONFIRM]** branch strategy and whether tool folders are committed or git-ignored. |
| Root metadata | Still "Create Next App" | Replace in Phase 0. |

---

## 1. System Overview

EventHub lets students of Wesleyan University–Philippines discover and register for council events, check in using a rotating QR code verified by an organizer, and receive verifiable digital certificates.

Core principles:

1. **One account, layered permissions.** Every user is a Participant. Organizer is an extra permission granted by an Admin. Admin is a system flag.
2. **The database is the authority.** All authorization is enforced by PostgreSQL Row Level Security and `SECURITY DEFINER` functions. Route guards in Next.js only improve UX.
3. **State machines live in the database.** Status transitions (registration decisions, attendance confirmation, certificate issuance) happen only through database functions (RPCs) that validate the transition. Clients never write status columns directly.
4. **Store facts, derive the rest.** "Registration open", "ongoing", "absent", report totals, and eligibility are computed, not stored.
5. **Human-in-the-loop attendance.** A scan only creates a *pending* check-in. An organizer's visual confirmation makes it *present*.

---

## 2. Roles and Permissions

### 2.1 Role model

| Concept | Storage | Granted by |
|---|---|---|
| Participant | Implicit: every row in `profiles` | Sign-up |
| Organizer | `profiles.organizer_status = 'active'` | Admin approving an application |
| Admin | `profiles.is_admin = true` | Set manually via SQL by the system maintainer (never through the UI) |

`organizer_status` values: `none`, `active`, `suspended`, `revoked`.

- `suspended`: temporary; admin can reinstate to `active`.
- `revoked`: permanent for that grant; the user must submit a new application to regain access.

**[DECISION]** Organizer status is a column on `profiles`, not a separate roles table. There is exactly one organizer permission and it is checked in nearly every RLS policy, so a single indexed column is simplest and fastest. History is kept in `organizer_applications` and `audit_logs`.

**[DECISION]** Admin accounts are not blocked from participating, but an admin cannot review their own organizer application.

### 2.2 Permission matrix

| Capability | Participant | Organizer (active) | Organizer (suspended/revoked) | Admin |
|---|---|---|---|---|
| Manage own profile | ✓ | ✓ | ✓ | ✓ |
| Browse/search published events | ✓ | ✓ | ✓ | ✓ |
| Register / cancel own registration | ✓ | ✓ | ✓ | ✓ |
| Scan attendance QR | ✓ | ✓ | ✓ | ✓ |
| View/download own certificates | ✓ | ✓ | ✓ | ✓ |
| Apply for organizer access | ✓ (if `none` or `revoked`, no pending application) | — | revoked only | — |
| Create/edit/publish events | — | Own events | — | — |
| Manage registrations, attendance, certificates | — | Own events | Read-only view of own events + exports | — |
| Review organizer applications | — | — | — | ✓ |
| Suspend / revoke / reinstate organizers | — | — | — | ✓ |
| View system overview | — | — | — | ✓ |
| Manage another organizer's event | — | — | — | ✗ (out of scope) |

An organizer may register for **other** organizers' events. An organizer **cannot register for their own event** (prevents self-issued certificates). **[CONFIRM]**

---

## 3. Participant Flow

1. **Sign up** with email + password (school email **[CONFIRM]** domain restriction). Supabase sends a confirmation email.
2. **Confirm email**, log in.
3. **Complete profile** (required before registering for any event): first name, middle name (optional), last name, suffix (optional), student ID, college, program, year level, profile photo.
   - The photo is required because organizers visually verify attendees.
4. **Dashboard**: next registered event, registrations awaiting approval, an "Attendance is open — Scan now" banner when an event they are approved for has an open attendance session, recent certificates.
5. **Explore Events** (§12.3): tabs, search, filters, pagination.
6. **Event details**: banner, title, category, host college, date/time, venue, description, capacity indicator ("42 of 100 slots taken" or "Unlimited"), registration window, approval mode ("Requires organizer approval"), certificate availability, and a context-aware primary action (§13.2).
7. **Register** — explicit button press. Result: `approved` (automatic mode) or `pending` (manual mode), or a clear error (closed, full, incomplete profile).
8. **Join via invite**: invite QR or direct link opens event details; invite code is typed at `/events/join`. Never auto-registers.
9. **My Events**: tabs Upcoming / Pending approval / Past / Cancelled-or-rejected. Each row shows registration status and attendance status.
10. **Attendance**: during the event, open **Scan** (or scan the organizer's QR with the phone's native camera — the QR encodes an EventHub URL). Then see "Waiting for organizer confirmation" until confirmed.
11. **Attendance history**: on My Events → Past (present / not checked in).
12. **My Certificates**: list, preview, download PDF, copy verification link.
13. **Become an Organizer**: submit application, track status, see rejection notes, reapply.

---

## 4. Organizer Application Flow

### 4.1 Fields

Pulled from the profile (not re-entered, shown read-only on the form): full name, student ID, college, program, account email.

Entered on the application:

| Field | Type | Validation |
|---|---|---|
| Organization / council name | text | required, 3–150 chars |
| Position / role in organization | text | required, 2–100 chars |
| Contact number | text | required, PH mobile format `^(\+63|0)9\d{9}$` |
| Reason for requesting access | textarea | required, 50–1000 chars |
| Proof of authorization / appointment | file | **required**; PDF/JPG/PNG; ≤ 5 MB |
| Supporting document | file | optional; PDF/JPG/PNG; ≤ 5 MB |
| Data-privacy consent checkbox | boolean | required (Data Privacy Act of 2012 notice) |

**[DECISION]** No separate "school email" field: the account email is used. If sign-up is restricted to the school domain (**[CONFIRM]**), it is already verified.

Not collected: home address, birthdate, government IDs, parents' info.

### 4.2 Statuses

`pending` → `approved` | `rejected`; `pending` → `withdrawn` (by applicant).

Rules:
- At most **one `pending` application per user** (partial unique index).
- Eligible to apply: profile complete, `organizer_status IN ('none','revoked')`, no pending application.
- Rejection requires `review_notes` (DB check constraint).
- After rejection, the user may reapply immediately with a new application (history retained).
- Approval atomically: sets application `approved`, sets `profiles.organizer_status='active'`, `organizer_since=now()`, writes audit log.
- Submitted documents are immutable (no update/delete policy on storage objects after submission).

---

## 5. Admin Flow

1. **Overview**: counts — total users, active organizers, pending applications, events by status (draft/published/completed/cancelled), events this month.
2. **Applications**: table filtered by status (default `pending`, oldest first). Detail page shows applicant profile, submitted fields, documents opened via short-lived signed URLs (60 s), prior applications of the same user.
3. **Approve** (confirm dialog) or **Reject** (dialog with required reason).
4. **Organizers**: table of users with `organizer_status != 'none'`; columns: name, organization, status, since, number of events. Actions: Suspend (reason required), Reinstate (from suspended), Revoke (reason required, permanent).
5. Admin does **not** manage event registrations or attendance.

---

## 6. Organizer Flow

1. After approval, an **Organizer** section appears in the sidebar (participant sections remain).
2. **Organizer dashboard**: upcoming own events, pending registration count per event, "Attendance open" indicators, events past end time awaiting **Mark as completed**, completed events with certificates not yet generated.
3. **Create event** → saved as `draft`.
4. **Publish** (validates all required fields, banner optional).
5. **Event workspace** tabs: Overview · Registrations · Attendance · Certificates · Reports · Settings.
6. **Share**: invite code, invite QR (downloadable PNG), direct link; regenerate invite code.
7. **Registrations**: review, approve/reject (single and bulk).
8. **Attendance**: open session → launch Check-in Station (full-screen) → confirm attendees → close session.
9. **Mark as completed** after the event.
10. **Certificates**: upload template, position fields, preview, save, Generate Certificates.
11. **Reports**: summary, CSV exports, printable report.
12. **Cancel event** (with reason) at any time before completion.

---

## 7. Event Specification

### 7.1 Fields and validation

All times are stored as `timestamptz` and displayed in **Asia/Manila**. The form collects date + time pickers and combines them in the Asia/Manila zone before submit.

| Field | Column | Required to save draft | Required to publish | Validation |
|---|---|---|---|---|
| Title | `title` | ✓ | ✓ | 5–150 chars, trimmed |
| Description | `description` | — | ✓ | 20–5000 chars, plain text with line breaks (no HTML/Markdown rendering in MVP) |
| Banner | `banner_path` | — | — | JPG/PNG/WEBP, ≤ 5 MB, recommended 1600×900 (16:9); placeholder used if absent |
| Category | `category_id` | — | ✓ | FK to `event_categories` |
| Host college | `host_college_id` | — | — | FK to `colleges`; NULL = university-wide |
| Venue | `venue` | — | ✓ | 3–200 chars |
| Start | `starts_at` | — | ✓ | Must be in the future at publish time |
| End (optional) | `ends_at` | — | — | `> starts_at`; same or later day; max 7 days after start |
| Registration opens | `registration_opens_at` | — | ✓ | `< registration_closes_at` (may be in the past at publish = opens immediately) |
| Registration deadline | `registration_closes_at` | — | ✓ | `<= starts_at` |
| Max participants | `capacity` | — | — | NULL = unlimited, else integer 1–5000 |
| Approval mode | `approval_mode` | ✓ (default `automatic`) | ✓ | `automatic` \| `manual` |
| Visibility | `visibility` | ✓ (default `public`) | ✓ | `public` \| `unlisted` **[CONFIRM]** |
| Certificates enabled | `certificates_enabled` | ✓ (default `false`) | ✓ | boolean |

Draft-level checks are enforced by Zod; publish-level checks are enforced again in the `publish_event` RPC.

**Effective end** (used for derivations when `ends_at` is NULL): end of the start day in Asia/Manila (23:59:59).

### 7.2 Event status (stored)

| Status | Meaning |
|---|---|
| `draft` | Visible only to the owner. Fully editable. Deletable. |
| `published` | Visible to participants. Editable with restrictions (§7.4). |
| `completed` | Organizer marked the event finished. Attendance closed permanently. Certificates may be generated. Read-only except certificate settings. |
| `cancelled` | Event will not happen. Read-only. Registrations frozen. No attendance or certificates. |

Transitions: `draft → published` (publish), `draft → deleted` (hard delete), `published → completed` (only after `starts_at`), `published → cancelled` (reason required). No transition out of `completed` or `cancelled`. **No `archived` status**: past events are filtered by date; archiving adds no behavior.

### 7.3 Event phase (derived, never stored)

Computed for a `published` event from `now()`:

| Phase | Condition |
|---|---|
| `upcoming` | `now < registration_opens_at` |
| `registration_open` | `registration_opens_at ≤ now < registration_closes_at` and not full |
| `registration_full` | registration window open but approved count ≥ capacity |
| `registration_closed` | `registration_closes_at ≤ now < starts_at` |
| `ongoing` | `starts_at ≤ now ≤ effective_end` |
| `awaiting_completion` | `now > effective_end` and status still `published` |

Implemented once as a SQL function `event_phase(events)` (used by queries and RPCs) and mirrored in a TypeScript helper for UI display only.

**Event status vs attendance session status are independent.** "Event = ongoing, Attendance = closed" is the normal state until the organizer opens a session. The scheduled start only drives a countdown on the attendance page.

### 7.4 Editing a published event

- Cannot change: `organizer_id`, `status` (only via RPCs), `invite_code` (only via `regenerate_invite_code`).
- `capacity` cannot be set below current approved count (trigger error: "Capacity cannot be lower than the 57 already-approved registrations").
- Changing `approval_mode` from manual → automatic does **not** auto-approve existing pending registrations; the organizer is prompted to use "Approve all pending".
- Changing `starts_at`/`registration_*` is allowed while no attendance session has ever been opened; the UI warns that registrants are not notified automatically (no notification system in MVP).
- `certificates_enabled` may be toggled until certificates have been issued; after that it is locked on.

---

## 8. Registration Lifecycle

Statuses: `pending`, `approved`, `rejected`, `cancelled`.

```
               (automatic mode)
register ─────────────────────────► approved ─┐
   │                                   ▲      │ organizer rejects (only if not checked in)
   │ (manual mode)                     │      ▼
   └──► pending ──── organizer ────────┘   rejected
           │  └──── organizer rejects ───────►┘
           │
           └── participant cancels ──► cancelled ◄── participant cancels approved (before start, not checked in)
cancelled ──► re-register (same row reused) ──► pending/approved
```

Rules (all enforced in RPCs):

1. **One row per (event, user)** — `UNIQUE (event_id, user_id)`. Re-registering after `cancelled` reuses the row (status reset, `registered_at` updated). Duplicate press of Register returns the existing status instead of erroring.
2. **Register allowed only if**: event `published`; phase `registration_open`; profile complete; user is not the event owner; no existing row in `pending`/`approved`/`rejected`.
3. **Rejected users cannot re-register** for the same event. **[CONFIRM]**
4. **Capacity** counts only `approved` registrations. Pending registrations do not hold a slot.
   - Automatic mode: if full, registration fails with "Event is full".
   - Manual mode: new pending registrations are also refused once approved count reaches capacity (prevents an unbounded pending pile that can never be approved).
   - Race safety: `register_for_event` and approval RPCs take `SELECT … FOR UPDATE` on the event row, then count approved, then insert/update — in one transaction.
5. **Waitlist: excluded from MVP.** **[DECISION]** It adds promotion rules, notifications, and deadline edge cases with little thesis value. Manual mode already gives organizers control.
6. **Organizer decisions** allowed while event is `published` and before `effective_end`.
7. **Approved → rejected** allowed only if no `present`/`pending` attendance record exists; requires a reason.
8. **Participant cancellation** allowed until `starts_at` and only without an attendance record.
9. Registrations of a cancelled event stay as they were (for history); the UI shows "Event cancelled".

### 8.1 Bulk actions (manual approval)

UI (Registrations tab):
- Status filter tabs (Pending default, Approved, Rejected, Cancelled, All), search by name/student ID, 50 rows per page.
- Row checkboxes; header checkbox = **select all rows visible on the current page only**.
- Selection is **cleared whenever the filter, search, or page changes**, so hidden rows are never acted on.
- Action bar shows "N selected": **Approve selected**, **Reject selected** (dialog with optional reason).
- Separate **Approve all pending (N)** button: confirmation dialog states the server-side count and remaining capacity.

Server behavior:
- `decide_registrations(event_id, registration_ids[], decision, reason)` — max 500 ids. Only rows that belong to the event **and** are currently `pending` are changed. Approvals are applied oldest-first until capacity is reached.
- `approve_all_pending(event_id)` — approves pending rows oldest-first up to remaining capacity.
- Both return `{ approved, rejected, skipped_not_pending, skipped_capacity }`; the UI shows a summary toast, e.g. "38 approved. 4 not approved: event is full."

---

## 9. Attendance Lifecycle

### 9.1 Attendance session

Table `attendance_sessions`, statuses `open` | `closed`.

- Organizer opens a session from the Attendance tab. Allowed when event is `published` and `now ≥ starts_at − 2 hours` (grace for early check-in) **[CONFIRM]** and not `completed`/`cancelled`.
- Only **one open session per event** (partial unique index).
- Closing a session stops new scans. Pending check-ins can still be confirmed or dismissed after closing, until the event is completed.
- A closed session can be followed by a new session (e.g., accidental close). Attendance is still **one record per registration per event**, regardless of session.
- **[DECISION]** One attendance per event. Multi-day or multi-session attendance (AM/PM) is out of scope.
- Marking the event `completed` closes any open session automatically.

### 9.2 Dynamic QR token

- On session open, the database generates a random 32-byte secret stored in `attendance_session_secrets` (a table with **no client grants**).
- Time is divided into **30-second windows**: `w = floor(epoch(now) / 30)`.
- Token = `base64url( session_id[16 bytes] ‖ w[4 bytes] ‖ HMAC-SHA256(secret, session_id ‖ w)[first 16 bytes] )` — ~48 characters.
- The organizer's station calls `get_attendance_qr(session_id)` (owner-only RPC) which returns `{ token, window_ends_at }`. The client refreshes at `window_ends_at`, so the QR rotates every ≤ 30 s, with a visible countdown ring.
- Verification accepts the current and the previous window (max lifetime ≈ 60 s) to tolerate scan latency.
- Both generation and verification use the **database clock** — device clocks are irrelevant.
- QR payload is a URL: `{NEXT_PUBLIC_APP_URL}/scan?t=<token>`. Scanning with the in-app scanner **or** the phone's native camera both work; the `/scan` page submits the token automatically after login.

### 9.3 Scan → pending → confirm

`submit_attendance_scan(token)` (participant RPC) checks, in this order, and returns a result code:

| Order | Check | Result code | Participant message |
|---|---|---|---|
| 1 | Authenticated | `unauthenticated` | Redirect to login, then back to `/scan?t=…` |
| 2 | Token decodes and HMAC matches | `invalid_qr` | "This QR code is not a valid EventHub attendance code." |
| 3 | Session exists and is `open` | `attendance_closed` | "Attendance for {event} is closed." |
| 4 | Window is current or previous | `expired_qr` | "This QR code has expired. Scan the code currently on screen." |
| 5 | User has a registration for that event | `not_registered` | "You are not registered for {event}." (covers wrong event) |
| 6 | Registration `approved` | `registration_not_approved` | "Your registration is {pending/rejected/cancelled}." |
| 7 | Existing attendance record | `already_present` (+ `verified_at`) / `already_pending` | "Already checked in at 9:14 AM." / "Waiting for organizer confirmation." |
| 8 | All pass | `pending_created` | "Scan received. Show your face to the organizer." |

When a scanner is opened from a specific event card (`/scan?event=<id>`) and the token belongs to another event, the result is `wrong_event` ("This QR is for {other event}").

A `dismissed` record is reset to `pending` on a new valid scan.

`INSERT … ON CONFLICT (registration_id) DO NOTHING` guarantees no duplicate records.

**Organizer actions** (owner-only RPCs):

| RPC | Effect |
|---|---|
| `confirm_attendance(record_id)` | `pending → present`; sets `verified_by = auth.uid()`, `verified_at = now()`. Uses `UPDATE … WHERE status = 'pending'`; if 0 rows, returns `already_confirmed` with who/when (handles two tabs or two devices). |
| `dismiss_attendance(record_id, reason)` | `pending → dismissed` ("Not this person"). Participant may rescan. |
| `manual_check_in(registration_id)` | Creates/sets `present` with `method = 'manual'` for an approved registrant without a phone. **[DECISION]** Recommended addition — real events always have dead batteries. |
| `revoke_attendance(record_id, reason)` | `present → dismissed` (wrong person confirmed). Allowed until certificates are generated; afterwards the certificate must be revoked first. Audit-logged. |

**Security formula:** authenticated account + approved registration + valid rotating QR + organizer visual confirmation = confirmed attendance. No biometrics.

Attendance statuses stored: `pending`, `present`, `dismissed`. **"Absent" is derived**: approved registration with no `present` record after the event is completed.

### 9.4 Check-in Station layout (laptop/tablet, full-screen route)

- **Left (≈55%)**: large QR, countdown ring ("Refreshes in 12 s"), event title, session status badge, counters (Present / Approved, Pending in queue), Close session button.
- **Right (≈45%)**: verification panel.
  - Empty state: "Waiting for participant…".
  - On new pending record: card slides/fades in with photo (large), full name, student ID, college/program/year, registration status badge, scan time. Buttons: **Confirm attendance** (primary, keyboard `Enter`), **Not this person** (secondary, keyboard `Esc` → reason).
  - **[DECISION]** Below the focus card, a compact **queue list** ("3 more waiting") — at real events many people scan within seconds; a single-card panel would lose people. Focus card is always the oldest pending record (FIFO); the organizer can click any queued entry to focus it.
  - Already-confirmed toast when another device confirmed the same record.
- Connection indicator (Live / Reconnecting / Polling).

---

## 10. Certificate Lifecycle

### 10.1 Template configuration

1. Organizer enables certificates on the event.
2. Uploads a background image designed in Canva/Photoshop: **PNG or JPG**, ≤ 10 MB, landscape or portrait; recommended A4 or Letter at 150–300 DPI. PDF backgrounds are out of MVP scope **[CONFIRM]**.
3. Constrained editor: the image is shown at fit-width; predefined fields appear as draggable labels.

| Field key | Content | Default enabled |
|---|---|---|
| `recipient_name` | Participant full name (snapshot) | ✓ (cannot be disabled) |
| `event_title` | Event title | ✓ |
| `event_date` | Formatted date, e.g. "October 10, 2026" | ✓ |
| `certificate_number` | e.g. `CLC-2026-000123` | ✓ |
| `signatory_text` | Free text entered by organizer (e.g. "Juan Dela Cruz, CLC President") — up to 2 lines | — |
| `verification_qr` | QR to public verify page | ✓ |

Per text field: position (x, y as 0–1 fractions of page), font family (Helvetica, Helvetica Bold, Times Roman, Times Bold, Courier — pdf-lib standard fonts), font size (8–96 pt), alignment (left/center/right), color (hex). Name field auto-shrinks to fit a configurable max width. Per QR field: position and size (fraction of page width).

**[DECISION]** Standard PDF fonts only in MVP (no font upload, no `@pdf-lib/fontkit`). They support Filipino characters such as "ñ". Custom fonts can be added later with fontkit.

4. **Preview** renders a real PDF in the browser using the *same* renderer as final certificates, with sample or real data.
5. **Save** creates a template version.

### 10.2 Template versioning

- `certificate_templates` rows are versioned per event (`version` 1, 2, …); exactly one `is_active`.
- A template version referenced by any certificate becomes **immutable** (trigger). Editing then creates a new version.
- When a newer active version exists and certificates were issued on an older one, the Certificates tab shows "12 certificates use template v1" with an action **Apply current template to issued certificates** (updates `template_id`; numbers, names, and verification codes unchanged).

### 10.3 Eligibility

A participant is eligible when all hold:
- Event `status = 'completed'` and `certificates_enabled = true` and an active template exists.
- Registration `approved`.
- Attendance record `present`.
- No existing certificate for that registration.

### 10.4 Generation ("Generate Certificates")

- Organizer sees "N eligible, M already issued" and clicks **Generate certificates**.
- `issue_certificates(event_id)` creates certificate rows for all eligible participants in **one transaction**, with `ON CONFLICT (registration_id) DO NOTHING`. Retrying is safe and only issues the missing ones.
- Each row snapshots `recipient_name`, `event_title`, `event_date`, assigns `certificate_number` from a sequence (`CLC-{YYYY}-{000001}`) **[CONFIRM prefix]**, and a random `verification_code` (unguessable, ~22 chars).

**[DECISION] PDFs are rendered on demand, not stored.** Downloading calls a Route Handler that authorizes the request (RLS), loads the template image, and renders the PDF with pdf-lib from the certificate's snapshot. Because the snapshot and the template version are immutable, the output is deterministic. Benefits: no bulk-render timeouts on Vercel, no `generated-certificates` bucket, no orphaned files, and template changes are explicit. "Generation" is still an explicit organizer action — it is the issuance of numbered, verifiable certificates.

### 10.5 Participant access

- My Certificates: list with event, date, number. **Preview** (inline PDF) and **Download PDF** (`EventHub-Certificate-CLC-2026-000123.pdf`).
- Visible only after issuance.

### 10.6 Public verification

- `/verify/[code]` is public (no login). Calls `verify_certificate(code)` (anon-executable RPC) that returns only: recipient name, event title, event date, certificate number, issued date, organizer organization name, status (Valid / Revoked).
- Unknown code → "No certificate found". Codes are random, so the page cannot be enumerated.
- Also a form at `/verify` to type a certificate number + verification code.

### 10.7 Revocation and corrections

- `revoke_certificate(id, reason)` — organizer; certificate shows **Revoked** on verify page; participant can no longer download.
- `refresh_certificate_name(id)` — organizer; replaces `recipient_name` snapshot with the current profile name (for name corrections). Number and verification code unchanged. Audit-logged.

**Attendance QR = check-in. Certificate QR = authenticity verification.** They never share format or route.

---

## 11. Business Rules (consolidated)

1. Profile must be complete (including photo) before registering or applying as organizer.
2. One registration row per (event, user); one attendance record per registration; one certificate per registration.
3. One pending organizer application per user.
4. One open attendance session per event.
5. One active certificate template per event; referenced templates are immutable.
6. Capacity counts approved registrations only and is enforced under a row lock.
7. Capacity can never be set below the approved count.
8. Organizers cannot register for their own events.
9. Organizers act only on events where `events.organizer_id = auth.uid()` **and** their `organizer_status = 'active'` (suspended/revoked organizers get read-only access to their own events).
10. Admins cannot review their own application.
11. Status columns are written only by RPCs.
12. Completed and cancelled events are terminal.
13. Certificates require completed event + approved registration + present attendance.
14. Invite links/QR/code only open event details; registration is always explicit.
15. All timestamps `timestamptz`; display timezone Asia/Manila.

---

## 12. Proposed Database Schema

Conventions: `snake_case`; `uuid` PKs via `gen_random_uuid()` for user-facing entities, `smallint`/`bigint identity` for lookups/logs; every mutable table has `created_at timestamptz not null default now()` and `updated_at` maintained by a shared trigger `set_updated_at()`. All tables in `public` have RLS **enabled**. Foreign keys get covering indexes.

### 12.1 Enums

```sql
create type organizer_status         as enum ('none','active','suspended','revoked');
create type application_status       as enum ('pending','approved','rejected','withdrawn');
create type event_status             as enum ('draft','published','completed','cancelled');
create type event_visibility         as enum ('public','unlisted');
create type approval_mode            as enum ('automatic','manual');
create type registration_status      as enum ('pending','approved','rejected','cancelled');
create type attendance_session_status as enum ('open','closed');
create type attendance_status        as enum ('pending','present','dismissed');
create type check_in_method          as enum ('qr','manual');
```

### 12.2 Tables

#### `colleges` (lookup, seeded)
Purpose: college filter, profile college, event host college.
- `id smallint identity PK`, `code text UNIQUE NOT NULL` (e.g. `CECT`), `name text UNIQUE NOT NULL`, `is_active boolean default true`.
- Seed list **[CONFIRM]** the official WU-P colleges.

#### `event_categories` (lookup, seeded)
- `id smallint identity PK`, `slug text UNIQUE`, `name text UNIQUE`, `sort_order smallint`, `is_active boolean`.
- Seed e.g. Seminar, Workshop, Assembly, Competition, Sports, Cultural, Community Service, Other **[CONFIRM]**.
- Admin CRUD UI is out of scope; changed by migration.

#### `profiles`
Purpose: one row per auth user; participant identity; role flags.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text NOT NULL | Copied from `auth.users` by trigger; not user-editable |
| `first_name` | text | 1–80 |
| `middle_name` | text NULL | |
| `last_name` | text | 1–80 |
| `suffix` | text NULL | Jr., III |
| `student_id` | text NULL UNIQUE | Format **[CONFIRM]**; NULL until completed |
| `college_id` | smallint NULL FK → colleges | |
| `program` | text NULL | e.g. BS Information Technology |
| `year_level` | smallint NULL | CHECK 1–6 |
| `avatar_path` | text NULL | Storage path in `avatars` |
| `is_complete` | boolean GENERATED ALWAYS AS (all required fields not null) STORED | |
| `is_admin` | boolean NOT NULL default false | Not client-writable |
| `organizer_status` | organizer_status NOT NULL default 'none' | Not client-writable |
| `organizer_since` | timestamptz NULL | |
| `organizer_status_reason` | text NULL | Last suspend/revoke reason |
| `created_at`, `updated_at` | timestamptz | |

- Display name derived: `first_name [middle initial.] last_name[, suffix]` — SQL function `profile_full_name(profiles)` + TS helper.
- Index: `(organizer_status) WHERE organizer_status <> 'none'`; unique on `student_id`.
- Created by trigger `handle_new_user()` on `auth.users` insert.
- Column privileges: `authenticated` may UPDATE only `first_name, middle_name, last_name, suffix, student_id, college_id, program, year_level, avatar_path`.
- **[DECISION]** `student_id` changes after any certificate is issued are blocked (trigger) to keep identity stable; admin can fix via SQL.

#### `organizer_applications`

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
| `status` | application_status NOT NULL default 'pending' | |
| `submitted_at` | timestamptz NOT NULL default now() | |
| `reviewed_by` | uuid NULL FK → profiles | |
| `reviewed_at` | timestamptz NULL | |
| `review_notes` | text NULL | CHECK: required when `status='rejected'` |
| `created_at`, `updated_at` | | |

- `UNIQUE (applicant_id) WHERE status = 'pending'` (partial unique index).
- Index `(status, submitted_at)`, `(applicant_id, submitted_at desc)`.
- CHECK: `reviewed_by <> applicant_id`.
- The approved application's `organization_name` is shown as the organizer's organization (latest approved application).

#### `events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organizer_id` | uuid NOT NULL FK → profiles | Owner; set to `auth.uid()` by default |
| `title` | text NOT NULL | |
| `description` | text NULL | |
| `banner_path` | text NULL | |
| `category_id` | smallint NULL FK | |
| `host_college_id` | smallint NULL FK | NULL = university-wide |
| `venue` | text NULL | |
| `starts_at` | timestamptz NULL | Required to publish |
| `ends_at` | timestamptz NULL | CHECK `ends_at > starts_at` |
| `registration_opens_at` | timestamptz NULL | |
| `registration_closes_at` | timestamptz NULL | CHECK `> registration_opens_at` and `<= starts_at` (§7.1) |
| `capacity` | integer NULL | CHECK 1–5000 |
| `approval_mode` | approval_mode NOT NULL default 'automatic' | |
| `visibility` | event_visibility NOT NULL default 'public' | |
| `certificates_enabled` | boolean NOT NULL default false | |
| `invite_code` | text NOT NULL UNIQUE | 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, generated by default |
| `status` | event_status NOT NULL default 'draft' | RPC-only |
| `published_at`, `completed_at`, `cancelled_at` | timestamptz NULL | |
| `cancellation_reason` | text NULL | CHECK required when cancelled |
| `search` | tsvector GENERATED (title A, venue B, description C, 'simple' config) STORED | |
| `created_at`, `updated_at` | | |

- Publish-completeness enforced by CHECK: `status = 'draft' OR (description, category_id, venue, starts_at, registration_opens_at, registration_closes_at are NOT NULL)`.
- Indexes: `(status, starts_at)`, `(organizer_id, starts_at desc)`, `(category_id)`, `(host_college_id)`, GIN `(search)`.
- Column privileges: `authenticated` may INSERT/UPDATE content columns only (not `organizer_id` on update, `status`, `*_at` status timestamps, `invite_code`).
- Trigger `events_guard`: blocks content updates when status is `completed`/`cancelled` (except `certificates_enabled` rule), blocks capacity below approved count.
- Approved count is **derived** (`count(*) where status='approved'`) — not stored. With index `(event_id, status)` the count is cheap at this scale.

#### `event_registrations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid NOT NULL FK → events ON DELETE CASCADE (only drafts can be deleted, and drafts have no registrations) | |
| `user_id` | uuid NOT NULL FK → profiles | |
| `status` | registration_status NOT NULL | |
| `registered_at` | timestamptz NOT NULL default now() | Reset on re-register |
| `decided_at` | timestamptz NULL | |
| `decided_by` | uuid NULL FK → profiles | NULL for automatic approvals |
| `decision_reason` | text NULL | Rejection reason |
| `cancelled_at` | timestamptz NULL | |
| `created_at`, `updated_at` | | |

- `UNIQUE (event_id, user_id)`.
- Indexes: `(event_id, status, registered_at)`, `(user_id, registered_at desc)`.
- No client INSERT/UPDATE/DELETE grants — RPC only.

#### `attendance_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid NOT NULL FK → events | |
| `status` | attendance_session_status NOT NULL default 'open' | |
| `opened_by` | uuid NOT NULL FK → profiles | |
| `opened_at` | timestamptz NOT NULL default now() | |
| `closed_by` | uuid NULL | |
| `closed_at` | timestamptz NULL | CHECK consistent with status |

- `UNIQUE (event_id) WHERE status = 'open'`.
- Index `(event_id, opened_at desc)`.
- RPC-only writes.

#### `attendance_session_secrets`
- `session_id uuid PK FK → attendance_sessions ON DELETE CASCADE`, `secret bytea NOT NULL`.
- RLS enabled, **no policies, all privileges revoked from `anon`/`authenticated`**. Read only inside `SECURITY DEFINER` functions.
- Justification: keeps the HMAC secret out of every API response and Realtime payload of `attendance_sessions`.

#### `attendance_records`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `registration_id` | uuid NOT NULL UNIQUE FK → event_registrations | Prevents duplicates |
| `event_id` | uuid NOT NULL FK → events | Denormalized for RLS + Realtime filter (`event_id=eq.…`) |
| `user_id` | uuid NOT NULL FK → profiles | Denormalized for participant RLS |
| `session_id` | uuid NULL FK → attendance_sessions | Session of the latest scan; NULL for manual |
| `method` | check_in_method NOT NULL | |
| `status` | attendance_status NOT NULL | |
| `scanned_at` | timestamptz NULL | Latest scan |
| `verified_by` | uuid NULL FK → profiles | Organizer who confirmed |
| `verified_at` | timestamptz NULL | = official check-in time |
| `dismissed_by`, `dismissed_at`, `dismiss_reason` | | |
| `created_at`, `updated_at` | | |

- Consistency between `event_id`/`user_id` and the registration is guaranteed because only RPCs write rows (they copy values from the registration); additionally a composite FK `(registration_id, event_id, user_id)` → `event_registrations(id, event_id, user_id)` (requires a matching unique index there) enforces it in the schema.
- CHECK: `status = 'present'` ⇒ `verified_at IS NOT NULL`.
- Indexes: `(event_id, status, scanned_at)`, `(user_id)`.
- Added to the `supabase_realtime` publication.

#### `certificate_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event_id` | uuid NOT NULL FK → events | |
| `version` | integer NOT NULL | |
| `background_path` | text NOT NULL | `certificate-templates` bucket |
| `page_width_pt`, `page_height_pt` | numeric NOT NULL | Derived from image aspect, mapped to A4/Letter |
| `layout` | jsonb NOT NULL | Array of field configs (validated by Zod on write; CHECK `jsonb_typeof(layout)='array'`) |
| `signatory_text` | text NULL | ≤ 200 chars |
| `is_active` | boolean NOT NULL default true | |
| `created_by` | uuid NOT NULL | |
| `created_at` | timestamptz | |

- `UNIQUE (event_id, version)`; `UNIQUE (event_id) WHERE is_active`.
- Trigger: block UPDATE/DELETE when referenced by any certificate (except toggling `is_active` off).

#### `certificates`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `certificate_number` | text NOT NULL UNIQUE | From sequence `certificate_number_seq` |
| `verification_code` | text NOT NULL UNIQUE | 16 random bytes, base64url |
| `event_id` | uuid NOT NULL FK | |
| `user_id` | uuid NOT NULL FK | |
| `registration_id` | uuid NOT NULL UNIQUE FK | One certificate per registration |
| `attendance_record_id` | uuid NOT NULL FK | |
| `template_id` | uuid NOT NULL FK → certificate_templates | |
| `recipient_name` | text NOT NULL | Snapshot |
| `event_title` | text NOT NULL | Snapshot |
| `event_date` | date NOT NULL | Snapshot (Asia/Manila date of `starts_at`) |
| `issued_at` | timestamptz NOT NULL default now() | |
| `issued_by` | uuid NOT NULL | |
| `revoked_at`, `revoked_by`, `revoke_reason` | NULL | |

- Indexes: `(user_id, issued_at desc)`, `(event_id)`.
- RPC-only writes.

#### `audit_logs` (justified, minimal)
Purpose: accountability for privileged or corrective actions, useful for thesis defense.
- `id bigint identity PK`, `actor_id uuid NULL`, `action text NOT NULL` (e.g. `application.approved`, `organizer.suspended`, `attendance.revoked`, `certificate.revoked`, `certificate.name_refreshed`, `certificates.issued`), `entity_type text`, `entity_id uuid`, `metadata jsonb`, `created_at`.
- Inserted only inside RPCs. Admin can read all; organizers can read entries for their own events (`metadata->>'event_id'`) — optional view.
- Index `(entity_type, entity_id)`, `(created_at desc)`.

### 12.3 Tables evaluated and excluded

| Table | Decision | Reason |
|---|---|---|
| `event_invites` | Excluded | One reusable `invite_code` on `events` covers code, QR, and link. Per-person invites need notification/email delivery (out of scope). |
| `notifications` | Excluded | No in-app notification center in MVP; statuses are visible on pages. Auth emails handled by Supabase. |
| `generated_certificates` storage | Excluded | PDFs are rendered on demand (§10.4). |
| `event_staff` / co-organizers | Excluded | Single owner per event. **[CONFIRM]** whether co-organizers/door staff are needed. |
| Stored counters (approved_count, attendance_count) | Excluded | Derived with indexed counts; avoids drift. |

### 12.4 Relationships

```
auth.users 1─1 profiles
profiles 1─* organizer_applications (applicant)      profiles 1─* organizer_applications (reviewer)
profiles 1─* events (organizer)
events *─1 event_categories      events *─1 colleges (host)      profiles *─1 colleges
events 1─* event_registrations *─1 profiles
events 1─* attendance_sessions 1─1 attendance_session_secrets
event_registrations 1─0..1 attendance_records *─0..1 attendance_sessions
events 1─* certificate_templates
event_registrations 1─0..1 certificates *─1 certificate_templates
certificates *─1 attendance_records
```

### 12.5 Database functions (RPC surface)

All `SECURITY DEFINER`, `SET search_path = ''`, schema-qualified references, `auth.uid()` checks at the top, `EXECUTE` granted only to the listed role.

| Function | Caller | Purpose |
|---|---|---|
| `is_admin()`, `is_active_organizer()`, `owns_event(event_id)`, `can_view_profile(profile_id)` | internal / RLS | Helpers (`STABLE`) |
| `event_phase(events)` | authenticated | Derived phase |
| `submit_organizer_application(...)`, `withdraw_organizer_application(id)` | authenticated | |
| `review_organizer_application(id, decision, notes)` | admin | |
| `set_organizer_status(user_id, status, reason)` | admin | suspend / reinstate / revoke |
| `publish_event(id)`, `cancel_event(id, reason)`, `complete_event(id)`, `regenerate_invite_code(id)` | active organizer, owner | |
| `get_event_by_invite_code(code)` | authenticated | Returns event id for published events |
| `register_for_event(event_id)`, `cancel_registration(event_id)` | authenticated | |
| `decide_registrations(event_id, ids, decision, reason)`, `approve_all_pending(event_id)` | owner | |
| `open_attendance_session(event_id)`, `close_attendance_session(session_id)` | owner | |
| `get_attendance_qr(session_id)` | owner | Token + window end |
| `submit_attendance_scan(token, expected_event_id default null)` | authenticated | |
| `confirm_attendance`, `dismiss_attendance`, `manual_check_in`, `revoke_attendance` | owner | |
| `save_certificate_template(event_id, background_path, layout, signatory_text, page dims)` | owner | Creates new version or updates unreferenced active one |
| `issue_certificates(event_id)`, `revoke_certificate(id, reason)`, `refresh_certificate_name(id)`, `apply_template_to_issued(event_id)` | owner | |
| `verify_certificate(code)` | anon + authenticated | Minimal public fields |
| `get_event_report(event_id)` | owner (read-only for suspended owner) | Aggregate counts |
| `get_admin_overview()` | admin | Aggregate counts |

---

## 13. Supabase RLS Strategy

### 13.1 Principles

1. RLS enabled on every `public` table; default deny.
2. Policies are written per role (`TO authenticated` / `TO anon`) and per command.
3. Helper functions are `SECURITY DEFINER STABLE` and wrapped as `(select public.is_admin())` in policies so Postgres evaluates them once per statement.
4. **Writes to status columns never go through table policies** — they go through RPCs. Table-level `INSERT/UPDATE/DELETE` grants are revoked where RPCs own the writes, and column-level grants restrict what direct updates can touch.
5. No service-role key in the Next.js runtime.
6. Realtime `postgres_changes` honors the same SELECT policies.

### 13.2 Policy table

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `colleges`, `event_categories` | anon + authenticated: all | — | — | — |
| `profiles` | own row; admin all; organizer: profiles of users registered to an event they own (`can_view_profile`) | via trigger only | own row, allowed columns only | — |
| `organizer_applications` | own; admin all | RPC | RPC | — |
| `events` | `status <> 'draft'` (any authenticated); own (any status); admin all | active organizer with `organizer_id = auth.uid()`, `status='draft'` | owner + active organizer; content columns only; guard trigger | owner, `status='draft'` |
| `event_registrations` | own; event owner; admin (counts only via RPC) | RPC | RPC | — |
| `attendance_sessions` | event owner; participants with approved registration for that event (to show "Attendance open") | RPC | RPC | — |
| `attendance_session_secrets` | none | none | none | none |
| `attendance_records` | own; event owner | RPC | RPC | — |
| `certificate_templates` | event owner | RPC | RPC | — |
| `certificates` | own (not revoked for download); event owner | RPC | RPC | — |
| `audit_logs` | admin | RPC | — | — |

Notes:
- Unlisted events are hidden from the Explore query, but any authenticated user who has the link/code can read them. "Unlisted" means *not listed*, not *secret*. **[DECISION]**
- Suspended/revoked organizers keep SELECT on their own events and related data (read-only reports/exports); all write RPCs check `is_active_organizer()`.

### 13.3 RLS testing

Every policy gets SQL tests that impersonate users via `set local role authenticated; set local request.jwt.claims = '{"sub":"…"}'` covering: owner allowed, other organizer denied, participant denied, suspended organizer denied for writes, admin allowed where intended. See PLAN.md Phase 1/3/8.

---

## 14. Storage Strategy

| Bucket | Access | Path convention | Read policy | Write policy | Limits |
|---|---|---|---|---|---|
| `avatars` | **Private**, signed URLs (1 h) | `{user_id}/{uuid}.{ext}` | owner; `can_view_profile(owner)` (event owner of a registration); admin | owner folder only; replace = upload new + update `avatar_path` + delete old | 2 MB; jpeg/png/webp; client-side resize to 512 px |
| `event-banners` | **Public** read | `{event_id}/{uuid}.{ext}` | public | `owns_event(event_id)` + active organizer | 5 MB; jpeg/png/webp |
| `organizer-requirements` | **Private**, signed URLs (60 s) | `{user_id}/{uuid}.{ext}` | owner; admin | owner folder, insert only; no update/delete | 5 MB; pdf/jpeg/png |
| `certificate-templates` | **Private** | `{event_id}/{uuid}.{ext}` | event owner; users holding a non-revoked certificate for that event (needed for on-demand render under their session) | owner + active organizer, insert only (new version = new file) | 10 MB; png/jpeg |
| `generated-certificates` | **Not created** | — | — | — | PDFs rendered on demand |

**[DECISION]** Avatars are private because student photos are personal data under the Data Privacy Act; banners are public because they are marketing material for published events (unguessable paths; draft banners are not linked anywhere).

Bucket file-size and MIME limits are set on the bucket itself, and mirrored in Zod for UX.

---

## 15. Realtime Strategy

Used only where it gives clear value.

| Use | Mechanism | Subscriber | Fallback |
|---|---|---|---|
| Check-in Station receives new/updated pending check-ins | `postgres_changes` on `attendance_records`, filter `event_id=eq.{id}` (INSERT + UPDATE) | Organizer station (RLS: owner) | On `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`: show "Reconnecting", poll `attendance_records` every 3 s until resubscribed; manual Refresh button |
| Participant waiting screen ("Waiting for organizer confirmation") | `postgres_changes` on `attendance_records`, filter `id=eq.{record_id}` | Participant (RLS: own) | Poll every 4 s |

Payload handling: the realtime payload contains only the attendance row; the station then fetches the participant's display data (name, student ID, college, program, year, signed avatar URL) in one query. On reconnect, the station refetches the full pending queue (realtime does not replay missed events).

Not realtime: Explore, registrations table (refresh on action + manual refresh), dashboards, reports, certificates.

Multiple tabs/devices: each subscribes independently; confirmation is idempotent at the DB level (§9.3); the losing tab shows "Already confirmed by {name} at {time}" and removes the card.

**[DECISION]** `postgres_changes` is sufficient at thesis scale (one event, hundreds of attendees). Supabase recommends Broadcast-from-database for high scale; noted as a future optimization.

---

## 16. Routing / Page Architecture

### 16.1 Structure

```
app/
  layout.tsx                         root: fonts, <html>, Toaster
  (public)/
    page.tsx                         /                  landing (brief, links to login/explore)
    verify/page.tsx                  /verify            enter certificate number + code
    verify/[code]/page.tsx           /verify/:code      public verification result
  (auth)/
    layout.tsx                       centered card layout
    login/page.tsx
    signup/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
  auth/
    confirm/route.ts                 email OTP/token-hash confirmation
    callback/route.ts                PKCE code exchange
    signout/route.ts                 POST
  (app)/                             authenticated shell (sidebar + topbar), ONE shell for all roles
    layout.tsx                       static shell; session-dependent nav streamed inside <Suspense>
    dashboard/page.tsx
    profile/page.tsx                 also the "complete your profile" flow
    events/page.tsx                  Explore (searchParams: tab, q, category, college, from, to, page)
    events/join/page.tsx             enter invite code
    events/[eventId]/page.tsx        event details + register action
    my-events/page.tsx
    certificates/page.tsx
    certificates/[certificateId]/page.tsx   preview
    certificates/[certificateId]/pdf/route.ts   GET → PDF (inline or ?download=1)
    scan/page.tsx                    QR scanner + ?t= token handling + waiting screen
    become-organizer/page.tsx        application form / status
    organizer/
      layout.tsx                     guard: organizer_status in (active, suspended, revoked) with owned events; else redirect
      page.tsx                       organizer dashboard
      events/page.tsx                my organized events
      events/new/page.tsx
      events/[eventId]/
        layout.tsx                   event workspace header + tabs; ownership check
        page.tsx                     Overview
        registrations/page.tsx
        attendance/page.tsx          sessions, stats, open/close, manual check-in, launch station
        certificates/page.tsx        template editor, eligibility, generate, issued list
        reports/page.tsx
        reports/export/route.ts      GET ?type=registrations|attendance|certificates → CSV
        settings/page.tsx            edit, invite code, cancel, delete draft
      reports/page.tsx               cross-event summary table
    admin/
      layout.tsx                     guard: is_admin
      page.tsx                       overview
      applications/page.tsx
      applications/[applicationId]/page.tsx
      organizers/page.tsx
  (station)/
    station/[eventId]/page.tsx       full-screen Check-in Station (no sidebar)
  e/[code]/route.ts                  short invite link → resolves code → redirect /events/:id
proxy.ts                             session refresh + optimistic redirect of unauthenticated users
lib/
  supabase/{server.ts, client.ts, proxy.ts}
  auth/dal.ts                        getCurrentUser(), requireOrganizer(), requireAdmin() — 'server-only'
  validation/*.ts                    Zod schemas shared by forms and server actions
  events/phase.ts, lib/datetime.ts   Asia/Manila helpers
  attendance/*.ts                    scanner + station client helpers
  certificates/render.ts             isomorphic pdf-lib renderer (preview + final)
  database.types.ts                  generated by Supabase CLI
components/
  ui/                                shadcn (existing)
  app-shell/, events/, registrations/, attendance/, certificates/, admin/
supabase/
  migrations/*.sql
  seed.sql
  tests/*.sql
```

**[DECISION]** One authenticated `(app)` shell for everyone. Organizer and admin routes are nested *inside* it, so organizers keep participant navigation without duplicated layouts. The sidebar renders sections conditionally:

- **Participant**: Dashboard, Explore Events, My Events, My Certificates, Scan Attendance, Become an Organizer (hidden when active), Profile.
- **Organizer** (when status ≠ none and has access): Organizer Dashboard, My Organized Events, Create Event, Reports.
- **Admin** (when `is_admin`): Overview, Applications, Organizers.
- Mobile: bottom navigation for participant core (Home, Explore, Scan, My Events, Certificates); sidebar in a Sheet for the rest.

### 16.2 Next.js 16 specifics

- `proxy.ts` refreshes the Supabase session cookie (the `@supabase/ssr` pattern) and redirects unauthenticated users away from `(app)` and `(station)`. It is an optimistic check only.
- The real check is the Data Access Layer (`lib/auth/dal.ts`, `import 'server-only'`), called in pages/components inside `<Suspense>` and in every Server Action and Route Handler, plus RLS in the database.
- Use `supabase.auth.getClaims()` / `getUser()` server-side — never trust `getSession()` alone.
- Session-reading components sit inside `<Suspense>`; layouts do not `await` the session at top level (cacheComponents rule).
- Mutations: Server Actions validate with Zod, call the RPC with the user-scoped Supabase client, map result codes to typed results, and call `refresh()`/`revalidatePath` as appropriate.

---

## 17. Event Discovery Design

- **Event is the unit**; organizer appears as a byline ("by Supreme Student Council – CECT").
- Explore tabs: **Upcoming** (default: published, public, `effective_end ≥ now`, sorted by `starts_at`), **Open for registration** (phase `registration_open`), **My college** (`host_college_id = my college OR NULL`), **Past** (completed, last 90 days).
- Search: full-text on `search` (title > venue > description) with `websearch_to_tsquery('simple', q)`; fallback `ilike` prefix for 1–2 char queries is not needed (min 2 chars).
- Filters: category (multi), host college, date range (This week / This month / custom).
- Pagination: offset pagination, 12 cards per page, URL-driven (`?page=`), shareable and back-button safe. Card grid on desktop, single column on mobile.
- Card content: banner thumbnail, date chip, title, venue, category badge, phase badge ("Open", "Closing soon" < 48 h, "Full", "Closed"), "Registered" badge if applicable.
- Empty states: "No events match your filters — Clear filters".

---

## 18. Important UI States

| Area | States |
|---|---|
| Auth | unconfirmed email notice; invalid credentials; password reset sent; session expired → redirect with `next` param |
| Profile | incomplete-profile gate (blocks Register/Apply with a link back) |
| Event details action button | Log in to register · Complete profile to register · Registration opens {date} · Register · Registered (approved) · Pending approval · Rejected (reason) · Cancelled — Register again · Event full · Registration closed · Event cancelled · Ongoing — Scan attendance (if session open) · Completed |
| Explore | loading skeleton cards, empty, no-results, error with retry |
| Registrations (org) | empty (no registrants yet + share invite CTA), filtered empty, bulk-result summary, capacity bar |
| Attendance (org) | not started (countdown to `starts_at`), session open, session closed (n pending to resolve), completed |
| Station | waiting, card focused, queue, already confirmed elsewhere, reconnecting/polling, session closed by another tab |
| Scan (participant) | camera permission prompt / denied (instructions + "use native camera" tip) / no camera; scanning; submitting; each result code in §9.3; waiting for confirmation; confirmed |
| Certificates (org) | disabled, no template, template saved (preview), event not completed (locked with explanation), N eligible, generating, issued list, template outdated banner |
| Certificates (participant) | none yet; available; revoked |
| Applications | none, pending (submitted date), rejected (notes + Reapply), approved (link to workspace), suspended/revoked notice |
| Global | toasts for success/error; destructive actions use AlertDialog; all forms show field-level errors |

---

## 19. Edge Cases and Safe Behavior

| # | Case | Behavior |
|---|---|---|
| 1 | Registration deadline passed | RPC returns `registration_closed`; button disabled with deadline shown. |
| 2 | Event full | Automatic: `event_full`. Manual: new pending refused once approved = capacity. Concurrent last-slot attempts serialized by `FOR UPDATE` lock; exactly one succeeds. |
| 3 | Participant registers twice (double click, two tabs) | Unique `(event_id, user_id)`; RPC returns existing status (idempotent). Button disabled while pending. |
| 4 | Organizer rejects participant | Status `rejected` + optional reason visible to participant; cannot re-register; blocked if attendance exists. |
| 5 | Organizer changes capacity | Allowed ≥ approved count; lowering below → validation error. Raising capacity does not auto-approve pending. |
| 6 | Organizer cancels event | Reason required; terminal; open session closed; registrations frozen; event shows Cancelled banner; no certificates. |
| 7 | Participant becomes organizer | Same account, same registrations/certificates; organizer section appears after approval (next navigation/refresh). |
| 8 | Organizer access revoked/suspended | Write RPCs refuse (`organizer_inactive`); workspace read-only with banner; open attendance sessions closed automatically at suspension; published events remain visible but cannot be managed — admin is shown the count of affected upcoming events in the suspend dialog. **[CONFIRM]** whether suspension should also auto-cancel upcoming events. |
| 9 | Expired QR | `expired_qr`; scanner keeps camera open to rescan. |
| 10 | QR from wrong event | `not_registered` / `wrong_event` with the other event's title. |
| 11 | Attendance not yet open | Token cannot exist; if participant opens Scan, it shows "Attendance hasn't started" for their events today. |
| 12 | Attendance closed | `attendance_closed`. |
| 13 | Duplicate scan | `already_pending` or `already_present` with original `verified_at`; no new row. |
| 14 | Wrong person confirmed | `revoke_attendance` with reason (audit-logged); if a certificate exists, revoke certificate first. |
| 15 | Event completed without closing attendance | `complete_event` closes the session; warns if pending records exist (they remain not-present → not eligible) and offers to resolve first. |
| 16 | Certificate generation retried | Idempotent; only missing certificates issued; numbers never reused. |
| 17 | Template changed after generation | Old version immutable; new version created; explicit "Apply current template to issued" action. |
| 18 | Participant name changed after generation | Certificate keeps snapshot; organizer can `refresh_certificate_name`. |
| 19 | Cancelled/deleted registrations | Registrations are never hard-deleted; `cancelled` is a status. Draft events (no registrations) are the only hard deletes. |
| 20 | Realtime connection failure | Station shows status, falls back to 3 s polling, refetches queue on reconnect. |
| 21 | Multiple organizer tabs | All receive updates; confirm is idempotent; QR tokens from either tab are valid (same session secret). |
| 22 | Two organizers verifying simultaneously | Same as #21 (single owner on two devices). True co-organizers are out of scope. |
| 23 | Screenshot/forwarded QR | Token valid ≤ 60 s; the remote person still needs organizer visual confirmation, so the check-in is dismissed. |
| 24 | Participant with no phone/camera | Organizer `manual_check_in`. |
| 25 | Camera permission denied | Explain how to enable; suggest native camera app (QR is a URL). |
| 26 | User not logged in scans QR with native camera | `/scan?t=…` → login → returns to `/scan?t=…`; if > 60 s passed, `expired_qr` with "scan again". |
| 27 | Organizer tries to register for own event | Refused (`own_event`). |
| 28 | Admin reviews own application | Refused (CHECK + RPC). |
| 29 | Two admins review same application | `UPDATE … WHERE status='pending'`; second gets `already_reviewed`. |
| 30 | Event edited after registrations | Allowed with warnings (§7.4); locked after completion/cancellation. |
| 31 | Clock drift on devices | Irrelevant — all time checks use DB `now()`. |
| 32 | Profile photo missing at check-in | Cannot happen for new registrations (required). For legacy cases, station shows initials and a "No photo — check school ID" hint. |

---

## 20. Ambiguities, Decisions, and Items to Confirm

> Resolution status is tracked in [DECISIONS.md](./DECISIONS.md) (D-001). Open as of 2026-10-10: C1, C2, C3.

| # | Topic | Recommendation |
|---|---|---|
| C1 | Restrict sign-up to the WU-P email domain? Which domain? | Yes, if all students have school email. Enforced by a Supabase Auth hook or a sign-up check. |
| C2 | Student ID format | Provide the official pattern for a CHECK/Zod regex. |
| C3 | Official college list and event categories | Provide lists for seed data. |
| C4 | Login required to view event details? | Yes (simpler RLS, invite flow works via login redirect). Alternative: public read of published events for anon. |
| C5 | `unlisted` visibility | Include (small cost, makes invite codes meaningful). |
| C6 | Rejected users re-registering | Not allowed. |
| C7 | Organizers registering for their own events | Not allowed. |
| C8 | Attendance session may open from `starts_at − 2h` | Confirm window. |
| C9 | One attendance per event (no AM/PM) | Confirm. |
| C10 | Manual check-in fallback | Include. |
| C11 | Certificate number prefix | `CLC-{YYYY}-{NNNNNN}`. |
| C12 | PDF templates and custom fonts | Exclude from MVP (PNG/JPG + standard fonts). |
| C13 | Render certificate PDFs on demand (no stored files) | Adopt. |
| C14 | Suspension effect on upcoming events | Keep visible but frozen; admin informed. |
| C15 | Co-organizers / door staff accounts | Exclude from MVP. |
| C16 | Email notifications (approval, reminders) | Exclude from MVP. |
| C17 | Development database | Recommend a separate Supabase dev project (or local Supabase via Docker) so migrations are not first tested on the client's project. |
| C18 | Git branch (`master` vs `main`) and committing AI tool folders | Decide before first commit. |
| C19 | New env var `NEXT_PUBLIC_APP_URL` (for QR/verify URLs) | Client adds it; `.env.local` is not modified by us; `.env.example` documents it. |
| C20 | Reports PDF export | Use a print-optimized report page (browser "Save as PDF") instead of a generated PDF. CSV exports generated server-side. |

---

## 21. Explicitly Out of Scope

- Facial recognition, biometrics, geofencing/GPS check-in.
- Canva integration or a free-form certificate design editor; custom font upload; PDF template backgrounds (MVP).
- Waitlists and automatic promotion.
- Email/SMS/push notifications beyond Supabase Auth emails.
- Co-organizers, staff roles, organization entities with multiple members.
- Admin management of event registrations/attendance.
- Multi-session/multi-day attendance.
- Payments/ticketing.
- Native mobile apps (web app is mobile-first; optional PWA later).
- Analytics dashboards beyond the listed reports.
- Comments, ratings, feedback forms, chat.
- Recurring events.
