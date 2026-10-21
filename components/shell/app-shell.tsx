"use client";

import { useState, type ReactNode, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheckIcon, CalendarDaysIcon, CalendarPlusIcon, ClipboardCheckIcon, CompassIcon, DatabaseIcon, HomeIcon, LayoutDashboardIcon, MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, ScanLineIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { AccountMenu } from "@/components/shell/account-menu";
import { CurrentEventProvider, useCurrentEvent } from "@/components/shell/current-event";
import { MyEventsNav, type SidebarEvent } from "@/components/shell/my-events-nav";
import { MyRegistrationsNav } from "@/components/shell/my-registrations-nav";
import type { MyRegistration } from "@/lib/participant/labels";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { dashboards, navigation, navigationFor, eventIdFromPath, isActiveLink, isAttendanceDisplay, shellDashboard, type NavItem, type Permissions } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const icons: Record<NavItem["icon"], typeof HomeIcon> = { home: HomeIcon, dashboard: LayoutDashboardIcon, events: CalendarDaysIcon, explore: CompassIcon, attendance: ClipboardCheckIcon, people: UsersIcon, organizers: BadgeCheckIcon, reference: DatabaseIcon, admin: ShieldCheckIcon, scan: ScanLineIcon, create: CalendarPlusIcon };
export type ShellUser = Permissions & { name: string; email: string; avatarUrl?: string | null };
export type ShellEvents = { events: SidebarEvent[]; more: boolean };

export function AppShell({ user, myEvents = null, myRegistrations = null, children }: { user: ShellUser | null; myEvents?: ShellEvents | null; myRegistrations?: MyRegistration[] | null; children: ReactNode }) {
  return <CurrentEventProvider><TooltipProvider><Shell user={user} myEvents={myEvents} myRegistrations={myRegistrations}>{children}</Shell></TooltipProvider></CurrentEventProvider>;
}

function Shell({ user, myEvents, myRegistrations, children }: { user: ShellUser | null; myEvents: ShellEvents | null; myRegistrations: MyRegistration[] | null; children: ReactNode }) {
  const path = usePathname();
  const currentEvent = useCurrentEvent();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  if (isAttendanceDisplay(path)) return <main id="main-content" className="min-h-svh">{children}</main>;

  if (!user) return <div className="min-h-svh">
    <a href="#main-content" className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-2">Skip to content</a>
    <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
      <Link href="/" aria-label="EventHub home" className="shrink-0"><BrandLogo className="w-28" sizes="118px" /></Link>
      <Link href="/login" className="text-sm font-medium">Log in</Link>
    </header>
    <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 outline-none md:px-8">{children}</main>
  </div>;

  const current = shellDashboard(user, path);
  const close = () => setOpen(false);
  // The event open in the workspace (ownership verified by its layout) stays listed even when it is
  // not one of the few chosen for the sidebar.
  const events = current === "organizer" && myEvents ? withCurrent(myEvents.events, currentEvent && eventIdFromPath(path) === currentEvent.id ? currentEvent : null) : null;

  const link = (item: NavItem, compact: boolean) => {
    const Icon = icons[item.icon];
    const active = isActiveLink(path, item.href);
    return <SidebarTooltip key={item.href} label={item.label} enabled={compact}><Link href={item.href} onClick={close} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", compact && "min-h-11 justify-center px-0", active ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-accent hover:text-foreground")}><Icon className={cn("size-4 shrink-0", active && "text-orange-800")} aria-hidden="true" /><span className={compact ? "sr-only" : "whitespace-nowrap"}>{item.label}</span></Link></SidebarTooltip>;
  };

  const nav = (compact = false) => <div className="flex min-h-full flex-col">
    <nav aria-label={`${dashboards[current].label} navigation`} className="space-y-1">
      {navigationFor(user, current).map(item => link(item, compact))}
    </nav>

    {current === "participant" && myRegistrations && <MyRegistrationsNav registrations={myRegistrations} path={path} compact={compact} onNavigate={close} />}
    {events && <MyEventsNav events={events} more={myEvents!.more} path={path} compact={compact} onNavigate={close} />}
    <div className="mt-auto border-t pt-3"><AccountMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} dashboard={current} compact={compact} onNavigate={close} /></div>
  </div>;

  return <div className="min-h-svh bg-background md:flex">
    <a href="#main-content" className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-2">Skip to content</a>
    {/* Mobile only: a compact bar that keeps the menu reachable. Desktop has no top header. */}
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background px-4 md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="-ml-2 size-11" aria-label="Open menu" />}><MenuIcon /></SheetTrigger>
          <SheetContent side="left" className="w-72"><SheetHeader><SheetTitle>EventHub</SheetTitle><SheetDescription>Your campus. Your events.</SheetDescription></SheetHeader><div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">{nav()}</div></SheetContent>
        </Sheet>
        <Link href={dashboards[current].href} aria-label="EventHub home" className="shrink-0"><BrandLogo className="w-24" sizes="100px" /></Link>
      </div>

    </header>
    <aside id="desktop-sidebar" aria-label={`${dashboards[current].label} sidebar`} className={cn("sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar motion-safe:transition-[width] motion-safe:duration-[225ms] motion-safe:ease-in-out md:flex", collapsed ? "w-18" : "w-64")}>
      <div className={cn("flex h-14 shrink-0 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        {!collapsed && <Link href={dashboards[current].href} aria-label="EventHub home" className="mr-auto shrink-0"><BrandLogo className="w-28" sizes="118px" /></Link>}
        <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-sidebar" onClick={() => setCollapsed(value => !value)}>
          {collapsed ? <PanelLeftOpenIcon aria-hidden="true" /> : <PanelLeftCloseIcon aria-hidden="true" />}
        </Button>
      </div>
      <div className={"flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3"}>{nav(collapsed)}</div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <main id="main-content" tabIndex={-1} className={cn("mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 outline-none motion-safe:transition-[max-width] motion-safe:duration-[225ms] motion-safe:ease-in-out md:px-8", collapsed && "md:max-w-[82.5rem]", current === "participant" && "pb-24 md:pb-8")}>{children}</main>
    </div>
    {current === "participant" && <nav aria-label="Participant quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">{navigation.participant.map(item => { const Icon = icons[item.icon]; return <Link key={item.href} href={item.href} aria-current={isActiveLink(path, item.href) ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs focus-visible:outline-2 focus-visible:outline-ring", isActiveLink(path, item.href) ? "bg-accent font-semibold" : "text-muted-foreground")}><Icon className="size-5" aria-hidden="true" />{item.label}</Link>; })}</nav>}
  </div>;
}

function withCurrent(events: SidebarEvent[], current: { id: string; title: string } | null): SidebarEvent[] {
  if (!current || events.some(e => e.id === current.id)) return events;
  return [{ id: current.id, title: current.title, status: "" }, ...events];
}

/** Portal tooltips remain visible outside the narrow, scrollable rail. */
function SidebarTooltip({ enabled, label, children }: { enabled: boolean; label: string; children: ReactElement<{ children?: ReactNode }> }) {
  if (!enabled) return children;
  return <Tooltip><TooltipTrigger render={children}>{children.props.children}</TooltipTrigger><TooltipContent side="right" className="motion-reduce:animate-none">{label}</TooltipContent></Tooltip>;
}
