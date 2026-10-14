import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; Next.js adds the <link rel="manifest"> automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "EventHub",
    short_name: "EventHub",
    description:
      "QR-based event management, attendance, and digital certificates for the College Local Council of Wesleyan University–Philippines.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Landing page background and the navy (slate-900) of the hero panel and logo.
    background_color: "#faf9f6",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
