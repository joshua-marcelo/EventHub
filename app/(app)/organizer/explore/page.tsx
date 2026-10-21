import { redirect } from "next/navigation";

// Explore Events is retired from the Organizer MVP; old links land on the Organizer overview.
export default function Page() { redirect("/organizer"); }
