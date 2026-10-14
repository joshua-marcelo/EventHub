// Generates the PWA and Apple touch icons from the calendar mark in the EventHub logo.
// Uses the `sharp` that ships with Next.js; no extra dependency. Re-run after a logo change:
//   node scripts/generate-pwa-icons.mjs
import { createRequire } from "node:module";

const sharp = createRequire(import.meta.url)("sharp");

const LOGO = "public/images/eventhub-logo.png";
// The calendar mark inside the 2172×724 logo, measured from its alpha channel (the wordmark
// starts at x=614). Re-measure if the artwork changes.
const MARK = { left: 54, top: 130, width: 526, height: 420 };
const BACKGROUND = "#faf9f6"; // Landing page background; matches the manifest background_color.

/** Renders the mark centered on a square canvas, scaled to `fill` of the canvas width. */
async function render(file, size, { fill, background }) {
  const width = Math.round(size * fill);
  const mark = await sharp(LOGO).extract(MARK).resize({ width, kernel: "lanczos3" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mark, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${file}`);
}

// "any" icons: transparent, the mark nearly edge to edge.
await render("public/icons/icon-192.png", 192, { fill: 0.9 });
await render("public/icons/icon-512.png", 512, { fill: 0.9 });
// Maskable icons: opaque, and the mark's diagonal (673px at 526×420) stays inside the 80%
// safe-zone circle, so launchers can crop to any shape without clipping it.
await render("public/icons/maskable-192.png", 192, { fill: 0.6, background: BACKGROUND });
await render("public/icons/maskable-512.png", 512, { fill: 0.6, background: BACKGROUND });
// iOS fills transparency with black, so the touch icon is opaque. Next.js links it automatically.
await render("app/apple-icon.png", 180, { fill: 0.78, background: BACKGROUND });
