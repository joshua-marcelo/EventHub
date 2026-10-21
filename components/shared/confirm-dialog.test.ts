// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

describe("shared confirmation dialog", () => {
  it.each(["normal", "destructive", "warning"] as const)("supports the %s treatment and traps keyboard focus", async tone => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(createElement(ConfirmDialog, { trigger: "Open", title: "Continue?", description: "Review this change.", confirmLabel: "Continue", tone, onConfirm }));
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("alertdialog", { name: "Continue?" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Continue" });
    expect(confirm.className).toContain(tone === "destructive" ? "bg-destructive/10" : tone === "warning" ? "bg-amber-100" : "bg-primary");
    if (tone === "warning") expect(confirm.className).toContain("bg-amber-100");
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.tab({ shift: true });
    await waitFor(() => expect(document.activeElement).toBe(confirm));
    await user.tab();
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("awaits async consumers, reports unexpected failures, and closes on retry", async () => {
    const user = userEvent.setup();
    let fail!: (reason: Error) => void;
    const onConfirm = vi.fn<() => Promise<void>>()
      .mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
      .mockResolvedValueOnce(undefined);
    render(createElement(ConfirmDialog, { trigger: "Deactivate", title: "Deactivate entry?", description: "This removes it from future selections.", onConfirm }));
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect((screen.getByRole("button", { name: "Working…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fail(new Error("Offline")); });
    expect((await screen.findByRole("alert")).textContent).toContain("Could not complete this action.");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
