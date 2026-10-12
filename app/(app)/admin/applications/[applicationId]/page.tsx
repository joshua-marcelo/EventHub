import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";
import { reviewApplication } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
export const metadata = { title: "Application review" };
export default function Page({ params }: PageProps<"/admin/applications/[applicationId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }
async function Content({ params }: Pick<PageProps<"/admin/applications/[applicationId]">,"params">) {
  const user = await requireAdmin(); const { applicationId } = await params;
  if (!idSchema.safeParse(applicationId).success) notFound();
  const client = await createClient();
  const { data: a, error } = await client.from("organizer_applications").select("*").eq("id",applicationId).maybeSingle();
  if (error) throw new Error("Could not load application."); if (!a) notFound();
  const { data: p } = await client.from("profiles").select("first_name,last_name,student_id,email").eq("id",a.applicant_id).single();
  const documents = await Promise.all([a.proof_document_path,a.supporting_document_path].filter((path): path is string => !!path).map(async path => {
    const { data, error } = await client.storage.from("organizer-requirements").createSignedUrl(path,60);
    if (error) throw new Error("Could not open document."); return data.signedUrl;
  }));
  return <div className="max-w-2xl space-y-6"><PageHeader title={a.organization_name} description={`Application: ${a.status}`} /><dl className="space-y-2"><div><dt className="font-medium">Applicant</dt><dd>{p?.first_name} {p?.last_name} · {p?.student_id}</dd></div><div><dt className="font-medium">Email</dt><dd>{p?.email}</dd></div><div><dt className="font-medium">Position / contact</dt><dd>{a.position_title} · {a.contact_number}</dd></div><div><dt className="font-medium">Reason</dt><dd className="whitespace-pre-wrap">{a.reason}</dd></div></dl>
    <section className="space-y-2"><h2 className="font-semibold">Private documents</h2>{documents.map((url,i) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block underline">{i === 0 ? "Proof of authorization" : "Supporting document"}</a>)}<p className="text-sm text-muted-foreground">Links expire after 60 seconds. Refresh to reopen.</p></section>
    {a.status === "pending" && a.applicant_id !== user.id ? <div className="flex flex-wrap gap-4"><ActionControl label="Approve organizer" runAction={reviewApplication.bind(null,a.id,"approved")} confirm /><ActionControl label="Reject application" runAction={reviewApplication.bind(null,a.id,"rejected")} reason confirm /></div> : a.applicant_id === user.id && a.status === "pending" ? <p>Another administrator must review your application.</p> : <p>{a.review_notes}</p>}
  </div>;
}