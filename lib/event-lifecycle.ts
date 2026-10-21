import { z } from "zod";

export const lifecycleSchema = z.object({
  registration_open: z.boolean(),
  registration_enabled: z.boolean(),
  can_open_registration: z.boolean(),
  attendance_started: z.boolean(),
  attendance_kind: z.enum(["time_in", "time_out"]).nullable(),
  next_attendance_kind: z.enum(["time_in", "time_out"]),
  can_scan_attendance: z.boolean(),
});
export type EventLifecycle = z.infer<typeof lifecycleSchema>;

export const lifecycleConfirmations = {
  open: { title: "Open Registration?", description: "Participants will be able to register for this event." },
  close: { title: "Close Registration?", description: "Participants will no longer be able to register for this event." },
  start: { title: "Start Attendance?", description: "Registration will close, and approved participants can begin scanning the attendance QR code." },
  stop: { title: "Close Attendance?", description: "Participants will no longer be able to scan for the current attendance session." },
};
