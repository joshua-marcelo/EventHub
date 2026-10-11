// DEVELOPMENT ONLY. Seed mvp-stage1-fixtures.sql and always run its cleanup SQL.
// node --env-file=.env.local scripts/mvp-stage1-check.mjs http://localhost:3100
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const APP = process.argv[2] ?? "http://localhost:3100";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (URL !== "https://ldhpbfujqnyovovabvcg.supabase.co" || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(APP)) throw new Error("Development and local server only");
const results = [];
function check(name, passed) { results.push(passed); console.log(`${passed ? "ok" : "NOT OK"} ${name}`); }
async function login(n) {
  const cookies = new Map();
  const client = createServerClient(URL,KEY,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>cookies.set(name,value))}});
  const {error} = await client.auth.signInWithPassword({email:`mvp-live-${n}@eventhub.test`,password:"MvpStage1test123"}); if(error) throw error;
  return {client,header:()=>[...cookies].map(([name,value])=>`${name}=${value}`).join("; ")};
}
async function get(path,user) {
  const response = await fetch(APP+path,{redirect:"manual",headers:user ? {cookie:user.header()} : {}});
  return {response,html:(await response.text()).replace(/<!--.*?-->/g,"")};
}
if (process.argv.includes("--public-only")) {
  for (const path of ["/events/not-a-uuid","/events/00000000-0000-4000-8000-000000000000"]) {
    const r = await get(path);
    check(`neutral public preview ${path}`,r.response.status === 200 && r.html.includes("Log in to view this event"));
  }
  check("invite entry stays authenticated",(await get("/events/join")).response.status === 307);
  check("discovery stays authenticated",(await get("/events")).response.status === 307);
  console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
const manifest = JSON.parse(readFileSync(new globalThis.URL("../.next/server/server-reference-manifest.json",import.meta.url)));
const actions = Object.fromEntries(Object.entries(manifest.node).map(([id,v])=>[v.exportedName,id]));
async function action(name,args,user,path="/my-events") {
  const response = await fetch(APP+path,{method:"POST",redirect:"manual",headers:{"Next-Action":actions[name],Accept:"text/x-component","Content-Type":"text/plain;charset=UTF-8",Origin:APP,cookie:user?.header() ?? ""},body:JSON.stringify(args)});
  const text = await response.text(); const line = text.split("\n").find(line=>/^\d+:\{"ok":/.test(line));
  return {response,result:line ? JSON.parse(line.slice(line.indexOf(":")+1)) : null,text};
}
const [organizer,admin,one,two,incomplete,foreign] = await Promise.all([1,2,3,4,5,6].map(login));
const anon = createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const uid = n => `c1000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const proof = `${uid(1)}/proof.pdf`;
try {
{
  const {error} = await organizer.client.storage.from("organizer-requirements").upload(proof,Buffer.from("%PDF-1.4\nMVP integration proof"),{contentType:"application/pdf"});
  if(error) throw error; check("proof uploads privately",!error);
  const other = await one.client.storage.from("organizer-requirements").download(proof);
  check("other participant cannot download proof",!!other.error);
}
const application = {organization_name:"MVP Live Council",position_title:"President",contact_number:"09123456789",reason:"I have authorization to organize student activities for our university council.",proof_document_path:proof,consent:true};
check("application page renders",(await get("/become-organizer",organizer)).html.includes("Submit application"));
check("real action rejects missing consent",(await action("submitApplication",[{...application,consent:false}],organizer,"/become-organizer")).result?.ok === false);
check("real action submits application",(await action("submitApplication",[application],organizer,"/become-organizer")).result?.ok === true);
const {data:app} = await organizer.client.from("organizer_applications").select("id,status").eq("applicant_id",uid(1)).single();
if(!app) throw new Error("Application missing");
check("admin application detail renders private proof",(await get(`/admin/applications/${app.id}`,admin)).html.includes("Proof of authorization"));
check("participant admin action denied",(await action("reviewApplication",[app.id,"approved",""],one,"/admin/applications")).response.status === 404);
check("admin approves via real action",(await action("reviewApplication",[app.id,"approved",""],admin,"/admin/applications")).result?.ok === true);
check("approved organizer can open creation page",(await get("/organizer/events/new",organizer)).html.includes("Save event"));
const {data:category} = await admin.client.from("event_categories").select("id").eq("slug","mvp-live").single();
const future = hours => new Date(Date.now()+hours*3600000+8*3600000).toISOString().slice(0,16);
const input = {title:"MVP Live Campus Seminar",description:"A university seminar for the EventHub thesis MVP integration checks.",venue:"University Hall",category_id:String(category.id),host_college_id:"",starts_at:future(48),ends_at:future(50),registration_opens_at:future(-24),registration_closes_at:future(24),capacity:"1",approval_mode:"automatic",visibility:"public"};
async function createEvent(values) {
  const r = await action("saveEvent",[null,values],organizer,"/organizer/events/new");
  const location = r.response.headers.get("x-action-redirect");
  check(`event draft created: ${values.title}`,!!location?.startsWith("/organizer/events/"));
  const id = location?.split(";")[0].split("/").at(-1); if(!id) throw new Error("Event action did not redirect"); return id;
}
const event = await createEvent(input);
check("draft public preview is neutral",(await get(`/events/${event}`)).html.includes("Log in to view this event"));
check("foreign organizer workspace denied",(await get(`/organizer/events/${event}`,foreign)).html.includes("Page not found"));
check("foreign organizer edit action denied",(await action("saveEvent",[event,input],foreign,"/organizer/events/new")).result?.ok === false);
check("real action publishes event",(await action("eventAction",[event,"publish"],organizer,`/organizer/events/${event}`)).result?.ok === true);
const {data:original} = await organizer.client.from("events").select("invite_code").eq("id",event).single();
check("public preview renders published title",(await get(`/events/${event}`)).html.includes(input.title));
check("public preview keeps auth return path",(await get(`/events/${event}`)).html.includes(encodeURIComponent(`/events/${event}`)));
check("explore finds published event",(await get("/events?q=Seminar",one)).html.includes(input.title));
check("incomplete participant sees onboarding registration link",(await get(`/events/${event}`,incomplete)).html.includes("Complete profile to register"));
check("preview does not register automatically",(await one.client.from("event_registrations").select("id").eq("event_id",event)).data?.length === 0);
const edited = await action("saveEvent",[event,{...input,title:"MVP Live Edited Seminar"}],organizer,`/organizer/events/${event}/settings`);
check("published event edited via action",edited.response.headers.get("x-action-redirect")?.startsWith(`/organizer/events/${event}`));
check("static QR share panel renders",(await get(`/organizer/events/${event}`,organizer)).html.includes("Download QR PNG"));
check("invite redirect goes to canonical event",(await get(`/e/${original.invite_code}`,one)).response.headers.get("location") === `${APP}/events/${event}`);
const race = await Promise.all([one,two].map(u=>u.client.rpc("register_for_event",{p_event_id:event})));
check("concurrent capacity=1 admits exactly one",race.filter(r=>r.data === "approved").length === 1 && race.filter(r=>r.data === "event_full").length === 1);
const winner = race[0].data === "approved" ? one : two;
check("duplicate real registration action succeeds idempotently",(await action("registrationAction",[event,"register"],winner)).result?.ok === true);
check("winner My Events displays registration",(await get("/my-events",winner)).html.includes("MVP Live Edited Seminar"));
check("organizer registrants page displays participant",(await get(`/organizer/events/${event}/registrations`,organizer)).html.includes("MVP-LIVE-"));
check("participant cannot query others registration",(await (winner === one ? two : one).client.from("event_registrations").select("id").eq("event_id",event)).data?.length === 0);
const {data:profile} = await winner.client.from("profiles").select("college_id,program_id").eq("id",winner === one ? uid(3) : uid(4)).single();
const locked = await action("saveProfile",[{firstName:"MVP",middleName:"",lastName:"Test",suffix:"",studentId:"MVP-LOCKTEST",collegeId:profile.college_id,programId:profile.program_id,yearLevel:1}],winner,"/profile");
check("profile action reports identity lock",locked.result?.ok === false && locked.result.error.includes("locked"));
check("real action cancels registration",(await action("registrationAction",[event,"cancel"],winner)).result?.ok === true);
check("cancelled row reused by registration action",(await action("registrationAction",[event,"register"],winner)).result?.ok === true);
const manual = await createEvent({...input,title:"MVP Live Manual Event",capacity:"10",approval_mode:"manual",visibility:"unlisted"});
check("manual event published",(await action("eventAction",[manual,"publish"],organizer,`/organizer/events/${manual}`)).result?.ok === true);
check("unlisted event hidden from Explore",!(await get("/events",one)).html.includes("MVP Live Manual Event"));
check("unlisted public preview neutral",(await get(`/events/${manual}`)).html.includes("Log in to view this event"));
check("manual registration action yields pending",(await action("registrationAction",[manual,"register"],one)).result?.message === "Registration submitted for approval.");
const {data:pending} = await organizer.client.from("event_registrations").select("id").eq("event_id",manual).eq("user_id",uid(3)).single();
check("owner approves manual registration via action",(await action("decideRegistration",[pending.id,"approved",""],organizer,`/organizer/events/${manual}/registrations`)).result?.ok === true);
check("anonymous preview whitelist",Object.keys((await anon.rpc("get_public_event_preview",{p_event_id:event})).data?.[0] ?? {}).sort().join(",") === ["title","description","category_name","host_college_name","starts_at","ends_at","venue","banner_path","organization_name","status_label"].sort().join(","));
check("admin can cancel event with reason",(await action("eventAction",[event,"cancel","MVP test cancellation"],admin,`/admin/events/${event}`)).result?.ok === true);
check("registrant sees administrator cancellation",(await get(`/events/${event}`,winner)).html.includes("by an administrator"));
check("terminal event edit refused",(await action("saveEvent",[event,input],organizer,`/organizer/events/${event}/settings`)).result?.code === "terminal_event");
check("admin suspends organizer",(await action("changeOrganizerStatus",[uid(1),"suspended","MVP security check"],admin,"/admin/organizers")).result?.ok === true);
check("suspended SQL event mutation denied",(await organizer.client.rpc("save_event",{p_id:null,p_values:{title:"Suspended mutation"}})).data?.code === "not_permitted");
check("admin reinstates organizer",(await action("changeOrganizerStatus",[uid(1),"active","MVP check finished"],admin,"/admin/organizers")).result?.ok === true);
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);
process.exitCode = results.every(Boolean) ? 0 : 1;
} finally {
  const {error} = await organizer.client.storage.from("organizer-requirements").remove([proof]);
  if(error) throw new Error("Remove the disposable proof through Storage before SQL cleanup.");
  await Promise.all([organizer,admin,one,two,incomplete,foreign].map(user=>user.client.auth.signOut()));
}
