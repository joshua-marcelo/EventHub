import { requireOrganizer } from "@/lib/auth/dal";
export async function GET() { await requireOrganizer(); return Response.json({ message: "Report exports are not available yet." }, { status: 501 }); }
