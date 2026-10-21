// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/attendance-actions", () => ({ submitScan: vi.fn() }));
vi.mock("@/lib/participant/invite", () => ({ resolveInviteCode: vi.fn() }));
import { InviteCodeDialog } from "./invite-code-dialog";
import { EventEntryActions } from "@/components/participant/event-entry-actions";
afterEach(cleanup);

it("displays and copies the fixed invite code without generating a QR", async () => {
  const user = userEvent.setup();
  render(createElement(InviteCodeDialog, { code: "ABCDEFGH" }));
  await user.click(screen.getByRole("button", { name: "Invite Code" }));
  expect((screen.getByRole("textbox", { name: "Event invite code" }) as HTMLInputElement).value).toBe("ABCDEFGH");
  expect(screen.queryByRole("img")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Copy Code" }));
  expect(await navigator.clipboard.readText()).toBe("ABCDEFGH");
  expect(screen.getByRole("status").textContent).toBe("Code copied.");
});

it("reuses the invite route, opens the scanner in place, with mobile stacking", () => {
  const { container } = render(createElement(EventEntryActions));
  expect(screen.getByRole("button", { name: "Join by Invite Code" }).getAttribute("type")).toBe("button");
  expect(screen.queryByRole("link", { name: "Scan QR Code" })).toBeNull();
  expect(screen.getByRole("button", { name: "Scan QR Code" }).getAttribute("type")).toBe("button");
  expect(container.firstElementChild?.className).toContain("flex-col");
  expect(container.firstElementChild?.className).toContain("sm:flex-row");
});
