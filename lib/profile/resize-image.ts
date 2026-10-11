/** Client-side photo resize for avatars (SYSTEM_SPEC §14: 512 px, ≤ 2 MB, jpeg/png/webp). */

export const AVATAR_MAX_EDGE = 512;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Generous limit for the original file; it is resized before upload.
export const AVATAR_MAX_INPUT_BYTES = 15 * 1024 * 1024;

export type ResizedImage = { blob: Blob; extension: "webp" | "jpg" };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Scales the image so its longer edge is at most 512 px and encodes WEBP (JPEG if unsupported). */
export async function resizeAvatar(file: File): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff"; // flatten transparency (JPEG has no alpha)
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", 0.85);
  if (webp && webp.type === "image/webp") return { blob: webp, extension: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("The photo could not be processed.");
  return { blob: jpeg, extension: "jpg" };
}
