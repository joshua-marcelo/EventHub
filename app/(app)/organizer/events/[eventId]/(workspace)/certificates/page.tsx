import { redirect } from "next/navigation";

// Retired from the MVP: historical data is kept, and old links land on the event overview.
export default async function Page({ params }: PageProps<"/organizer/events/[eventId]/certificates">) {
  const { eventId } = await params;
  redirect(`/organizer/events/${eventId}`);
}
