import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
const APP=process.argv[2]??"http://localhost:3100",URL=process.env.NEXT_PUBLIC_SUPABASE_URL,KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(URL!=="https://ldhpbfujqnyovovabvcg.supabase.co"||!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(APP))throw Error("Development project and local server only");
const event="fe000000-0000-4000-8000-000000000001",route=`/organizer/events/${event}/attendance`,results=[];
function check(name,value){results.push(!!value);console.log(`${value?"ok":"NOT OK"} ${name}`);}
async function login(n){const cookies=new Map(),client=createServerClient(URL,KEY,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:a=>a.forEach(({name,value})=>cookies.set(name,value))}});const {error}=await client.auth.signInWithPassword({email:`core-live-${n}@eventhub.test`,password:"CoreMvpTest123"});if(error)throw error;return {client,header:()=>[...cookies].map(([n,v])=>`${n}=${v}`).join("; ")};}
const [owner,one,two,other]=await Promise.all([1,2,3,4].map(login));
const actions=Object.fromEntries(Object.entries(JSON.parse(readFileSync(".next/server/server-reference-manifest.json")).node).map(([id,v])=>[v.exportedName,id]));
async function action(name,args,user,path){const r=await fetch(APP+path,{method:"POST",redirect:"manual",headers:{"Next-Action":actions[name],Accept:"text/x-component","Content-Type":"text/plain;charset=UTF-8",Origin:APP,cookie:user.header()},body:JSON.stringify(args)});const text=await r.text();return {r,text};}
async function page(path,user){const r=await fetch(APP+path,{redirect:"manual",headers:user?{cookie:user.header()}:{}});return {r,html:(await r.text()).replace(/<!--.*?-->/g,"")};}
const guestScan=await page("/scan?t="+"A".repeat(48));check("login discards expiring scan token",new globalThis.URL(guestScan.r.headers.get("location"),APP).searchParams.get("next")==="/scan");
check("attendance page renders",(await page(route,owner)).html.includes("Start Attendance"));
check("foreign organizer workspace denied",(await page(route,other)).html.includes("Page not found"));
const opened=await action("attendanceAction",[event,"time_in"],owner,route);check("real Start Attendance redirects to display",opened.r.headers.get("x-action-redirect")?.includes("/attendance/display"));
check("owner display renders",(await page(route+"/display",owner)).html.includes("Live check-ins"));
check("participant display denied",(await page(route+"/display",one)).r.status===307);
const {data:qr}=await owner.client.rpc("get_attendance_qr",{p_event_id:event});if(!qr)throw Error("QR unavailable");
let realtime=false;await owner.client.realtime.setAuth((await owner.client.auth.getSession()).data.session.access_token);const channel=owner.client.channel("core-check").on("postgres_changes",{event:"*",schema:"public",table:"attendance_records",filter:`event_id=eq.${event}`},()=>{realtime=true;});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Realtime subscription timeout")),12000);channel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timer);resolve();}});});
await new Promise(resolve=>setTimeout(resolve,2000));
const scan=token=>one.client.rpc("submit_attendance_scan",{p_token:token,p_device_id:"12345678-1234-4234-8234-123456789012"});
const concurrent=await Promise.all([scan(qr.tokens[0].token),scan(qr.tokens[0].token)]);
check("concurrent scans record one time-in",concurrent.map(r=>r.data?.code).sort().join(",")==="already_timed_in,timed_in");
const browser=await action("submitScan",[qr.tokens[0].token,"87654321-1234-4234-8234-123456789012",null],two,"/scan");check("participant server action records scan",browser.text.includes('"code":"timed_in"'));
check("other participant cannot read attendance",(await other.client.from("attendance_records").select("id").eq("event_id",event)).data?.length===0);
check("foreign organizer cannot close session",(await other.client.rpc("close_attendance_session",{p_event_id:event})).data==="not_permitted");
const out=await action("attendanceAction",[event,"time_out"],owner,route);check("real time-out redirects",out.r.headers.get("x-action-redirect")?.includes("/attendance/display"));
const {data:qout}=await owner.client.rpc("get_attendance_qr",{p_event_id:event});
check("participant action records timeout",(await action("submitScan",[qout.tokens[0].token,"12345678-1234-4234-8234-123456789012",null],one,"/scan")).text.includes('"code":"timed_out"'));
for(let i=0;i<20&&!realtime;i++)await new Promise(resolve=>setTimeout(resolve,500));check("organizer receives realtime attendance",realtime);
check("tampered QR rejected",(await scan(qout.tokens[0].token.slice(0,-1)+(qout.tokens[0].token.at(-1)==="A"?"B":"A"))).data?.code==="invalid_qr");
await owner.client.removeChannel(channel);
if(!process.argv.includes("--attendance-only")){
 const certRoute=`/organizer/events/${event}/certificates`;
 check("certificate workspace renders eligibility",(await page(certRoute,owner)).html.includes("Missing time-out"));
 const before=await action("generateCertificates",[event],owner,certRoute);check("generation before completion rejected",before.text.includes('"ok":false'));
 const complete=await action("attendanceAction",[event,"complete"],owner,route);check("real completion action succeeds",complete.text.includes('"ok":true'));
 const generated=await Promise.all([action("generateCertificates",[event],owner,certRoute),action("generateCertificates",[event],owner,certRoute)]);
 check("concurrent generation succeeds safely",generated.every(r=>r.text.includes('"ok":true')));
 const {data:certs}=await owner.client.from("certificates").select("*").eq("event_id",event);
 check("one eligible certificate issued; missing timeout skipped",certs?.length===1);if(!certs?.length)throw Error("Certificate missing");
 const cert=certs[0];
 const reportRoute=`/organizer/events/${event}/reports`;
 check("event report shows basic summary",(await page(reportRoute,owner)).html.includes("Attendance rate"));
 const report=await owner.client.rpc("get_event_report",{p_event_id:event});
 check("derived report counts match facts",report.data?.registered===2&&report.data?.approved===2&&report.data?.attended===2&&report.data?.attendance_rate===100&&report.data?.certificates_issued===1);
 const exported=await fetch(APP+reportRoute+"/export",{headers:{cookie:owner.header()}}),csv=await exported.text();
 check("CSV exports private minimal columns",exported.status===200&&exported.headers.get("cache-control")==="private, no-store"&&csv.includes("Core Live 2 Test")&&csv.includes("CORE-0002")&&!csv.includes("@eventhub.test")&&!csv.includes("avatar")&&!csv.includes("reason"));
 check("foreign organizer CSV denied",(await page(reportRoute+"/export",other)).r.status===404);
 check("participant report RPC denied",(await one.client.rpc("get_event_report",{p_event_id:event})).data===null);
 check("holder certificate list renders",(await page("/certificates",one)).html.includes(cert.certificate_number));
 const pdf=await fetch(APP+`/certificates/${cert.id}/pdf`,{headers:{cookie:one.header()}});const bytes=Buffer.from(await pdf.arrayBuffer());
 check("holder downloads real PDF",pdf.status===200&&pdf.headers.get("content-type")==="application/pdf"&&bytes.subarray(0,5).toString()==="%PDF-");
 const foreignPdf=await page(`/certificates/${cert.id}/pdf`,two);check("another participant PDF denied",foreignPdf.r.status===404);
 check("signed-out PDF requires login",(await page(`/certificates/${cert.id}/pdf`)).r.status===307);
 const verify=await page(`/verify/${cert.verification_code}`);check("public verification valid and noindex",verify.html.includes("Valid")&&verify.html.includes("noindex")&&verify.html.includes(cert.recipient_name));
 const revoke=await action("revokeCertificate",[cert.id,"Disposable integration revocation"],owner,certRoute);check("real revocation action succeeds",revoke.text.includes('"ok":true'));
 check("revoked PDF download blocked",(await page(`/certificates/${cert.id}/pdf`,one)).r.status===410);
 check("public verification shows revoked",(await page(`/verify/${cert.verification_code}`)).html.includes("Revoked"));
}
for(const u of [owner,one,two,other]){u.client.realtime.disconnect();await u.client.auth.signOut();}
console.log(`${results.filter(Boolean).length}/${results.length} checks passed`);process.exit(results.every(Boolean)?0:1);
