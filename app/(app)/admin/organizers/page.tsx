import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { changeOrganizerStatus } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export default function Page() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
async function Content() {
  await requireAdmin();
  const { data, error } = await (await createClient()).from("profiles").select("id,first_name,last_name,organizer_status,organizer_status_reason").neq("organizer_status","none").order("last_name").limit(200);
  if (error) throw new Error("Could not load organizers.");
  return <div className="space-y-6"><PageHeader title="Organizers" description="Suspended and revoked organizers cannot change events or registrations." />{data.length ? data.map(p => <article key={p.id} className="space-y-3 rounded border p-4"><h2 className="font-semibold">{p.first_name} {p.last_name} · {p.organizer_status}</h2>{p.organizer_status_reason && <p>{p.organizer_status_reason}</p>}<div className="flex flex-wrap gap-3">{p.organizer_status === "active" && <ActionControl label="Suspend" runAction={changeOrganizerStatus.bind(null,p.id,"suspended")} reason confirm />}{p.organizer_status === "suspended" && <ActionControl label="Reinstate" runAction={changeOrganizerStatus.bind(null,p.id,"active")} reason confirm />}{p.organizer_status !== "revoked" && <ActionControl label="Revoke" runAction={changeOrganizerStatus.bind(null,p.id,"revoked")} reason confirm />}</div></article>) : <p>No organizers yet.</p>}</div>;
}