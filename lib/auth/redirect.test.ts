import { describe, expect, it } from "vitest";

import { isGuestOnlyPath, isPublicPath, safeNextPath } from "./redirect";

const ORIGIN = "http://localhost:3000";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths with query and hash", () => {
    expect(safeNextPath("/events/abc?tab=1#top")).toBe("/events/abc?tab=1#top");
    expect(safeNextPath("/onboarding?next=%2Fevents%2Fx")).toBe("/onboarding?next=%2Fevents%2Fx");
  });

  it("falls back for empty or missing values", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath("   ", "/profile")).toBe("/profile");
  });

  it("rejects other origins and protocol tricks", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "data:text/html,hi",
      "evil.com/path",
      "/ok\r\nSet-Cookie: x=1",
      "http://localhost:3000.evil.com/x",
    ]) {
      expect(safeNextPath(bad, "/dashboard", ORIGIN), bad).toBe("/dashboard");
    }
  });

  it("accepts an absolute URL only on the given origin and strips it to a path", () => {
    expect(safeNextPath("http://localhost:3000/events/x?a=1", "/dashboard", ORIGIN)).toBe("/events/x?a=1");
    expect(safeNextPath("http://localhost:3000", "/dashboard", ORIGIN)).toBe("/");
    expect(safeNextPath("http://localhost:3000/events/x")).toBe("/dashboard"); // no origin given
  });

  it("never returns auth pages that would loop", () => {
    for (const p of ["/login", "/login?next=/x", "/signup", "/signup/check-email", "/auth/confirm?token_hash=x", "/forgot-password"]) {
      expect(safeNextPath(p), p).toBe("/dashboard");
    }
  });

  it("normalizes dot segments without leaving the site", () => {
    expect(safeNextPath("/a/../profile")).toBe("/profile");
    expect(safeNextPath("/../../etc/passwd")).toBe("/etc/passwd");
  });

  it("rejects overly long values", () => {
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/dashboard");
  });
});

describe("isPublicPath", () => {
  it("allows the demo placeholder without exposing nested routes", () => {
    expect(isPublicPath("/demo")).toBe(true);
    expect(isPublicPath("/demo/settings")).toBe(false);
  });

  it("allows auth pages, privacy, verification and the event preview", () => {
    for (const p of ["/", "/login", "/signup", "/signup/check-email", "/forgot-password", "/reset-password", "/privacy", "/auth/confirm", "/auth/error", "/verify", "/verify/abc", "/events/123e4567-e89b-42d3-a456-426614174000"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("protects app pages", () => {
    for (const p of ["/dashboard", "/profile", "/onboarding", "/events", "/events/join", "/events/anything/settings", "/organizer", "/admin", "/scan", "/e/ABCD2345"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
  it("allows malformed event IDs to render the same neutral public response", () => {
    expect(isPublicPath("/events/not-a-uuid")).toBe(true);
    expect(isPublicPath("/events/unknown")).toBe(true);
  });
});

describe("isGuestOnlyPath", () => {
  it("only covers login and sign-up", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/signup")).toBe(true);
    expect(isGuestOnlyPath("/signup/check-email")).toBe(false);
    expect(isGuestOnlyPath("/dashboard")).toBe(false);
  });
});
