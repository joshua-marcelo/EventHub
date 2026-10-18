"use client";

import Link from "next/link";
import { ChevronDownIcon, LayoutDashboardIcon, Loader2Icon, LogOutIcon, UserIcon } from "lucide-react";

import { useSignOut } from "@/components/auth/sign-out-buttons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type LandingAccount = { dashboardHref: string; firstName: string; initial: string };

/** Landing-only account actions, using the same menu primitives and sign-out as the app shell. */
export function LandingAccountMenu({ account }: { account: LandingAccount }) {
  const [pending, logOut] = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-11 gap-2 px-1.5 sm:max-w-48 sm:pr-2" aria-label={`Account menu${account.firstName ? `, ${account.firstName}` : ""}`} />}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white" aria-hidden="true">{account.initial}</span>
        <span className="hidden truncate sm:inline" aria-hidden="true">{account.firstName || "Account"}</span>
        <ChevronDownIcon className="size-4 text-muted-foreground motion-safe:transition-transform [[data-popup-open]_&]:rotate-180" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 max-w-[calc(100vw-2rem)]">
        <DropdownMenuItem render={<Link href="/profile" />} className="min-h-11">
          <UserIcon aria-hidden="true" />My Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={account.dashboardHref} />} className="min-h-11">
          <LayoutDashboardIcon aria-hidden="true" />Go to Dashboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-11" closeOnClick={false} disabled={pending} onClick={logOut} aria-busy={pending}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
          {pending ? "Logging out…" : "Log Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
