import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), saved: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { saveAccountProfile, saveStudentDetails } from "./actions";

const names = { firstName: "Casey", middleName: "", lastName: "Account", suffix: "" };
beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({ id: "signed-in-user", isComplete: false, organizerStatus: "active" });
  m.client.mockResolvedValue({ from: () => ({ update: m.update }) });
  m.update.mockReturnValue({ eq: m.eq }); m.eq.mockReturnValue({ select: m.select }); m.select.mockReturnValue({ maybeSingle: m.saved });
  m.saved.mockResolvedValue({ data: { id: "signed-in-user" }, error: null });
});
describe("shared account updates", () => {
  it("saves account names without student fields or Student Onboarding", async () => {
    expect(await saveAccountProfile(names)).toMatchObject({ ok: true });
    expect(m.update).toHaveBeenCalledWith({ first_name: "Casey", middle_name: null, last_name: "Account", suffix: null });
    expect(m.eq).toHaveBeenCalledWith("id", "signed-in-user");
    expect(m.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("ignores forged identity, workspace, student, email, and privilege fields", async () => {
    expect(await saveAccountProfile({ ...names, id: "victim", workspace: "admin", is_admin: true, organizer_status: "active", email: "other@example.test", studentId: "REPLACE" })).toMatchObject({ ok: true });
    expect(m.eq).toHaveBeenCalledWith("id", "signed-in-user");
    expect(m.update).toHaveBeenCalledWith({ first_name: "Casey", middle_name: null, last_name: "Account", suffix: null });
  });
  it("requires a signed-in identity before any database update", async () => {
    m.user.mockResolvedValue(null);
    expect(await saveAccountProfile(names)).toMatchObject({ ok: false, code: "not_signed_in" });
    expect(m.client).not.toHaveBeenCalled();
  });
  it("retains required-name validation", async () => {
    expect(await saveAccountProfile({ ...names, lastName: "" })).toMatchObject({ ok: false, fieldErrors: { lastName: expect.any(String) } });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("does not claim success if RLS permits no matching row", async () => {
    m.saved.mockResolvedValue({ data: null, error: null });
    expect(await saveAccountProfile(names)).toMatchObject({ ok: false });
    expect(m.revalidate).not.toHaveBeenCalled();
  });
});
describe("separate Student details", () => {
  const student = { studentId: "STUDENT-123", collegeId: "1", programId: "2", yearLevel: "3" };
  it("updates only student columns on the authenticated identity", async () => {
    expect(await saveStudentDetails({ ...student, firstName: "Unexpected", is_admin: true })).toMatchObject({ ok: true });
    expect(m.update).toHaveBeenCalledWith({ student_id: "STUDENT-123", college_id: 1, program_id: 2, year_level: 3 });
    expect(m.eq).toHaveBeenCalledWith("id", "signed-in-user");
  });
  it("still requires valid Student details", async () => {
    expect(await saveStudentDetails({ ...student, programId: "", studentId: "!" })).toMatchObject({ ok: false });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("preserves the registration lock failure returned by the database", async () => {
    m.saved.mockResolvedValue({ data: null, error: { code: "23514", message: "locked by an approved event registration" } });
    expect(await saveStudentDetails(student)).toMatchObject({ ok: false, error: expect.stringContaining("locked") });
  });
  it("retains duplicate Student ID feedback", async () => {
    m.saved.mockResolvedValue({ data: null, error: { code: "23505" } });
    expect(await saveStudentDetails(student)).toMatchObject({ ok: false, fieldErrors: { studentId: expect.stringContaining("registered") } });
  });
});
