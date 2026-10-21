import { redirect } from "next/navigation";
import { ACCOUNT_PROFILE_PATH } from "@/lib/navigation";

export const metadata = { title: "Student details" };
// Student details now live on the Account Profile. Not behind onboarding, so this cannot loop.
export default function Page() { redirect(`${ACCOUNT_PROFILE_PATH}#student-details`); }
