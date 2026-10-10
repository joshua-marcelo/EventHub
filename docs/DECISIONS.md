# Engineering Decisions Log

Short records of implementation decisions that are not already explicit in [SYSTEM_SPEC.md](./SYSTEM_SPEC.md).
Newest last. Each entry: context → decision → consequence.

## Phase 0 (2026-10-10)

**D-001 — Spec §20 [CONFIRM] items.**
The planning documents were approved without separate answers for C1–C20. The recommended options in §20 are treated as accepted, except for items that need client data:
- **C1 (email domain restriction)**: no domain is known, so sign-up is **not** restricted yet. A restriction can be added later without schema changes.
- **C2 (student ID format)**: no official pattern is known. A permissive pattern is used: 4–20 characters, letters, digits and hyphens (`^[A-Za-z0-9-]{4,20}$`). Tighten it in one place (`lib/validation/profile.ts` + the `profiles_student_id_format` CHECK) when the official format is provided.
- **C3 (college and category lists)**: no official lists are known, so **no seed rows are created by migrations**. Until the client supplies them, profile completion cannot pick a college. See the Phase 1/2 notes below.
- **C11 (certificate prefix)**: `CLC-{YYYY}-{NNNNNN}` (used in Phase 9).
- **C17 (development database)**: see D-004.
- **C18 (git)**: see D-002.

**D-002 — Git.** No remote is configured on this machine. Work stays on the local `master` branch; nothing is pushed. The client decides how to push to their repository (`main`).
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
