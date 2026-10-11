import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { verifyOtp } })) }));
import { GET } from "./route";
beforeEach(() => vi.resetAllMocks());

it("repeated recovery GETs open the form without consuming the token", async () => {
  for (let i = 0; i < 2; i++) {
    const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?token_hash=test-only&type=recovery"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/reset-password");
    expect(destination.search).toBe("");
    expect(destination.hash).toContain("type=recovery");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  }
  expect(verifyOtp).not.toHaveBeenCalled();
});

it("retains signup verification and rejects external redirects", async () => {
  verifyOtp.mockResolvedValue({ error: null });
  const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?token_hash=test-only&type=email&next=https://evil.invalid"));
  expect(new URL(response.headers.get("location")!).pathname).toBe("/dashboard");
  expect(verifyOtp).toHaveBeenCalledOnce();
});

it("missing recovery credentials retain the helpful resend page", async () => {
  const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?type=recovery"));
  expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/error");
  expect(verifyOtp).not.toHaveBeenCalled();
});
