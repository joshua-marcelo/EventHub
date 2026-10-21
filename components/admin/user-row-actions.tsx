"use client";

import { useState } from "react";
import Link from "next/link";
import { EyeIcon, KeyRoundIcon, MoreHorizontalIcon, PauseCircleIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";

import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActionResult } from "@/lib/action-result";
import type { CredentialsResult } from "@/lib/admin/accounts";
import { organizerActionCopy, type OrganizerAction, type OrganizerStatus } from "@/lib/admin/organizer-actions";

export type BoundOrganizerActions = Partial<Record<OrganizerAction, (reason: string) => Promise<ActionResult>>>;

const icons = { suspend: PauseCircleIcon, reinstate: ShieldCheckIcon, revoke: ShieldXIcon } as const;

/**
 * The single "more actions" menu for a user row (Organizers and Participants tables). Only the
 * organizer actions the server bound for this user's current status appear, plus Reset password
 * when the server bound it; Revoke sits last behind a separator. Each opens a typed confirmation.
 */
export function UserRowActions({ name, detailsHref, organizerStatus, actions = {}, resetPassword }: {
  name: string;
  detailsHref: string;
  organizerStatus: OrganizerStatus;
  actions?: BoundOrganizerActions;
  resetPassword?: () => Promise<CredentialsResult>;
}) {
  const [dialog, setDialog] = useState<OrganizerAction | "reset" | null>(null);
  const available = (Object.keys(actions) as OrganizerAction[]).map(action => ({ action, run: actions[action]!, copy: organizerActionCopy(action, organizerStatus) }));
  const safe = available.filter(a => a.action !== "revoke");
  const destructive = available.filter(a => a.action === "revoke");
  const item = (a: (typeof available)[number]) => { const Icon = icons[a.action]; return <DropdownMenuItem key={a.action} variant={a.action === "revoke" ? "destructive" : "default"} onClick={() => setDialog(a.action)}><Icon aria-hidden="true" />{a.copy.menuLabel}</DropdownMenuItem>; };

  return <div className="flex justify-end">
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger render={<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${name}`} />} />}>
          <MoreHorizontalIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>More actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={detailsHref} />}><EyeIcon aria-hidden="true" />View details</DropdownMenuItem>
        {resetPassword && <DropdownMenuItem onClick={() => setDialog("reset")}><KeyRoundIcon aria-hidden="true" />Reset password</DropdownMenuItem>}
        {safe.map(item)}
        {destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map(item)}
      </DropdownMenuContent>
    </DropdownMenu>
    {available.map(a => <ConfirmActionDialog key={a.action} open={dialog === a.action} onOpenChange={open => { if (!open) setDialog(null); }} config={a.copy} subject={name} runAction={a.run} />)}
    {resetPassword && <ResetPasswordDialog open={dialog === "reset"} onOpenChange={open => { if (!open) setDialog(null); }} subject={name} runAction={resetPassword} />}
  </div>;
}
