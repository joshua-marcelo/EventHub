// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventLifecycleControls } from "./event-lifecycle-controls";
import { lifecycleConfirmations, type EventLifecycle } from "@/lib/event-lifecycle";

const m = vi.hoisted(() => ({ registration: vi.fn(), attendance: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/mvp/actions", () => ({ setEventRegistration: m.registration }));
vi.mock("@/lib/attendance-actions", () => ({ attendanceAction: m.attendance }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }), unstable_rethrow: () => {} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const closed: EventLifecycle = { registration_open: false, registration_enabled: false, can_open_registration: true, attendance_started: false, attendance_kind: null, next_attendance_kind: "time_in", can_scan_attendance: false };

describe("organizer lifecycle controls", () => {
  it.each([
    ["Open Registration", "open", closed, "registration", true],
    ["Close Registration", "close", { ...closed, registration_open: true, registration_enabled: true }, "registration", false],
    ["Start Attendance", "start", closed, "attendance", "time_in"],
    ["Close Attendance", "stop", { ...closed, attendance_started: true, can_open_registration: false, attendance_kind: "time_in" }, "attendance", "close"],
  ] as const)("confirms %s with the required copy before calling the server", async (label, key, state, action, value) => {
    const user = userEvent.setup();
    m[action].mockResolvedValue({ ok: true });
    render(createElement(EventLifecycleControls, { id: "event", title: "Campus event", state }));
    await user.click(screen.getByRole("button", { name: label }));
    const dialog = screen.getByRole("alertdialog", { name: lifecycleConfirmations[key].title });
    expect(dialog.textContent).toContain(lifecycleConfirmations[key].description);
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(m[action]).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: label }));
    await waitFor(() => expect(m[action]).toHaveBeenCalledExactlyOnceWith("event", value, ""));
  });

  it("does not offer reopening after attendance closes and resumes the correct session kind", async () => {
    const user = userEvent.setup();
    m.attendance.mockResolvedValue({ ok: true });
    render(createElement(EventLifecycleControls, { id: "event", title: "Campus event", state: { ...closed, attendance_started: true, can_open_registration: false, next_attendance_kind: "time_out" } }));
    expect(screen.queryByRole("button", { name: "Open Registration" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Start Attendance" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Start Attendance" }));
    await waitFor(() => expect(m.attendance).toHaveBeenCalledWith("event", "time_out", ""));
  });

  it("fails closed when lifecycle state cannot be loaded", () => {
    render(createElement(EventLifecycleControls, { id: "event", title: "Campus event", state: null }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("unavailable");
  });
});
