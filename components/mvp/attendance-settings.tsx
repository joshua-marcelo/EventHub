"use client";
import { useState,useTransition } from "react";
import { attendanceSettings } from "@/lib/attendance-actions";
import { Button } from "@/components/ui/button";
export function AttendanceSettings({id,policy,lead,onsite,locked,disabled}:{id:string;policy:string;lead:number;onsite:boolean;locked:boolean;disabled:boolean}){
 const [message,setMessage]=useState("");const [pending,start]=useTransition();
 return <form className="flex flex-wrap items-end gap-4" action={f=>start(async()=>{const r=await attendanceSettings(id,{policy:locked?policy:f.get("policy"),lead:locked?lead:f.get("lead"),onsite:f.get("onsite")==="on"});setMessage(r.ok?"Settings saved.":r.error);})}>
 <label className="grid gap-1">Attendance policy<select name="policy" defaultValue={policy} disabled={locked||disabled} className="rounded border p-2"><option value="time_in_only">Time-in only</option><option value="time_in_and_out">Time-in and time-out</option></select></label>
 <label className="grid gap-1">Opens before start (minutes)<input name="lead" type="number" min={0} max={180} defaultValue={lead} disabled={locked||disabled} className="rounded border p-2"/></label>
 <label><input name="onsite" type="checkbox" defaultChecked={onsite} disabled={disabled}/> Allow on-site registration</label>
 <Button disabled={pending||disabled}>Save settings</Button>{locked&&<p className="text-sm">Policy and schedule locked: attendance has started.</p>}<p role="status">{message}</p></form>;
}
