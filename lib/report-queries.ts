import "server-only";
import { z } from "zod";
import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
const reportSchema=z.object({registered:z.number(),approved:z.number(),attended:z.number(),attendance_rate:z.number(),certificates_issued:z.number(),certificates_revoked:z.number()});
export async function getEventReport(id:string){
 const owned=await getOwnedEvent(id);const {data,error}=await(await createClient()).rpc("get_event_report",{p_event_id:id});const report=reportSchema.safeParse(data);
 if(error||!report.success)throw Error("Could not load event report.");return {...owned,report:report.data};
}
