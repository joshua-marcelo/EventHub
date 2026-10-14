# Participant workspace refinement

The Participant sidebar and mobile bar contain Home, My Events, and Certificates. The header provides the existing `/scan` route through an accessible scanner action in Participant context only. The Account menu remains the location for My Profile and Log Out. Admin and Organizer navigation and appearance are unchanged.

Home and `/events` share `components/participant/event-discovery.tsx`. It retains the existing published/public/upcoming event query, text search, category filter, 24-item pagination, invitation route, and event-detail links. The original `/events` route remains usable. There is no second discovery query implementation or fabricated event data.

My Events retains the user's existing registration and attendance queries, event links, approved-registration scanner links, and cancellation action/conditions. The status filters use only existing registration enum values: pending, approved, rejected, cancelled. As before, the page loads the latest 100 registrations. Certificates retain their existing data query, detail/verification route, PDF endpoint, and revoked-certificate download restriction.

## Onboarding

`OnboardingWizard` presents Privacy Notice, Student Details, and Profile Photo one at a time. Its completion flags come from saved server data or a successful existing action response. Progress navigation cannot skip an unsaved prerequisite. The privacy checkbox remains unchecked initially; only the existing consent RPC records consent. Viewing the notice does not record consent.

The existing profile schema, required/optional fields, server validation, database-driven full college/program names, and dependent selection are retained. Form instances stay mounted while hidden, preserving draft inputs when returning to an earlier step. The successful save callbacks are optional; ordinary profile editing retains the existing refresh behavior.

Photo input validation, resizing, own-folder Storage upload, and `setAvatar` action are unchanged. In the wizard, a successful upload updates the preview and unlocks Finish Setup without immediately refreshing into the existing completed-onboarding redirect. Finish Setup navigates to the existing sanitized destination; server guards continue to enforce database-computed profile completion. Reloading a completed onboarding page retains its existing redirect. Preview object URLs are revoked on replacement/unmount.

## Organizer provisioning: future backend work

Removing the sidebar entry does **not** disable `/become-organizer`. Eligible completed participants can still submit a documented application through `submit_organizer_application`, see application history, and withdraw a pending application. `review_organizer_application` already requires an Admin, prevents self-review, and activates organizer access only on approval, with audit logging. Existing authorization and RLS are unchanged.

To prohibit participant-initiated applications in the future, explicitly authorize a separate backend task to restrict the submission RPC and corresponding server action/route, review requirements-document upload permissions, and decide how pending applications are handled. Direct Admin provisioning without an application also needs a dedicated authorized/audited backend flow: `set_organizer_status` currently handles existing organizer suspension/reinstatement/revocation, and does not provision a participant with status `none`. Do not enforce that policy merely by hiding navigation.

## Verification boundaries

Modified files:

- `lib/navigation.ts`, `lib/navigation.test.ts`
- `components/shell/app-shell.tsx`
- `components/participant/event-discovery.tsx`, `components/participant/empty-state.tsx`
- `components/profile/onboarding-wizard.tsx`, `components/profile/privacy-consent.tsx`, `components/profile/profile-form.tsx`, `components/profile/avatar-upload.tsx`
- `app/(app)/dashboard/page.tsx`, `app/(app)/events/page.tsx`, `app/(app)/my-events/page.tsx`, `app/(app)/certificates/page.tsx`, `app/(app)/onboarding/page.tsx`
- This document.

TypeScript, ESLint, all 112 automated tests, and the production build passed during this refinement. Chrome DevTools MCP could not connect to the existing browser (`DevToolsActivePort` was unavailable), so no signed-in browser verification is claimed. No database writes, schema migrations, deployments or Git operations were performed.

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build`. The navigation regression test covers the three Participant destinations and backward-compatible discovery-route highlighting. Existing validation, redirect, navigation, and profile tests remain applicable.

Live signed-in QA still needs: discovery with real published events; each registration status and allowed cancellation; certificate details/download/revocation; scanner camera permission and real QR verification; unchecked consent and successful persistence; failed/successful profile saves; college/program reset behavior; failed/successful photo uploads; finishing/resuming onboarding; Account menu/logout; desktop and mobile layout, focus and overflow. Do not substitute dummy records, privileged authentication bypasses, or fabricated attendance for these checks.
