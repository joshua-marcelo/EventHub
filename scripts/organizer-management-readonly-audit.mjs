// Read-only diagnostic: GET/HEAD only. Never prints credential values or user rows.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const expectedRef = "ldhpbfujqnyovovabvcg";
const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
if (base.hostname !== `${expectedRef}.supabase.co` || base.protocol !== "https:") {
  throw new Error("Refusing to inspect a different Supabase project.");
}
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error("Server credential is not configured.");
const credentialFormat = key.startsWith("sb_publishable_") ? "publishable_key" : key.startsWith("sb_secret_") ? "secret_key" : key.split(".").length === 3 ? "legacy_jwt_not_validated" : "unknown";
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const checks = [];

async function count(table, filter = "") {
  const response = await fetch(`${base.origin}/rest/v1/${table}?select=id${filter}`, {
    method: "HEAD", headers: { ...headers, Prefer: "count=exact" }, signal: AbortSignal.timeout(20000),
  });
  const range = response.headers.get("content-range");
  const total = range?.split("/").at(-1);
  return { check: `${table}${filter}`, httpStatus: response.status, count: response.ok && total && total !== "*" ? Number(total) : null };
}

const jobs = [
  () => count("profiles"),
  ...["none", "active", "suspended", "revoked"].map(status => () => count("profiles", `&organizer_status=eq.${status}`)),
  () => count("profiles", "&is_admin=eq.true"),
  () => count("profiles", "&organizer_status=eq.active&is_complete=eq.false"),
  () => count("organizer_applications"),
  () => count("organizer_applications", "&status=eq.pending"),
  () => count("organizer_invitations"),
  () => count("events"), () => count("event_registrations"), () => count("certificates"),
  async () => {
    const response = await fetch(`${base.origin}/rest/v1/`, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return { check: "openapi", httpStatus: response.status };
    const spec = await response.json();
    return { check: "openapi", httpStatus: response.status, paths: Object.keys(spec.paths ?? {}).filter(path => /organizer|save_event/.test(path)) };
  },
  async () => {
    const response = await fetch(`${base.origin}/rest/v1/schema_migrations?select=version&version=in.(20261016012245,20261016012340)`, {
      headers: { ...headers, "Accept-Profile": "supabase_migrations" }, signal: AbortSignal.timeout(20000),
    });
    const body = await response.json().catch(() => ({}));
    return { check: "migration_history", httpStatus: response.status, versions: response.ok && Array.isArray(body) ? body.map(row => row.version) : null, errorCode: response.ok ? null : body.code ?? null };
  },
];

const outcomes = await Promise.allSettled(jobs.map(job => job()));
for (let i = 0; i < outcomes.length; i++) {
  const outcome = outcomes[i];
  checks.push(outcome.status === "fulfilled" ? outcome.value : { check: `request_${i + 1}`, errorType: outcome.reason?.name ?? "Error" });
}
const report = {
  checkedAt: new Date().toISOString(), projectRef: expectedRef, methodsUsed: ["GET", "HEAD"],
  credentialFormat,
  environment: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_APP_URL", "SUPABASE_SECRET_KEY"]
    .map(name => ({ name, present: Boolean(process.env[name]?.trim()) })), checks,
};
fs.writeFileSync("docs/ORGANIZER_MANAGEMENT_READONLY_RESULTS.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
