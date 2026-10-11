import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request, { params }: RouteContext<"/e/[code]">) {
  const { code } = await params;
  await requireUser({ next:`/e/${code}` });
  const {data,error} = /^[A-Z2-9]{8}$/i.test(code) ? await (await createClient()).rpc("get_event_by_invite_code",{p_code:code}) : {data:null,error:null};
  if (error) return Response.json({error:"Could not load invite. Try again."},{status:503});
  if (!data) return Response.json({error:"This event isn’t available."},{status:404});
  return Response.redirect(new URL(`/events/${data}`,request.url),303);
}