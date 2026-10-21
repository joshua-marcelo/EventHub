import { redirect } from "next/navigation";
import { ACCOUNT_PROFILE_PATH } from "@/lib/navigation";

export const metadata = { title: "Account Profile" };
// Legacy link: the account profile is shared by every role and has no workspace parameter.
export default function Page() { redirect(ACCOUNT_PROFILE_PATH); }
