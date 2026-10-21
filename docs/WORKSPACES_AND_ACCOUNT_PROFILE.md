# Accounts, Roles and Navigation

Supersedes the earlier workspace-switching design (2026-10-21). There is no workspace switcher.

## Roles

Roles stay in `profiles`: `is_admin` and `organizer_status` (`none | active | suspended | revoked`).
Every account can participate in events. No new role system was added.

| Account | Home | Sidebar |
| --- | --- | --- |
| Administrator | `/admin` | Overview, Organizers, Participants, Reference Data |
| Organizer (any non-`none` status) | `/organizer` | Overview, Create Event, MY EVENTS (up to five own events → Overview, Registrations, Attendance) |
| Participant | `/dashboard` | Dashboard, Events, Scan QR Code, MY REGISTERED EVENTS (registration and attendance status) |

- Priority for accounts holding several roles: Admin, then Organizer, then Participant (`homeFor`).
- An Administrator is **not** an Organizer unless granted Organizer access (`canUseOrganizerTools` =
  `organizer_status = 'active'`, matching `private.is_active_organizer()`).
- An account that really holds both Admin and Organizer roles sees the area it is in and a plain link
  to the other area. Navigation never grants access: the proxy, the DAL and RLS decide.
- Suspended and revoked Organizers keep a read-only Organizer experience.

## MVP scope (2026-10-22)

Three workflows: an Organizer creates and publishes an event; a Participant registers from Events or the
event registration QR (both open `/events/<id>`, one `register_for_event` path); the Organizer starts
attendance, Participants scan the rotating QR, and the display shows each server-confirmed attendance.

- Create Event: title, short description, category (required to publish by the database), date, start and
  end time, venue, capacity, optional banner. Approval, visibility, host college and registration deadline
  are under Advanced. Registration opens on save and closes at the event start unless set.
- Event Overview: registered and attended counts plus Edit Event, Registration QR, Open Registrations and
  Open Attendance. Editing is `/organizer/events/<id>/settings`.
- Attendance is opened and closed by the Organizer (migration `20261022090000_manual_attendance_control`,
  pending approval), with a 12-hour safety cap. Draft, cancelled and completed events cannot open it.
- Retired from the UI, data kept: certificates, reports, Organizer Explore Events, Participant My Events and
  Certificates pages. Old URLs redirect (event reports/certificates → event overview, `/organizer/explore`
  → `/organizer`, `/my-events` → `/dashboard`). Issued certificates stay viewable and verifiable by link.

## Account pages

- `/account/profile` is shared by every role. `?workspace=` is ignored. `/profile` redirects there.
- The account menu sits in the sidebar footer: My Profile, Change Password, Log Out.

## Accounts and passwords (no email)

- Admin → Organizers → **Add Organizer** and Admin → Participants → **Create Participant** create an
  account from an email address. The server reserves it (`reserve_account`), creates the Auth user
  with the Admin API (confirmed email, generated temporary password), and the `on_auth_user_created`
  trigger provisions role and `must_change_password` in the same transaction. The credentials are
  shown once to the Admin and never stored, emailed or logged.
- `must_change_password` is not client-writable. While it is set, the proxy and the DAL allow only
  `/change-password` (and logging out). Changing the password clears it (trigger on
  `auth.users.encrypted_password`).
- Change Password always verifies the current (or temporary) password and signs out other devices.
- Recovery: Admin → user → **Reset password** issues a new temporary password (not for the Admin's own
  account or other Administrators). Email recovery pages still exist for projects with SMTP.
- Participant self sign-up is unchanged; with hosted email confirmation turned off it goes straight to
  Student Onboarding.

## Pending before this works live

1. Apply `supabase/migrations/20261021120000_direct_account_provisioning.sql` and
   `20261021120100_retire_organizer_invitations.sql` with the linked Supabase CLI.
2. Set `SUPABASE_SECRET_KEY` on the server (already required for Admin API calls).
3. Hosted Auth (Dashboard → Authentication → Sign In / Providers → Email): turn **Confirm email** off
   for the MVP, so self sign-up returns a session. Admin-created accounts do not depend on it.
