# EventHub production deployment guide

EventHub: A QR-Based Event Management and Attendance System with Automated Digital Certificate Generation for the College Local Council of Wesleyan University–Philippines

This guide prepares a **separate production Supabase project** and a **Vercel** deployment. Nothing here has been run against production; each step is a manual action for the maintainer. Never copy development users, passwords, test data or `.env.local` into production.

| Environment | Supabase project | App URL |
|---|---|---|
| Development | `ldhpbfujqnyovovabvcg` | `http://localhost:3000` |
| Production | new project (create in step 1) | `https://<your-domain>` |

## 1. Create the production Supabase project

1. In the Supabase dashboard, create a new project in the client's organization. Choose a nearby region (for example Singapore) and store the database password in the team's password manager.
2. Note the **Project URL** and the **publishable key** (Project Settings → API Keys). The app needs no secret or service-role key; do not create environment variables for one.

## 2. Apply the database migrations

The 15 migrations in `supabase/migrations/` are the complete schema, RLS, RPCs, Storage buckets and policies, and the `pg_cron` device-evidence retention job. Local filenames match the development history exactly (reconciled 2026-10-12), so a fresh project replays them in the same order.

```bash
npx supabase login                                  # opens the browser
npx supabase link --project-ref <production-ref>    # asks for the database password
npx supabase db push --dry-run                      # review: 15 migrations, nothing else
npx supabase db push
```

Afterwards, in the production dashboard:

- **Database → Migrations** lists 15 versions, `20261009202616` through `20261011134144`.
- **Storage** shows `avatars` (private, 2 MB, JPEG/PNG/WebP), `organizer-requirements` (private) and `event-banners` (public).
- **Advisors → Security** reports only the expected items: SECURITY DEFINER RPCs that check the caller themselves, two deny-all secret tables (`attendance_session_secrets`, `attendance_device_signals`), and dashboard-only Auth settings.

Do not run `supabase/seed.sql` or anything in `supabase/tests/` against production.

## 3. Configure Authentication

**Authentication → URL Configuration**
- Site URL: `https://<your-domain>` (no trailing slash). Email links are built from it.
- Redirect URLs: `https://<your-domain>/**`. Add Vercel preview URLs only if previews point at this project (not recommended).

**Authentication → Sign In / Providers → Email**
- Confirm email: **on**. Email OTP expiration: **3600** seconds (the emails say "1 hour").
- Secure email change: not used by the MVP.
- Minimum password length: 8. The app also requires letters and numbers.

**Other settings**
- Anonymous sign-ins: **off** (the app treats anonymous sessions as signed out).
- Leaked password protection: enable it if the plan allows (it is off on development).
- CAPTCHA (optional): enable Cloudflare Turnstile with its secret key, then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel. Enabling CAPTCHA in Supabase **without** the site key blocks every auth form.

## 4. Email templates and SMTP

**Authentication → Emails → Templates**
- **Confirm signup**: subject `Confirm your EventHub account`; body = full contents of `supabase/templates/confirmation.html`.
- **Reset password**: subject `Reset your EventHub password`; body = full contents of `supabase/templates/recovery.html`.

The templates use `{{ .SiteURL }}`, `{{ .TokenHash }}` and `{{ .RedirectTo }}`. The reset link carries its token in the URL fragment (`#token_hash=…`), and the token is verified only when the new password is submitted. Email scanners that open links therefore cannot spend it, and it works on any device. With the **default** Supabase template, a reset link works only in the browser that requested it (PKCE); the app now says so instead of calling the link expired.

**SMTP (required for real users).** Supabase's built-in sender only delivers to the project team's addresses and is heavily rate-limited. Configure a custom SMTP provider (for example Resend, Brevo, SendGrid or Google Workspace) under **Authentication → Emails → SMTP Settings**:
- Use a sender on a domain you control, with SPF and DKIM records published.
- Disable click/link tracking for these emails; tracking rewrites the links.
- Raise **Rate Limits → emails sent per hour** to suit the expected sign-up volume.

Verify by signing up with a real mailbox you control and by requesting a password reset (see the smoke tests in step 9).

## 5. Vercel project

1. Import the GitHub repository into Vercel; the framework preset is Next.js and the default build command (`next build`) is correct.
2. Set the **Production** environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<production-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` (no trailing slash) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional; only with CAPTCHA enabled in Supabase |

All four are public by design. **Do not** add `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`: no code reads them, and the app enforces permissions through the signed-in user, RLS and caller-checked RPCs. Preview deployments must not use production values; point them at development or disable them.

## 6. Domain and HTTPS

- Add the custom domain in Vercel. Vercel issues the TLS certificate and enables HSTS.
- HTTPS is mandatory. Phones only allow camera access for attendance scanning on secure origins, and session cookies must not travel over plain HTTP.
- After the domain works, confirm the Supabase Site URL, Redirect URLs and `NEXT_PUBLIC_APP_URL` all use the same `https://` origin, then redeploy.

The app sends `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (with `no-referrer` on token-bearing auth routes) and `Permissions-Policy: camera=(self)`.

## 7. Provision administrators (maintainer only)

Admin rights are never granted through the UI or sign-up. Grant them only to a real person whose identity has been verified **outside** EventHub, and keep at least two admins (D-009).

1. The person signs up at `https://<your-domain>/signup` and confirms the email.
2. The maintainer verifies identity out of band, then runs this in the production **SQL Editor**:

```sql
-- Replace the email. Refuses unconfirmed or missing accounts.
do $$
declare v_id uuid;
begin
  select u.id into v_id from auth.users u
   where u.email = 'person@example.edu' and u.email_confirmed_at is not null and not u.is_anonymous;
  if v_id is null then raise exception 'No confirmed account for that email'; end if;
  update public.profiles set is_admin = true where id = v_id;
  perform private.log_audit('admin.granted', 'profile', v_id,
    jsonb_build_object('email', 'person@example.edu', 'method', 'maintainer_identity_verified'));
end $$;
```

To remove an admin, set `is_admin = false` the same way and log `admin.revoked`.

## 8. Initial data

Lookups are not seeded by migrations, by design (C3). After the first admin signs in, open **Admin → Lookups** and add the official colleges, their programs and the event categories provided by the College Local Council. Students cannot complete onboarding until at least one active college and program exist.

Before launch, the client must also supply the data controller and contact for the privacy notice (K-06). Then update `/privacy`, bump `PRIVACY_NOTICE_VERSION` in `lib/privacy.ts` (currently `2026-10-draft`), and redeploy.

## 9. Production smoke tests

Use real accounts you control; delete or anonymize them afterwards (spec §21.2).

1. `https://<your-domain>` loads over HTTPS with the EventHub logo, and upcoming events appear once published.
2. Sign up with a real mailbox → branded **Confirm your EventHub account** email arrives → link signs you in and opens onboarding.
3. Complete the student profile with a photo → dashboard loads.
4. Log out, log in, reload: the session persists. Visiting `/admin` as a participant returns 404.
5. **Forgot password** → branded **Reset your EventHub password** email → open the link on a *different* device → form appears → save → sign in with the new password. Reopening the same link shows **Request a new link**.
6. Admin: approve an organizer application with proof upload; the applicant sees the Organizer dashboard.
7. Organizer: create and publish an event; open the registration QR and link on a phone and register.
8. Organizer: start attendance on a laptop; the participant scans the rotating QR with a **separate phone**; the check-in appears live; run time-out if the event uses it.
9. Complete the event, generate certificates, download the PDF as the participant, and open the verification link on another device. Revoke it and confirm verification shows **Revoked**.
10. Export the event CSV and open it in a spreadsheet.

## 10. Rollback

Vercel: promote the previous deployment. Database: migrations are forward-only; restore a Supabase backup (Pro plan point-in-time recovery or a daily backup) instead of editing schema by hand.
