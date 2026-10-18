"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEARCH_DEBOUNCE_MS, createDebouncer, nextDirectoryUrl } from "@/lib/admin/directory-filters";

const selectClass = "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Search (debounced) and College (immediate) for the Participants directory. Both only change the URL;
 * the server re-runs the filtered, paginated query. While a navigation is in flight the form carries
 * `data-pending`, which the results use to dim instead of showing stale rows as current.
 */
export function ParticipantFilters({ colleges }: { colleges: { id: number; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQ = searchParams.get("q") ?? "";
  const urlCollege = searchParams.get("college") ?? "";
  const [q, setQ] = useState(urlQ);
  const [typing, setTyping] = useState(false);
  const [seenQ, setSeenQ] = useState(urlQ);
  const [college, setCollege] = useState(urlCollege);
  const [seenCollege, setSeenCollege] = useState(urlCollege);
  // Back/Forward (or Clear) changed the URL: reflect it, but never overwrite a search being typed.
  if (urlQ !== seenQ) { setSeenQ(urlQ); if (!typing && urlQ !== q.trim()) setQ(urlQ); }
  if (urlCollege !== seenCollege) { setSeenCollege(urlCollege); setCollege(urlCollege); }

  function navigate(changes: { q?: string; college?: string }) {
    // Read the live URL so a debounced search never resurrects an older college or page.
    const url = nextDirectoryUrl(pathname, window.location.search, changes);
    if (url) startTransition(() => router.push(url, { scroll: false }));
  }
  const latest = useRef(navigate);
  useEffect(() => { latest.current = navigate; });
  const debouncer = useRef<ReturnType<typeof createDebouncer<[string]>> | null>(null);
  useEffect(() => {
    const d = createDebouncer((value: string) => { setTyping(false); latest.current({ q: value }); }, SEARCH_DEBOUNCE_MS);
    debouncer.current = d;
    return () => d.cancel();
  }, []);

  const active = Boolean(urlQ || urlCollege || q.trim() || college);

  return <form role="search" aria-label="Filter participants" data-pending={pending || undefined} onSubmit={e => { e.preventDefault(); debouncer.current?.cancel(); setTyping(false); navigate({ q }); }} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-end">
    <div className="grid gap-2">
      <Label htmlFor="participant-search">Search</Label>
      <div className="relative">
        {pending ? <LoaderCircleIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" /> : <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />}
        <Input id="participant-search" type="search" name="q" value={q} onChange={e => { setQ(e.target.value); setTyping(true); debouncer.current?.call(e.target.value); }} placeholder="Name, email or student ID" maxLength={80} autoComplete="off" aria-describedby="participant-search-hint" className="h-9 pl-8" />
      </div>
      <p id="participant-search-hint" className="sr-only">Results update as you type. Enter at least 2 characters.</p>
    </div>
    <div className="grid gap-2">
      <Label htmlFor="participant-college">College</Label>
      <select id="participant-college" name="college" value={college} onChange={e => { debouncer.current?.cancel(); setTyping(false); setCollege(e.target.value); navigate({ q, college: e.target.value }); }} className={selectClass}>
        <option value="">All colleges</option>
        {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
    {active
      ? <Button type="button" variant="ghost" className="h-9" onClick={() => { debouncer.current?.cancel(); setTyping(false); setQ(""); setCollege(""); navigate({ q: "", college: "" }); }}><XIcon aria-hidden="true" />Clear filters</Button>
      : <span aria-hidden="true" className="hidden sm:block" />}
  </form>;
}
