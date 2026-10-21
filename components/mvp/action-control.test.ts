// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { ActionControl } from "./action-control";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), unstable_rethrow: () => {} }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const confirmation = {
  title: "Publish Event?",
  subject: "EventHub Student Conference",
  description: "Publishing makes this event visible to participants.",
};

function setup(runAction = vi.fn<(_: string) => Promise<ActionResult>>().mockResolvedValue({ ok: true, message: "Event published." })) {
  const user = userEvent.setup();
  render(createElement(ActionControl, { label: "Publish Event", runAction, confirmation }));
  return { user, runAction, trigger: screen.getByRole("button", { name: "Publish Event" }) };
}

describe("action confirmation", () => {
  it("shows the real event name, focuses Cancel, and cancels without executing", async () => {
    const { user, runAction, trigger } = setup();
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "Publish Event?" });
    expect(dialog.textContent).toContain(confirmation.subject);
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(within(dialog).getByText(confirmation.description)).toBeTruthy();
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.click(cancel);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(runAction).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("supports Escape, focus return, and keyboard confirmation without a typed phrase", async () => {
    const { user, runAction, trigger } = setup();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(runAction).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" })));
    await user.tab();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Publish Event" }));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(runAction).toHaveBeenCalledExactlyOnceWith("");
    expect(screen.getByRole("status").textContent).toBe("Event published.");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("disables controls and prevents dismissal and duplicate requests while pending", async () => {
    let finish!: (result: ActionResult) => void;
    const runAction = vi.fn(() => new Promise<ActionResult>(resolve => { finish = resolve; }));
    const { user, trigger } = setup(runAction);
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Publish Event" });
    // Same-tick clicks also exercise the synchronous in-flight guard.
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(runAction).toHaveBeenCalledOnce();
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.getAttribute("aria-busy")).toBe("true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBe(dialog);
    fireEvent.submit(trigger.closest("form")!);
    expect(runAction).toHaveBeenCalledOnce();
    await act(async () => { finish({ ok: true }); });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect((trigger as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps a server refusal visible and permits one deliberate retry", async () => {
    const runAction = vi.fn<(_: string) => Promise<ActionResult>>()
      .mockResolvedValueOnce({ ok: false, error: "Set an event schedule before publishing." })
      .mockResolvedValueOnce({ ok: true });
    const { user, trigger } = setup(runAction);
    await user.click(trigger);
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Publish Event" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Set an event schedule before publishing.");
    expect(refresh).not.toHaveBeenCalled();
    const retry = await within(screen.getByRole("alertdialog")).findByRole("button", { name: "Publish Event" });
    await user.click(retry);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(runAction).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("retains a required reason through cancellation and passes it to the existing handler", async () => {
    const user = userEvent.setup();
    const runAction = vi.fn().mockResolvedValue({ ok: true });
    render(createElement(ActionControl, { label: "Cancel event", runAction, reason: true, confirmation: { ...confirmation, title: "Cancel event?", tone: "destructive" } }));
    const trigger = screen.getByRole("button", { name: "Cancel event" });
    await user.click(trigger);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.type(screen.getByRole("textbox"), "Venue unavailable");
    await user.click(trigger);
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(runAction).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Venue unavailable");
    await user.click(trigger);
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel event" }));
    await waitFor(() => expect(runAction).toHaveBeenCalledExactlyOnceWith("Venue unavailable"));
  });

  it("keeps ordinary registration immediate and reports unexpected failures", async () => {
    const user = userEvent.setup();
    const runAction = vi.fn().mockRejectedValue(new Error("Offline"));
    render(createElement(ActionControl, { label: "Register", runAction }));
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((await screen.findByRole("alert")).textContent).toContain("Could not complete this action.");
    expect(runAction).toHaveBeenCalledOnce();
  });
});
