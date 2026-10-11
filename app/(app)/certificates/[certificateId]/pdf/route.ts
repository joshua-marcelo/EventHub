import { requireUser } from "@/lib/auth/dal";
export async function GET() { await requireUser(); return Response.json({ message: "Certificate downloads are not available yet." }, { status: 501 }); }
