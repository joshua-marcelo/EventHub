import { z } from "zod";
export const qrStateSchema = z.object({
 server_time:z.string(),title:z.string(),kind:z.enum(["time_in","time_out"]).nullable(),closes_at:z.string().nullable(),
 tokens:z.array(z.object({token:z.string(),valid_from:z.string(),valid_until:z.string()})),
});
export const feedSchema = z.object({
 approved:z.number(),present:z.number(),timed_out:z.number(),flagged:z.number(),
 records:z.array(z.object({id:z.string(),name:z.string(),avatar_path:z.string().nullable(),college:z.string().nullable(),time_in_at:z.string(),time_out_at:z.string().nullable(),flag:z.string().nullable(),flag_resolution:z.string().nullable(),photo:z.string().nullable().optional()})),
});
export type AttendanceState = {qr:z.infer<typeof qrStateSchema>;feed:z.infer<typeof feedSchema>};
export function parseScan(value:string,origin:string):{kind:"attendance";token:string}|{kind:"registration";path:string}|{kind:"invalid"} {
 try {
  const url=new URL(value);if(url.origin!==new URL(origin).origin)return {kind:"invalid"};
  if(url.pathname==="/scan" && /^[A-Za-z0-9_-]{48}$/.test(url.searchParams.get("t")??""))return {kind:"attendance",token:url.searchParams.get("t")!};
  if(/^\/events\/[0-9a-f-]{36}$/i.test(url.pathname)||/^\/e\/[A-Z0-9]{8}$/i.test(url.pathname))return {kind:"registration",path:url.pathname};
 }catch{}
 return {kind:"invalid"};
}
export const scanMessages:Record<string,string>={
 invalid_qr:"This is not a valid EventHub attendance code.",attendance_closed:"Attendance is closed.",expired_qr:"Code expired. Scan the code currently on the organizer’s screen.",
 wrong_event:"This code belongs to another event.",profile_incomplete:"Complete your profile first.",not_registered:"You are not registered for this event.",
 registration_not_approved:"Your registration is not approved.",attendance_revoked:"Attendance revoked. See the organizer.",timed_in:"Time-in recorded.",already_timed_in:"Already timed in.",
 timed_out:"Time-out recorded.",already_timed_out:"Already timed out.",time_in_required:"No time-in recorded. See the organizer.",
};
