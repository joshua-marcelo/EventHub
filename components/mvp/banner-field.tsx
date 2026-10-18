"use client";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, ImageUpIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BANNER_TYPES, bannerFileError, detectImageType } from "@/lib/mvp/banner";

/** Pending banner change: a newly chosen file, a removal of the saved banner, or nothing. */
export type BannerChange = { kind: "none" } | { kind: "file"; file: File; preview: string } | { kind: "remove" };

export function BannerField({ currentUrl, value, onChange, disabled }: { currentUrl: string | null; value: BannerChange; onChange: (value: BannerChange) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  // Release the local preview URL once this selection is replaced or the field unmounts.
  useEffect(() => value.kind === "file" ? () => URL.revokeObjectURL(value.preview) : undefined, [value]);
  const shown = value.kind === "file" ? value.preview : value.kind === "remove" ? null : currentUrl;

  async function choose(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    const problem = bannerFileError(file);
    if (problem) { setError(problem); return; }
    // Check the real format, not just the browser-reported type (the server checks again).
    if (detectImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer())) !== file.type) { setError("This file is not a valid JPG, PNG or WEBP image."); return; }
    setError(""); onChange({ kind: "file", file, preview: URL.createObjectURL(file) });
  }

  return <section aria-labelledby="banner-heading" className="space-y-3">
    <div><h2 id="banner-heading" className="text-sm font-medium">Event banner <span className="font-normal text-muted-foreground">(optional)</span></h2><p className="text-xs text-muted-foreground">Shown on event cards and the event page.</p></div>
    <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
      {shown
        // eslint-disable-next-line @next/next/no-img-element -- local object URLs and Storage URLs, displayed as-is
        ? <img src={shown} alt="Selected event banner preview" className="h-full w-full object-cover" />
        : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><ImageIcon className="size-7" strokeWidth={1.5} aria-hidden="true" /><span className="text-sm">No banner uploaded</span></div>}
    </div>
    <input ref={input} type="file" accept={Object.keys(BANNER_TYPES).join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => void choose(e.target.files?.[0])} disabled={disabled} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={disabled}><ImageUpIcon aria-hidden="true" />{shown ? "Replace image" : "Upload image"}</Button>
      {(shown || value.kind === "file") && <Button type="button" variant="ghost" size="sm" onClick={() => { setError(""); onChange(currentUrl && value.kind !== "remove" ? { kind: "remove" } : { kind: "none" }); }} disabled={disabled}><Trash2Icon aria-hidden="true" />Remove</Button>}
      {value.kind === "remove" && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ kind: "none" })} disabled={disabled}>Undo</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {value.kind !== "none" && !error && <p role="status" className="text-xs text-muted-foreground">{value.kind === "file" ? "New banner selected. It is uploaded when you save." : "The banner will be removed when you save."}</p>}
    <ul className="space-y-0.5 text-xs text-muted-foreground"><li>Recommended 1600 × 900 (16:9)</li><li>JPG, PNG or WEBP, up to 5 MB</li></ul>
  </section>;
}
