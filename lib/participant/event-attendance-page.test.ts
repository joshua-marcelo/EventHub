// @vitest-environment jsdom
import type { ReactElement, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ lifecycle: vi.fn(), user: vi.fn(), registration: { status: "approved" }, rpc: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: m.user, requireUser: m.user }));
vi.mock("@/lib/event-lifecycle-queries", () => ({ getEventLifecycle: m.lifecycle }));
vi.mock("@/components/mvp/attendance-scanner", () => ({ AttendanceScanner: () => "Scanner ready" }));
vi.mock("@/components/mvp/scan-attendance-dialog", async () => { const { createElement } = await import("react"); return { ScanAttendanceDialog: ({ expected, children }: { expected: string; children: string }) => createElement("button", { "data-expected": expected }, children) }; });
vi.mock("@/components/mvp/event-banner", () => ({ EventBanner: () => null }));
vi.mock("@/components/mvp/action-control", () => ({ ActionControl: ({ label }: { label: string }) => label }));
vi.mock("@/lib/mvp/actions", () => ({ registrationAction: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  rpc: m.rpc,
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ error: null, data: table === "events" ? {
        id: "d5e00000-0000-4000-8000-000000000001", organizer_id: "organizer", title: "Campus event", status: "published",
        starts_at: "2099-01-01T00:00:00Z", registration_opens_at: "2020-01-01T00:00:00Z", registration_closes_at: "2099-01-01T00:00:00Z",
      } : table === "event_registrations" ? { id: "registration", ...m.registration } : null }),
    }; return query;
  },
}) }));
import EventPage from "@/app/(app)/events/[eventId]/page";
import ScanPage from "@/app/(app)/scan/page";

// Execute the async server child inside the route's Suspense boundary, then render its real UI.
async function renderContent(outer: ReactElement<{ children: ReactNode }>) {
  const child = outer.props.children as ReactElement<Record<string, unknown>>;
  const Content = child.type as (props: Record<string, unknown>) => Promise<ReactNode>;
  render(await Content(child.props));
}
beforeEach(() => {
  vi.resetAllMocks();
  m.registration.status = "approved";
  m.user.mockResolvedValue({ id: "participant", isComplete: true, isAdmin: false });
  m.lifecycle.mockResolvedValue({ attendance_kind: null, can_scan_attendance: false });
});
afterEach(cleanup);
const params = () => Promise.resolve({ eventId: "d5e00000-0000-4000-8000-000000000001" });

describe("participant attendance entry", () => {
  it("hides Scan Attendance without an active session and preserves cancellation", async () => {
    await renderContent(EventPage({ params: params(), searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("button", { name: "Scan Attendance" })).toBeNull();
    expect(screen.getByText("Attendance hasn't started yet.")).toBeTruthy();
    expect(screen.getByText("Cancel registration")).toBeTruthy();
  });
  it("shows Scan Attendance when the server confirms eligibility", async () => {
    m.lifecycle.mockResolvedValue({ attendance_kind: "time_in", can_scan_attendance: true });
    await renderContent(EventPage({ params: params(), searchParams: Promise.resolve({}) }));
    // Opens the scanner in place, bound to this event.
    expect(screen.getByRole("button", { name: "Scan Attendance" }).getAttribute("data-expected")).toBe("d5e00000-0000-4000-8000-000000000001");
    expect(screen.queryByText("Attendance hasn't started yet.")).toBeNull();
  });
  it("hides scanning for a pending registration even with an active session", async () => {
    m.registration.status = "pending";
    m.lifecycle.mockResolvedValue({ attendance_kind: "time_in", can_scan_attendance: false });
    await renderContent(EventPage({ params: params(), searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("button", { name: "Scan Attendance" })).toBeNull();
  });
  it.each([null, { attendance_kind: null, can_scan_attendance: false }, { attendance_kind: "time_in", can_scan_attendance: false }])("blocks direct event-specific scanner entry when ineligible", async state => {
    m.lifecycle.mockResolvedValue(state);
    await renderContent(ScanPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ event: (await params()).eventId }) }));
    expect(screen.queryByText("Scanner ready")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });
  it("permits direct event-specific scanner entry only after an eligibility check", async () => {
    m.lifecycle.mockResolvedValue({ attendance_kind: "time_in", can_scan_attendance: true });
    await renderContent(ScanPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ event: (await params()).eventId }) }));
    expect(screen.getByText("Scanner ready")).toBeTruthy();
    expect(m.lifecycle).toHaveBeenCalledExactlyOnceWith((await params()).eventId);
  });
});
