// Phase 2 Server Action check: calls the real actions of a production build over HTTP, the way
// the browser does (Next-Action header + JSON arguments), against the DEVELOPMENT project.
// Prerequisite: supabase/tests/phase2-fixtures.sql, then phase2-auth-check.mjs (D-022);
// run after that script (it confirms p2-unconfirmed / p2-evilnext). It needs an unused recovery
// token for p2-recover (re-seed it if phase2-auth-check.mjs already used it).
//
// Usage: npm run build && npx next start -p 3100
//        node --env-file=.env.local scripts/phase2-actions-check.mjs http://localhost:3100
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APP = process.argv[2] ?? "http://localhost:3100";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL?.includes("ldhpbfujqnyovovabvcg")) throw new Error("Refusing to run outside the development project");

const PASSWORD = "Phase2pass1";
const NEW_PASSWORD = "Phase2pass2";
const U = {
  confirmed: { id: "e2000000-0000-4000-8000-000000000001", email: "p2-confirmed@eventhub.test" },
  unconfirmed: { email: "p2-expired@eventhub.test" },
  other: { email: "p2-unconfirmed@eventhub.test" },
  recover: { id: "e2000000-0000-4000-8000-000000000003", email: "p2-recover@eventhub.test" },
};
const RECOVERY_TOKEN = "p2recovertoken000000000000000000000000000000000000000003";

// Action ids from the build that is running.
const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url)));
const ACTION = {};
// Shared actions are bundled into many pages; post to one a participant can reach (no
// dynamic segment, no admin/organizer prefix that the proxy answers with 404 or a redirect).
const reachable = (w) => !w.includes("[") && !/\/(admin|organizer)\//.test(w);
for (const [id, v] of Object.entries(manifest.node)) {
  const workers = Object.keys(v.workers);
  ACTION[v.exportedName] = { id, page: workers.find(reachable) ?? workers[0] };
}
const pagePath = (worker) => worker.replace(/^app/, "").replace(/\/page$/, "").replace(/\/\([^)]+\)/g, "") || "/";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok    " : "NOT OK"} ${name}${detail ? `  (${detail})` : ""}`);
};
const sb = () => createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function jar() {
  const cookies = new Map();
  return {
    absorb(res) {
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        const value = pair.slice(i + 1);
        if (!value || /max-age=0/i.test(c)) cookies.delete(pair.slice(0, i));
        else cookies.set(pair.slice(0, i), value);
      }
    },
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}

/** Calls a Server Action. Returns { result, redirect } where redirect is the action redirect path. */
async function call(name, args, j) {
  const { id, page } = ACTION[name];
  const res = await fetch(new URL(pagePath(page), APP), {
    method: "POST",
    redirect: "manual",
    headers: {
      "Next-Action": id,
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: APP,
      cookie: j?.header() ?? "",
    },
    body: JSON.stringify(args),
  });
  j?.absorb(res);
  const text = await res.text();
  const redirect = res.headers.get("x-action-redirect")?.split(";")[0] ?? null;
  const line = text.split("\n").find((l) => /^\w+:\{"ok":/.test(l));
  return { result: line ? JSON.parse(line.slice(line.indexOf(":") + 1)) : null, redirect, status: res.status };
}
async function get(path, j) {
  const res = await fetch(new URL(path, APP), { redirect: "manual", headers: { cookie: j?.header() ?? "" } });
  j?.absorb(res);
  return res;
}

// --- Sign in -------------------------------------------------------------------------------
{
  const r = await call("signIn", [{ email: "not-an-email", password: "" }], jar());
  check("signIn: invalid input returns field errors", r.result?.ok === false && r.result.fieldErrors?.email && r.result.fieldErrors?.password);
}
{
  const r = await call("signIn", [{ email: U.confirmed.email, password: "wrong-pass-9" }], jar());
  check("signIn: wrong password → message, no redirect", r.result?.code === "invalid_credentials" && !r.redirect, r.result?.error);
}
{
  const r = await call("signIn", [{ email: U.unconfirmed.email, password: PASSWORD }], jar());
  check("signIn: unconfirmed email → email_not_confirmed (form offers resend)", r.result?.code === "email_not_confirmed", r.result?.error);
}
{
  const r = await call("signIn", [{ email: U.confirmed.email, password: PASSWORD }, "https://evil.example/x"], jar());
  check("signIn: off-site next is ignored → /dashboard", r.redirect === "/dashboard", r.redirect);
}
const session = jar();
{
  const r = await call("signIn", [{ email: U.confirmed.email, password: PASSWORD }, "/profile"], session);
  check("signIn: success redirects to the requested next", r.redirect === "/profile", r.redirect);
}

// --- Sign up / resend / reset request --------------------------------------------------------
{
  const r = await call("signUp", [{ firstName: "", lastName: "X", email: "a@b.co", password: "short", confirmPassword: "nope" }], jar());
  check("signUp: validation errors (name, weak password, mismatch)", r.result?.ok === false && r.result.fieldErrors?.firstName && r.result.fieldErrors?.password && r.result.fieldErrors?.confirmPassword);
}
// Accepted sign-ups and reset requests send real email; bounces from undeliverable test
// addresses can get the project's sender restricted, so only validation runs here.
{
  const r = await call("requestPasswordReset", [{ email: "not-an-email" }], jar());
  check("password reset request validates the email address", r.result?.ok === false && r.result.fieldErrors?.email !== undefined, r.result?.error);
}

// --- Onboarding actions ----------------------------------------------------------------------
const anon = sb();
const { data: colleges } = await anon.from("colleges").select("id, code");
const { data: programs } = await anon.from("programs").select("id, college_id, name");
const devA = colleges.find((c) => c.code === "DEV-A");
const devB = colleges.find((c) => c.code === "DEV-B");
const progA = programs.find((p) => p.college_id === devA.id);
const progB = programs.find((p) => p.college_id === devB.id);
const profile = {
  firstName: "Phase",
  middleName: "",
  lastName: "Two",
  suffix: "",
  studentId: "P2-0001",
  collegeId: String(devA.id),
  programId: String(progA.id),
  yearLevel: "3",
};
{
  const r = await call("acceptPrivacyNotice", [], jar());
  // The proxy already sends signed-out requests to login before the action runs.
  check("acceptPrivacyNotice without a session is refused", r.status === 307 || r.result?.code === "not_signed_in", `${r.status} ${r.result?.code ?? ""}`);
}
{
  const r = await call("acceptPrivacyNotice", [], session);
  check("acceptPrivacyNotice records consent", r.result?.ok === true, r.result?.error);
}
{
  const r = await call("saveProfile", [{ ...profile, programId: String(progB.id) }], session);
  check("saveProfile: program from another college is refused", r.result?.fieldErrors?.programId !== undefined, r.result?.error);
}
{
  const r = await call("saveProfile", [{ ...profile, studentId: "bad id!" }], session);
  check("saveProfile: invalid student ID is refused", r.result?.fieldErrors?.studentId !== undefined);
}
{
  const r = await call("saveProfile", [profile], session);
  check("saveProfile: valid details are saved", r.result?.ok === true, r.result?.error);
}
{
  // A second account tries to claim the same student ID.
  const other = jar();
  await call("signIn", [{ email: U.recover.email, password: PASSWORD }], other);
  const r = await call("saveProfile", [{ ...profile, studentId: "P2-0001" }], other);
  check("saveProfile: a student ID already in use is refused with the admin hint", /already registered/.test(r.result?.fieldErrors?.studentId ?? ""), r.result?.fieldErrors?.studentId);
}

// --- Avatar ----------------------------------------------------------------------------------
const owner = sb();
await owner.auth.signInWithPassword({ email: U.confirmed.email, password: PASSWORD });
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
{
  const r = await call("setAvatar", [`${U.recover.id}/0f8fad5b-d9cb-469f-a165-70867728950e.png`], session);
  check("setAvatar: a path outside the user's folder is refused", r.result?.code === "invalid_path");
}
const first = `${U.confirmed.id}/${crypto.randomUUID()}.png`;
const second = `${U.confirmed.id}/${crypto.randomUUID()}.png`;
{
  await owner.storage.from("avatars").upload(first, png, { contentType: "image/png" });
  const r = await call("setAvatar", [first], session);
  check("setAvatar: uploaded photo is saved on the profile", r.result?.ok === true, r.result?.error);
}
{
  const dashboard = await get("/dashboard", session);
  const html = await dashboard.text();
  check("complete profile: dashboard renders for the user", dashboard.status === 200 && /Welcome, (<!-- -->)?Phase/.test(html), String(dashboard.status));
}
{
  await owner.storage.from("avatars").upload(second, png, { contentType: "image/png" });
  const r = await call("setAvatar", [second], session);
  const { data: files } = await owner.storage.from("avatars").list(U.confirmed.id);
  const names = (files ?? []).map((f) => `${U.confirmed.id}/${f.name}`);
  check("setAvatar: replacing a photo deletes the previous file", r.result?.ok === true && names.includes(second) && !names.includes(first), names.join(","));
  await owner.storage.from("avatars").remove([second]);
}

// --- Password reset completion and sign-out-others -------------------------------------------
{
  const otherDevice = sb();
  await otherDevice.auth.signInWithPassword({ email: U.recover.email, password: PASSWORD });
  const { data: before } = await otherDevice.auth.refreshSession();

  // The reset form keeps the email credential in memory and submits it with the password.
  const recovery = jar();
  const link = { kind: "token_hash", tokenHash: RECOVERY_TOKEN };
  const weak = await call("updatePassword", [{ password: "abc", confirmPassword: "abc" }, link], recovery);
  check("updatePassword: weak password is refused", weak.result?.fieldErrors?.password !== undefined);
  const r = await call("updatePassword", [{ password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, link], recovery);
  check("updatePassword: new password saved", r.result?.ok === true, r.result?.error);

  const { error: refreshError } = await otherDevice.auth.refreshSession(before.session ?? undefined);
  check("updatePassword: other sessions are signed out (P-05)", Boolean(refreshError), refreshError?.code ?? "still valid");
  const { error: oldLogin } = await sb().auth.signInWithPassword({ email: U.recover.email, password: PASSWORD });
  const { error: newLogin } = await sb().auth.signInWithPassword({ email: U.recover.email, password: NEW_PASSWORD });
  check("updatePassword: old password fails, new password works", Boolean(oldLogin) && !newLogin);
}

// --- Sign out of all devices (P-29) ----------------------------------------------------------
{
  const laptop = sb();
  await laptop.auth.signInWithPassword({ email: U.confirmed.email, password: PASSWORD });
  const r = await call("signOutEverywhere", [], session);
  check("signOutEverywhere redirects to the login notice", r.redirect === "/login?signed_out=all", r.redirect);
  const { error } = await laptop.auth.refreshSession();
  check("signOutEverywhere revokes other devices' sessions", Boolean(error), error?.code ?? "still valid");
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
