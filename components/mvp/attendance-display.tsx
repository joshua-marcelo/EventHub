"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { CheckCircle2Icon, MaximizeIcon, ScanLineIcon, XIcon } from "lucide-react";
import { attendanceDisplay } from "@/lib/attendance-actions";
import type { AttendanceState } from "@/lib/attendance";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/datetime";

/**
 * Projector display for an open attendance session. Left: the rotating QR (the same signed tokens the
 * server verifies). Right: the latest server-confirmed attendance, with only name, college and photo
 * (no student ID). Updates through Realtime with a 3-second polling fallback.
 */
export function AttendanceDisplay({id,initial,origin}:{id:string;initial:AttendanceState;origin:string}){
 const [state,setState]=useState(initial),[now,setNow]=useState(Date.now),[qr,setQr]=useState({value:"",data:""}),[connection,setConnection]=useState("Connecting");
 const [offset,setOffset]=useState(()=>Date.parse(initial.qr.server_time)-Date.now());
 useEffect(()=>{
  let alive=true,busy=false;const c=createClient();
  async function refresh(){if(busy)return;busy=true;try{const data=await attendanceDisplay(id);if(alive&&data){setState(data);setOffset(Date.parse(data.qr.server_time)-Date.now());}else if(alive)setConnection("Unavailable");}catch{if(alive)setConnection("Reconnecting");}finally{busy=false;}}
  const channel=c.channel(`attendance:${id}`).on("postgres_changes",{event:"*",schema:"public",table:"attendance_records",filter:`event_id=eq.${id}`},()=>void refresh());
  void c.auth.getSession().then(async({data})=>{if(!alive||!data.session)return;await c.realtime.setAuth(data.session.access_token);if(alive)channel.subscribe(status=>{if(!alive)return;setConnection(status==="SUBSCRIBED"?"Live":"Polling");void refresh();});});
  const poll=setInterval(()=>void refresh(),3000),clock=setInterval(()=>setNow(Date.now()),1000);
  return()=>{alive=false;clearInterval(poll);clearInterval(clock);void c.removeChannel(channel);};
 },[id]);
 const serverNow=now+offset;
 const token=[...state.qr.tokens].reverse().find(t=>Date.parse(t.valid_from)<=serverNow&&serverNow<Date.parse(t.valid_until));
 const open=state.qr.closes_at!==null&&serverNow<Date.parse(state.qr.closes_at);
 const value=open&&token?`${origin}/scan?t=${token.token}`:"";
 useEffect(()=>{let alive=true;if(value)void QRCode.toDataURL(value,{width:720,margin:2,errorCorrectionLevel:"M"}).then(data=>{if(alive)setQr({value,data});});return()=>{alive=false;};},[value]);
 const latest=state.feed.records[0];
 const seconds=token?Math.max(0,Math.ceil((Date.parse(token.valid_from)+30000-serverNow)/1000)):0;

 return <main className="flex min-h-svh flex-col bg-slate-950 text-white">
  <header className="flex items-center justify-between gap-4 px-6 py-3 text-sm text-slate-400">
   <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`size-2 rounded-full ${connection==="Live"?"bg-emerald-400":"bg-amber-400"}`}/>{connection}</span>
   <div className="flex items-center gap-1">
    <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-orange-400" onClick={()=>void document.documentElement.requestFullscreen?.().catch(()=>{})}><MaximizeIcon className="size-4" aria-hidden="true"/>Fullscreen</button>
    <Link className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-orange-400" href={`/organizer/events/${id}/attendance`}><XIcon className="size-4" aria-hidden="true"/>Exit display</Link>
   </div>
  </header>
  <div className="grid flex-1 items-center gap-8 px-6 pb-8 md:px-10 lg:grid-cols-2 lg:gap-12 xl:px-16">
   <section aria-label="Attendance QR code" className="flex flex-col items-center gap-5 text-center">
    <div className="space-y-2">
     <h1 className="text-balance text-3xl font-semibold tracking-tight xl:text-4xl">{state.qr.title}</h1>
     <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${open?"bg-emerald-500/15 text-emerald-300":"bg-white/10 text-slate-300"}`}><span aria-hidden="true" className={`size-2 rounded-full ${open?"bg-emerald-400 motion-safe:animate-pulse":"bg-slate-400"}`}/>{open?(state.qr.kind==="time_out"?"Time-out open":"Attendance open"):"Attendance closed"}</p>
    </div>
    {value&&qr.value===value
     ?<Image src={qr.data} alt="Rotating attendance QR code" width={720} height={720} unoptimized className="aspect-square w-full max-w-[min(30rem,62vh)] rounded-2xl bg-white p-3"/>
     :<div className="flex aspect-square w-full max-w-[min(30rem,62vh)] items-center justify-center rounded-2xl bg-slate-800 p-8 text-lg text-slate-300">{open?"Loading a fresh QR code…":"Attendance is closed."}</div>}
    <div className="space-y-1">
     <p className="inline-flex items-center gap-2 text-lg font-medium"><ScanLineIcon className="size-5 text-orange-300" aria-hidden="true"/>Scan with EventHub → Scan, signed in to your own account</p>
     {open&&<p className="text-sm text-slate-400" aria-live="off">New code in {seconds}s</p>}
    </div>
   </section>
   <section aria-label="Latest attendance" aria-live="polite" className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
    {latest
     ?<div key={latest.id} className="flex flex-col items-center gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
       {latest.photo
        ?<Image alt="" src={latest.photo} width={208} height={208} unoptimized className="size-40 rounded-full object-cover ring-4 ring-emerald-400/70 xl:size-52"/>
        :<span aria-hidden="true" className="flex size-40 items-center justify-center rounded-full bg-slate-700 text-6xl font-semibold ring-4 ring-emerald-400/70 xl:size-52">{latest.name.charAt(0)}</span>}
       <div className="space-y-1">
        <p className="text-balance text-3xl font-semibold xl:text-4xl">{latest.name}</p>
        {latest.college&&<p className="text-lg text-slate-400">{latest.college}</p>}
       </div>
       <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-lg font-medium text-emerald-300"><CheckCircle2Icon className="size-5" aria-hidden="true"/>{latest.time_out_at?"Time-out recorded":"Attendance recorded"} · {formatTime(latest.time_out_at??latest.time_in_at)}</p>
      </div>
     :<div className="space-y-3 text-slate-400"><ScanLineIcon className="mx-auto size-12 opacity-60" aria-hidden="true"/><p className="text-2xl font-medium text-slate-300">Waiting for participant…</p><p>Confirmed attendance appears here.</p></div>}
    <p className="mt-8 text-sm text-slate-400"><strong className="text-base text-white tabular-nums">{state.feed.present}</strong> present of {state.feed.approved} approved</p>
   </section>
  </div>
 </main>;
}
