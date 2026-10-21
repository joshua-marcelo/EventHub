"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { saveLookup } from "@/lib/lookups/actions";
import type { LookupData } from "@/lib/lookups/queries";
import type { LookupInput, LookupKind } from "@/lib/validation/lookup";

const titles: Record<LookupKind, string> = { colleges: "Colleges", programs: "Programs", event_categories: "Event Categories" };
const empty: Record<LookupKind, string> = { colleges: "No colleges yet. Add the official colleges first; programs belong to a college.", programs: "No programs for this selection yet.", event_categories: "No event categories yet." };
const hints: Record<LookupKind, string> = { colleges: "Shown in student onboarding and as event host colleges.", programs: "Each program belongs to one college.", event_categories: "Shown when organizers create events, in display order." };
const singular: Record<LookupKind, string> = { colleges: "college", programs: "program", event_categories: "category" };
const selectClass = "h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export function LookupManager({ data }: { data: LookupData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<LookupInput | null>(null);
  const [college, setCollege] = useState("");
  const [pending, setPending] = useState(false);
  const rows: Record<LookupKind, LookupInput[]> = {
    colleges: data.colleges.map(row => ({ ...row, kind: "colleges" })),
    programs: data.programs.filter(row => !college || row.college_id === Number(college)).map(row => ({ ...row, kind: "programs" })),
    event_categories: data.event_categories.map(row => ({ ...row, kind: "event_categories" })),
  };
  function add(kind: LookupKind) {
    const common = { id: null, name: "", is_active: true };
    setEditing(kind === "colleges" ? { ...common, kind, code: `CL-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}` } : kind === "programs" ? { ...common, kind, college_id: Number(college) || data.colleges.find(c => c.is_active)?.id || 0 } : { ...common, kind, slug: "", sort_order: 0 });
  }
  async function toggle(row: LookupInput) {
    setPending(true);
    try {
      const result = await saveLookup({ ...row, is_active: !row.is_active });
      if (!result.ok) toast.error(result.error);
      else { toast.success(result.message); router.refresh(); }
      return result.ok;
    } finally {
      setPending(false);
    }
  }
  function columns(kind: LookupKind): Column<LookupInput>[] {
    const fields: Column<LookupInput>[] = [{ key: "name", label: "Name", render: row => <div className="space-y-1.5"><span className="block max-w-sm whitespace-normal font-medium">{row.name}</span><div className="sm:hidden"><StatusBadge status={row.is_active ? "active" : "inactive"} /></div></div> }];
    if (kind === "programs") fields.push({ key: "college", label: "College", className: "hidden sm:table-cell", render: row => row.kind === "programs" ? <span className="block max-w-64 whitespace-normal text-muted-foreground">{data.colleges.find(c => c.id === row.college_id)?.name}</span> : null });
    if (kind === "event_categories") fields.push({ key: "slug", label: "Slug", className: "hidden sm:table-cell", render: row => row.kind === "event_categories" ? <span className="font-mono text-xs text-muted-foreground">{row.slug}</span> : null }, { key: "order", label: "Order", className: "hidden md:table-cell", render: row => row.kind === "event_categories" ? <span className="tabular-nums">{row.sort_order}</span> : null });
    fields.push({ key: "status", label: "Status", className: "hidden sm:table-cell", render: row => <StatusBadge status={row.is_active ? "active" : "inactive"} /> }, {
      key: "actions", label: "Actions", className: "text-right", render: row => <div className="flex items-center justify-end gap-2"><Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(row)} aria-label={`Edit ${row.name}`}>Edit</Button><ConfirmDialog trigger={row.is_active ? "Deactivate" : "Activate"} title={`${row.is_active ? "Deactivate" : "Activate"} ${row.name}?`} description={row.is_active ? "This entry will disappear from new selections. Existing records will keep their values." : "This entry will be available for selection again."} confirmLabel={row.is_active ? "Deactivate" : "Activate"} pending={pending} onConfirm={() => toggle(row)} /></div>,
    });
    return fields;
  }
  return <>
    <Tabs defaultValue="colleges">
      <TabsList aria-label="Reference data types">{(Object.keys(titles) as LookupKind[]).map(kind => <TabsTrigger key={kind} value={kind}>{titles[kind]}<span className="ml-1 text-xs tabular-nums text-muted-foreground">{data[kind].length}</span></TabsTrigger>)}</TabsList>
      {(Object.keys(titles) as LookupKind[]).map(kind => <TabsContent key={kind} value={kind} className="space-y-4 pt-4"><div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0">{kind === "programs" ? <div className="w-64 max-w-full space-y-2"><Label htmlFor="filter-college">Filter by college</Label><select id="filter-college" value={college} onChange={e => setCollege(e.target.value)} className={selectClass}><option value="">All colleges</option>{data.colleges.map(c => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (inactive)" : ""}</option>)}</select></div> : <><h2 className="font-semibold">{titles[kind]}</h2><p className="text-sm text-muted-foreground">{hints[kind]}</p></>}</div><Button onClick={() => add(kind)} disabled={pending || (kind === "programs" && !data.colleges.some(c => c.is_active))}><PlusIcon aria-hidden="true" />Add {singular[kind]}</Button></div>{kind === "programs" && !data.colleges.some(c => c.is_active) && <p className="text-sm text-muted-foreground">Add or activate a college before adding programs.</p>}<DataTable caption={titles[kind]} columns={columns(kind)} rows={rows[kind]} rowKey={row => row.id!} empty={empty[kind]} /></TabsContent>)}
    </Tabs>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} {editing ? singular[editing.kind] : "entry"}</DialogTitle><DialogDescription>Changes apply to future selections. Entries are retained for existing records.</DialogDescription></DialogHeader>{editing && <LookupForm key={`${editing.kind}-${editing.id}`} entry={editing} colleges={data.colleges} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}</DialogContent></Dialog>
  </>;
}

const fieldHints: Partial<Record<string, string>> = { slug: "Lowercase letters, numbers and hyphens, e.g. academic-forum.", sort_order: "Lower numbers appear first." };

function LookupForm({ entry, colleges, onSaved, onCancel }: { entry: LookupInput; colleges: LookupData["colleges"]; onSaved: () => void; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const common = { kind: entry.kind, id: entry.id, name: form.get("name"), is_active: form.get("is_active") === "on" };
    const input = entry.kind === "colleges" ? { ...common, code: entry.code } : entry.kind === "programs" ? { ...common, college_id: entry.id ? entry.college_id : Number(form.get("college_id")) } : { ...common, slug: form.get("slug"), sort_order: Number(form.get("sort_order")) };
    setError(""); setErrors({});
    startTransition(async () => {
      const result = await saveLookup(input);
      if (!result.ok) { setError(result.error); setErrors(result.fieldErrors ?? {}); }
      else { toast.success(result.message); onSaved(); }
    });
  }
  function field(name: "name" | "slug" | "sort_order", label: string, value: string | number, maxLength?: number) {
    return <div className="space-y-2"><Label htmlFor={`lookup-${name}`}>{label}</Label><Input id={`lookup-${name}`} name={name} defaultValue={value} required maxLength={maxLength} type={name === "sort_order" ? "number" : "text"} min={name === "sort_order" ? -32768 : undefined} max={name === "sort_order" ? 32767 : undefined} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : fieldHints[name] ? `hint-${name}` : undefined} />{errors[name] ? <p id={`error-${name}`} className="text-sm text-destructive">{errors[name]}</p> : fieldHints[name] && <p id={`hint-${name}`} className="text-xs text-muted-foreground">{fieldHints[name]}</p>}</div>;
  }
  return <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{field("name", "Name", entry.name, entry.kind === "colleges" ? 150 : entry.kind === "programs" ? 120 : 60)}{entry.kind === "programs" && <div className="space-y-2"><Label htmlFor="lookup-college">College</Label><select id="lookup-college" name="college_id" defaultValue={entry.college_id || ""} disabled={entry.id !== null} required className={selectClass}><option value="" disabled>Choose a college</option>{colleges.filter(c => c.is_active || c.id === entry.college_id).map(c => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (inactive)" : ""}</option>)}</select>{entry.id && <p className="text-xs text-muted-foreground">A program cannot move to another college.</p>}</div>}{entry.kind === "event_categories" && <>{field("slug", "Slug", entry.slug)}{field("sort_order", "Display order", entry.sort_order)}</>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={entry.is_active} className="size-4 accent-primary" />Active</label></fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save entry"}</Button></div></form>;
}
