import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export type Watch = { consoleErrors: string[]; failedRequests: string[]; blockedWrites: string[] };

/**
 * Collects console errors and failed/5xx requests, and (unless allowWrites) aborts every
 * non-GET request to the app, so a read-only test can never create or change live records.
 * Server Actions are POSTs to the page URL, so this also blocks sign-up, login and every mutation.
 */
export async function watch(page: Page, { allowWrites = false }: { allowWrites?: boolean } = {}): Promise<Watch> {
  const w: Watch = { consoleErrors: [], failedRequests: [], blockedWrites: [] };
  page.on("console", msg => { if (msg.type() === "error") w.consoleErrors.push(msg.text()); });
  page.on("pageerror", err => w.consoleErrors.push(`pageerror: ${err.message}`));
  // Pages may 404 on purpose (authorization checks); a missing script, style, image or data request is a defect.
  // RSC requests for a protected route after logout are redirected to /login, and Next answers the
  // redirected flight request 404 and falls back to a full navigation (which tests assert separately).
  page.on("response", res => {
    const flight = new URL(res.url()).searchParams.has("_rsc");
    if (res.status() >= 500 || (res.status() === 404 && res.request().resourceType() !== "document" && !flight)) w.failedRequests.push(`${res.status()} ${res.url()}`);
  });
  if (!allowWrites) {
    await page.route("**/*", route => {
      const req = route.request();
      if (req.method() !== "GET" && req.method() !== "HEAD" && new URL(req.url()).origin === new URL(page.url() === "about:blank" ? req.url() : page.url()).origin) {
        w.blockedWrites.push(`${req.method()} ${new URL(req.url()).pathname}`);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
  }
  return w;
}

// Known dev-only noise that is not an application defect.
const IGNORED = [/Download the React DevTools/i, /\[Fast Refresh\]/i, /blockedbyclient|ERR_BLOCKED_BY_CLIENT/i,
  // The browser's echo of an intentional 404 page; missing sub-resources are caught in failedRequests.
  /Failed to load resource: the server responded with a status of 404/];
export function expectClean(w: Watch) {
  expect(w.consoleErrors.filter(e => !IGNORED.some(r => r.test(e))), "console errors").toEqual([]);
  expect(w.failedRequests, "5xx responses and missing resources").toEqual([]);
}

/** No horizontal page scroll at this viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}

/** axe-core WCAG 2.x A/AA scan; serious and critical violations fail the test, the rest are attached. */
export async function expectAccessible(page: Page, info: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  await info.attach("axe-violations.json", { body: JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), null, 2), contentType: "application/json" });
  const serious = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
  expect(serious.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(" | ")}`), "serious accessibility violations").toEqual([]);
}
