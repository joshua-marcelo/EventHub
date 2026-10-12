"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRightIcon, AwardIcon, CalendarDaysIcon, CompassIcon, HomeIcon, MenuIcon, QrCodeIcon, SettingsIcon, UsersIcon, ChartNoAxesColumnIcon, GraduationCapIcon } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-buttons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { dashboards, navigation, dashboardForPath, isActiveLink, isAttendanceDisplay, permittedDashboards, type Permissions } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/brand-logo";

const icons = { home: HomeIcon, explore: CompassIcon, scan: QrCodeIcon, events: CalendarDaysIcon, certificates: AwardIcon, organizer: GraduationCapIcon, people: UsersIcon, reports: ChartNoAxesColumnIcon, settings: SettingsIcon };
export type ShellUser = Permissions & { name: string; email: string };

export function AppShell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = dashboardForPath(path);
  const permitted = user ? permittedDashboards(user) : [];
  if (isAttendanceDisplay(path)) return <main id="main-content" className="min-h-svh">{children}</main>;

  const switcher = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}><ArrowLeftRightIcon aria-hidden="true" />{dashboards[current].label}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Switch dashboard</DropdownMenuLabel>
        {permitted.map(key => <DropdownMenuItem key={key} render={<Link href={dashboards[key].href} onClick={() => setOpen(false)} />} aria-current={key === current ? "page" : undefined}>{dashboards[key].label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const nav = <>
    <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{dashboards[current].label} workspace</p>
    <nav aria-label={`${dashboards[current].label} navigation`} className="space-y-1">
      {navigation[current].map(item => {
        const Icon = icons[item.icon];
        return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActiveLink(path, item.href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring", isActiveLink(path, item.href) ? "bg-accent font-medium text-foreground" : "text-muted-foreground")}><Icon className="size-4 shrink-0" aria-hidden="true" />{item.label}</Link>;
      })}
    </nav>
    {permitted.length > 1 && <nav aria-label="Other dashboards" className="mt-6 border-t pt-4">{permitted.filter(key => key !== current).map(key => <Link className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent" key={key} href={dashboards[key].href} onClick={() => setOpen(false)}><ArrowLeftRightIcon className="size-4" aria-hidden="true" />{dashboards[key].label}</Link>)}</nav>}
    <nav aria-label="Account" className="mt-6 space-y-2 border-t pt-4"><Link href="/profile" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-accent">Profile</Link><Link href="/privacy" className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">Privacy notice</Link></nav>
  </>;
  return <div className="min-h-svh">
    <a href="#main-content" className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-2">Skip to content</a>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        {user && <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}><MenuIcon /></SheetTrigger>
          <SheetContent side="left" className="w-72"><SheetHeader><SheetTitle>EventHub</SheetTitle><SheetDescription>Your campus. Your events.</SheetDescription></SheetHeader><div className="overflow-y-auto px-4 pb-6"><div className="mb-6">{switcher}</div>{nav}<div className="mt-4"><SignOutButton variant="ghost" /></div></div></SheetContent>
        </Sheet>}
        <Link href={user && current === "admin" ? "/admin" : "/dashboard"} aria-label="EventHub home" className="shrink-0"><BrandLogo className="w-28" sizes="118px" /></Link>
        {user && <div className="hidden md:block">{switcher}</div>}
      </div>
      {user ? <>
        <form id="shell-signout" action="/auth/signout" method="post" hidden />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="max-w-[35vw] md:max-w-44" />}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span className="truncate">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel><DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>Profile</DropdownMenuItem><DropdownMenuSeparator />
            <DropdownMenuItem render={<button type="submit" form="shell-signout" />}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </> : <Link href="/login" className="text-sm font-medium">Log in</Link>}
    </header>
    <div className="flex">
      {user && <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] w-60 shrink-0 overflow-y-auto border-r bg-sidebar p-4 md:block">{nav}</aside>}
      <main id="main-content" tabIndex={-1} className={cn("mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 outline-none md:px-8", user && current === "participant" && "pb-24 md:pb-8")}>{children}</main>
    </div>
    {user && current === "participant" && <nav aria-label="Participant quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">{navigation.participant.slice(0, 5).map(item => { const Icon = icons[item.icon]; return <Link key={item.href} href={item.href} aria-current={isActiveLink(path, item.href) ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] focus-visible:outline-2 focus-visible:outline-ring", isActiveLink(path, item.href) ? "bg-accent font-semibold" : "text-muted-foreground")}><Icon className="size-5" aria-hidden="true" />{item.label}</Link>; })}</nav>}
  </div>;
}
