"use client";
import { useCallback,useEffect,useRef,useState,useTransition } from "react";
import Link from "next/link";
import { CheckCircle2Icon,CircleAlertIcon,LoaderCircleIcon } from "lucide-react";
import { BrowserQRCodeReader,type IScannerControls } from "@zxing/browser";
import { submitScan } from "@/lib/attendance-actions";
import { parseScan,scanMessages } from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
function deviceId(){
 const cookie=document.cookie.split("; ").find(c=>c.startsWith("eh-device="))?.slice(10);
 let id=cookie;try{id=localStorage.getItem("eh-device")??cookie;}catch{}
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))id=crypto.randomUUID();
 try{localStorage.setItem("eh-device",id);}catch{}
 document.cookie=`eh-device=${id}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;return id;
}
/** Codes after which attendance is on record; everything else lets the participant scan again. */
export const RECORDED=new Set(["timed_in","timed_out","already_timed_in","already_timed_out"]);
/** Actionable wording for getUserMedia failures (permission, missing hardware, insecure origin). */
export function cameraError(error:unknown){
 const name=error instanceof Error?error.name:"";
 if(typeof window!=="undefined"&&!window.isSecureContext)return "The camera needs a secure (HTTPS) connection. Open EventHub over HTTPS, or scan using your phone’s camera app.";
 if(name==="NotAllowedError"||name==="SecurityError")return "Camera access was blocked. Allow camera access for this site in your browser settings, then try again.";
 if(name==="NotFoundError"||name==="OverconstrainedError"||name==="DevicesNotFoundError")return "No camera was found on this device. Scan using your phone’s camera app instead.";
 if(name==="NotReadableError")return "The camera is in use by another app. Close it, then try again.";
 return "Camera unavailable. Allow camera access, or scan using your phone’s camera app.";
}
type Phase="idle"|"starting"|"scanning"|"submitting"|"success"|"error";
/**
 * The one attendance scanner: used by /scan and by the in-app dialog. Signed `/scan?t=` links are submitted
 * on load; submit_attendance_scan checks the rotating QR, active session, approved registration and duplicates.
 */
export function AttendanceScanner({expected,autoStart=false,onRecorded}:{expected:string|null;autoStart?:boolean;onRecorded?:()=>void}){
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls|null>(null),busy=useRef(false),alive=useRef(true);
 const [phase,setPhase]=useState<Phase>("idle"),[message,setMessage]=useState("Point your camera at the QR on the organizer’s display."),[path,setPath]=useState(""),[,start]=useTransition();
 const stop=useCallback(()=>{controls.current?.stop();controls.current=null;},[]);
 const submit=useCallback((value:string)=>{
  if(busy.current)return;const parsed=parseScan(value,location.origin);
  if(parsed.kind==="registration"){stop();setPath(parsed.path);setPhase("error");setMessage("This is an event registration code, not an attendance code.");return;}
  if(parsed.kind==="invalid"){stop();setPhase("error");setMessage(scanMessages.invalid_qr);return;}
  busy.current=true;stop();setPhase("submitting");
  start(async()=>{try{const r=await submitScan(parsed.token,deviceId(),expected);const text=(scanMessages[r.code]??"Could not record attendance. Scan again.")+(r.at?` ${formatTime(r.at)}`:"");
   if(RECORDED.has(r.code)){setPhase("success");setMessage(text);onRecorded?.();}else{setPhase("error");setMessage(text);}}
   catch{setPhase("error");setMessage("Could not record attendance. Scan again.");}finally{busy.current=false;}});
 },[expected,onRecorded,stop]);
 const openCamera=useCallback(async()=>{
  setPath("");setPhase("starting");setMessage("Point your camera at the QR on the organizer’s display.");
  try{const reader=new BrowserQRCodeReader();const c=await reader.decodeFromConstraints({video:{facingMode:"environment"},audio:false},video.current!,(result,_error,scanner)=>{if(result){scanner.stop();submit(result.getText());}});
   // Closed (dialog dismissed) while the camera was starting: release it at once.
   if(!alive.current){c.stop();return;}controls.current=c;setPhase(p=>p==="starting"?"scanning":p);}
  catch(error){stop();setPhase("error");setMessage(cameraError(error));}
 },[stop,submit]);
 useEffect(()=>{
  alive.current=true;const url=new URL(location.href),token=url.searchParams.get("t");
  const timer=setTimeout(()=>{if(token){url.searchParams.delete("t");history.replaceState(null,"",url.pathname+url.search);submit(`${location.origin}/scan?t=${token}`);}else if(autoStart)void openCamera();},0);
  return()=>{alive.current=false;clearTimeout(timer);stop();};
 },[submit,openCamera,autoStart,stop]);
 const live=phase==="starting"||phase==="scanning";
 const Icon=phase==="success"?CheckCircle2Icon:phase==="error"?CircleAlertIcon:phase==="submitting"||phase==="starting"?LoaderCircleIcon:null;
 return <div className="space-y-4">
  <div className="relative overflow-hidden rounded-lg border bg-muted/40">
   <video ref={video} autoPlay muted playsInline aria-label="Attendance QR camera preview" className={cn("aspect-square w-full object-cover",!live&&"hidden")}/>
   {!live&&<div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 p-6 text-center">
    {Icon&&<Icon className={cn("size-8",phase==="success"?"text-emerald-700":phase==="error"?"text-destructive":"animate-spin text-muted-foreground motion-reduce:animate-none")} aria-hidden="true"/>}
    {phase==="success"&&<p className="text-lg font-semibold">Attendance recorded!</p>}
    {phase==="submitting"&&<p className="font-medium">Recording attendance…</p>}
    {phase==="idle"&&<p className="text-sm text-muted-foreground">The camera is off.</p>}
   </div>}
   {phase==="starting"&&<p className="absolute inset-x-0 bottom-0 bg-background/90 p-2 text-center text-sm">Starting camera…</p>}
  </div>
  <p role="status" aria-live="polite" className={cn("text-sm",phase==="error"?"text-destructive":"text-muted-foreground")}>{message}</p>
  {path&&<Link className="block text-sm font-medium underline" href={path}>Open event</Link>}
  {(phase==="idle"||phase==="error")&&<Button onClick={()=>void openCamera()}>{phase==="error"?"Try again":"Start camera"}</Button>}
  {live&&<Button variant="outline" onClick={()=>{stop();setPhase("idle");}}>Stop camera</Button>}
 </div>;
}
