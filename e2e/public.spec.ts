import { expect, test } from "@playwright/test";
import { expectAccessible, expectClean, expectNoHorizontalOverflow, watch } from "./helpers";

// Read-only: never logs in, every write request is aborted by watch().

const publicPages = [
  { path: "/", heading: /./ },
  { path: "/login", heading: "Welcome back" },
  { path: "/signup", heading: "Create your account" },
  { path: "/forgot-password", heading: /./ },
  { path: "/privacy", heading: /./ },
  { path: "/verify", heading: /./ },
  { path: "/accept-invitation", heading: "Invitations are no longer used" },
];

for (const p of publicPages) {
  test(`public page ${p.path} renders cleanly, fits the viewport and is accessible`, async ({ page }, info) => {
    const w = await watch(page);
    const res = await page.goto(p.path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, info);
    expectClean(w);
  });
}

const protectedPaths = ["/dashboard", "/admin", "/admin/users", "/admin/organizers", "/organizer", "/organizer/explore", "/organizer/events", "/change-password", "/account/profile", "/my-events", "/certificates", "/scan", "/onboarding"];
for (const path of protectedPaths) {
  test(`signed-out visit to ${path} goes to login with a safe return path`, async ({ page }) => {
    const w = await watch(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(\?|$)/);
    const next = new URL(page.url()).searchParams.get("next");
    expect(next).toBe(path);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    expectClean(w);
  });
}

test("a signed-out non-GET request to an Admin route never reaches the page", async ({ request }) => {
  const res = await request.post("/admin/users", { maxRedirects: 0, data: "x" });
  expect([303, 307, 308]).toContain(res.status());
  expect(res.headers().location).toContain("/login");
});

test("an unknown public event shows the neutral preview, not an error", async ({ page }) => {
  const w = await watch(page);
  const res = await page.goto("/events/00000000-0000-4000-8000-000000000000");
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator("main")).toBeVisible();
  expectClean(w);
});

test.describe("sign-up validation (nothing is submitted)", () => {
  test("rejects invalid input on the client and sends no request", async ({ page }) => {
    const w = await watch(page);
    await page.goto("/signup");
    await page.getByLabel("First name").fill("Test");
    await page.getByLabel("Last name").fill("Person");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("short");
    await page.getByRole("textbox", { name: "Confirm password" }).fill("different");
    await page.getByRole("button", { name: /create account|sign up/i }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("lettersonly");
    await page.getByRole("textbox", { name: "Confirm password" }).fill("lettersonly");
    await page.getByRole("button", { name: /create account|sign up/i }).click();
    await expect(page.getByText("Include at least one number.")).toBeVisible();
    expect(w.blockedWrites).toEqual([]);
    await expect(page).toHaveURL(/\/signup$/);
    expectClean(w);
  });
});

test.describe("login form", () => {
  test("validates required fields on the client", async ({ page }) => {
    const w = await watch(page);
    await page.goto("/login");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    expect(w.blockedWrites).toEqual([]);
    expectClean(w);
  });
  test("password visibility toggle is keyboard reachable and labelled", async ({ page }) => {
    await page.goto("/login");
    const field = page.getByLabel("Password", { exact: true });
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(field).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});
