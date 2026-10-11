import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser, requireUser } from "@/lib/auth/dal";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
export const metadata = { title: "Event" };
export default function Page({ params }: PageProps<"/events/[eventId]">) { return <Suspense fallback={<PageSkeleton />}><Preview params={params} /></Suspense>; }
async function Preview({ params }: Pick<PageProps<"/events/[eventId]">, "params">) {
  const { eventId } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId)) notFound();
  const user = await getCurrentUser();
  if (user) { await requireUser({ next: `/events/${eventId}` }); return <EmptyState title="This event isn’t available" description="Event details will be available when events are published." />; }
  return <EmptyState title="Log in to view this event" description="Sign in to your EventHub account to continue." action={<Link href={`/login?next=${encodeURIComponent(`/events/${eventId}`)}`} className={buttonVariants()}>Log in</Link>} />;
}
