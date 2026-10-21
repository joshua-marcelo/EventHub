import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { expectClean, expectNoHorizontalOverflow, watch, type Watch } from "../helpers";
import { changePassword, createQaAdmin, someoneElsesEventId, currentAttendanceToken, demoteQaAdmin, login, logout, manila, png, qaEmail, run, strongPassword } from "./qa-env";

/*
 * End-to-end account and event lifecycle with real logins, against the approved QA data set.
 * Serial: each step builds on the previous one. Desktop project only (mobile has its own checks).
 */
test.describe.configure({ mode: "serial" });

type Actor = { email: string; password: string; temp?: string; ctx?: BrowserContext; page?: Page; w?: Watch };
const admin: Actor & { id?: string } = { email: "", password: "" };
const organizer: Actor = { email: qaEmail("org"), password: strongPassword() };
const participant: Actor = { email: qaEmail("par"), password: strongPassword() };
const selfSignup: Actor = { email: qaEmail("self"), password: strongPassword() };
const event = { id: "", title: `QA Lifecycle ${run}`, startsAt: 0 };

async function open(browser: Browser, a: Actor) {
  a.ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await a.ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  a.page = await a.ctx.newPage();
  a.page.on("dialog", d => void d.accept());
  a.w = await watch(a.page, { allowWrites: true });
  return a.page;
}

test.beforeAll(async ({}, info) => {
  test.skip(info.project.name !== "desktop", "write suite runs once, at desktop size");
  Object.assign(admin, await createQaAdmin());
});
test.afterAll(async () => { if (admin.id) await demoteQaAdmin(admin.id); });

test("QA Admin signs in to /admin with the redesigned shell", async ({ browser }) => {
  const page = await open(browser, admin);
  await login(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin$/);
  const sidebar = page.getByRole("complementary", { name: "Admin sidebar" });
  for (const name of ["Overview", "Organizers", "Participants", "Reference Data"]) await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /^Account menu, QA, Administrator$/ })).toBeVisible();
  await expect(page.getByText(/switch workspace/i)).toHaveCount(0);
  // No desktop top header: the mobile bar is hidden and content starts near the top.
  await expect(page.getByRole("banner")).toBeHidden();
  // #main-content: Next keeps the previous route (the login page) hidden in the DOM, with its own <main>.
  expect((await page.locator("main#main-content").boundingBox())!.y).toBeLessThan(8);
  for (const path of ["/admin", "/admin/organizers", "/admin/users", "/admin/lookups"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  expectClean(admin.w!);
});

test("Admin creates an Organizer and sees one-time credentials", async () => {
  const page = admin.page!;
  await page.goto("/admin/organizers");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add Organizer" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill("someone@nodot");
  await dialog.getByRole("button", { name: "Create Organizer" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter a valid email address.");
  await dialog.getByLabel("Email address").fill(organizer.email.toUpperCase());
  await dialog.getByRole("button", { name: "Create Organizer" }).click();
  await expect(dialog.getByRole("heading", { name: "Organizer account created" })).toBeVisible();
  await expect(dialog.getByText(organizer.email, { exact: true })).toBeVisible();
  await expect(dialog.getByText("will not be shown again")).toBeVisible();
  const temp = (await dialog.locator("dd.font-mono").textContent())!.trim();
  expect(temp).toMatch(/^[A-Za-z2-9]{16}$/);
  organizer.temp = temp;
  await dialog.getByRole("button", { name: "Copy Credentials" }).click();
  await expect(dialog.getByText("Credentials copied to the clipboard.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(temp);
  // Outside clicks and Escape do not discard the only copy of the password.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Add Organizer" }).click();
  await expect(page.getByRole("dialog").getByLabel("Email address")).toHaveValue("");
  await expect(page.getByText(temp)).toHaveCount(0);
  // Duplicate email is refused without creating anything.
  await page.getByRole("dialog").getByLabel("Email address").fill(organizer.email);
  await page.getByRole("dialog").getByRole("button", { name: "Create Organizer" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("already belongs to an EventHub account");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("cell", { name: organizer.email, exact: true }).filter({ visible: true })).toBeVisible();
  expectClean(admin.w!);
});

test("Admin creates a Participant", async () => {
  const page = admin.page!;
  await page.goto("/admin/users");
  await page.waitForLoadState("networkidle"); // let the streamed directory hydrate before opening a modal
  await page.getByRole("button", { name: "Create Participant" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill(participant.email);
  await dialog.getByRole("button", { name: "Create Participant" }).click();
  await expect(dialog.getByRole("heading", { name: "Participant account created" })).toBeVisible();
  participant.temp = (await dialog.locator("dd.font-mono").textContent())!.trim();
  expect(participant.temp).toHaveLength(16);
  await dialog.getByRole("button", { name: "Done" }).click();
  await page.goto(`/admin/users?q=${encodeURIComponent(participant.email)}`);
  await expect(page.getByText(participant.email).first()).toBeVisible();
  expectClean(admin.w!);
});

test("new Organizer must replace the temporary password before anything else", async ({ browser }) => {
  const page = await open(browser, organizer);
  await login(page, organizer.email, organizer.temp!);
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole("heading", { name: "Set your own password" })).toBeVisible();
  for (const path of ["/organizer", "/organizer/events/new", "/admin", "/account/profile", "/dashboard"]) {
    await page.goto(path);
    await expect(page, `direct visit to ${path}`).toHaveURL(/\/change-password$/);
  }
  const post = await page.request.post("/organizer", { data: "{}", headers: { "content-type": "application/json" }, maxRedirects: 0 });
  expect(post.status(), "direct POST while on a temporary password").toBe(403);
  await changePassword(page, "WrongPass123", organizer.password);
  await expect(page.getByText("Your current password is incorrect.").first()).toBeVisible();
  await changePassword(page, organizer.temp!, organizer.temp!);
  await expect(page.getByText("Choose a password different from your current one.")).toBeVisible();
  await changePassword(page, organizer.temp!, organizer.password);
  await expect(page).toHaveURL(/\/organizer$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await logout(page);
  await login(page, organizer.email, organizer.temp!);
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await login(page, organizer.email, organizer.password);
  await expect(page).toHaveURL(/\/organizer$/);
  const adminVisit = await page.goto("/admin");
  expect(adminVisit?.status(), "Organizer has no Admin access").toBe(404);
  expectClean(organizer.w!);
});

test("new Participant changes password, then completes Student Onboarding", async ({ browser }) => {
  const page = await open(browser, participant);
  await login(page, participant.email, participant.temp!);
  await expect(page).toHaveURL(/\/change-password$/);
  await changePassword(page, participant.temp!, participant.password);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("checkbox").filter({ visible: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("First name").fill("QA");
  await page.getByLabel("Last name").fill(`Participant ${run}`);
  await page.getByLabel("Student ID").fill(`QA-${run}`.slice(0, 20));
  await page.getByLabel("College").selectOption({ index: 1 });
  await expect(page.getByLabel("Program").locator("option")).not.toHaveCount(1);
  await page.getByLabel("Program").selectOption({ index: 1 });
  await page.getByLabel("Year level").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save and Continue" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "qa-avatar.png", mimeType: "image/png", buffer: png(400, 400) });
  await expect(page.getByRole("link", { name: "Finish Setup" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Finish Setup" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1, name: /Welcome back, QA/ })).toBeVisible();
  await page.goto("/organizer");
  await expect(page, "Participant has no Organizer access").toHaveURL(/\/dashboard/);
  expect((await page.goto("/admin"))?.status(), "Participant has no Admin access").toBe(404);
  expectClean(participant.w!);
});

test("public sign-up needs no email step and lands in Student Onboarding", async ({ browser }) => {
  const page = await open(browser, selfSignup);
  const fill = async () => {
    await page.goto("/signup");
    await page.getByLabel("First name").fill("QA");
    await page.getByLabel("Last name").fill("Self");
    await page.getByLabel("Email address").fill(selfSignup.email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(selfSignup.password);
    await page.getByRole("textbox", { name: "Confirm password" }).fill(selfSignup.password);
    await page.getByRole("button", { name: /create account|sign up/i }).click();
  };
  await fill();
  await expect(page, "Confirm email must be OFF in hosted Auth").toHaveURL(/\/onboarding/);
  await page.goto("/organizer");
  await expect(page).toHaveURL(/\/onboarding|\/dashboard/);
  await logout(page);
  await fill();
  await expect(page.getByText(/already exists/i)).toBeVisible();
  await login(page, selfSignup.email, selfSignup.password);
  await expect(page, "self-registered accounts are not forced to change password").toHaveURL(/\/onboarding/);
  expectClean(selfSignup.w!);
});

test("Organizer sidebar: Overview, Create Event and MY EVENTS; retired pages redirect", async () => {
  const page = organizer.page!;
  await page.goto("/organizer");
  const sidebar = page.getByRole("complementary", { name: "Organizer sidebar" });
  await expect(sidebar.getByRole("navigation", { name: "Organizer navigation" }).getByRole("link")).toHaveText(["Overview", "Create Event"]);
  await expect(sidebar.getByRole("button", { name: "My events" })).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar.getByText("No events yet.")).toBeVisible();
  for (const [from, to] of [["/organizer/explore", /\/organizer$/], ["/organizer/registrations", /\/organizer\/events$/], ["/organizer/reports", /\/organizer\/events$/]] as const) {
    await page.goto(from);
    await expect(page, `${from} is retired`).toHaveURL(to);
  }
  expectClean(organizer.w!);
});

test("Create Event uses the short form; draft attendance is unavailable", async () => {
  const page = organizer.page!;
  await page.goto("/organizer/events/new");
  // Starts in two days: attendance must still open manually, before the scheduled time.
  event.startsAt = Math.ceil((Date.now() + 2 * 86_400_000) / 60_000) * 60_000;
  const start = manila(event.startsAt);
  await page.getByLabel("Event title").fill(event.title);
  await page.getByLabel("Short description").fill("QA event");
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Venue").fill("QA Hall");
  const end = manila(event.startsAt + 26 * 3_600_000); // overnight into the next day
  await page.getByLabel("Start date").fill(start.slice(0, 10));
  await page.getByLabel("Start time").fill(start.slice(11, 16));
  await page.getByLabel("End date").fill(end.slice(0, 10));
  await page.getByLabel("End time").fill(end.slice(11, 16));
  await page.getByLabel("Capacity").fill("50");
  await page.locator('input[type="file"]').setInputFiles({ name: "qa-banner.png", mimeType: "image/png", buffer: png(1200, 630) });
  await page.getByRole("button", { name: /save draft/i }).click();
  await expect(page).toHaveURL(/\/organizer\/events\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  event.id = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1, name: event.title })).toBeVisible();
  for (const name of ["Edit Event", "Open Registrations", "Open Attendance"]) await expect(page.getByRole("link", { name })).toBeVisible();
  for (const retired of ["Certificates", "Reports", "Participant view", "Settings"]) await expect(page.getByRole("link", { name: retired, exact: true }).filter({ visible: true })).toHaveCount(0);
  const myEvents = page.getByRole("complementary", { name: "Organizer sidebar" }).locator("#sidebar-my-events");
  const sections = myEvents.getByRole("list", { name: event.title });
  await expect(sections.getByRole("link")).toHaveText(["Overview", "Registrations", "Attendance"]);
  await sections.getByRole("link", { name: "Attendance" }).click();
  await expect(page.getByText("Attendance is unavailable for draft events. Publish the event first.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Attendance" })).toHaveCount(0);
  expectClean(organizer.w!);
});

test("Organizer publishes and shares the registration QR", async () => {
  const page = organizer.page!;
  await page.goto(`/organizer/events/${event.id}`);
  await page.getByRole("button", { name: "Publish Event" }).click();
  await expect(page.getByRole("button", { name: "Publish Event" })).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole("button", { name: "Registration QR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("img", { name: `Registration QR for ${event.title}` })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Event registration link" })).toHaveValue(new RegExp(`/events/${event.id}$`));
  await page.keyboard.press("Escape");
  expectClean(organizer.w!);
});

test("Participant registers once from the Events feed; statuses show in the sidebar", async () => {
  const p = participant.page!;
  await p.goto("/events");
  await p.getByRole("link", { name: event.title }).first().click();
  await expect(p).toHaveURL(new RegExp(`/events/${event.id}$`));
  await p.getByRole("button", { name: "Register" }).click();
  await expect(p.getByRole("region", { name: "Registration" }).getByText("Approved")).toBeVisible({ timeout: 20_000 });
  await expect(p.getByRole("button", { name: "Register" }), "no duplicate registration").toHaveCount(0);
  const mine = p.getByRole("complementary", { name: "Participant sidebar" }).locator("#sidebar-my-registrations");
  await mine.getByRole("button", { name: event.title }).click();
  await expect(mine.getByText("Approved")).toBeVisible();
  await expect(mine.getByText("Not Yet Recorded")).toBeVisible();
  const page = organizer.page!;
  await page.goto(`/organizer/events/${event.id}/registrations?q=${encodeURIComponent(`Participant ${run}`)}`);
  await expect(page.getByRole("table", { name: "Event registrations" }).getByText(`Participant ${run}`)).toBeVisible();
  expectClean(organizer.w!); expectClean(participant.w!);
});

test("Organizer cannot open an event they do not own", async () => {
  const page = organizer.page!;
  // Partial prerendering streams the not-found UI after a 200 shell, so assert the UI and the absence of controls.
  for (const section of ["", "/registrations", "/attendance"]) {
    await page.goto(`/organizer/events/${await someoneElsesEventId(organizer.email)}${section}`);
    await expect(page.getByRole("heading", { name: "Page not found" }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Publish Event|Start Attendance/ })).toHaveCount(0);
  }
  expectClean(organizer.w!);
});

test("manual attendance: start before the scheduled time, scan, live display, close", async () => {
  const page = organizer.page!;
  await page.goto(`/organizer/events/${event.id}/attendance`);
  await page.getByRole("button", { name: "Start Attendance" }).click();
  await expect(page).toHaveURL(new RegExp(`/organizer/events/${event.id}/attendance/display$`), { timeout: 20_000 });
  await expect(page.getByText("Attendance open")).toBeVisible();
  await expect(page.getByText("Waiting for participant…")).toBeVisible();
  const p = participant.page!;
  await p.goto("/scan?t=not-a-real-token");
  await expect(p.getByRole("status").filter({ hasText: /not a valid EventHub attendance code/ })).toBeVisible();
  await p.goto(`/scan?t=${await currentAttendanceToken(organizer.email, organizer.password, event.id)}`);
  await expect(p.getByRole("status").filter({ hasText: "Time-in recorded." })).toBeVisible({ timeout: 20_000 });
  // The projector shows the server-confirmed attendance without a student ID.
  const latest = page.getByRole("region", { name: "Latest attendance" });
  await expect(latest.getByText(`Participant ${run}`, { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(latest.getByText(/Attendance recorded/)).toBeVisible();
  await expect(latest.getByText(`QA-${run}`.slice(0, 20))).toHaveCount(0);
  await p.goto(`/scan?t=${await currentAttendanceToken(organizer.email, organizer.password, event.id)}`);
  await expect(p.getByRole("status").filter({ hasText: "Already timed in." })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Exit display" }).click();
  await page.getByRole("button", { name: "Close Attendance" }).click();
  await expect(page.getByRole("button", { name: "Start Attendance" })).toBeVisible({ timeout: 20_000 });
  await p.goto(`/events/${event.id}`);
  await expect(p.getByRole("region", { name: "Registration" }).getByText("Present")).toBeVisible();
  expectClean(organizer.w!); expectClean(participant.w!);
});

test("Admin password reset: RESET confirmation, rate limit, forced change, session respects it", async () => {
  const page = admin.page!;
  await page.goto(`/admin/users?q=${encodeURIComponent(participant.email)}`);
  await page.getByRole("button", { name: /^More actions for QA Participant/ }).click();
  await page.getByRole("menuitem", { name: "Reset password" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Reset password" })).toBeDisabled();
  await dialog.getByLabel(/Type RESET to confirm/).fill("reset");
  await expect(dialog.getByRole("button", { name: "Reset password" })).toBeDisabled();
  await dialog.getByLabel(/Type RESET to confirm/).fill("RESET");
  await dialog.getByRole("button", { name: "Reset password" }).click();
  await expect(dialog.getByRole("heading", { name: "Temporary password issued" })).toBeVisible();
  const temp = (await dialog.locator("dd.font-mono").textContent())!.trim();
  await dialog.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: /^More actions for QA Participant/ }).click();
  await page.getByRole("menuitem", { name: "Reset password" }).click();
  await page.getByRole("alertdialog").getByLabel(/Type RESET to confirm/).fill("RESET");
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText("Too many requests");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  const p = participant.page!;
  await p.goto("/dashboard");
  await expect(p, "existing session is held at Change Password after a reset").toHaveURL(/\/change-password$/);
  await changePassword(p, participant.password, strongPassword());
  await expect(p.getByText("Your current password is incorrect.").first()).toBeVisible();
  participant.password = strongPassword();
  await changePassword(p, temp, participant.password);
  await expect(p).toHaveURL(/\/dashboard/);
  await page.goto(`/admin/users/${admin.id}`);
  await expect(page.getByText("Use Change Password in your account menu to change your own password.")).toBeVisible();
  expectClean(admin.w!); expectClean(participant.w!);
});

test("Suspend, reinstate and revoke an Organizer with typed confirmation", async () => {
  const page = admin.page!;
  const act = async (menu: string, phrase: string, confirm: string) => {
    await page.goto("/admin/organizers?status=all");
    await page.getByRole("row").filter({ hasText: organizer.email }).getByRole("button", { name: /^More actions for/ }).last().click();
    await page.getByRole("menuitem", { name: menu }).click();
    const d = page.getByRole("alertdialog");
    await d.getByRole("textbox", { name: /Reason/ }).fill("Automated QA check");
    await d.getByLabel(new RegExp(`Type ${phrase} to confirm`)).fill(phrase.toLowerCase());
    await expect(d.getByRole("button", { name: confirm })).toBeDisabled();
    await d.getByLabel(new RegExp(`Type ${phrase} to confirm`)).fill(phrase);
    await d.getByRole("button", { name: confirm }).click();
    await expect(d).toBeHidden({ timeout: 20_000 });
  };
  await act("Suspend organizer", "SUSPEND", "Suspend organizer");
  const o = organizer.page!;
  await o.goto("/organizer/events/new");
  await expect(o).toHaveURL(/\/organizer$/);
  await expect(o.getByRole("status").filter({ hasText: "Your organizer access is suspended" })).toBeVisible();
  await act("Reinstate organizer", "REINSTATE", "Reinstate organizer");
  await o.goto("/organizer/events/new");
  await expect(o).toHaveURL(/\/organizer\/events\/new$/);
  await act("Revoke organizer access", "REVOKE", "Revoke access");
  await o.goto("/organizer/events/new");
  await expect(o).toHaveURL(/\/organizer$/);
  await page.goto("/admin/organizers?status=revoked");
  await expect(page.getByText(organizer.email).first()).toBeVisible();
  expectClean(admin.w!);
});

test("mobile shell keeps navigation and the account menu reachable", async () => {
  const p = participant.page!;
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto("/dashboard");
  await expect(p.getByRole("navigation", { name: "Participant quick navigation" })).toBeVisible();
  await p.getByRole("button", { name: "Open menu" }).click();
  const sheet = p.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Certificates" })).toHaveCount(0);
  await sheet.getByRole("link", { name: "Events", exact: true }).click();
  await expect(p).toHaveURL(/\/events$/);
  await expect(sheet).toBeHidden();
  await expectNoHorizontalOverflow(p);
  await logout(p);
  expectClean(participant.w!);
});
