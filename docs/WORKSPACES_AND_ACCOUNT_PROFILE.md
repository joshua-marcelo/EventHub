# Workspace switching and shared Account Profile

## Implemented behavior

The sidebar footer now contains a Workspace Switcher menu rather than immediate
dashboard links. Its trigger is a button showing the current workspace, icon, secondary
label, and chevron. Only a menu selection navigates. The current entry has a check and
no link, so selecting it closes the menu without navigating. The switcher is absent for
Participant-only accounts.

The collapsed rail uses a compact named trigger and tooltip. Menus use the existing
portaled DropdownMenu primitives to escape the scrolling rail. The expanded desktop
sidebar and mobile drawer share the same switcher; selecting an entry closes the drawer.
No role updates, session-role flags, or authentication operations occur on selection.

Account dropdown styling, identity, current workspace role label, My Profile, and secure
Log Out remain. Workspace switching is exclusively in the sidebar, and no Profile or
Log Out items were added there. The logo now points to the current workspace's home.
Dashboard page content and server route protections are unchanged.

## Routes and context

- `/account/profile?workspace=admin|organizer|participant` is the single shared account
  route. The Account menu passes its current workspace context.
- Context is validated against `permittedDashboards(user)` on the server and in the shell.
  A query parameter can never grant a role or make an unauthorized workspace available.
  Admin access does not imply Organizer access. Existing suspended/revoked Organizer
  workspaces remain available read-only, consistent with their existing server guards.
- Valid context persists on refresh, controls the sidebar and Account role label, and
  supplies Back to Admin/Organizer/Participant. Missing, invalid, or repeated context
  values are canonicalized from actual roles: Admin, otherwise Organizer if authorized,
  otherwise Participant. Explicit authorized Participant context is preserved for Admins.
- Legacy `/profile` links redirect to the canonical shared account route after validating
  the session and context. Direct Admin profile visits no longer default to Participant.
- `/profile/student` holds Participant student details separately. Entering it is an
  explicit choice from Account Profile. Existing `/onboarding` remains the student setup
  flow, and its original form and completion requirements remain unchanged.

Account Profile requires a signed-in user with `allowIncomplete: true`. It does not
require student data, fetch college/program options, or force Admin/invited Organizer
accounts into Student Onboarding. It supports existing account names, email display,
private profile photo upload, privacy consent/history, password-reset link, and sign-out
everywhere. Email editing and new security-sensitive account actions were not introduced.

## Data and authorization

All data stays in the existing `profiles` row and Supabase identity. No tables, migrations,
environment variables, accounts, or profile-data migrations were added.

`accountProfileSchema` and `studentDetailsSchema` reuse the corresponding fields from
the existing profile validation. `saveAccountProfile` accepts only name fields and
updates only those columns. `saveStudentDetails` accepts only student fields and updates
only student ID/college/program/year. Each action gets the current authenticated user on
the server and filters by that ID; caller-supplied IDs, email, workspace, and role fields
cannot change the target or grant privileges. Both verify a returned matching row before
claiming success, and invalidate the shell so names/completion state refresh correctly.

Existing profile RLS and column grants, college/program relationships, duplicate Student
ID constraints, and event-related student ID/photo locks remain authoritative. Avatar
upload and all password/recovery/logout logic are reused unchanged. Participant-only
registration/attendance still require Student Onboarding. Admin and Organizer guards,
including active-status requirements for mutations, were not weakened.

## Modified files

- `components/shell/app-shell.tsx`: shared switcher placement, validated account context,
  mobile drawer closing, and workspace home link.
- `components/shell/account-menu.tsx`: contextual shared-profile destination only.
- `components/shell/workspace-switcher.tsx` (new): compact/expanded selection menu.
- `components/shell/workspace-switcher.test.ts` (new): one-workspace omission and closed
  expanded/collapsed trigger semantics, with no immediate navigation link.
- `app/(app)/account/profile/page.tsx` (new): canonical shared account view and safe Back link.
- `app/(app)/profile/page.tsx`: legacy compatibility redirect.
- `app/(app)/profile/student/page.tsx` (new): separate Participant student editing.
- `components/profile/account-profile-form.tsx` (new): account-name editor.
- `components/profile/student-details-form.tsx` (new): student-only editor with existing rules.
- `lib/navigation.ts`, `lib/navigation.test.ts`: workspace context resolution, profile link,
  and actual-role/query validation coverage.
- `lib/profile/actions.ts`: own-account and student-column updates, preserving existing
  onboarding/profile/avatar actions.
- `lib/profile/account-actions.test.ts` (new): authenticated target, field allowlists,
  validation, no-row failure, duplicate ID and registration-lock handling.
- `lib/profile/account-routes.test.ts` (new): all workspace contexts, incomplete Organizer
  access, canonicalization, and legacy Admin profile routing.
- `lib/validation/profile.ts`: name-only/student-only schemas derived from existing rules.
- `lib/lookups/actions.ts`: invalidate the new student-details route after lookup changes.
- This report.

Earlier local Organizer-management, migration, and landing changes were not reapplied,
deployed, or executed against a database as part of this task.

## Validation and limitations

TypeScript, ESLint (including final test files), and Vitest passed: 205 tests across 24
files. Coverage includes existing role routing/guards, password recovery, and prior
Organizer authorization tests. New profile tests mock privileged data access; no real
account edits, role changes, or emails were performed.

Production build passed, generating 51 routes including `/account/profile` and
`/profile/student`. Browser tooling could not connect
to Chrome, so live menu selection, keyboard navigation/focus, mobile drawer behavior,
photo upload, logout, and visual layout were not browser-verified. SSR/unit tests and
the existing accessible primitives cover their code-level contracts, not a live E2E run.

No database changes are required for this refinement. Previously prepared Organizer
migrations remain subject to their separate approval boundary.
