import { beforeEach, describe, expect, it, vi } from "vitest";

const factory = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import { createAdminClient } from "./admin";

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); });
describe("isolated server Admin client", () => {
  it("refuses missing privileged configuration", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(() => createAdminClient()).toThrow("not configured");
    expect(factory).not.toHaveBeenCalled();
  });
  it("uses only the server key and disables session/storage behavior", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "fake-server-test-key");
    createAdminClient();
    expect(factory).toHaveBeenCalledWith("https://example.supabase.co", "fake-server-test-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });
});
