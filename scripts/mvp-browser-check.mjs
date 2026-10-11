// Development-only browser verification; isolated Chrome must run on localhost:9223.
import { createServerClient } from "@supabase/ssr";
import { writeFileSync } from "node:fs";
const APP=process.argv[2]??"http://localhost:3100",URL=process.env.NEXT_PUBLIC_SUPABASE_URL,KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,event="fe000000-0000-4000-8000-000000000001";
if(URL!=="https://ldhpbfujqnyovovabvcg.supabase.co"||!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(APP))throw Error("Local development only");
async function login(n){const cookies=new Map(),client=createServerClient(URL,KEY,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:a=>a.forEach(({name,value})=>cookies.set(name,value))}});const {error}=await client.auth.signInWithPassword({email:`core-live-${n}@eventhub.test`,password:"CoreMvpTest123"});if(error)throw error;return {client,cookies};}
const owner=await login(1),participant=await login(2);
const target=await(await fetch("http://127.0.0.1:9223/json/new?about:blank",{method:"PUT"})).json(),socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener("open",resolve,{once:true}));let sequence=0;const pending=new Map(),errors=[];
socket.addEventListener("message",e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}if(m.method==="Runtime.exceptionThrown")errors.push(m.params.exceptionDetails.text);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const {result}=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});return result.value;}
async function cookies(user){await send("Network.clearBrowserCookies");await send("Network.setCookies",{cookies:[...user.cookies].map(([name,value])=>({name,value,url:APP,path:"/"}))});}
let failed=false;function check(label,value){console.log(`${value?"ok":"NOT OK"} ${label}`);failed||=!value;}
try{
 await send("Page.enable");await send("Runtime.enable");await cookies(owner);
 const opened=await owner.client.rpc("open_attendance_session",{p_event_id:event,p_kind:"time_in"});if(opened.data!=="ok")throw Error("Fresh fixture required.");
 await send("Emulation.setDeviceMetricsOverride",{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send("Page.navigate",{url:APP+`/organizer/events/${event}/attendance/display`});
 await new Promise(resolve=>setTimeout(resolve,3500));
 check("desktop display renders rotating QR",await evaluate("!!document.querySelector('img[alt=\"Rotating attendance QR code\"]')?.naturalWidth && document.body.innerText.includes('Time-in open')"));
 const firstQr=await evaluate("document.querySelector('img[alt=\"Rotating attendance QR code\"]').src");
 await new Promise(resolve=>setTimeout(resolve,31000));
 check("QR rotates across a full 30-second window",await evaluate("document.querySelector('img[alt=\"Rotating attendance QR code\"]').src")!==firstQr);
 check("display omits private fields",await evaluate("!document.body.innerText.includes('@eventhub.test') && !document.body.innerText.includes('CORE-')"));
 const {data:qr}=await owner.client.rpc("get_attendance_qr",{p_event_id:event});
 await cookies(participant);await send("Emulation.setDeviceMetricsOverride",{width:360,height:900,deviceScaleFactor:1,mobile:true});await send("Page.navigate",{url:APP+"/scan?t="+qr.tokens[0].token});
 await new Promise(resolve=>setTimeout(resolve,3500));
 check("phone QR link automatically records attendance",await evaluate("document.body.innerText.includes('Time-in recorded.') && !location.search.includes('t=')"));
 check("phone scanner has no horizontal overflow",await evaluate("document.documentElement.scrollWidth<=innerWidth"));
 await cookies(owner);await send("Emulation.setDeviceMetricsOverride",{width:1366,height:900,deviceScaleFactor:1,mobile:false});await send("Page.navigate",{url:APP+`/organizer/events/${event}/attendance/display`});
 await new Promise(resolve=>setTimeout(resolve,2500));
 check("check-in appears on organizer screen",await evaluate("document.body.innerText.includes('Core Live 2 Test') && document.body.innerText.includes('Timed in')"));
 const screenshot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});writeFileSync(".next/attendance-display.png",Buffer.from(screenshot.data,"base64"));
 check("no browser runtime errors",errors.length===0);
}finally{await send("Page.close");socket.close();for(const u of [owner,participant]){u.client.realtime.disconnect();await u.client.auth.signOut();}}
process.exit(failed?1:0);
