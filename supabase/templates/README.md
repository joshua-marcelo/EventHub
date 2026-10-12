# EventHub authentication emails

Branded templates for Supabase Auth: dark charcoal header, warm orange call to action, table layout with inline styles (no external fonts or images), so they render in common email clients and at 390 px widths.

| Supabase template | Subject | File |
|---|---|---|
| Confirm signup | `Confirm your EventHub account` | `confirmation.html` |
| Reset password | `Reset your EventHub password` | `recovery.html` |

`config.toml` records the same subjects and paths, but it only affects a local Supabase stack. **Hosted projects must be updated in the dashboard.**

## Status (2026-10-13)

- Development `ldhpbfujqnyovovabvcg`: **not yet applied.** Auth logs from 2026-10-12 show the default templates are still sent. The Supabase CLI is not logged in on this machine, and the Supabase MCP has no Auth-configuration tool, so the agent could not apply or read them.
- Production: apply during deployment ([docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) §4).

## Apply (each hosted project)

1. **Authentication → URL Configuration**: Site URL = the app origin (`http://localhost:3000` for development, `https://<domain>` for production); Redirect URLs include `<origin>/**`. Keep other approved entries.
2. **Authentication → Emails → Templates**: paste each file's **entire** contents into the matching template's HTML body and set the subject above. Save.
3. **Email OTP expiration** stays at **3600 s**; both emails say "1 hour".
4. With a custom SMTP provider, turn off click tracking for these emails.
5. Verify: request a **new** email from `/forgot-password`. The link opens the form without spending the token; saving the new password spends it; reopening the link shows **Request a new link**. Then sign out and sign in with the new password. Never paste real links or tokens into logs, issues or Git.

## Link formats

- Confirmation: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo | urlquery }}`. It is verified server-side on open, then redirects to the sanitized `next` (off-site values are ignored).
- Recovery: `{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&type=recovery`. The fragment never reaches the server on a GET or in a Referer, so link scanners cannot spend it, and it works on any device or browser.

The app still accepts older formats: `/auth/confirm?…&type=recovery` links are forwarded to the form unverified, and default-template PKCE links (`?code=`) are exchanged on submit. A PKCE link only works in the browser that requested the reset; elsewhere the form says so instead of claiming the link expired. Supabase reports expired, used and superseded tokens with the same `otp_expired` code. Each new reset request replaces the previous token, so only the newest email works.

## Tests

`npm test -- lib/auth app/auth` covers the parsing and action logic. Live checks (development only; seed and clean up the fixtures through MCP): `scripts/email-recovery-check.mjs` (11 checks) and `scripts/email-recovery-browser-check.mjs` (10 checks, including narrow-screen renders of both templates). Actual inbox delivery is a manual test.
