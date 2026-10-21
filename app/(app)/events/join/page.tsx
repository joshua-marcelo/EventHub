import { redirect } from "next/navigation";

export const metadata = { title: "Join with invite code" };
// Old direct links: the invite form is now a dialog on Events, opened by ?join=1.
export default function Page() { redirect("/events?join=1"); }
