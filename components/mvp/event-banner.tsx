import Image from "next/image";
import { CalendarDaysIcon } from "lucide-react";
import { bannerUrl } from "@/lib/mvp/banner";
import { cn } from "@/lib/utils";

/** 16:9 event banner with a neutral calendar fallback. Decorative: the event title is always nearby. */
export function EventBanner({ path, src, className, sizes = "(min-width: 1024px) 640px, 100vw" }: { path?: string | null; src?: string | null; className?: string; sizes?: string }) {
  const url = src ?? bannerUrl(path);
  return <div className={cn("relative aspect-video w-full overflow-hidden rounded-lg border bg-muted", className)}>
    {url
      ? <Image src={url} alt="" fill unoptimized sizes={sizes} className="object-cover" />
      : <div className="flex h-full items-center justify-center text-muted-foreground/70"><CalendarDaysIcon className="size-8" strokeWidth={1.5} aria-hidden="true" /></div>}
  </div>;
}
