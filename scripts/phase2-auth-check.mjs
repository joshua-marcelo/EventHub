// Phase 2 live check against a running app (`npm run build && npm start`) and the DEVELOPMENT
// Supabase project. Never point this at production.
//
// Prerequisite: seed supabase/tests/phase2-fixtures.sql through MCP (p2-*@eventhub.test,
// known confirmation/recovery token hashes); always run phase2-cleanup.sql afterwards.
// Real emails cannot be delivered to test addresses, so the email links are simulated with the
// seeded token hashes; everything else goes through the real app routes and Supabase Auth.
//
// Usage: node --env-file=.env.local scripts/phase2-auth-check.mjs [http://localhost:3000]
import { createClient } from "@supabase/supabase-js";

const APP = process.argv[2] ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !KEY) throw new Error("Run with --env-file=.env.local");
if (!SUPABASE_URL.includes("ldhpbfujqnyovovabvcg")) throw new Error("Refusing to run outside the development project");

const PASSWORD = "Phase2pass1";
const TOKENS = {
  confirm: "p2confirmtoken0000000000000000000000000000000000000000002",
  recover: "p2recovertoken000000000000000000000000000000000000000003",
  expired: "p2expiredtoken000000000000000000000000000000000000000004",
  evilNext: "p2evilnexttoken00000000000000000000000000000000000000005",
};
const USER = {
  confirmed: { id: "e2000000-0000-4000-8000-000000000001", email: "p2-confirmed@eventhub.test" },
  unconfirmed: { email: "p2-unconfirmed@eventhub.test" },
  recover: { id: "e2000000-0000-4000-8000-000000000003", email: "p2-recover@eventhub.test" },
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "ok    " : "NOT OK"} ${name}${detail ? `  (${detail})` : ""}`);
}

const supabase = () => createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// --- HTTP helpers with a tiny cookie jar -----------------------------------------------------
function jar() {
  const cookies = new Map();
  return {
    absorb(res) {
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        const name = pair.slice(0, i);
        const value = pair.slice(i + 1);
        if (!value || /max-age=0/i.test(c)) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
    header() {
      return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    hasSession() {
      return [...cookies.keys()].some((k) => k.startsWith("sb-") && k.includes("auth-token"));
    },
  };
}
async function get(path, j, init = {}) {
  const res = await fetch(new URL(path, APP), {
    redirect: "manual",
    ...init,
    headers: { ...(j ? { cookie: j.header() } : {}), ...(init.headers ?? {}) },
  });
  j?.absorb(res);
  return res;
}
const location = (res) => {
  const l = res.headers.get("location");
  return l ? new URL(l, APP) : null;
};

// --- 1. Route protection (proxy) -------------------------------------------------------------
for (const path of ["/dashboard", "/profile", "/onboarding", "/scan", "/organizer", "/admin"]) {
  const res = await get(path);
  const loc = location(res);
  check(`signed out: ${path} redirects to login with next`, res.status === 307 && loc?.pathname === "/login" && loc.searchParams.get("next") === path, `${res.status} ${loc?.pathname}${loc?.search ?? ""}`);
}
for (const path of ["/", "/login", "/signup", "/forgot-password", "/privacy", "/signup/check-email", "/reset-password"]) {
  const res = await get(path);
  check(`signed out: ${path} is public`, res.status === 200, String(res.status));
}
{
  const res = await get("/events/123e4567-e89b-42d3-a456-426614174000");
  check("signed out: /events/{uuid} is not sent to login (public preview, A1)", location(res)?.pathname !== "/login", String(res.status));
}

// --- 2. Supabase Auth behaviour --------------------------------------------------------------
{
  const { error } = await supabase().auth.signInWithPassword({ email: USER.unconfirmed.email, password: PASSWORD });
  check("unconfirmed account cannot log in (email_not_confirmed)", error?.code === "email_not_confirmed", error?.code);
}
{
  const { error } = await supabase().auth.signInWithPassword({ email: USER.confirmed.email, password: "wrong-pass-1" });
  check("wrong password is rejected (invalid_credentials)", error?.code === "invalid_credentials", error?.code);
}
{
  const { data, error } = await supabase().auth.signInWithPassword({ email: USER.confirmed.email, password: PASSWORD });
  check("confirmed account can log in", !error && Boolean(data.session), error?.code);
}

// --- 3. Confirmation link (/auth/confirm) ----------------------------------------------------
{
  const j = jar();
  const next = encodeURIComponent(`${APP}/profile`);
  const res = await get(`/auth/confirm?token_hash=${TOKENS.confirm}&type=email&next=${next}`, j);
  const loc = location(res);
  check("valid confirmation link signs in and returns to next", res.status === 307 && loc?.pathname === "/profile" && j.hasSession(), `${res.status} ${loc?.pathname}`);
  check("token is not left in the redirect URL", !loc?.search.includes("token_hash"));

  const onboarding = await get("/onboarding", j);
  const html = await onboarding.text();
  check("confirmed user with an incomplete profile sees onboarding", onboarding.status === 200 && html.includes("Complete your profile"), String(onboarding.status));

  const loginPage = await get("/login", j);
  check("signed-in user visiting /login goes to the dashboard", loginPage.status === 307 && location(loginPage)?.pathname === "/dashboard");

  const signOut = await get("/auth/signout", j, { method: "POST" });
  check("POST /auth/signout redirects to login (303)", signOut.status === 303 && location(signOut)?.pathname === "/login", String(signOut.status));
  const after = await get("/dashboard", j);
  check("after sign-out the dashboard requires login again", after.status === 307 && location(after)?.pathname === "/login");

  const reused = await get(`/auth/confirm?token_hash=${TOKENS.confirm}&type=email`, jar());
  check("a used confirmation link is rejected", location(reused)?.pathname === "/auth/error", location(reused)?.search);
}
{
  const { error } = await supabase().auth.signInWithPassword({ email: USER.unconfirmed.email, password: PASSWORD });
  check("after confirming, the same account can log in", !error, error?.code);
}
{
  const res = await get("/auth/confirm?token_hash=not-a-real-token&type=email", jar());
  const loc = location(res);
  check("an invalid link goes to /auth/error", loc?.pathname === "/auth/error" && loc.searchParams.get("type") === "signup", loc?.search);
}
{
  const res = await get(`/auth/confirm?token_hash=${TOKENS.expired}&type=email`, jar());
  const loc = location(res);
  check("a link older than the expiry is rejected as expired", loc?.pathname === "/auth/error" && loc.searchParams.get("reason") === "link_expired", loc?.search);
}
{
  const res = await get("/auth/confirm?token_hash=x&type=magiclink", jar());
  check("unsupported link types are refused without calling Auth", location(res)?.pathname === "/auth/error");
}
{
  const j = jar();
  const res = await get(`/auth/confirm?token_hash=${TOKENS.evilNext}&type=email&next=${encodeURIComponent("https://evil.example/steal")}`, j);
  const loc = location(res);
  check("an off-site next is ignored (open redirect blocked)", loc?.origin === new URL(APP).origin && loc.pathname === "/dashboard", loc?.href);
}

// --- 4. Recovery link ------------------------------------------------------------------------
{
  const j = jar();
  const res = await get(`/auth/confirm?token_hash=${TOKENS.recover}&type=recovery&next=${encodeURIComponent("/dashboard")}`, j);
  const loc = location(res);
  // Recovery tokens are spent only when the new password is submitted (email-recovery-check.mjs).
  check("recovery link goes to /reset-password without spending the token", loc?.pathname === "/reset-password" && loc.hash.includes("type=recovery") && !loc.search && !j.hasSession(), loc?.pathname);
  const page = await get("/reset-password");
  check("reset page renders for a signed-out visitor", page.status === 200 && (await page.text()).includes("Choose a new password"));
}

// --- 5. Avatar Storage through the API -------------------------------------------------------
{
  const a = supabase();
  await a.auth.signInWithPassword({ email: USER.confirmed.email, password: PASSWORD });
  const b = supabase();
  await b.auth.signInWithPassword({ email: USER.recover.email, password: PASSWORD });

  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
  const own = `${USER.confirmed.id}/${crypto.randomUUID()}.png`;
  const up = await a.storage.from("avatars").upload(own, png, { contentType: "image/png" });
  check("user uploads a photo into their own folder", !up.error, up.error?.message);

  const other = await a.storage.from("avatars").upload(`${USER.recover.id}/${crypto.randomUUID()}.png`, png, { contentType: "image/png" });
  check("user cannot upload into another user's folder", Boolean(other.error), other.error?.message);

  const svg = await a.storage.from("avatars").upload(`${USER.confirmed.id}/${crypto.randomUUID()}.png`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
  check("bucket refuses other file types", Boolean(svg.error), svg.error?.message);

  const peek = await b.storage.from("avatars").download(own);
  check("another user cannot download the photo", Boolean(peek.error), peek.error?.message ?? "downloaded!");

  const signed = await a.storage.from("avatars").createSignedUrl(own, 60);
  check("owner can create a signed URL", Boolean(signed.data?.signedUrl), signed.error?.message);

  const del = await a.storage.from("avatars").remove([own]);
  check("owner can delete their photo", !del.error && del.data?.length === 1, del.error?.message);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
