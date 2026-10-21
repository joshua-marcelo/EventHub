"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { attendanceLabel, registrationLabel, type MyRegistration } from "@/lib/participant/labels";
import { cn } from "@/lib/utils";

/**
 * MY REGISTERED EVENTS in the Participant sidebar: the account's own registrations (read on the
 * server), each expanding to its real registration and attendance status and a link to the event.
 */
export function MyRegistrationsNav({ registrations, path, compact, onNavigate }: { registrations: MyRegistration[]; path: string; compact: boolean; onNavigate: () => void }) {
  const listId = useId();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const current = (r: MyRegistration) => path === `/events/${r.eventId}`;

  if (compact) return <div className="mt-5 space-y-1 border-t pt-4">
    <p className="sr-only">My registered events</p>
    {registrations.map(r => {
      const link = <Link href={`/events/${r.eventId}`} onClick={onNavigate} aria-label={r.title} aria-current={current(r) ? "page" : undefined} className={cn("flex min-h-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-ring", current(r) ? "bg-background shadow-xs ring-1 ring-border" : "hover:bg-accent")}><span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md border bg-background text-xs font-semibold">{r.title.trim().slice(0, 1).toUpperCase() || "E"}</span></Link>;
      return <Tooltip key={r.id}><TooltipTrigger render={link}>{link.props.children}</TooltipTrigger><TooltipContent side="right">{r.title}</TooltipContent></Tooltip>;
    })}
  </div>;

  return <div className="mt-5 border-t pt-4">
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls={listId} className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
      My registered events<ChevronRightIcon className={cn("size-3.5 motion-safe:transition-transform", open && "rotate-90")} aria-hidden="true" />
    </button>
    {open && <ul id={listId} className="mt-1 space-y-0.5">
      {!registrations.length && <li className="px-3 py-2 text-sm text-muted-foreground">No registrations yet.</li>}
      {registrations.map(r => {
        const shown = expanded === r.id || (expanded === null && current(r));
        const details = `${listId}-${r.id}`;
        return <li key={r.id}>
          <button type="button" onClick={() => setExpanded(shown ? "" : r.id)} aria-expanded={shown} aria-controls={details} title={r.title}
            className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring", current(r) ? "bg-accent/60 font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <ChevronRightIcon className={cn("size-3.5 shrink-0 motion-safe:transition-transform", shown && "rotate-90")} aria-hidden="true" />
            <span className="truncate">{r.title}</span>
          </button>
          {shown && <div id={details} className="mb-1 ml-[1.125rem] space-y-1 border-l py-1 pl-3 text-xs">
            <p><span className="text-muted-foreground">Registration: </span><span className={r.status === "approved" ? "font-medium text-emerald-800" : r.status === "rejected" ? "font-medium text-amber-900" : "font-medium"}>{registrationLabel[r.status]}</span></p>
            <p><span className="text-muted-foreground">Attendance: </span><span className={r.attendance === "present" ? "font-medium text-emerald-800" : "font-medium"}>{attendanceLabel(r.attendance)}</span></p>
            <Link href={`/events/${r.eventId}`} onClick={onNavigate} className="inline-flex min-h-8 items-center font-medium text-orange-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Event details</Link>
          </div>}
        </li>;
      })}
    </ul>}
  </div>;
}
