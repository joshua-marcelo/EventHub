import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
// `className` applies to the column's header and cells (e.g. `hidden md:table-cell` on narrow screens).
export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string };
export function DataTable<T>({ rows, columns, rowKey, caption, empty = "No entries yet." }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string | number; caption: string; empty?: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border bg-card"><Table><caption className="sr-only">{caption}</caption><TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40">{columns.map(c => <TableHead key={c.key} scope="col" className={cn("h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground", c.className)}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map(row => <TableRow key={rowKey(row)}>{columns.map(c => <TableCell key={c.key} className={cn("px-4 py-3", c.className)}>{c.render(row)}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">{empty}</TableCell></TableRow>}</TableBody></Table></div>;
}
