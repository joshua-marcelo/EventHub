import { beforeEach, describe, expect, it, vi } from "vitest";
import { bannerFileError, bannerTypeFromPath, bannerUrl, detectImageType, isBannerPath, newBannerPath } from "./banner";

const m = vi.hoisted(() => ({ requireOrganizer: vi.fn(), createClient: vi.fn(), from: vi.fn(), rpc: vi.fn(), download: vi.fn(), remove: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn(), requireUser: vi.fn(), requireOrganizer: m.requireOrganizer }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
import { setEventBanner } from "./actions";

const eventId = "a1000000-0000-4000-8000-000000000001";
const objectId = "b2000000-0000-4000-8000-000000000002";
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("banner rules", () => {
  it("detects real formats from file signatures", () => {
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(jpg)).toBe("image/jpeg");
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(detectImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
  });
  it.each([
    [{ type: "image/gif", size: 10 }, "Use a JPG, PNG or WEBP image."],
    [{ type: "image/svg+xml", size: 10 }, "Use a JPG, PNG or WEBP image."],
    [{ type: "image/png", size: 0 }, "This file is empty. Choose another image."],
    [{ type: "image/png", size: 5 * 1024 * 1024 + 1 }, "This image is larger than 5 MB. Choose a smaller file."],
  ])("rejects invalid files before upload", (file, message) => expect(bannerFileError(file)).toBe(message));
  it("accepts a 5 MB WEBP", () => expect(bannerFileError({ type: "image/webp", size: 5 * 1024 * 1024 })).toBeNull());
  it("creates paths only inside the event folder and validates them strictly", () => {
    const path = newBannerPath(eventId, "image/jpeg");
    expect(path).toMatch(new RegExp(`^${eventId}/[0-9a-f-]{36}\\.jpg$`));
    expect(isBannerPath(eventId, path)).toBe(true);
    expect(isBannerPath(objectId, path)).toBe(false);
    for (const bad of [`${eventId}/../x.png`, `${eventId}/${objectId}.gif`, `${eventId}/sub/${objectId}.png`, `${objectId}.png`, `${eventId}/${objectId}.png?x`]) expect(isBannerPath(eventId, bad)).toBe(false);
    expect(bannerTypeFromPath(`${eventId}/${objectId}.webp`)).toBe("image/webp");
  });
  it("builds public URLs and handles missing banners", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    expect(bannerUrl(`${eventId}/${objectId}.png`)).toBe(`https://ref.supabase.co/storage/v1/object/public/event-banners/${eventId}/${objectId}.png`);
    expect(bannerUrl(null)).toBeNull();
  });
});

describe("setEventBanner", () => {
  const path = `${eventId}/${objectId}.png`;
  const owned = (banner_path: string | null = null) => m.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { organizer_id: "owner", banner_path }, error: null }) }) }) });
  beforeEach(() => {
    vi.resetAllMocks();
    m.requireOrganizer.mockResolvedValue({ id: "owner" });
    m.createClient.mockResolvedValue({ from: m.from, rpc: m.rpc, storage: { from: () => ({ download: m.download, remove: m.remove }) } });
    m.download.mockResolvedValue({ data: new Blob([png]), error: null });
    m.remove.mockResolvedValue({ data: [], error: null });
    m.rpc.mockResolvedValue({ data: "ok", error: null });
    owned();
  });
  it("rejects paths outside the event folder before any privileged work", async () => {
    expect(await setEventBanner(eventId, `${objectId}/${objectId}.png`)).toMatchObject({ ok: false, code: "invalid_input" });
    expect(m.requireOrganizer).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("refuses events the Organizer does not own", async () => {
    m.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { organizer_id: "someone-else", banner_path: null }, error: null }) }) }) });
    expect(await setEventBanner(eventId, path)).toMatchObject({ ok: false, code: "not_permitted" });
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
  });
  it("deletes and rejects an upload whose bytes are not the declared format", async () => {
    m.download.mockResolvedValue({ data: new Blob([jpg]), error: null });
    expect(await setEventBanner(eventId, path)).toMatchObject({ ok: false, code: "invalid_image" });
    expect(m.remove).toHaveBeenCalledWith([path]); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("attaches a verified banner and removes the replaced one", async () => {
    const old = `${eventId}/c3000000-0000-4000-8000-000000000003.jpg`; owned(old);
    expect(await setEventBanner(eventId, path)).toMatchObject({ ok: true, message: "Banner saved." });
    expect(m.rpc).toHaveBeenCalledWith("set_event_banner", { p_event_id: eventId, p_path: path });
    expect(m.remove).toHaveBeenCalledWith([old]);
  });
  it("cleans up the new upload and reports failure when the database rejects it", async () => {
    m.rpc.mockResolvedValue({ data: "not_permitted", error: null });
    expect(await setEventBanner(eventId, path)).toMatchObject({ ok: false });
    expect(m.remove).toHaveBeenCalledWith([path]); expect(m.revalidatePath).not.toHaveBeenCalled();
  });
  it("removes the banner", async () => {
    const old = `${eventId}/c3000000-0000-4000-8000-000000000003.jpg`; owned(old);
    expect(await setEventBanner(eventId, null)).toMatchObject({ ok: true, message: "Banner removed." });
    expect(m.download).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith("set_event_banner", { p_event_id: eventId, p_path: null });
    expect(m.remove).toHaveBeenCalledWith([old]);
  });
});
