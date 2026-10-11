import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
async function join(form: FormData) {
  "use server";
  await requireUser({next:"/events/join"});
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code)) redirect("/events/join?error=unavailable");
  const {data,error} = await (await createClient()).rpc("get_event_by_invite_code",{p_code:code});
  if (error) redirect("/events/join?error=retry");
  if (!data) redirect("/events/join?error=unavailable");
  redirect(`/events/${data}`);
}
export default function Page(props: PageProps<"/events/join">) { return <Suspense fallback={<PageSkeleton />}><Content {...props} /></Suspense>; }
async function Content({searchParams}: PageProps<"/events/join">) {
  await requireUser({next:"/events/join"}); const q = await searchParams;
  return <div className="max-w-md space-y-6"><PageHeader title="Join by invite code" /><form action={join} className="space-y-3"><label className="block space-y-1"><span>Event invite code</span><Input name="code" required minLength={8} maxLength={8} autoCapitalize="characters" /></label><Button type="submit">Open event</Button></form>{q.error && <p role="alert">{q.error === "retry" ? "Could not load invite. Try again." : "This event isn’t available. Check the code."}</p>}</div>;
}