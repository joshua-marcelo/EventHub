# Condensed MVP stage 1 — 2026-10-11

Phase 3 checkpoint: commit `084761f`, local tag `checkpoint-phase3-mvp`.
Preserved existing changes to `package-lock.json`, `.mcp.json`, `skills-lock.json`;
unrelated `public/images/eventhub-logo.png` also excluded from this commit.

Implemented: private organizer applications, admin approval/rejection and status management;
organizer draft/edit/publish/cancel/delete-draft; public/unlisted events; searchable discovery;
automatic/manual registration, individual approval/rejection, cancellation/re-registration;
My Events; fixed invite links; canonical direct links and static registration PNG QR.

Development migration: `20261011122544_mvp_registration.sql`. Types regenerated.
No Attendance or Certificate implementation, Auth setting changes, production writes or push.

Validation: targeted unit tests 26/26; stage 1 pgTAP 72/72 plus affected avatar tests 10/10,
rolled back; production-build HTTP/Server Action and concurrency checks 43/43; neutral-public
route checks 4/4; typecheck, lint and build passed. Registration PNG decoded to the exact URL.
Live fixture identities, events, applications, audit rows, uploaded proof and temporary
fixture-only cleanup policy were removed. Advisors report only intentional caller-checked
[authenticated RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
and [public preview](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
warnings, plus unused-index information.

Pending inherited items: verified permanent admins; real SMTP delivery/templates/dashboard
configuration (D-022); browser/phone visual and keyboard checks. These were not re-audited.
Stage 2 and Stage 3 remain gated by user approval.
