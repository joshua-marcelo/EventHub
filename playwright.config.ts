import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E. Targets the running dev server (E2E_BASE_URL, default http://localhost:3000).
 * The default "readonly" project never logs in and never submits state-changing forms, so it is safe
 * against the linked Supabase project. Write scenarios live in e2e/write/ and only run with
 * E2E_ALLOW_WRITES=1 against an isolated or explicitly approved database.
 */
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
  "small-mobile": { width: 320, height: 640 },
} as const;

export default defineConfig({
  testDir: "e2e",
  testIgnore: process.env.E2E_ALLOW_WRITES === "1" ? [] : ["write/**"],
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: Object.entries(viewports).map(([name, viewport]) => ({ name, use: { ...devices["Desktop Chrome"], viewport, hasTouch: name !== "desktop", isMobile: false } })),
});
