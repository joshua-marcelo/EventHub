import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ change: vi.fn() }));
vi.mock("@/lib/mvp/actions", () => ({ changeOrganizerStatus: m.change }));
vi.mock("@/components/admin/confirm-action-dialog", () => ({ ConfirmActionDialog: () => null }));
vi.mock("@/components/admin/reset-password-dialog", () => ({ ResetPasswordDialog: () => null }));
vi.mock("@/lib/admin/accounts", () => ({ resetAccountPassword: async () => ({ ok: false, error: "mock" }) }));
import { bindOrganizerActions } from "@/components/admin/organizer-status-actions";
import { availableOrganizerActions, organizerActionCopy } from "./organizer-actions";

const id = "e1000000-0000-4000-8000-000000000001";
const adminId = "e1000000-0000-4000-8000-0000000000ad";

beforeEach(() => { vi.resetAllMocks(); m.change.mockResolvedValue({ ok: true }); });

describe("organizer actions offered by status", () => {
  it("matches the set_organizer_status transitions", () => {
    expect(availableOrganizerActions("active")).toEqual(["suspend", "revoke"]);
    expect(availableOrganizerActions("suspended")).toEqual(["reinstate", "revoke"]);
    expect(availableOrganizerActions("revoked")).toEqual([]);
    expect(availableOrganizerActions("none")).toEqual([]);
  });

  it("never offers an admin actions on their own organizer access", () => {
    expect(availableOrganizerActions("active", { isSelf: true })).toEqual([]);
    expect(availableOrganizerActions("suspended", { isSelf: true })).toEqual([]);
  });

  it("gives each action its own severity, keyword and reason wording", () => {
    const suspend = organizerActionCopy("suspend", "active");
    const revoke = organizerActionCopy("revoke", "suspended");
    const reinstate = organizerActionCopy("reinstate", "suspended");
    expect([suspend.severity, revoke.severity, reinstate.severity]).toEqual(["warning", "destructive", "positive"]);
    expect([suspend.phrase, revoke.phrase, reinstate.phrase]).toEqual(["SUSPEND", "REVOKE", "REINSTATE"]);
    expect([suspend.reasonLabel, revoke.reasonLabel, reinstate.reasonLabel]).toEqual(["Reason for suspension", "Reason for revocation", "Reason for reinstatement"]);
    expect([suspend.confirmLabel, revoke.confirmLabel, reinstate.confirmLabel]).toEqual(["Suspend organizer", "Revoke access", "Reinstate organizer"]);
    expect(suspend.current).toBe("Active organizer");
    expect(revoke.current).toBe("Suspended organizer");
  });

  it("only the revoke dialog carries a destructive warning, and it never claims restoration is impossible", () => {
    const revoke = organizerActionCopy("revoke", "active");
    expect(revoke.warning).toBeTruthy();
    expect(organizerActionCopy("suspend", "active").warning).toBeUndefined();
    expect(organizerActionCopy("reinstate", "suspended").warning).toBeUndefined();
    expect(`${revoke.description} ${revoke.warning}`).not.toMatch(/impossible|can ?not ever|never be restored/i);
    expect(revoke.description).toMatch(/preserving the participant account/);
  });
});

describe("bindOrganizerActions", () => {
  it("binds the existing changeOrganizerStatus server action to the right target status", async () => {
    const actions = bindOrganizerActions(id, "active", adminId);
    expect(Object.keys(actions)).toEqual(["suspend", "revoke"]);
    await actions.suspend!("Policy breach");
    await actions.revoke!("Repeated breach");
    expect(m.change).toHaveBeenNthCalledWith(1, id, "suspended", "Policy breach");
    expect(m.change).toHaveBeenNthCalledWith(2, id, "revoked", "Repeated breach");

    await bindOrganizerActions(id, "suspended", adminId).reinstate!("Resolved");
    expect(m.change).toHaveBeenLastCalledWith(id, "active", "Resolved");
  });

  it("binds nothing for participants, revoked organizers or the signed-in admin", () => {
    expect(bindOrganizerActions(id, "none", adminId)).toEqual({});
    expect(bindOrganizerActions(id, "revoked", adminId)).toEqual({});
    expect(bindOrganizerActions(adminId, "active", adminId)).toEqual({});
  });
});
