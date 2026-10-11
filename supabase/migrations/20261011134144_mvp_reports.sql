create function public.get_event_report(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare approved bigint;attended bigint;
begin
 if not private.is_permanent_user() or not exists(select 1 from public.events where id=p_event_id and organizer_id=auth.uid()) then return null;end if;
 select count(*) into approved from public.event_registrations where event_id=p_event_id and status='approved';
 select count(*) into attended from public.attendance_records where event_id=p_event_id and status='present';
 return jsonb_build_object('registered',(select count(*) from public.event_registrations where event_id=p_event_id and status in ('approved','pending')),'approved',approved,'attended',attended,'attendance_rate',case when approved=0 then 0 else round(attended::numeric*100/approved,1) end,'certificates_issued',(select count(*) from public.certificates where event_id=p_event_id and revoked_at is null),'certificates_revoked',(select count(*) from public.certificates where event_id=p_event_id and revoked_at is not null));
end;$$;
create function public.export_event_report(p_event_id uuid) returns table(name text,student_id text,college text,program text,year_level smallint,registration_status text,time_in_at timestamptz,time_out_at timestamptz,attendance_status text,certificate_number text) language sql stable security definer set search_path='' as $$
 select case when visible then public.profile_full_name(p) else 'Profile access expired' end,case when visible then p.student_id end,case when visible then co.name end,case when visible then pr.name end,case when visible then p.year_level end,r.status::text,a.time_in_at,a.time_out_at,
 case when a.status='revoked' then 'revoked' when a.id is null then 'absent' when e.attendance_policy='time_in_and_out' and a.time_out_at is null then 'incomplete' when a.time_out_at is not null then 'timed_out' else 'timed_in' end,c.certificate_number
 from public.events e join public.event_registrations r on r.event_id=e.id join public.profiles p on p.id=r.user_id left join public.colleges co on co.id=p.college_id left join public.programs pr on pr.id=p.program_id
 left join public.attendance_records a on a.registration_id=r.id left join public.certificates c on c.registration_id=r.id and c.revoked_at is null
 cross join lateral(select coalesce(e.completed_at,e.cancelled_at) is null or now()<coalesce(e.completed_at,e.cancelled_at)+interval '30 days' as visible)access
 where private.is_permanent_user() and e.id=p_event_id and e.organizer_id=auth.uid() order by r.registered_at,r.id;
$$;
revoke all on function public.get_event_report(uuid),public.export_event_report(uuid) from public,anon;
grant execute on function public.get_event_report(uuid),public.export_event_report(uuid) to authenticated;

-- Definer RPCs must honor the same per-event profile-access cutoff as RLS.
create function private.event_profiles_visible(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select coalesce(completed_at,cancelled_at) is null or now()<coalesce(completed_at,cancelled_at)+interval '30 days' from public.events where id=p_event_id),false);
$$;
revoke all on function private.event_profiles_visible(uuid) from public,anon,authenticated;
create or replace function public.get_attendance_feed(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_permanent_user() or not private.is_active_organizer() or not exists(select 1 from public.events where id=p_event_id and organizer_id=auth.uid()) then return null;end if;
 return jsonb_build_object('approved',(select count(*) from public.event_registrations where event_id=p_event_id and status='approved'),'present',(select count(*) from public.attendance_records where event_id=p_event_id and status='present'),'timed_out',(select count(*) from public.attendance_records where event_id=p_event_id and status='present' and time_out_at is not null),'flagged',(select count(*) from public.attendance_records where event_id=p_event_id and flag is not null and flag_resolution is null),'records',coalesce((select jsonb_agg(x order by x.latest desc) from (select a.id,public.profile_full_name(p) as name,p.avatar_path,c.name as college,a.time_in_at,a.time_out_at,a.flag,a.flag_resolution,greatest(a.time_in_at,a.time_out_at) as latest from public.attendance_records a join public.profiles p on p.id=a.user_id left join public.colleges c on c.id=p.college_id where a.event_id=p_event_id and a.status='present' and private.event_profiles_visible(p_event_id) order by greatest(a.time_in_at,a.time_out_at) desc limit 50)x),'[]'::jsonb));
end;$$;
create or replace function public.get_certificate_eligibility(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_permanent_user() or not exists(select 1 from public.events where id=p_event_id and organizer_id=auth.uid()) then return null;end if;
 return jsonb_build_object('counts',coalesce((select jsonb_object_agg(reason,n) from (select reason,count(*) n from private.certificate_eligibility(p_event_id) group by reason)x),'{}'::jsonb),'participants',coalesce((select jsonb_agg(jsonb_build_object('registration_id',registration_id,'name',case when private.event_profiles_visible(p_event_id) then name else 'Profile access expired' end,'reason',reason) order by name) from private.certificate_eligibility(p_event_id)),'[]'::jsonb));
end;$$;
