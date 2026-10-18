"use client";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { segment: null, label: "Overview" },
  { segment: "registrations", label: "Registrations" },
  { segment: "attendance", label: "Attendance" },
  { segment: "certificates", label: "Certificates" },
  { segment: "reports", label: "Reports" },
  { segment: "settings", label: "Settings" },
] as const;

/** Route-backed tabs: each tab is its own URL, so history, deep links and server rendering keep working. */
export function WorkspaceTabs({ eventId }: { eventId: string }) {
  const current = useSelectedLayoutSegment();
  return <nav aria-label="Event sections" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
    <ul className="flex min-w-max gap-1">{tabs.map(tab => {
      const active = current === tab.segment;
      return <li key={tab.label}><Link href={`/organizer/events/${eventId}${tab.segment ? `/${tab.segment}` : ""}`} aria-current={active ? "page" : undefined}
        className={cn("-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>{tab.label}</Link></li>;
    })}</ul>
  </nav>;
}
