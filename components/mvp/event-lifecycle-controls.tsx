import { ActionControl } from "@/components/mvp/action-control";
import { setEventRegistration } from "@/lib/mvp/actions";
import { attendanceAction } from "@/lib/attendance-actions";
import { lifecycleConfirmations, type EventLifecycle } from "@/lib/event-lifecycle";

export function EventLifecycleControls({ id, title, state }: { id: string; title: string; state: EventLifecycle | null }) {
  if (!state) return <p role="status" className="text-sm text-muted-foreground">Event controls are unavailable. Refresh and try again.</p>;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{state.attendance_started ? "Attendance has started. Registration stays closed." : state.registration_open ? "Registration is open." : state.registration_enabled ? "Registration is enabled within its scheduled dates." : "Registration is closed."}</p>
    <div className="flex flex-wrap items-start gap-2">
      {state.registration_enabled && !state.attendance_started ? <ActionControl label="Close Registration" runAction={setEventRegistration.bind(null, id, false)} confirmation={{ ...lifecycleConfirmations.close, subject: title }} />
        : state.can_open_registration && <ActionControl label="Open Registration" runAction={setEventRegistration.bind(null, id, true)} confirmation={{ ...lifecycleConfirmations.open, subject: title }} />}
      {state.attendance_kind ? <ActionControl label="Close Attendance" runAction={attendanceAction.bind(null, id, "close")} confirmation={{ ...lifecycleConfirmations.stop, subject: title }} />
        : <ActionControl label="Start Attendance" variant="default" runAction={attendanceAction.bind(null, id, state.next_attendance_kind)} confirmation={{ ...lifecycleConfirmations.start, subject: title }} />}
    </div>
  </div>;
}
