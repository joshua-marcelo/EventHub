"use client";

import Link from "next/link";
import { ChevronsUpDownIcon, Loader2Icon, LogOutIcon, UserIcon } from "lucide-react";

import { useSignOut } from "@/components/auth/sign-out-buttons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCOUNT_PROFILE_PATH, type Dashboard } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// Role shown for the area being viewed; access itself is always checked on the server.
const roleLabels: Record<Dashboard, string> = { admin: "Administrator", organizer: "Organizer", participant: "Participant" };

/**
 * Sidebar-footer account control: who is signed in (saved photo, or initials) and in which role,
 * with My Profile and Log Out. In the collapsed rail it shrinks to the avatar and opens to the right.
 * Password help goes through an Administrator; the forced first-login change has its own page.
 */
export function AccountMenu({ name, email, avatarUrl = null, dashboard, compact = false, onNavigate }: { name: string; email: string; avatarUrl?: string | null; dashboard: Dashboard; compact?: boolean; onNavigate?: () => void }) {
  const [pending, logOut] = useSignOut();
  const label = name || "Account";
  const initial = (name || email || "A").slice(0, 1).toUpperCase();
  const role = roleLabels[dashboard];

  const trigger = <DropdownMenuTrigger
    render={<Button variant="ghost" className={cn("h-auto min-h-12 w-full justify-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent", compact && "justify-center px-0")} aria-label={`Account menu, ${label}, ${role}`} />}
  >
    <Avatar className="size-8 shrink-0" aria-hidden="true">
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-slate-900 text-xs font-semibold text-white">{initial}</AvatarFallback>
    </Avatar>
    {!compact && <>
      <span className="flex min-w-0 flex-1 flex-col leading-tight" aria-hidden="true">
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="truncate text-xs font-normal text-muted-foreground">{role}</span>
      </span>
      <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>}
  </DropdownMenuTrigger>;

  return (
    <DropdownMenu>
      {compact ? <Tooltip><TooltipTrigger render={trigger}>{trigger.props.children}</TooltipTrigger><TooltipContent side="right">Account</TooltipContent></Tooltip> : trigger}
      <DropdownMenuContent side={compact ? "right" : "top"} align={compact ? "end" : "start"} sideOffset={8} className="w-60 max-w-[calc(100vw-2rem)]">
        {/* A menu label must sit inside a group (Base UI throws otherwise and the menu never opens). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{label}</span>
            <span className="truncate text-xs font-normal">{email}</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[.12em] text-orange-800">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href={ACCOUNT_PROFILE_PATH} onClick={onNavigate} />} className="min-h-10">
            <UserIcon aria-hidden="true" />My Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* Stays open while signing out so the pending state is visible and cannot be clicked twice. */}
        <DropdownMenuItem variant="destructive" className="min-h-10" closeOnClick={false} disabled={pending} onClick={logOut} aria-busy={pending}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
          {pending ? "Logging out…" : "Log Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
