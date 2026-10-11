import { getOwnedEvent } from "@/lib/mvp/queries";
import { createClient } from "@/lib/supabase/server";
import { csvRow } from "@/lib/csv";
export async function GET(_request:Request,{params}:RouteContext<"/organizer/events/[eventId]/reports/export">){
 const {eventId}=await params;await getOwnedEvent(eventId);const client=await createClient();
 const encoder=new TextEncoder();
 const stream=new ReadableStream({async start(controller){
  try{
   controller.enqueue(encoder.encode("\ufeff"+csvRow(["Participant name","Student ID","College","Program","Year level","Registration status","Time-in","Time-out","Attendance status","Certificate number"])));
   for(let offset=0;;offset+=1000){
    const {data,error}=await client.rpc("export_event_report",{p_event_id:eventId}).range(offset,offset+999);if(error)throw Error("Could not export report.");
    for(const row of data)controller.enqueue(encoder.encode(csvRow([row.name,row.student_id,row.college,row.program,row.year_level,row.registration_status,row.time_in_at,row.time_out_at,row.attendance_status,row.certificate_number])));
    if(data.length<1000)break;
   }controller.close();
  }catch(error){controller.error(error);}
 }});
 return new Response(stream,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="EventHub-${eventId}-participants.csv"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
