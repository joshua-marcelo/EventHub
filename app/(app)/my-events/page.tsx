import { redirect } from "next/navigation";

// Registered events now live on the Dashboard and under MY REGISTERED EVENTS in the sidebar.
export default function Page() { redirect("/dashboard"); }
