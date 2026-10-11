import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode };
export function DataTable<T>({ rows, columns, rowKey, caption }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string | number; caption: string }) {
  return <div className="overflow-hidden rounded-lg border"><Table><caption className="sr-only">{caption}</caption><TableHeader><TableRow>{columns.map(c => <TableHead key={c.key} scope="col">{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length ? rows.map(row => <TableRow key={rowKey(row)}>{columns.map(c => <TableCell key={c.key}>{c.render(row)}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">No entries yet.</TableCell></TableRow>}</TableBody></Table></div>;
}
