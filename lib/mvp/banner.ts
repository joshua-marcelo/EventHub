// Event banner rules shared by the browser upload, the server action and the display.
// The `event-banners` bucket enforces the same size and MIME limits at the Storage boundary.
export const BANNER_BUCKET = "event-banners";
export const BANNER_MAX_BYTES = 5 * 1024 * 1024;
export const BANNER_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type BannerType = keyof typeof BANNER_TYPES;

const EXTENSION_TYPES: Record<string, BannerType> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const PATH = /^([0-9a-f-]{36})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** Identifies JPG, PNG and WEBP from their file signatures, ignoring the client-supplied type. */
export function detectImageType(bytes: Uint8Array): BannerType | null {
  const at = (offset: number, ...values: number[]) => values.every((v, i) => bytes[offset + i] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** Quick checks before reading the file; returns a user-facing message or null. */
export function bannerFileError(file: { type: string; size: number }): string | null {
  if (!(file.type in BANNER_TYPES)) return "Use a JPG, PNG or WEBP image.";
  if (file.size === 0) return "This file is empty. Choose another image.";
  if (file.size > BANNER_MAX_BYTES) return "This image is larger than 5 MB. Choose a smaller file.";
  return null;
}

/** Stable, unguessable object name inside the event's own folder; never overwrites another file. */
export function newBannerPath(eventId: string, type: BannerType) {
  return `${eventId}/${crypto.randomUUID()}.${BANNER_TYPES[type]}`;
}

/** Accepts only paths produced by `newBannerPath` for this exact event. */
export function isBannerPath(eventId: string, path: string) {
  const match = PATH.exec(path);
  return match !== null && match[1] === eventId;
}

export function bannerTypeFromPath(path: string): BannerType | null {
  return EXTENSION_TYPES[path.split(".").pop() ?? ""] ?? null;
}

/** Public URL for a stored banner (the bucket is public; object names are unguessable). */
export function bannerUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BANNER_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
