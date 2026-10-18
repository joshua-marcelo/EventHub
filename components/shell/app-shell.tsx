"use client";

import { useState, type ReactNode, type ReactElement } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AwardIcon, BadgeCheckIcon, CalendarDaysIcon, DatabaseIcon, HomeIcon, MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, ScanLineIcon, UsersIcon, ChartNoAxesColumnIcon } from "lucide-react";
import { AccountMenu } from "@/components/shell/account-menu";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { dashboards, navigation, dashboardForPath, isActiveLink, isAttendanceDisplay, permittedDashboards, resolveWorkspaceContext, isSharedAccountPath, type Permissions } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const icons = { home: HomeIcon, events: CalendarDaysIcon, certificates: AwardIcon, people: UsersIcon, reports: ChartNoAxesColumnIcon, organizers: BadgeCheckIcon, reference: DatabaseIcon };
export type ShellUser = Permissions & { name: string; email: string };

export function AppShell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const path = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const contexts = params.getAll("workspace");
  const current = user && isSharedAccountPath(path)
    ? resolveWorkspaceContext(user, contexts.length === 1 ? contexts[0] : undefined)
    : dashboardForPath(path);
  const permitted = user ? permittedDashboards(user) : [];
  if (isAttendanceDisplay(path)) return <main id="main-content" className="min-h-svh">{children}</main>;

  const nav = (compact = false) => <div className="flex min-h-full flex-col">
    <p className={cn("mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground", compact && "sr-only")}>{dashboards[current].label} workspace</p>
    <nav aria-label={`${dashboards[current].label} navigation`} className="space-y-1">
      {navigation[current].map(item => {
        const Icon = icons[item.icon];
        const active = isActiveLink(path, item.href);
        return <SidebarTooltip key={item.href} label={item.label} enabled={compact}><Link href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", compact && "min-h-11 justify-center px-0", active ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-accent hover:text-foreground")}><Icon className={cn("size-4 shrink-0", active && "text-orange-800")} aria-hidden="true" /><span className={compact ? "sr-only" : "whitespace-nowrap"}>{item.label}</span></Link></SidebarTooltip>;
      })}
    </nav>
    {permitted.length > 1 && <div className="mt-auto border-t pt-4"><WorkspaceSwitcher current={current} permitted={permitted} compact={compact} onSelect={() => setOpen(false)} /></div>}
  </div>;
  return <div className={cn("min-h-svh", user && current === "participant" && "bg-[#FAF9F6]")}>
    <a href="#main-content" className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-2">Skip to content</a>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        {user && <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}><MenuIcon /></SheetTrigger>
          <SheetContent side="left" className="w-72"><SheetHeader><SheetTitle>EventHub</SheetTitle><SheetDescription>Your campus. Your events.</SheetDescription></SheetHeader><div className="flex flex-1 flex-col overflow-y-auto px-4 pb-6">{nav()}</div></SheetContent>
        </Sheet>}
        <Link href={user ? dashboards[current].href : "/dashboard"} aria-label="EventHub home" className="shrink-0"><BrandLogo className="w-28" sizes="118px" /></Link>
        {user && <Button type="button" variant="ghost" size="icon" className="hidden size-9 shrink-0 md:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-sidebar" onClick={() => setCollapsed(value => !value)}>
          {collapsed ? <PanelLeftOpenIcon aria-hidden="true" /> : <PanelLeftCloseIcon aria-hidden="true" />}
        </Button>}
      </div>
      {user ? <div className="flex items-center gap-2">
        {current === "participant" && <TooltipProvider><Tooltip><TooltipTrigger render={<Link href="/scan" aria-label="Scan event QR code" className="flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-orange-50 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" />}><ScanLineIcon className="size-5" aria-hidden="true" /></TooltipTrigger><TooltipContent side="bottom">Scan event QR code</TooltipContent></Tooltip></TooltipProvider>}
        <AccountMenu name={user.name} email={user.email} dashboard={current} />
      </div> : <Link href="/login" className="text-sm font-medium">Log in</Link>}
    </header>
    <div className="flex">
      {user && <aside id="desktop-sidebar" aria-label={`${dashboards[current].label} sidebar`} className={cn("sticky top-16 hidden h-[calc(100svh-4rem)] shrink-0 overflow-y-auto border-r bg-sidebar motion-safe:transition-[width,padding] motion-safe:duration-[225ms] motion-safe:ease-in-out md:block", collapsed ? "w-18 p-3" : "w-60 p-4")}>{nav(collapsed)}</aside>}
      <main id="main-content" tabIndex={-1} className={cn("mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 outline-none motion-safe:transition-[max-width] motion-safe:duration-[225ms] motion-safe:ease-in-out md:px-8", collapsed && "md:max-w-[82.5rem]", user && current === "participant" && "pb-24 md:pb-8")}>{children}</main>
    </div>
    {user && current === "participant" && <nav aria-label="Participant quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">{navigation.participant.map(item => { const Icon = icons[item.icon]; return <Link key={item.href} href={item.href} aria-current={isActiveLink(path, item.href) ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs focus-visible:outline-2 focus-visible:outline-ring", isActiveLink(path, item.href) ? "bg-accent font-semibold" : "text-muted-foreground")}><Icon className="size-5" aria-hidden="true" />{item.label}</Link>; })}</nav>}
  </div>;
}

/** Portal tooltips remain visible outside the narrow, scrollable rail. */
function SidebarTooltip({ enabled, label, children }: { enabled: boolean; label: string; children: ReactElement<{ children?: ReactNode }> }) {
  if (!enabled) return children;
  return <Tooltip><TooltipTrigger render={children}>{children.props.children}</TooltipTrigger><TooltipContent side="right" className="motion-reduce:animate-none">{label}</TooltipContent></Tooltip>;
}
