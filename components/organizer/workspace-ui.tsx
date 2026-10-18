import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const cols: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-1 sm:grid-cols-3", 4: "grid-cols-2 lg:grid-cols-4" };
/** One row of real figures, divided by hairlines rather than separate cards (2–4 items). */
export function StatStrip({ items, className }: { items: { label: string; value: ReactNode; hint?: string }[]; className?: string }) {
  return <dl className={cn("grid gap-px overflow-hidden rounded-lg border bg-border", cols[items.length] ?? "grid-cols-2", className)}>{items.map(item =>
    <div key={item.label} className="bg-background px-4 py-3">
      <dt className="text-xs text-muted-foreground">{item.label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{item.value}</dd>
      {item.hint && <dd className="mt-0.5 text-xs text-muted-foreground">{item.hint}</dd>}
    </div>)}</dl>;
}

/** Section within a workspace tab: small heading, optional description and trailing action. */
export function WorkspaceSection({ title, description, action, children, className }: { title: string; description?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <section aria-labelledby={id} className={cn("space-y-3", className)}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0 space-y-0.5"><h2 id={id} className="text-base font-semibold">{title}</h2>{description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action}</div>
    {children}
  </section>;
}

/** Shared table frame: horizontal scroll on narrow screens, consistent header styling. */
export function DataFrame({ children, label }: { children: ReactNode; label: string }) {
  return <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[40rem] text-left text-sm"><caption className="sr-only">{label}</caption>{children}</table></div>;
}
export const th = "border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground";
export const td = "border-b px-4 py-3 align-top group-last:border-b-0";

/** Previous/next pagination; renders nothing when everything fits on one page. */
export function Pager({ label, from, shown, total, prev, next }: { label: string; from: number; shown: number; total: number; prev?: string; next?: string }) {
  if (!prev && !next) return null;
  const link = "inline-flex h-8 items-center rounded-md border px-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return <nav aria-label={label} className="flex items-center justify-between gap-4 text-sm">
    <span className="text-muted-foreground tabular-nums">{from + 1}–{from + shown} of {total}</span>
    <span className="flex gap-2">{prev && <Link className={link} href={prev}>Previous</Link>}{next && <Link className={link} href={next}>Next</Link>}</span>
  </nav>;
}

/** Native disclosure for secondary row actions (e.g. audited corrections), keyboard accessible without JS. */
export function RowActions({ label, children }: { label: string; children: ReactNode }) {
  return <details className="group/details">
    <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-md border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">{label}</summary>
    <div className="mt-2 grid gap-3 rounded-md border bg-muted/30 p-3">{children}</div>
  </details>;
}
