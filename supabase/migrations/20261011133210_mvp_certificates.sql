-- One immutable fixed layout, PDFs rendered on demand. No template editor/storage.
create sequence public.certificate_number_seq;
revoke all on sequence public.certificate_number_seq from public,anon,authenticated;
create table public.certificates (
 id uuid primary key default extensions.gen_random_uuid(),certificate_number text not null unique,
 verification_code text not null unique default translate(rtrim(encode(extensions.gen_random_bytes(16),'base64'),'='),'+/','-_'),
 event_id uuid not null references public.events(id),user_id uuid not null references public.profiles(id),registration_id uuid not null unique,
 foreign key(registration_id,event_id,user_id) references public.event_registrations(id,event_id,user_id),
 attendance_record_id uuid not null references public.attendance_records(id),template_version smallint not null default 1 check(template_version=1),
 recipient_name text not null,event_title text not null,event_date date not null,issuer_name text not null,
 issued_at timestamptz not null default now(),issued_by uuid not null references public.profiles(id),revoked_at timestamptz,revoked_by uuid references public.profiles(id),
 check((revoked_at is null)=(revoked_by is null))
);
create index certificates_user on public.certificates(user_id,issued_at desc);
create index certificates_event on public.certificates(event_id);
alter table public.certificates enable row level security;
revoke all on public.certificates from anon,authenticated;
grant select on public.certificates to authenticated;
create policy "Certificates: holder or event owner" on public.certificates for select to authenticated using ((select private.is_permanent_user()) and (user_id=(select auth.uid()) or exists(select 1 from public.events e where e.id=event_id and e.organizer_id=(select auth.uid()))));
create function private.certificate_eligibility(p_event_id uuid) returns table(registration_id uuid,attendance_id uuid,user_id uuid,name text,reason text) language sql stable security definer set search_path='' as $$
 select r.id,a.id,r.user_id,public.profile_full_name(p),case
 when c.id is not null then 'issued'
 when r.status<>'approved' then 'not_approved'
 when a.id is null then 'absent'
 when a.status='revoked' then 'revoked_attendance'
 when p.identity_flagged_at is not null then 'identity_review'
 when a.flag is not null and a.flag_resolution is null then 'blocked_by_flags'
 when e.attendance_policy='time_in_and_out' and a.time_out_at is null then 'missing_time_out'
 else 'eligible' end
 from public.event_registrations r join public.events e on e.id=r.event_id join public.profiles p on p.id=r.user_id
 left join public.attendance_records a on a.registration_id=r.id left join public.certificates c on c.registration_id=r.id where r.event_id=p_event_id;
$$;
create function public.get_certificate_eligibility(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_permanent_user() or not exists(select 1 from public.events where id=p_event_id and organizer_id=auth.uid()) then return null;end if;
 return jsonb_build_object('counts',coalesce((select jsonb_object_agg(reason,n) from (select reason,count(*) n from private.certificate_eligibility(p_event_id) group by reason)x),'{}'::jsonb),'participants',coalesce((select jsonb_agg(jsonb_build_object('registration_id',registration_id,'name',name,'reason',reason) order by name) from private.certificate_eligibility(p_event_id)),'[]'::jsonb));
end;$$;
create function public.set_certificate_enabled(p_event_id uuid,p_enabled boolean) returns text language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted';end if;
 select * into e from public.events where id=p_event_id and organizer_id=auth.uid() for update;if not found then return 'not_permitted';end if;
 if e.status='cancelled' or p_enabled is null then return 'invalid_status';end if;
 if exists(select 1 from public.certificates where event_id=e.id) and p_enabled is distinct from e.certificates_enabled then return 'certificates_locked';end if;
 update public.events set certificates_enabled=p_enabled where id=e.id;perform private.log_audit('certificate.settings_changed','events',e.id);return 'ok';
end;$$;
create function public.issue_certificates(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events;issuer text;n integer;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return jsonb_build_object('code','not_permitted');end if;
 select * into e from public.events where id=p_event_id and organizer_id=auth.uid() for update;if not found then return jsonb_build_object('code','not_permitted');end if;
 if e.status<>'completed' or not e.certificates_enabled then return jsonb_build_object('code','invalid_status');end if;
 -- Serialize with identity disputes and profile corrections before snapshots.
 perform 1 from public.profiles p where p.id in(select user_id from public.event_registrations where event_id=e.id) order by p.id for update;
 select organization_name into issuer from public.organizer_applications where applicant_id=e.organizer_id and status='approved' order by reviewed_at desc limit 1;
 issuer:=coalesce(issuer,'EventHub Organizer');
 insert into public.certificates(certificate_number,event_id,user_id,registration_id,attendance_record_id,recipient_name,event_title,event_date,issuer_name,issued_by)
 select 'CLC-'||extract(year from e.starts_at at time zone 'Asia/Manila')::text||'-'||lpad(nextval('public.certificate_number_seq')::text,6,'0'),e.id,x.user_id,x.registration_id,x.attendance_id,x.name,e.title,(e.starts_at at time zone 'Asia/Manila')::date,issuer,auth.uid()
 from private.certificate_eligibility(e.id)x where x.reason='eligible' on conflict(registration_id) do nothing;
 get diagnostics n=row_count;
 perform private.log_audit('certificate.issued','events',e.id,jsonb_build_object('issued',n));
 return jsonb_build_object('code','ok','issued',n,'eligibility',public.get_certificate_eligibility(e.id)->'counts');
end;$$;
create function public.revoke_certificate(p_id uuid,p_reason text) returns text language plpgsql security definer set search_path='' as $$
declare c public.certificates;
begin
 if not private.is_permanent_user() or not private.is_active_organizer() then return 'not_permitted';end if;
 if nullif(btrim(p_reason),'') is null or char_length(p_reason)>1000 then return 'reason_required';end if;
 select * into c from public.certificates where id=p_id;
 perform 1 from public.events where id=c.event_id and organizer_id=auth.uid() for update;if not found then return 'not_permitted';end if;
 update public.certificates set revoked_at=now(),revoked_by=auth.uid() where id=c.id and revoked_at is null;
 if found then perform private.log_audit('certificate.revoked','certificates',c.id,jsonb_build_object('reason',p_reason));end if;return 'ok';
end;$$;
create function public.verify_certificate(p_code text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('recipient_name',recipient_name,'event_title',event_title,'event_date',event_date,'certificate_number',certificate_number,'issued_at',issued_at,'issuer_name',issuer_name,'status',case when revoked_at is null then 'Valid' else 'Revoked' end) from public.certificates where verification_code=p_code and p_code~'^[A-Za-z0-9_-]{22}$';
$$;
create or replace function private.attendance_correction_allowed(p_registration_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.certificates where registration_id=p_registration_id and revoked_at is null);
$$;
create function private.certificate_identity_lock() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('eventhub.admin_dispute',true),'')<>'on' and new.student_id is distinct from old.student_id and exists(select 1 from public.certificates where user_id=old.id) then raise exception 'Student ID is locked by issued certificates' using errcode='23514';end if;return new;
end;$$;
create trigger profiles_certificate_identity_lock before update on public.profiles for each row execute function private.certificate_identity_lock();
revoke all on function private.certificate_eligibility(uuid),private.certificate_identity_lock() from public,anon,authenticated;
revoke all on function public.get_certificate_eligibility(uuid),public.set_certificate_enabled(uuid,boolean),public.issue_certificates(uuid),public.revoke_certificate(uuid,text) from public,anon;
grant execute on function public.get_certificate_eligibility(uuid),public.set_certificate_enabled(uuid,boolean),public.issue_certificates(uuid),public.revoke_certificate(uuid,text) to authenticated;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon,authenticated;
