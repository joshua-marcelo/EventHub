// Isolated headless Chrome on port 9223; development recovery fixtures required.
// Do not log navigation URLs, passwords, response bodies or OTP credentials.
// node --env-file=.env.local scripts/email-recovery-browser-check.mjs
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const APP = "http://localhost:3100";
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://ldhpbfujqnyovovabvcg.supabase.co") throw new Error("Development project required");
const target = await (await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let id = 0, checks = 0;
const pending = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data), task = pending.get(message.id);
  if (task) {
    pending.delete(message.id);
    if (message.error) task.reject(new Error("Browser command failed"));
    else task.resolve(message.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  pending.set(requestId, { resolve, reject });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error("Browser evaluation failed");
  return response.result.value;
}
function check(name, value) {
  if (!value) throw new Error(`Failed: ${name}`);
  console.log(`PASS ${name}`);
  checks++;
}
async function until(expression) {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`document.body && Boolean(${expression})`)) return true;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return false;
}
const password = `Eh8${randomBytes(24).toString("hex")}`;
async function fill(confirm = password) {
  await evaluate(`(()=>{const inputs=document.querySelectorAll('input[type=password]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [i,value] of [${JSON.stringify(password)},${JSON.stringify(confirm)}].entries()){setter.call(inputs[i],value);inputs[i].dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('button[type=submit]').click();})()`);
}
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.clearBrowserCookies");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: APP + "/reset-password" });
  check("missing-link page offers resend", await until("document.body.innerText.includes('Request a new link')"));
  const hash = createHash("sha256").update("af000000-0000-4000-8000-000000000001:email-recovery-integration").digest("hex");
  const link = APP + "/reset-password#token_hash=" + hash + "&type=recovery";
  await send("Page.navigate", { url: link });
  check("email fragment opens both password fields in existing tab", await until("document.querySelectorAll('input[type=password]').length===2"));
  check("credential removed from address bar", await evaluate("!location.hash && !location.search"));
  check("mobile reset form has no horizontal overflow", await evaluate("document.documentElement.scrollWidth<=innerWidth"));
  await fill("Mismatch9");
  check("password confirmation mismatch preserves form", await until("document.body.innerText.includes('Passwords do not match.')"));
  await fill();
  check("reset submission succeeds and leaves reset page", await until("location.pathname!='/reset-password'"));
  await send("Page.navigate", { url: link });
  check("used link still opens form without consuming on GET", await until("document.querySelectorAll('input[type=password]').length===2"));
  await fill();
  check("used link offers resend in actual browser", await until("document.body.innerText.includes('Request a new link')"));
  for (const name of ["recovery", "confirmation"]) {
    const html = readFileSync(`supabase/templates/${name}.html`, "utf8").replaceAll("{{ .SiteURL }}", "https://eventhub.example").replaceAll("{{ .TokenHash }}", "preview-only").replaceAll("{{ .RedirectTo | urlquery }}", "%2Fdashboard");
    const file = resolve(`.next/email-${name}-preview.html`);
    writeFileSync(file, html);
    await send("Page.navigate", { url: pathToFileURL(file).href });
    await until("document.body.innerText.includes('EventHub')");
    check(`${name} email fits a narrow viewport`, await evaluate("document.documentElement.scrollWidth<=innerWidth"));
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(`.next/email-${name}-preview.png`, Buffer.from(screenshot.data, "base64"));
  }
  console.log(`${checks} browser/email checks passed.`);
} catch (error) {
  console.error(error.message.startsWith("Failed:") ? error.message : "Browser check failed; credentials withheld.");
  process.exitCode = 1;
} finally {
  await send("Page.close");
  socket.close();
}
