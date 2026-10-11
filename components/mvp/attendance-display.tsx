"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { attendanceDisplay } from "@/lib/attendance-actions";
import type { AttendanceState } from "@/lib/attendance";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/datetime";
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
 const token=state.qr.tokens.findLast(t=>Date.parse(t.valid_from)<=serverNow&&serverNow<Date.parse(t.valid_until));
 const open=state.qr.closes_at!==null&&serverNow<Date.parse(state.qr.closes_at);
 const value=open&&token?`${origin}/scan?t=${token.token}`:"";
 useEffect(()=>{let alive=true;if(value)void QRCode.toDataURL(value,{width:640,margin:4,errorCorrectionLevel:"M"}).then(data=>{if(alive)setQr({value,data});});return()=>{alive=false;};},[value]);
 return <main className="min-h-svh bg-slate-950 text-white"><header className="flex items-center justify-between gap-4 border-b border-white/15 px-6 py-4"><span className="text-sm">{connection}</span><div className="flex gap-4"><button className="underline" onClick={()=>void document.documentElement.requestFullscreen?.().catch(()=>{})}>Fullscreen</button><Link className="underline" href={`/organizer/events/${id}/attendance`}>Exit display</Link></div></header>
 <div className="grid gap-8 p-6 lg:grid-cols-[minmax(360px,1fr)_1.2fr] lg:p-10"><section className="space-y-5"><h1 className="text-3xl font-semibold">{state.qr.title}</h1><p className="text-xl text-orange-300">{open?(state.qr.kind==="time_out"?"Time-out open":"Time-in open"):"Attendance closed"}</p>
 {value&&qr.value===value?<Image src={qr.data} alt="Rotating attendance QR code" width={640} height={640} unoptimized className="w-full max-w-[480px] rounded-xl bg-white"/>:<div className="flex aspect-square max-w-[480px] items-center justify-center rounded-xl bg-slate-800 p-8 text-center">{open?"Reconnecting. Wait for a fresh QR code.":"Attendance is closed."}</div>}
 <p aria-live="off">Refreshes in {token?Math.max(0,Math.ceil((Date.parse(token.valid_from)+30000-serverNow)/1000)):0}s</p><p className="text-slate-300">Scan with your phone camera or EventHub → Scan. Sign in with your own account.</p></section>
 <section aria-label="Successful check-ins" className="space-y-5"><div className="flex flex-wrap gap-6 border-b border-white/15 pb-5"><p><strong className="text-3xl">{state.feed.present}</strong> / {state.feed.approved} present</p><p>{state.feed.timed_out} timed out</p><p>{state.feed.flagged} flagged</p></div><h2 className="text-xl font-semibold">Live check-ins</h2>
 <ul className="divide-y divide-white/10">{state.feed.records.map(r=><li key={r.id} className="flex items-center gap-4 py-4">{r.photo?<Image alt="" src={r.photo} width={56} height={56} unoptimized className="size-14 rounded-full object-cover"/>:<span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-700" aria-hidden="true">{r.name.charAt(0)}</span>}<div className="min-w-0 flex-1"><p className="font-semibold">{r.name} {r.flag&&!r.flag_resolution&&<span className="text-orange-300" aria-label="Flagged for review">⚠</span>}</p><p className="text-sm text-slate-400">{r.college}</p></div><p className="text-right text-sm">{r.time_out_at?"Timed out":"Timed in"}<br/>{formatTime(r.time_out_at??r.time_in_at)}</p></li>)}</ul>{!state.feed.records.length&&<p className="text-slate-400">Successful scans appear here.</p>}</section></div></main>;
}
