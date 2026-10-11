# Core MVP checkpoint — 2026-10-11

Preserved Stage 1 at `56b7089` and Phase 3 at `084761f`.

- Branded responsive landing; unchanged official logo; actual upcoming public events; optional event posters.
- Organizer-owned rotating QR attendance; participant self-scan; approved-registration and time-in/out checks; shared-device review; audited corrections; completion; realtime plus 3-second polling.
- Fixed version-1 PDF certificates rendered on demand; immutable snapshots; one certificate per registration; eligibility and flag checks; download, public verification, and audited revocation.
- Per-event reports and private CSV; spreadsheet formula protection; no email/photo/note export; 30-day profile cutoff; scheduled hashed-device retention.

Development-only migrations: public_landing, mvp_attendance, mvp_certificates, mvp_reports.
No production project changes. No new dependencies. Unrelated package-lock, MCP config, and skills lock preserved.

Validation: typecheck, lint, production build; 30 targeted unit tests; 92 new database checks; 72 Stage 1 regression checks; 32 authenticated integration checks; 7 attendance browser checks; landing at 360/768/1280px. Disposable development fixtures removed.

Recheck locally with SQL fixtures/cleanup and `scripts/mvp-core-check.mjs`; browser scripts use isolated Chrome on port 9223. These scripts refuse non-development Supabase projects and non-local app URLs.

Before deployment:
- Provision separate production Supabase; apply/reconcile migration history (existing Phase 3 local timestamp differs from remote), seed approved lookups, provision maintainer admin.
- Configure Vercel environment, canonical HTTPS app URL, Supabase redirect allow-list, verified-email/anonymous-login settings, SMTP and CAPTCHA.
- Supply final privacy controller/contact and approved retention notice.
- Verify camera permission, QR rotation, realtime, and PDF downloads on physical phones over HTTPS.

PDFs use approved standard fonts; unsupported glyphs are transliterated or replaced. Template editing, advanced analytics, station pairing, and anonymous attendance remain outside the condensed MVP.
