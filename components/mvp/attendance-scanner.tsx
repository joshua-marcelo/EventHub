"use client";
import { useCallback,useEffect,useRef,useState,useTransition } from "react";
import Link from "next/link";
import { BrowserQRCodeReader,type IScannerControls } from "@zxing/browser";
import { submitScan } from "@/lib/attendance-actions";
import { parseScan,scanMessages } from "@/lib/attendance";
import { registrationAction } from "@/lib/mvp/actions";
import { ActionControl } from "@/components/mvp/action-control";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/datetime";
function deviceId(){
 const cookie=document.cookie.split("; ").find(c=>c.startsWith("eh-device="))?.slice(10);
 let id=cookie;try{id=localStorage.getItem("eh-device")??cookie;}catch{}
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))id=crypto.randomUUID();
 try{localStorage.setItem("eh-device",id);}catch{}
 document.cookie=`eh-device=${id}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;return id;
}
export function AttendanceScanner({expected}:{expected:string|null}){
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null),busy=useRef(false);
 const [message,setMessage]=useState("Scan the current QR on the organizer’s display."),[path,setPath]=useState(""),[onsite,setOnsite]=useState(""),[pending,start]=useTransition(),[camera,setCamera]=useState(false);
 const submit=useCallback((value:string)=>{
  if(busy.current)return;const parsed=parseScan(value,location.origin);
  if(parsed.kind==="registration"){setPath(parsed.path);setMessage("This is an event registration code, not an attendance code.");controls.current?.stop();setCamera(false);return;}
  if(parsed.kind==="invalid"){setMessage(scanMessages.invalid_qr);return;}
  busy.current=true;controls.current?.stop();setCamera(false);
  start(async()=>{try{const r=await submitScan(parsed.token,deviceId(),expected);setMessage((scanMessages[r.code]??"Could not record attendance. Scan again.")+(r.at?` ${formatTime(r.at)}`:""));setOnsite(r.onsite_available&&r.event_id?r.event_id:"");}catch{setMessage("Could not record attendance. Scan again.");}finally{busy.current=false;}});
 },[expected]);
 useEffect(()=>{
  const url=new URL(location.href),token=url.searchParams.get("t");const timer=setTimeout(()=>{if(token){url.searchParams.delete("t");history.replaceState(null,"",url.pathname+url.search);submit(`${location.origin}/scan?t=${token}`);}},0);
  return()=>{clearTimeout(timer);controls.current?.stop();};
 },[submit]);
 async function openCamera(){
  setPath("");setOnsite("");setCamera(true);
  try{const reader=new BrowserQRCodeReader();controls.current=await reader.decodeFromConstraints({video:{facingMode:"environment"},audio:false},video.current!,(result,_error,scanner)=>{if(result){scanner.stop();submit(result.getText());}});}
  catch{setCamera(false);setMessage("Camera unavailable. Allow camera access on HTTPS, or scan using your phone’s camera.");}
 }
 return <div className="max-w-lg space-y-5"><p role="status" aria-live="polite" className="rounded-lg border bg-muted/40 p-4">{message}</p><video ref={video} autoPlay muted playsInline aria-label="Attendance QR scanner" className={`w-full rounded-lg ${camera?"":"hidden"}`}/>
 <Button disabled={pending||camera} onClick={()=>void openCamera()}>{pending?"Recording…":"Scan attendance QR"}</Button>{camera&&<Button variant="outline" onClick={()=>{controls.current?.stop();setCamera(false);}}>Stop camera</Button>}
 {path&&<Link className="block underline" href={path}>Open event</Link>}{onsite&&<ActionControl label="Register on-site, then scan again" runAction={registrationAction.bind(null,onsite,"register")}/>}
 </div>;
}
