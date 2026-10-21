import { redirect } from "next/navigation";

// Reports are managed inside each event (My Events → event → Reports); keep old links working.
export default function Page() { redirect("/organizer/events"); }
