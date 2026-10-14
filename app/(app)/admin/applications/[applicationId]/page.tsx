import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

import { Panel, fullName } from "@/components/admin/admin-ui";
import { ReviewAction } from "@/components/admin/review-action";
import { PageSkeleton } from "@/components/page-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/datetime";
import { reviewApplication } from "@/lib/mvp/actions";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";

export const metadata = { title: "Application review" };

export default function Page({ params }: PageProps<"/admin/applications/[applicationId]">) { return <Suspense fallback={<PageSkeleton />}><Content params={params} /></Suspense>; }

async function Content({ params }: Pick<PageProps<"/admin/applications/[applicationId]">, "params">) {
  const user = await requireAdmin(); const { applicationId } = await params;
  if (!idSchema.safeParse(applicationId).success) notFound();
  const client = await createClient();
  const { data: a, error } = await client.from("organizer_applications").select("*").eq("id", applicationId).maybeSingle();
  if (error) throw new Error("Could not load application."); if (!a) notFound();
  const { data: p } = await client.from("profiles").select("first_name,last_name,student_id,email").eq("id", a.applicant_id).single();
  const documents = await Promise.all([a.proof_document_path, a.supporting_document_path].filter((path): path is string => !!path).map(async path => {
    const { data, error } = await client.storage.from("organizer-requirements").createSignedUrl(path, 60);
    if (error) throw new Error("Could not open document."); return data.signedUrl;
  }));
  const applicant = fullName(p);
  const ownApplication = a.applicant_id === user.id;
  const facts: [string, string][] = [
    ["Applicant", applicant], ["Student ID", p?.student_id ?? "Not set"], ["Email", p?.email ?? "Not available"],
    ["Position", a.position_title], ["Contact number", a.contact_number], ["Submitted", formatDateTime(a.submitted_at)],
  ];

  return <div className="space-y-6">
    <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" aria-hidden="true" />Applications</Link>
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{a.organization_name}</h1><StatusBadge status={a.status} /></div>
      <p className="text-sm text-muted-foreground">Organizer application from {applicant}</p>
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <Panel title="Applicant details">
          <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">{facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-1 break-words text-sm">{v}</dd></div>)}</dl>
        </Panel>
        <Panel title="Reason for applying"><p className="whitespace-pre-wrap p-4 text-sm leading-relaxed">{a.reason}</p></Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Private documents" description="Links expire after 60 seconds. Refresh to reopen.">
          <div className="grid gap-2 p-4">{documents.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", className: "justify-start" })}><FileTextIcon aria-hidden="true" />{i === 0 ? "Proof of authorization" : "Supporting document"}</a>)}</div>
        </Panel>
        <Panel title="Decision">
          <div className="space-y-3 p-4 text-sm">
            {a.status === "pending" && !ownApplication ? <>
              <p className="text-muted-foreground">Approving makes {applicant} an active organizer who can create and publish events.</p>
              <div className="flex flex-wrap gap-2">
                <ReviewAction label="Approve" title={`Approve ${a.organization_name}?`} description={`${applicant} will become an active organizer and can create and publish events.`} confirmLabel="Approve organizer" runAction={reviewApplication.bind(null, a.id, "approved")} />
                <ReviewAction label="Reject" tone="destructive" reason="required" title="Reject this application?" description="Give the reason for rejecting this application." confirmLabel="Reject application" runAction={reviewApplication.bind(null, a.id, "rejected")} />
              </div>
            </> : a.status === "pending" ? <p className="text-muted-foreground">Another administrator must review your application.</p> : <>
              {a.reviewed_at && <p className="text-muted-foreground">Reviewed {formatDateTime(a.reviewed_at)}</p>}
              {a.review_notes ? <p className="whitespace-pre-wrap">{a.review_notes}</p> : <p className="text-muted-foreground">No review notes.</p>}
            </>}
          </div>
        </Panel>
      </div>
    </div>
  </div>;
}
