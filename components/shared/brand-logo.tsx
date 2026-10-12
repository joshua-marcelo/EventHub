import Image from "next/image";

import { cn } from "@/lib/utils";
// A static import gives the logo a content-hashed URL, so replacing the file can never be
// served from a stale optimized-image cache entry (the old logo persisted for hours).
import logo from "@/public/images/eventhub-logo.png";

// Visible artwork inside the 2172×724 PNG, measured from its alpha channel. The file has
// transparent margins (about 18% above, 24% below), so the frame shows only the artwork;
// nothing but transparent pixels falls outside it. Re-measure if the artwork changes.
const ART = { left: 54, top: 130, width: 2072, height: 420 };

/** EventHub wordmark. Set the rendered width with `className` (for example `w-36`). */
export function BrandLogo({ className, sizes, preload = false }: { className?: string; sizes: string; preload?: boolean }) {
  return (
    <span className={cn("relative block overflow-hidden", className)} style={{ aspectRatio: `${ART.width} / ${ART.height}` }}>
      <Image
        src={logo}
        alt="EventHub"
        sizes={sizes}
        preload={preload}
        className="absolute h-auto max-w-none"
        style={{ width: `${(logo.width / ART.width) * 100}%`, left: `${(-ART.left / ART.width) * 100}%`, top: `${(-ART.top / ART.height) * 100}%` }}
      />
    </span>
  );
}
