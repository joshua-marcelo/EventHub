import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import type { BoundOrganizerActions } from "@/components/admin/user-row-actions";
import { availableOrganizerActions, organizerActionCopy, organizerTargetStatus, type OrganizerStatus } from "@/lib/admin/organizer-actions";
import { changeOrganizerStatus } from "@/lib/mvp/actions";

/**
 * Binds the existing `changeOrganizerStatus` server action for each transition permitted by the
 * user's current status. The server action and the RPC re-check everything; this only decides what to offer.
 */
export function bindOrganizerActions(id: string, status: OrganizerStatus, currentAdminId: string): BoundOrganizerActions {
  return Object.fromEntries(availableOrganizerActions(status, { isSelf: id === currentAdminId }).map(action => [action, changeOrganizerStatus.bind(null, id, organizerTargetStatus[action])]));
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
