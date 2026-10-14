import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

/** One overview metric. Links to the module it summarizes; `highlight` marks work waiting for review. */
export function StatCard({ label, value, hint, icon: Icon, href, highlight = false }: { label: string; value: number; hint: string; icon: Icon; href?: string; highlight?: boolean }) {
  const body = <>
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", highlight ? "bg-orange-50 text-orange-800" : "bg-muted text-slate-700")}><Icon className="size-4" aria-hidden="true" /></span>
    </div>
    <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value.toLocaleString("en-PH")}</p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </>;
  const card = cn("block rounded-lg border bg-card p-4", highlight && "border-orange-200");
  return href
    ? <Link href={href} className={cn(card, "transition-colors hover:border-slate-300 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}>{body}</Link>
    : <div className={card}>{body}</div>;
}

/** A bordered section with a title row; rows inside are divided, never nested cards. */
export function Panel({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border bg-card", className)} aria-label={title}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <div className="min-w-0"><h2 className="font-semibold">{title}</h2>{description && <p className="text-xs text-muted-foreground">{description}</p>}</div>
      {action}
    </div>
    {children}
  </section>;
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-orange-800 underline-offset-4 hover:underline">{children}<ArrowRightIcon className="size-3.5" aria-hidden="true" /></Link>;
}

/** Compact empty state for use inside a panel or table. */
export function PanelEmpty({ icon: Icon, title, description }: { icon: Icon; title: string; description: string }) {
  return <div className="flex flex-col items-center px-4 py-10 text-center">
    <Icon className="mb-3 size-6 text-muted-foreground" aria-hidden="true" />
    <p className="text-sm font-medium">{title}</p>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  </div>;
}

/** Status filter rendered as links (server-side filtering through `?status=`). */
export function FilterTabs({ label, options, current }: { label: string; options: { value: string; label: string; count: number; href: string }[]; current: string }) {
  return <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
    {options.map(o => <Link key={o.value} href={o.href} aria-current={o.value === current ? "page" : undefined} className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", o.value === current ? "border-slate-900 bg-slate-900 text-white" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {o.label}<span className={cn("tabular-nums text-xs", o.value === current ? "text-slate-300" : "text-muted-foreground")}>{o.count}</span>
    </Link>)}
  </nav>;
}

/** Initials avatar for people lists. */
export function Initials({ name }: { name: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("") || "?";
  return <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700" aria-hidden="true">{letters}</span>;
}

export function fullName(person: { first_name: string | null; last_name: string | null } | null | undefined) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(" ") || "Name not set";
}
