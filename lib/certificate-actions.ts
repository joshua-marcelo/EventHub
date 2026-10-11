"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";
import type { ActionResult } from "@/lib/action-result";
export async function generateCertificates(id:string):Promise<ActionResult>{
 if(!idSchema.safeParse(id).success)return {ok:false,error:"Invalid event."};await requireOrganizer();
 const {data,error}=await(await createClient()).rpc("issue_certificates",{p_event_id:id});const p=z.object({code:z.string(),issued:z.number().optional()}).safeParse(data);
 if(error||!p.success||p.data.code!=="ok")return {ok:false,error:"Complete the event and enable certificates first. Only eligible participants can receive certificates."};
 revalidatePath("/", "layout");return {ok:true,message:`${p.data.issued??0} certificate(s) issued. Existing certificates and ineligible participants skipped.`};
}
export async function enableCertificates(id:string,enabled:boolean):Promise<ActionResult>{
 if(!idSchema.safeParse(id).success||typeof enabled!=="boolean")return {ok:false,error:"Invalid event."};await requireOrganizer();
 const {data,error}=await(await createClient()).rpc("set_certificate_enabled",{p_event_id:id,p_enabled:enabled});
 if(error||data!=="ok")return {ok:false,error:"Could not change certificate settings. Settings lock after issuance."};revalidatePath("/", "layout");return {ok:true,message:"Saved."};
}
export async function revokeCertificate(id:string,reason:string):Promise<ActionResult>{
 if(!idSchema.safeParse(id).success||!reason.trim()||reason.length>1000)return {ok:false,error:"Enter a reason."};await requireOrganizer();
 const {data,error}=await(await createClient()).rpc("revoke_certificate",{p_id:id,p_reason:reason});
 if(error||data!=="ok")return {ok:false,error:"Could not revoke this certificate."};revalidatePath("/", "layout");return {ok:true,message:"Certificate revoked."};
}
