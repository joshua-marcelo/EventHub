import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { accountProfileHref, resolveWorkspaceContext } from "@/lib/navigation";

export const metadata = { title: "Account Profile" };
export default function Page({ searchParams }: PageProps<"/profile">) {
  return <Suspense fallback={<PageSkeleton />}><LegacyProfile searchParams={searchParams} /></Suspense>;
}
async function LegacyProfile({ searchParams }: Pick<PageProps<"/profile">, "searchParams">) {
  const user = await requireUser({ allowIncomplete: true, next: "/profile" });
  return redirect(accountProfileHref(resolveWorkspaceContext(user, (await searchParams).workspace)));
}
