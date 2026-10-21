import type { Database } from "@/lib/database.types";

export type RegistrationStatus = Database["public"]["Enums"]["registration_status"];
export type MyRegistration = {
  id: string;
  eventId: string;
  title: string;
  startsAt: string | null;
  eventStatus: string;
  status: RegistrationStatus;
  /** From attendance_records: null until a time-in is recorded. */
  attendance: string | null;
};

export const registrationLabel: Record<RegistrationStatus, string> = { pending: "Pending Approval", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };
export function attendanceLabel(a: string | null) { return a === "present" ? "Present" : a === "revoked" ? "Revoked" : "Not Yet Recorded"; }
