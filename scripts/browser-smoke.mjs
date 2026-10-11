// Uses an isolated headless Chrome at localhost:9223. No extra browser dependency.
import { writeFileSync } from "node:fs";
const target = await (await fetch("http://127.0.0.1:9223/json/new?about:blank",{method:"PUT"})).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
let sequence = 0; const pending = new Map();
socket.addEventListener("message",event=>{const message = JSON.parse(event.data);const p = pending.get(message.id);if(p){pending.delete(message.id);message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result);}});
const send = (method,params={}) => new Promise((resolve,reject)=>{const id = ++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
let failed = false;
try {
  await send("Page.enable");
  for (const width of [360,768,1280]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
    await send("Page.navigate",{url:"http://localhost:3100"});
    await new Promise(resolve=>setTimeout(resolve,2000));
    const {result} = await send("Runtime.evaluate",{expression:"JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,logo:!!document.querySelector('img[alt=EventHub]')?.naturalWidth,how:!!document.getElementById('how-it-works'),events:!!document.getElementById('events')})",returnByValue:true});
    const layout = JSON.parse(result.value); const ok = layout.scroll <= layout.width && layout.h1 === 1 && layout.logo && layout.how && layout.events;
    console.log(`${ok ? "ok" : "NOT OK"} landing ${width}px ${JSON.stringify(layout)}`);failed ||= !ok;
    const {data} = await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});
    writeFileSync(`.next/landing-${width}.png`,Buffer.from(data,"base64"));
  }
} finally { await send("Page.close");socket.close(); }
process.exitCode = failed ? 1 : 0;
