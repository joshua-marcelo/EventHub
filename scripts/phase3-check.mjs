// Production-build HTTP + Server Action integration checks, DEVELOPMENT ONLY.
// Seed supabase/tests/phase3-fixtures.sql through MCP; always run phase3-cleanup.sql afterwards.
// node --env-file=.env.local scripts/phase3-check.mjs http://localhost:3100
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const APP = process.argv[2] ?? "http://localhost:3100";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (URL !== "https://ldhpbfujqnyovovabvcg.supabase.co") throw new Error("Refusing to run outside development");
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(APP)) throw new Error("Use a local app server");
const results = [];
function check(name, passed) { results.push(passed); console.log(`${passed ? "ok" : "NOT OK"} ${name}`); }
async function login(label) {
  const cookies = new Map();
  const client = createServerClient(URL, KEY, { cookies: { getAll: () => [...cookies].map(([name,value]) => ({ name,value })), setAll: values => values.forEach(({ name,value }) => cookies.set(name,value)) } });
  const { error } = await client.auth.signInWithPassword({ email: `p3-${label}@eventhub.test`, password: "Phase3test123" });
  if (error) throw error;
  return { client, header: () => [...cookies].map(([name,value]) => `${name}=${value}`).join("; ") };
}
async function get(path, user) {
  const response = await fetch(APP + path, { redirect: "manual", headers: user ? { cookie: user.header() } : {} });
  return { response, html: (await response.text()).replace(/<!--.*?-->/g, "") };
}
const manifest = JSON.parse(readFileSync(new globalThis.URL("../.next/server/server-reference-manifest.json", import.meta.url)));
const actions = Object.fromEntries(Object.entries(manifest.node).map(([id,v]) => [v.exportedName,{ id, page: Object.keys(v.workers)[0] }]));
async function action(name, args, user) {
  const { id, page } = actions[name];
  const path = page.replace(/^app/, "").replace(/\/page$/, "").replace(/\/\([^)]+\)/g, "") || "/";
  const response = await fetch(APP + path, { method: "POST", redirect: "manual", headers: { "Next-Action": id, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8", Origin: APP, cookie: user?.header() ?? "" }, body: JSON.stringify(args) });
  const text = await response.text();
  const result = text.split("\n").find(line => /^\d+:\{"ok":/.test(line));
  return { response, result: result ? JSON.parse(result.slice(result.indexOf(":") + 1)) : null, text };
}

const participant = await login("participant");
const admin = await login("admin");
const adminTwo = await login("admin-two");
const organizer = await login("organizer");
const incomplete = await login("incomplete");
const id = "00000000-0000-4000-8000-000000000001";
for (const path of ["/dashboard","/admin","/admin/lookups","/organizer","/scan"]) {
  const { response } = await get(path);
  check(`signed-out ${path} redirects`, response.status === 307 && response.headers.get("location")?.includes("/login?next="));
}
for (const path of ["/admin","/admin/lookups",`/admin/users/${id}`]) {
  const { response, html } = await get(path,participant);
  check(`participant ${path} is HTTP 404`, response.status === 404 && html.includes("Page not found"));
}
{
  const { response } = await get("/organizer",participant);
  check("participant organizer route redirects to application", response.status === 307 && response.headers.get("location")?.endsWith("/become-organizer"));
}
{
  const { html } = await get("/dashboard",participant);
  check("participant shell has no extra dashboard links", html.includes("Participant workspace") && !html.includes('href="/admin"') && !html.includes('href="/organizer"'));
}
for (const [label,user] of [["admin",admin],["admin-two",adminTwo]]) {
  const { response,html } = await get("/admin",user);
  check(`${label} without student profile can open admin`, response.status === 200 && html.includes("Admin dashboard"));
  check(`${label} gets Participant and Admin switch links`, html.includes('href="/dashboard"') && html.includes('href="/admin"') && !html.includes('href="/organizer"'));
  const r = await get("/login",user);
  check(`${label} default entry goes to admin`, r.response.status === 307 && r.response.headers.get("location")?.endsWith("/admin"));
}
{
  const { response,html } = await get("/organizer",organizer);
  check("active organizer sees organizer dashboard", response.status === 200 && html.includes("Organizer dashboard") && html.includes('href="/dashboard"'));
}
for (const label of ["suspended","revoked"]) {
  const user = await login(label);
  const { response,html } = await get("/organizer",user);
  check(`${label} organizer retains read-only workspace`, response.status === 200 && html.includes("read-only") && html.includes(`access is ${label}`));
}
{
  const { html } = await get("/dashboard",incomplete);
  check("incomplete participant goes to onboarding", html.includes("/onboarding?next=%2Fdashboard"));
  const { html: adminHtml } = await get("/dashboard",admin);
  check("incomplete admin dashboard landing goes to admin", adminHtml.includes('url=/admin'));
}
for (const path of ["/events","/events/join","/scan","/my-events","/certificates",`/certificates/${id}`,"/become-organizer"]) {
  const { response,html } = await get(path,participant);
  check(`participant route renders ${path}`, response.status === 200 && !html.includes("Coming soon") && !html.includes("Something went wrong"));
}
for (const path of ["/organizer/events","/organizer/events/new","/organizer/reports",`/organizer/events/${id}`, ...["registrations","attendance","certificates","reports","settings"].map(tab => `/organizer/events/${id}/${tab}`)]) {
  const { response,html } = await get(path,organizer);
  check(`organizer route renders ${path}`, response.status === 200 && !html.includes("Coming soon") && !html.includes("Something went wrong"));
}
for (const path of ["/admin/applications",`/admin/applications/${id}`,"/admin/organizers","/admin/users",`/admin/users/${id}`,`/admin/events/${id}`]) {
  const { response,html } = await get(path,admin);
  check(`admin route renders ${path}`, response.status === 200 && !html.includes("Coming soon") && !html.includes("Something went wrong"));
}
{
  const { html } = await get("/admin/users?q=p3-participant", admin);
  check("admin user search finds account by email", html.includes("p3-participant@eventhub.test") && html.includes("/admin/users/a3000000-0000-4000-8000-000000000001"));
  const { html: detail } = await get("/admin/users/a3000000-0000-4000-8000-000000000001", admin);
  check("admin user detail renders read-only summary", detail.includes("p3-participant@eventhub.test") && detail.includes("Read-only account summary"));
  const { response, html: hostile } = await get("/admin/users?q=" + encodeURIComponent("a%,id.neq.0)"), admin);
  check("user search strips filter syntax", response.status === 200 && !hostile.includes("Something went wrong"));
}
{
  const { response,html } = await get(`/organizer/events/${id}/attendance/display`,organizer);
  // The ID is unknown, so the display shows its not-found state; it must still omit the app shell.
  check("attendance display omits top bar and sidebar", response.status === 200 && !html.includes("<header") && !html.includes("<aside"));
}
for (const path of ["/verify", "/verify/example"]) check(`public ${path} placeholder`, (await get(path)).response.status === 200);
{
  const { response,html } = await get(`/events/${id}`);
  check("public event fallback is neutral and keeps return path", response.status === 200 && html.includes("Log in to view this event") && html.includes(encodeURIComponent(`/events/${id}`)));
}
{
  const result = await action("signIn",[{ email:"p3-admin@eventhub.test", password:"Phase3test123" }]);
  check("admin login action defaults to admin", result.response.headers.get("x-action-redirect")?.startsWith("/admin;"));
}
const input = { kind:"colleges",id:null,name:"P3 Live College",code:"P3-LIVE",is_active:true };
{
  const result = await action("saveLookup",[input],participant);
  check("non-admin server action denied", result.result?.ok !== true && result.response.status === 404);
}
{
  const result = await action("saveLookup",[{ ...input,code:"bad" }],admin);
  check("lookup action validates with field errors", result.result?.ok === false && Boolean(result.result?.fieldErrors?.code));
}
check("admin lookup page renders", (await get("/admin/lookups",admin)).html.includes("Add college"));
check("college created through real action", (await action("saveLookup",[input],admin)).result?.ok === true);
const { data: college } = await admin.client.from("colleges").select("id").eq("code","P3-LIVE").single();
if (!college) throw new Error("Live college missing");
check("duplicate lookup produces typed failure", (await action("saveLookup",[input],admin)).result?.code === "duplicate");
const programInput = { kind:"programs",id:null,name:"P3 Live Program",college_id:college.id,is_active:true };
check("program created through real action", (await action("saveLookup",[programInput],admin)).result?.ok === true);
const { data: program } = await admin.client.from("programs").select("id").eq("name","P3 Live Program").single();
const { error: profileError } = await participant.client.from("profiles").update({ college_id:college.id, program_id:program.id }).eq("id","a3000000-0000-4000-8000-000000000001");
check("participant can select active college and program", !profileError);
check("program renamed and deactivated", (await action("saveLookup",[{ ...programInput,id:program.id,name:"P3 Live Program Renamed",is_active:false }],admin)).result?.ok === true);
check("college renamed and deactivated", (await action("saveLookup",[{ ...input,id:college.id,name:"P3 Live College Renamed",is_active:false }],admin)).result?.ok === true);
const { html: onboarding } = await get("/onboarding",incomplete);
check("deactivated college hidden in onboarding", !onboarding.includes("P3 Live College Renamed"));
check("deactivated program hidden in onboarding", !onboarding.includes("P3 Live Program Renamed"));
const { html: profileHtml } = await get("/profile",participant);
check("existing profile retains deactivated selections", profileHtml.includes("P3 Live College Renamed") && profileHtml.includes("P3 Live Program Renamed"));
const { data: retained } = await admin.client.from("programs").select("id, college_id").eq("id",program.id).single();
check("deactivation retains program and college reference", retained?.college_id === college.id);
const category = { kind:"event_categories",id:null,name:"P3 Live Category",slug:"p3-live-category",sort_order:3,is_active:true };
check("category created through real action", (await action("saveLookup",[category],admin)).result?.ok === true);
const { data: categoryRow } = await admin.client.from("event_categories").select("id").eq("slug",category.slug).single();
check("category renamed and deactivated", (await action("saveLookup",[{ ...category,id:categoryRow.id,name:"P3 Live Category Renamed",is_active:false }],admin)).result?.ok === true);
const { data: audit } = await admin.client.from("audit_logs").select("action,metadata").eq("actor_id","a3000000-0000-4000-8000-000000000002");
check("live changes audited", audit?.filter(row => row.action === "lookup.created").length === 3 && audit?.filter(row => row.action === "lookup.updated").length === 3);
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exitCode = results.every(Boolean) ? 0 : 1;
