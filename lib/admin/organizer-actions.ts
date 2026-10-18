import type { Database } from "@/lib/database.types";

export type OrganizerStatus = Database["public"]["Enums"]["organizer_status"];
export type OrganizerAction = "suspend" | "reinstate" | "revoke";

/**
 * The organizer status changes offered in the UI. Mirrors the `set_organizer_status` RPC rules
 * (active → suspended/revoked, suspended → active/revoked, revoked/none → nothing), which stay the
 * authority. An admin is never offered actions on their own organizer access.
 */
export function availableOrganizerActions(status: OrganizerStatus, { isSelf = false }: { isSelf?: boolean } = {}): OrganizerAction[] {
  if (isSelf) return [];
  if (status === "active") return ["suspend", "revoke"];
  if (status === "suspended") return ["reinstate", "revoke"];
  return [];
}

export const organizerTargetStatus: Record<OrganizerAction, "active" | "suspended" | "revoked"> = { suspend: "suspended", reinstate: "active", revoke: "revoked" };

const statusText: Record<OrganizerStatus, string> = { none: "No organizer access", active: "Active organizer", suspended: "Suspended organizer", revoked: "Revoked organizer" };

/** Visual severity of a confirmation: amber for reversible restrictions, red for removals, neutral-positive for restores. */
export type ConfirmSeverity = "warning" | "destructive" | "positive";

/** Everything the shared confirmation dialog needs for one action. Plain data, so server components can pass it. */
export type ConfirmConfig = {
  severity: ConfirmSeverity;
  title: string;
  description: string;
  indicator: string;
  warning?: string;
  phrase: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  confirmLabel: string;
  current: string;
};

/** Dialog and menu copy shared by every place that changes organizer status. */
export function organizerActionCopy(action: OrganizerAction, status: OrganizerStatus): ConfirmConfig & { label: string; menuLabel: string } {
  const current = statusText[status];
  switch (action) {
    case "suspend": return {
      label: "Suspend", menuLabel: "Suspend organizer", severity: "warning", current,
      title: "Suspend organizer temporarily?",
      description: "This temporarily disables organizer privileges. The account keeps participant access and existing records. Organizer access can be reinstated later.",
      indicator: "Temporary restriction", phrase: "SUSPEND",
      reasonLabel: "Reason for suspension", reasonPlaceholder: "Explain why organizer access is being temporarily suspended.",
      confirmLabel: "Suspend organizer",
    };
    case "revoke": return {
      label: "Revoke", menuLabel: "Revoke organizer access", severity: "destructive", current,
      title: "Revoke organizer access permanently?",
      description: "This removes organizer privileges while preserving the participant account, existing events, and related records. Access cannot be reinstated through the normal reinstatement action.",
      indicator: "Permanent access removal",
      warning: "Organizer tools stop working for this account immediately, and the Reinstate action will no longer be offered. Use Suspend instead if the restriction may be temporary.",
      phrase: "REVOKE",
      reasonLabel: "Reason for revocation", reasonPlaceholder: "Explain why organizer access is being revoked.",
      confirmLabel: "Revoke access",
    };
    case "reinstate": return {
      label: "Reinstate", menuLabel: "Reinstate organizer", severity: "positive", current,
      title: "Reinstate organizer access?",
      description: "This restores the suspended organizer privileges. They can manage their events and registrations again.",
      indicator: "Restores access", phrase: "REINSTATE",
      reasonLabel: "Reason for reinstatement", reasonPlaceholder: "Explain why organizer access is being restored.",
      confirmLabel: "Reinstate organizer",
    };
  }
}
