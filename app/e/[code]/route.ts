import { requireUser } from "@/lib/auth/dal";
export async function GET() { await requireUser(); return Response.json({ message: "Invite links are not available yet." }, { status: 501 }); }
