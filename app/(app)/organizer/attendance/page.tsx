import { redirect } from "next/navigation";

// Attendance is managed inside each event (My Events → event → Attendance); keep old links working.
export default function Page() { redirect("/organizer/events"); }
