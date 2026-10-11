"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizer,requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/mvp";
import type { ActionResult } from "@/lib/action-result";
import { qrStateSchema,feedSchema,type AttendanceState } from "@/lib/attendance";

const messages:Record<string,string>={outside_window:"Attendance opens within the configured lead time and closes one hour after the event end.",time_out_started:"Time-out has started. Use an audited manual time-in for late arrivals.",attendance_locked:"Schedule and policy are locked after attendance starts.",invalid_status:"This action is unavailable. Check event status, attendance policy, and any issued certificate.",not_permitted:"You cannot manage this event.",reason_required:"Enter a reason."};
function result(data:string|null,error:unknown):ActionResult {return !error&&data==="ok"?{ok:true,message:"Saved."}:{ok:false,error:messages[data??""]??"Could not save changes. Refresh and try again."};}
export async function attendanceAction(eventId:string,kind:"time_in"|"time_out"|"close"|"complete"):Promise<ActionResult>{
 if(!idSchema.safeParse(eventId).success||!["time_in","time_out","close","complete"].includes(kind))return {ok:false,error:"Invalid action."};
 await requireOrganizer();const c=await createClient();
 const r=kind==="close"?await c.rpc("close_attendance_session",{p_event_id:eventId}):kind==="complete"?await c.rpc("complete_event",{p_event_id:eventId}):await c.rpc("open_attendance_session",{p_event_id:eventId,p_kind:kind});
 const out=result(r.data,r.error);if(out.ok){revalidatePath("/", "layout");if(kind==="time_in"||kind==="time_out")redirect(`/organizer/events/${eventId}/attendance/display`);}return out;
}
export async function attendanceSettings(eventId:string,input:unknown):Promise<ActionResult>{
 const v=z.object({policy:z.enum(["time_in_only","time_in_and_out"]),lead:z.coerce.number().int().min(0).max(180),onsite:z.boolean()}).safeParse(input);
 if(!idSchema.safeParse(eventId).success||!v.success)return {ok:false,error:"Check the attendance settings."};
 await requireOrganizer();const r=await(await createClient()).rpc("set_attendance_settings",{p_event_id:eventId,p_policy:v.data.policy,p_lead:v.data.lead,p_onsite:v.data.onsite});const out=result(r.data,r.error);if(out.ok)revalidatePath("/", "layout");return out;
}
export async function correctAttendance(registrationId:string,action:string,reason:string):Promise<ActionResult>{
 if(!idSchema.safeParse(registrationId).success||!["time_in","time_out","revoke","clear_flag","revoke_flag"].includes(action)||!reason.trim()||reason.length>1000)return {ok:false,error:"Enter a valid reason."};
 await requireOrganizer();const r=await(await createClient()).rpc("correct_attendance",{p_registration_id:registrationId,p_action:action,p_reason:reason});const out=result(r.data,r.error);if(out.ok)revalidatePath("/", "layout");return out;
}
export async function attendanceDisplay(eventId:string):Promise<AttendanceState|null>{
 if(!idSchema.safeParse(eventId).success)return null;await requireOrganizer();const c=await createClient();
 const [q,f]=await Promise.all([c.rpc("get_attendance_qr",{p_event_id:eventId}),c.rpc("get_attendance_feed",{p_event_id:eventId})]);
 const qr=qrStateSchema.safeParse(q.data),feed=feedSchema.safeParse(f.data);if(q.error||f.error||!qr.success||!feed.success)return null;
 await Promise.all(feed.data.records.map(async r=>{r.photo=null;if(r.avatar_path){const {data}=await c.storage.from("avatars").createSignedUrl(r.avatar_path,600);r.photo=data?.signedUrl??null;}}));
 return {qr:qr.data,feed:feed.data};
}
export async function submitScan(token:string,device:string,expected:string|null){
 if(!/^[A-Za-z0-9_-]{48}$/.test(token)||!z.uuid().safeParse(device).success||(expected!==null&&!idSchema.safeParse(expected).success))return {code:"invalid_qr"};
 await requireUser({next:"/scan"});const {data,error}=await(await createClient()).rpc("submit_attendance_scan",{p_token:token,p_device_id:device,p_expected_event_id:expected!});
 const v=z.object({code:z.string(),at:z.string().optional(),event_id:z.string().optional(),onsite_available:z.boolean().optional()}).safeParse(data);
 return error||!v.success?{code:"error"}:v.data;
}
