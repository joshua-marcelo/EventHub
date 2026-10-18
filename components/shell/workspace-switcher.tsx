"use client";

import Link from "next/link";
import { BadgeCheckIcon, CheckIcon, ChevronDownIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dashboards, type Dashboard } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const icons = { admin: ShieldCheckIcon, organizer: BadgeCheckIcon, participant: UsersIcon };

export function WorkspaceSwitcher({ current, permitted, compact = false, onSelect }: {
  current: Dashboard; permitted: Dashboard[]; compact?: boolean; onSelect?: () => void;
}) {
  if (permitted.length < 2) return null;
  const Icon = icons[current];
  const label = `${dashboards[current].label} Workspace`;
  const trigger = <DropdownMenuTrigger render={<Button variant="outline" className={cn("h-auto min-h-11 w-full justify-start gap-2.5 rounded-lg px-3 py-2.5", compact && "justify-center px-0")} aria-label={`Switch workspace, current ${label}`} />}>
    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span className={compact ? "sr-only" : "min-w-0 flex-1 text-left"}><span className="block truncate text-sm font-medium">{label}</span><span className="block text-xs font-normal text-muted-foreground">Switch workspace</span></span>
    {!compact && <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
  </DropdownMenuTrigger>;

  return <DropdownMenu>
    {compact ? <Tooltip><TooltipTrigger render={trigger}>{trigger.props.children}</TooltipTrigger><TooltipContent side="right">Switch workspace</TooltipContent></Tooltip> : trigger}
    <DropdownMenuContent side={compact ? "right" : "top"} align="start" sideOffset={8} className="w-52 max-w-[calc(100vw-2rem)]" aria-label="Select workspace">
      {permitted.map(workspace => {
        const EntryIcon = icons[workspace];
        const active = workspace === current;
        return <DropdownMenuItem key={workspace} render={active ? undefined : <Link href={dashboards[workspace].href} />} onClick={onSelect} aria-current={active ? "page" : undefined} className="min-h-11 gap-2">
          <EntryIcon className="size-4" aria-hidden="true" /><span className="flex-1">{dashboards[workspace].label}</span>
          {active && <><CheckIcon className="size-4 text-orange-800" aria-hidden="true" /><span className="sr-only">Current workspace</span></>}
        </DropdownMenuItem>;
      })}
    </DropdownMenuContent>
  </DropdownMenu>;
}
