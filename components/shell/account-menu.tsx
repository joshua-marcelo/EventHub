"use client";

import Link from "next/link";
import { ChevronDownIcon, Loader2Icon, LogOutIcon, UserIcon } from "lucide-react";

import { useSignOut } from "@/components/auth/sign-out-buttons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Dashboard } from "@/lib/navigation";

// Role shown for the workspace being viewed; access itself is always checked on the server.
const roleLabels: Record<Dashboard, string> = { admin: "Administrator", organizer: "Organizer", participant: "Participant" };

/** Top-right account control: who is signed in, in which role, with My Profile and Log Out. */
export function AccountMenu({ name, email, dashboard }: { name: string; email: string; dashboard: Dashboard }) {
  const [pending, logOut] = useSignOut();
  const label = name || "Account";
  const initial = (name || email || "A").slice(0, 1).toUpperCase();
  const role = roleLabels[dashboard];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-10 max-w-[45vw] gap-2.5 px-1.5 md:max-w-56 md:pr-2" aria-label={`Account menu, ${label}, ${role}`} />}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white" aria-hidden="true">{initial}</span>
        <span className="hidden min-w-0 flex-col items-start text-left leading-tight sm:flex" aria-hidden="true">
          <span className="max-w-full truncate text-sm font-medium">{label}</span>
          <span className="text-xs font-normal text-muted-foreground">{role}</span>
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground motion-safe:transition-transform [[data-popup-open]_&]:rotate-180" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 max-w-[calc(100vw-2rem)]">
        {/* A menu label must sit inside a group (Base UI throws otherwise and the menu never opens). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{label}</span>
            <span className="truncate text-xs font-normal">{email}</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[.12em] text-orange-800">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/profile" />}>
            <UserIcon aria-hidden="true" />My Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* Stays open while signing out so the pending state is visible and cannot be clicked twice. */}
        <DropdownMenuItem variant="destructive" closeOnClick={false} disabled={pending} onClick={logOut} aria-busy={pending}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
          {pending ? "Logging out…" : "Log Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
