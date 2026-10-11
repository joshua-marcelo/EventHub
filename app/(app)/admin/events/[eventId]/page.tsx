import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";
import { eventAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export default function Page({params}: PageProps<"/admin/events/[eventId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }
async function Content({params}: Pick<PageProps<"/admin/events/[eventId]">,"params">) {
  await requireAdmin(); const {eventId} = await params; if (!idSchema.safeParse(eventId).success) notFound();
  const {data:e,error} = await (await createClient()).from("events").select("id,title,status,description,cancellation_reason").eq("id",eventId).maybeSingle();
  if (error) throw new Error("Could not load event."); if (!e) notFound();
  return <div className="max-w-2xl space-y-6"><PageHeader title={e.title} description={`Status: ${e.status}`} /><p className="whitespace-pre-wrap">{e.description}</p>{e.status === "published" && <ActionControl label="Cancel event as administrator" runAction={eventAction.bind(null,e.id,"cancel")} reason confirm />}{e.cancellation_reason && <p>{e.cancellation_reason}</p>}</div>;
}