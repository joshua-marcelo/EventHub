import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import type { BoundOrganizerActions } from "@/components/admin/user-row-actions";
import { availableOrganizerActions, organizerActionCopy, organizerTargetStatus, type OrganizerStatus } from "@/lib/admin/organizer-actions";
import { resetAccountPassword } from "@/lib/admin/accounts";
import { changeOrganizerStatus } from "@/lib/mvp/actions";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";

/**
 * Binds the existing `changeOrganizerStatus` server action for each transition permitted by the
 * user's current status. The server action and the RPC re-check everything; this only decides what to offer.
 */
export function bindOrganizerActions(id: string, status: OrganizerStatus, currentAdminId: string): BoundOrganizerActions {
  return Object.fromEntries(availableOrganizerActions(status, { isSelf: id === currentAdminId }).map(action => [action, changeOrganizerStatus.bind(null, id, organizerTargetStatus[action])]));
}

/**
 * Admin-issued password reset for one account, or undefined when it must not be offered: the Admin's
 * own account (use Change Password) and other Administrator accounts. request_password_reset enforces both.
 */
export function bindResetPassword(id: string, targetIsAdmin: boolean, currentAdminId: string) {
  return id === currentAdminId || targetIsAdmin ? undefined : resetAccountPassword.bind(null, id);
}

/** Reset password button for the user details page, with the same dialog as the table menus. */
export function ResetPasswordButton({ id, name, targetIsAdmin, currentAdminId }: { id: string; name: string; targetIsAdmin: boolean; currentAdminId: string }) {
  const run = bindResetPassword(id, targetIsAdmin, currentAdminId);
  if (!run) return <p className="text-sm text-muted-foreground">{id === currentAdminId ? "Use Change Password in your account menu to change your own password." : "Administrator passwords are not reset from here."}</p>;
  return <ResetPasswordDialog trigger="Reset password" subject={name} runAction={run} />;
}

/** Visible buttons for the user details page, using the same confirmation dialog as the table menus. */
export function OrganizerStatusButtons({ id, name, status, currentAdminId }: { id: string; name: string; status: OrganizerStatus; currentAdminId: string }) {
  const actions = availableOrganizerActions(status, { isSelf: id === currentAdminId });
  if (!actions.length) return <p className="text-sm text-muted-foreground">{id === currentAdminId ? "You cannot change your own organizer access." : "No status changes are available for this organizer."}</p>;
  return <div className="flex flex-wrap gap-2">
    {actions.map(action => {
      const copy = organizerActionCopy(action, status);
      return <ConfirmActionDialog key={action} trigger={copy.label} config={copy} subject={name} runAction={changeOrganizerStatus.bind(null, id, organizerTargetStatus[action])} />;
    })}
  </div>;
}
