"use client";
import { useState,useTransition,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { attendanceSettings } from "@/lib/attendance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { SelectField } from "@/components/forms/select-field";
export function AttendanceSettings({id,policy,lead,onsite,locked,disabled}:{id:string;policy:string;lead:number;onsite:boolean;locked:boolean;disabled:boolean}){
 const [message,setMessage]=useState("");const [ok,setOk]=useState(false);const [pending,start]=useTransition();const router=useRouter();
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);start(async()=>{const r=await attendanceSettings(id,{policy:locked?policy:f.get("policy"),lead:locked?lead:f.get("lead"),onsite:f.get("onsite")==="on"});setOk(r.ok);setMessage(r.ok?"Settings saved.":r.error);if(r.ok)router.refresh();});}
 return <form onSubmit={submit} className="space-y-4 rounded-lg border p-4" aria-busy={pending}>
  <div className="grid gap-4 sm:grid-cols-2">
   <SelectField name="policy" label="Attendance policy" defaultValue={policy} disabled={locked||disabled} options={[{value:"time_in_only",label:"Time-in only"},{value:"time_in_and_out",label:"Time-in and time-out"}]}/>
   <Field><FieldLabel htmlFor="attendance-lead">Check-in opens before start</FieldLabel><Input id="attendance-lead" name="lead" type="number" min={0} max={180} defaultValue={lead} disabled={locked||disabled}/><FieldDescription>Minutes, 0–180.</FieldDescription></Field>
  </div>
  <label className="flex items-center gap-2 text-sm"><input name="onsite" type="checkbox" defaultChecked={onsite} disabled={disabled} className="size-4 accent-primary"/>Allow on-site registration</label>
  <div className="flex flex-wrap items-center gap-3 border-t pt-4"><Button type="submit" variant="outline" size="sm" disabled={pending||disabled}>{pending?"Saving…":"Save settings"}</Button>{locked&&<p className="text-xs text-muted-foreground">Policy and timing are locked because attendance has started.</p>}{message&&<p role="status" className={ok?"text-sm text-muted-foreground":"text-sm text-destructive"}>{message}</p>}</div>
 </form>;
}
