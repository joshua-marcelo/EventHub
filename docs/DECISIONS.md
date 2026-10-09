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
- `supabase migration list`/`db push`/`gen types --linked` need `supabase login` + `supabase link`, which need the client's access token. They were not run here. Types were generated through the MCP integration instead.

**D-005 — Baseline fixes.** `app/globals.css` mapped `--font-sans` to itself, so the Geist font never applied. It now maps to `--font-geist-sans`. The shadcn `use-mobile` hook was rewritten with `useSyncExternalStore` to satisfy the React Compiler lint rule.
