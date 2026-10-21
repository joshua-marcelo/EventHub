import { redirect } from "next/navigation";

// Registrations is managed inside each event (My Events → event → Registrations); keep old links working.
export default function Page() { redirect("/organizer/events"); }
