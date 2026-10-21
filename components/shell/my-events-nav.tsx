"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { eventIdFromPath, eventSectionHref, eventSections, isActiveEventSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export type SidebarEvent = { id: string; title: string; status: string };
const stateLabel: Record<string, string> = { draft: "Draft", completed: "Completed", cancelled: "Cancelled" };

/**
 * MY EVENTS in the Organizer sidebar: a short list of the Organizer's own events (already chosen
 * and authorized on the server), each expanding to its sections. The event open in the URL is
 * expanded and highlighted. In the collapsed rail each event becomes a flyout menu.
 */
export function MyEventsNav({ events, more, path, compact, onNavigate }: { events: SidebarEvent[]; more: boolean; path: string; compact: boolean; onNavigate: () => void }) {
  const activeId = eventIdFromPath(path);
  const [open, setOpen] = useState(true);
  // The event in the URL starts expanded (also after client-side navigation); a toggle overrides that.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const shown = (id: string) => toggled[id] ?? id === activeId;
  const toggle = (id: string) => setToggled(current => ({ ...current, [id]: !shown(id) }));

  if (compact) return <div className="mt-5 space-y-1 border-t pt-4">
    <p className="sr-only">My events</p>
    {events.map(e => <EventFlyout key={e.id} event={e} path={path} active={e.id === activeId} onNavigate={onNavigate} />)}
  </div>;

  return <div className="mt-5 border-t pt-4">
    <div className="flex items-center gap-1 pr-1"><button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="sidebar-my-events" className="flex min-w-0 flex-1 items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
      My events<ChevronRightIcon className={cn("size-3.5 motion-safe:transition-transform", open && "rotate-90")} aria-hidden="true" />
    </button>{more && <Link href="/organizer/events" onClick={onNavigate} aria-label="View all my events" className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-orange-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">View all</Link>}</div>
    {open && <div id="sidebar-my-events" className="mt-1 space-y-0.5">
      {events.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No events yet.</p>}
      <ul className="space-y-0.5">{events.map(e => {
        const active = e.id === activeId;
        const sections = `sidebar-event-${e.id}`;
        return <li key={e.id}>
          <div className={cn("flex items-center rounded-md", active && "bg-accent/60")}>
            <button type="button" onClick={() => toggle(e.id)} aria-expanded={shown(e.id)} aria-controls={sections} aria-label={`${shown(e.id) ? "Collapse" : "Expand"} ${e.title}`} className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              <ChevronRightIcon className={cn("size-3.5 motion-safe:transition-transform", shown(e.id) && "rotate-90")} aria-hidden="true" />
            </button>
            <Link href={eventSectionHref(e.id, "")} onClick={onNavigate} title={e.title} className={cn("flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md pr-2 text-sm focus-visible:outline-2 focus-visible:outline-ring", active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <span className="truncate">{e.title}</span>
              {stateLabel[e.status] && <span className="shrink-0 rounded border px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{stateLabel[e.status]}</span>}
            </Link>
          </div>
          {shown(e.id) && <ul id={sections} aria-label={e.title} className="mb-1 ml-[1.125rem] space-y-0.5 border-l pl-3">
            {eventSections.map(s => {
              const current = isActiveEventSection(path, e.id, s.segment);
              return <li key={s.label}><Link href={eventSectionHref(e.id, s.segment)} onClick={onNavigate} aria-current={current ? "page" : undefined} className={cn("flex min-h-8 items-center rounded-md px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring", current ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{s.label}</Link></li>;
            })}
          </ul>}
        </li>;
      })}</ul>
    </div>}
  </div>;
}

function EventFlyout({ event: e, path, active, onNavigate }: { event: SidebarEvent; path: string; active: boolean; onNavigate: () => void }) {
  const trigger = <DropdownMenuTrigger aria-label={`${e.title} sections`} className={cn("flex min-h-11 w-full items-center justify-center rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring", active ? "bg-background text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
    <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md border bg-background">{e.title.trim().slice(0, 1).toUpperCase() || "E"}</span>
  </DropdownMenuTrigger>;
  return <DropdownMenu>
    <Tooltip><TooltipTrigger render={trigger}>{trigger.props.children}</TooltipTrigger><TooltipContent side="right">{e.title}</TooltipContent></Tooltip>
    <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
      <DropdownMenuGroup>
        <DropdownMenuLabel className="truncate">{e.title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {eventSections.map(s => <DropdownMenuItem key={s.label} render={<Link href={eventSectionHref(e.id, s.segment)} onClick={onNavigate} aria-current={isActiveEventSection(path, e.id, s.segment) ? "page" : undefined} />}>{s.label}</DropdownMenuItem>)}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
