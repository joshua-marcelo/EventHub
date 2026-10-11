import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";
export const eligibilitySchema=z.object({counts:z.record(z.string(),z.number()),participants:z.array(z.object({registration_id:z.string(),name:z.string(),reason:z.string()}))});
export const verificationSchema=z.object({recipient_name:z.string(),event_title:z.string(),event_date:z.string(),certificate_number:z.string(),issued_at:z.string(),issuer_name:z.string(),status:z.enum(["Valid","Revoked"])});
export async function getCertificate(id:string){
 await requireUser({allowIncomplete:true});if(!idSchema.safeParse(id).success)notFound();
 const {data,error}=await(await createClient()).from("certificates").select("*").eq("id",id).maybeSingle();if(error)throw Error("Could not load certificate.");if(!data)notFound();return data;
}
