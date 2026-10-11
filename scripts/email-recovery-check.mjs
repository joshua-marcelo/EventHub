// Run against a production build and DEVELOPMENT Supabase only. Seed the matching
// email-recovery-fixtures.sql through MCP first; always run cleanup afterwards.
// Uses fresh single-use Auth fixtures, not delivered mail. No credentials are logged.
// node --env-file=.env.local scripts/email-recovery-check.mjs http://localhost:3000
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const app = process.argv[2] ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (supabaseUrl !== "https://ldhpbfujqnyovovabvcg.supabase.co") throw new Error("Development project required");
if (!["localhost", "127.0.0.1"].includes(new URL(app).hostname)) throw new Error("Local app required");
const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url)));
const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === "updatePassword");
if (!entry) throw new Error("Build missing password action");
const [actionId] = entry;
const hash = (n) => createHash("sha256").update(`af000000-0000-4000-8000-00000000000${n}:email-recovery-integration`).digest("hex");
const password = `Eh9${randomBytes(24).toString("hex")}`;
const input = { password, confirmPassword: password };
const cookies = new Map();
let checks = 0;
function check(name, ok) {
  if (!ok) throw new Error(`Failed: ${name}`);
  checks++;
  console.log(`PASS ${name}`);
}
async function call(credential, cookieJar = cookies) {
  const response = await fetch(`${app}/reset-password`, {
    method: "POST", redirect: "manual",
    headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: app,
      cookie: [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ") },
    body: JSON.stringify(credential === undefined ? [input] : [input, credential]),
  });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0];
    const index = pair.indexOf("=");
    if (/max-age=0/i.test(header)) cookieJar.delete(pair.slice(0, index));
    else cookieJar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  const body = await response.text();
  const line = body.split("\n").find((value) => /^\w+:\{"ok":/.test(value));
  return line ? JSON.parse(line.slice(line.indexOf(":") + 1)) : null;
}

try {
  const page = await fetch(`${app}/reset-password`);
  check("signed-out reset page opens", page.status === 200 && (await page.text()).includes("Choose a new password"));
  const pkceId = "af000000-0000-4000-8000-000000000003";
  const missingVerifier = await call({ kind: "code", code: pkceId }, new Map());
  check("PKCE recovery without verifier is rejected", missingVerifier?.ok === false && missingVerifier.code === "link_invalid");
  const verifier = createHash("sha256").update(pkceId + ":pkce-verifier").digest("hex");
  const flowId = "email_recovery_test";
  const pkceCookies = new Map([[`sb-ldhpbfujqnyovovabvcg-auth-token-flow-${flowId}-code-verifier`, "base64-" + Buffer.from(JSON.stringify(verifier)).toString("base64url")]]);
  const pkceResult = await call({ kind: "code", code: pkceId, flowId }, pkceCookies);
  check("legacy PKCE recovery exchanges code and updates password", pkceResult?.ok === true && [...pkceCookies.keys()].some((name) => name.includes("auth-token") && !name.endsWith("code-verifier")));
  // A scanner or repeated click must not spend this valid token.
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${app}/auth/confirm?token_hash=${hash(1)}&type=recovery`, { redirect: "manual" });
    const destination = new URL(response.headers.get("location"));
    check(`recovery GET ${i + 1} preserves token for form submission`, destination.pathname === "/reset-password" && destination.search === "" && destination.hash.includes("type=recovery") && !response.headers.getSetCookie().some((v) => v.includes("auth-token")));
  }
  const invalid = await call({ kind: "token_hash", tokenHash: hash(2) }, new Map());
  check("expired link offers resend and cannot change password", invalid?.ok === false && invalid.code === "link_invalid" && invalid.error.includes("Request a new one"));
  const success = await call({ kind: "token_hash", tokenHash: hash(1) });
  check("fresh single-use link changes password and writes session cookies", success?.ok === true && [...cookies.keys()].some((name) => name.includes("auth-token")));
  const reused = await call({ kind: "token_hash", tokenHash: hash(1) });
  check("reused link rejected even with authenticated cookies", reused?.ok === false && reused.code === "link_invalid");
  const unauthorized = await call(undefined, new Map());
  check("unauthenticated password update refused", unauthorized?.ok === false && unauthorized.code === "session_not_found");
  const supabase = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: "email-recovery-fresh@eventhub.test", password });
  if (error) console.error(`Sign-in error: ${error.name}; status ${error.status ?? "unknown"}; code ${error.code ?? "unknown"}`);
  check("new password signs in successfully", !error && Boolean(data.session));
  await supabase.auth.signOut();
  const errorPage = await fetch(`${app}/auth/error?type=recovery&reason=link_expired`);
  check("error page explains single-use expiry and provides resend form", (await errorPage.text()).includes("expire after 1 hour"));
  console.log(`${checks} live recovery checks passed.`);
} catch (error) {
  // Never print HTTP responses, URLs or Auth errors which could contain credentials.
  console.error(error instanceof Error && error.message.startsWith("Failed:") ? error.message : "Recovery check failed; inspect without logging credentials.");
  process.exitCode = 1;
}
