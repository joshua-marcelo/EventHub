This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## EventHub environments

Specification and build plan: [`docs/SYSTEM_SPEC.md`](docs/SYSTEM_SPEC.md), [`docs/PLAN.md`](docs/PLAN.md), [`docs/DECISIONS.md`](docs/DECISIONS.md).

- **Development** Supabase project: `ldhpbfujqnyovovabvcg`. Migrations and tests run here first. It holds no real users.
- **Production** Supabase project: created separately before deployment (PLAN Phase 12). It receives only reviewed migrations through `supabase db push`, never test runs.
- Required Auth settings per environment are listed in `docs/SYSTEM_SPEC.md` §22 and recorded in `supabase/config.toml`.

## Admin provisioning (Phase 3)

Admin permissions are assigned only by the maintainer, never through signup metadata,
profile forms or a public RPC. The account must sign up and confirm its email first.
The maintainer verifies the person's identity and checks the target project before running
the following in that project's Supabase SQL editor. A student profile is optional for
admin work; registration, scanning and organizer applications still require one.

Replace the UUID with the verified account's `auth.users.id`. The transaction refuses
unconfirmed or anonymous users, checks that the profile exists, and records the grant.

```sql
begin;
do $$
declare
  v_id uuid := '<confirmed-user-uuid>';
  v_email text;
begin
  select email into v_email from auth.users
    where id = v_id and email_confirmed_at is not null and not is_anonymous;
  if v_email is null then raise exception 'Confirmed permanent account required'; end if;
  update public.profiles set is_admin = true where id = v_id;
  if not found then raise exception 'Profile not found'; end if;
  perform private.log_audit('admin.granted', 'profile', v_id,
    jsonb_build_object('email', v_email, 'method', 'maintainer_identity_verified'));
end;
$$;
commit;
```

Have the user sign in again or navigate to `/admin`. Admins with incomplete student
profiles land there by default. Provision at least two verified admins per environment.
Development integration checks used two temporary admins; permanent development grants
remain pending the team's verified identities. Temporary accounts are removed after tests.

## Phase 3 integration checks

Use development project `ldhpbfujqnyovovabvcg` only. Unit tests: `npm test`; SQL tests:
`npm run test:db` with a linked CLI, or `scripts/tap-batch.mjs` through MCP (rolled back).
For live checks, apply `supabase/tests/phase3-fixtures.sql` to development, build/start
the local app, then run:

```bash
node --env-file=.env.local scripts/phase3-check.mjs http://localhost:3100
```

Always run `supabase/tests/phase3-cleanup.sql` afterwards, including on failure.
These fixtures use fake identities and a test-only password; never retain them or apply
them to production. Real event/application/attendance/certificate behavior remains in
later phases; Phase 3 provides guarded placeholders for those routes.

## Local development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
