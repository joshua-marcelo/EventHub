// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ refresh: vi.fn(), submitScan: vi.fn(), decode: vi.fn(), stop: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/lib/attendance-actions", () => ({ submitScan: m.submitScan }));
vi.mock("@zxing/browser", () => ({ BrowserQRCodeReader: class { decodeFromConstraints = m.decode; } }));
import { ScanAttendanceDialog } from "./scan-attendance-dialog";
import { AttendanceScanner, cameraError } from "./attendance-scanner";

const token = "A".repeat(48);
const eventId = "11111111-1111-4111-8111-111111111111";
type OnResult = (result: { getText: () => string } | undefined, error: unknown, scanner: { stop: () => void }) => void;
let onResult: OnResult | null = null;
const scanQr = (text: string) => onResult!({ getText: () => text }, undefined, { stop: m.stop });

beforeEach(() => {
  vi.resetAllMocks(); onResult = null;
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  m.decode.mockImplementation(async (_c: unknown, _v: unknown, cb: OnResult) => { onResult = cb; return { stop: m.stop }; });
  history.replaceState(null, "", "/dashboard");
});
afterEach(cleanup);

async function openDialog(expected: string | null = null) {
  const user = userEvent.setup();
  render(createElement(ScanAttendanceDialog, { expected }));
  await user.click(screen.getByRole("button", { name: "Scan QR Code" }));
  await waitFor(() => expect(m.decode).toHaveBeenCalledTimes(1));
  return user;
}

it("opens the camera directly in a dialog, without navigating", async () => {
  await openDialog();
  expect(screen.getByRole("dialog", { name: "Scan Attendance QR" })).toBeTruthy();
  expect(screen.getByLabelText("Attendance QR camera preview")).toBeTruthy();
  expect(m.decode.mock.calls[0][0]).toEqual({ video: { facingMode: "environment" }, audio: false });
  expect(location.pathname).toBe("/dashboard");
  expect(await screen.findByRole("button", { name: "Stop camera" })).toBeTruthy();
});

it("records attendance through the server action, stops the camera and refreshes the page", async () => {
  m.submitScan.mockResolvedValue({ code: "timed_in" });
  await openDialog(eventId);
  scanQr(`${location.origin}/scan?t=${token}`);
  expect(await screen.findByText("Attendance recorded!")).toBeTruthy();
  expect(m.stop).toHaveBeenCalled();
  expect(m.submitScan).toHaveBeenCalledWith(token, expect.stringMatching(/^[0-9a-f-]{36}$/), eventId);
  expect(m.refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toBe("Time-in recorded.");
});

it("shows invalid codes and server rejections without breaking, and offers a retry", async () => {
  m.submitScan.mockResolvedValue({ code: "registration_not_approved" });
  const user = await openDialog();
  scanQr(`https://elsewhere.example/scan?t=${token}`);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("This is not a valid EventHub attendance code."));
  expect(m.submitScan).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(m.decode).toHaveBeenCalledTimes(2));
  scanQr(`${location.origin}/scan?t=${token}`);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Your registration is not approved."));
  expect(m.refresh).not.toHaveBeenCalled();
  expect(screen.queryByText("Attendance recorded!")).toBeNull();
});

it("explains a denied camera permission and offers a retry", async () => {
  m.decode.mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  await openDialog();
  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Camera access was blocked/));
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

it("words each camera failure actionably", () => {
  expect(cameraError(Object.assign(new Error(), { name: "NotFoundError" }))).toMatch(/No camera was found/);
  expect(cameraError(Object.assign(new Error(), { name: "NotReadableError" }))).toMatch(/in use by another app/);
  Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
  expect(cameraError(new Error())).toMatch(/HTTPS/);
});

it("releases the camera when the dialog closes", async () => {
  const user = await openDialog();
  await screen.findByRole("button", { name: "Stop camera" });
  await user.click(screen.getAllByRole("button", { name: "Close" })[0]);
  await waitFor(() => expect(m.stop).toHaveBeenCalled());
});

it("submits a signed /scan?t= link on load, strips the token from the URL and skips the camera", async () => {
  m.submitScan.mockResolvedValue({ code: "timed_in" });
  history.replaceState(null, "", `/scan?t=${token}`);
  render(createElement(AttendanceScanner, { expected: null, autoStart: true }));
  expect(await screen.findByText("Attendance recorded!")).toBeTruthy();
  expect(m.submitScan).toHaveBeenCalledWith(token, expect.any(String), null);
  expect(location.search).toBe("");
  expect(m.decode).not.toHaveBeenCalled();
});

it("auto-opens the camera on /scan without a token", async () => {
  history.replaceState(null, "", "/scan");
  render(createElement(AttendanceScanner, { expected: null, autoStart: true }));
  await waitFor(() => expect(m.decode).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: "Start camera" })).toBeNull();
});
