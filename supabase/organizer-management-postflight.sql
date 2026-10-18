-- POST-FLIGHT: standalone READ ONLY. Run only after separately approved application.

-- SQL Editor: use the primary development database, role postgres.
-- This file only reads. No application RPC is invoked. Keep the read-only transaction.
begin transaction isolation level repeatable read, read only;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

select now() as checked_at_utc, current_database() as database_name, current_user as database_role,
       current_setting('server_version') as postgres_version;
-- Database name alone does not identify a project: confirm ldhpbfujqnyovovabvcg in the dashboard URL.

select to_regclass('supabase_migrations.schema_migrations') is not null as history_table_exists,
 case when to_regclass('supabase_migrations.schema_migrations') is not null then
 query_to_xml($history$
   select version::text, to_jsonb(m)->>'name' as name
   from supabase_migrations.schema_migrations m
   where version::text in ('20261016012245','20261016012340') order by version
 $history$,false,true,'')::text else 'MISSING: do not create or repair history without review' end as target_versions_xml;

select column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns
where table_schema='supabase_migrations' and table_name='schema_migrations'
order by ordinal_position;

with required(schema_name,table_name) as (values
 ('public','profiles'),('public','organizer_applications'),('public','events'),
 ('public','event_registrations'),('public','certificates'),('public','audit_logs'),
 ('auth','users'),('storage','objects'),('storage','buckets'),('public','organizer_invitations'))
select r.schema_name,r.table_name,c.oid is not null as exists,c.relrowsecurity as rls_enabled,
 c.relforcerowsecurity as force_rls,pg_get_userbyid(c.relowner) as owner
from required r left join pg_class c on c.oid=to_regclass(format('%I.%I',r.schema_name,r.table_name))
order by r.schema_name,r.table_name;

select rolname,rolsuper,rolbypassrls from pg_roles
where rolname in ('postgres','anon','authenticated','service_role') order by rolname;

select policyname,schemaname,tablename,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename in ('profiles','organizer_applications','organizer_invitations'))
 or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;

-- Capture definitions/grants privately as rollback inputs; these are function source, not execution.
with targets(signature) as (values
 ('public.submit_organizer_application(jsonb)'),
  ('public.withdraw_organizer_application(uuid)'),
  ('public.review_organizer_application(uuid,text,text)'),
  ('public.reserve_organizer_invitation(text,text,text)'),
  ('public.acquire_organizer_invitation(uuid)'),
  ('public.finish_organizer_invitation(uuid,uuid,uuid,boolean)'),
  ('public.promote_participant_to_organizer(uuid)'),
  ('public.begin_organizer_acceptance(uuid,text,text)'),
  ('public.check_organizer_acceptance(uuid,text)'),
  ('public.complete_organizer_acceptance(uuid,text)'),
  ('public.save_event(uuid,jsonb)'))
select t.signature,p.oid is not null as exists,pg_get_userbyid(p.proowner) as owner,
 p.prosecdef as security_definer,p.proconfig as settings,l.lanname as language,
 md5(btrim(replace(p.prosrc,chr(13),''),E' \t\n\r')) as normalized_body_md5,
 pg_get_functiondef(p.oid) as definition
from targets t left join pg_proc p on p.oid=to_regprocedure(t.signature)
left join pg_language l on l.oid=p.prolang order by t.signature;

with targets(signature) as (values
 ('public.submit_organizer_application(jsonb)'),
  ('public.withdraw_organizer_application(uuid)'),
  ('public.review_organizer_application(uuid,text,text)'),
  ('public.reserve_organizer_invitation(text,text,text)'),
  ('public.acquire_organizer_invitation(uuid)'),
  ('public.finish_organizer_invitation(uuid,uuid,uuid,boolean)'),
  ('public.promote_participant_to_organizer(uuid)'),
  ('public.begin_organizer_acceptance(uuid,text,text)'),
  ('public.check_organizer_acceptance(uuid,text)'),
  ('public.complete_organizer_acceptance(uuid,text)'),
  ('public.save_event(uuid,jsonb)'))
select t.signature,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
 a.privilege_type,a.is_grantable
from targets t join pg_proc p on p.oid=to_regprocedure(t.signature)
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
order by t.signature,grantee;

-- Existing triggers are not created or replaced by either migration. Compare before and after.
select n.nspname as schema_name,c.relname as table_name,t.tgname,t.tgenabled,
 pg_get_triggerdef(t.oid,true) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and ((n.nspname='public' and c.relname in ('profiles','organizer_applications','events','organizer_invitations'))
 or (n.nspname='auth' and c.relname='users')) order by n.nspname,c.relname,t.tgname;

select n.nspname,c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid,true) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','organizer_applications','organizer_invitations')
order by c.relname,con.conname;

select schemaname,tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in ('profiles','organizer_applications','organizer_invitations')
order by tablename,indexname;

-- Deterministic snapshots contain only counts and aggregate hashes, never user rows or credentials.
-- Compare under a quiet application window: concurrent legitimate activity can change fingerprints.
with targets(schema_name,table_name,row_expression,where_clause) as (values
 ('public','profiles','to_jsonb(t)',''),
 ('public','organizer_applications','to_jsonb(t)',''),
 ('public','events','to_jsonb(t)',''),
 ('public','event_registrations','to_jsonb(t)',''),
 ('public','certificates','to_jsonb(t)',''),
 ('public','audit_logs','to_jsonb(t)',''),
 ('auth','users',$expr$jsonb_build_object('id',t.id,'email_confirmed_at',t.email_confirmed_at,'is_anonymous',t.is_anonymous)$expr$,''),
 ('storage','objects','to_jsonb(t)',$filter$ where t.bucket_id='organizer-requirements'$filter$))
select table_name,case when to_regclass(format('%I.%I',schema_name,table_name)) is null then 'MISSING'
else query_to_xml(format(
 $snapshot$select count(*)::text as row_count,md5(coalesce(string_agg(md5((%s)::text),'' order by t.id::text),'')) as fingerprint from %I.%I t%s$snapshot$,
 row_expression,schema_name,table_name,where_clause),false,true,'')::text end as snapshot_xml
from targets order by schema_name,table_name;

select case when to_regclass('public.profiles') is not null then query_to_xml(
 $counts$select organizer_status::text,is_admin,is_complete,count(*)::text as account_count from public.profiles group by organizer_status,is_admin,is_complete order by organizer_status,is_admin,is_complete$counts$,
 false,true,'')::text else 'MISSING profiles' end as role_counts_xml;
select case when to_regclass('public.organizer_applications') is not null then query_to_xml(
 $counts$select status::text,count(*)::text as application_count from public.organizer_applications group by status order by status$counts$,
 false,true,'')::text else 'MISSING applications' end as application_counts_xml;

select id,public as public_bucket,file_size_limit,allowed_mime_types from storage.buckets
where id in ('avatars','organizer-requirements') order by id;

-- Exact reviewed source bodies (line endings/outer whitespace normalized). All checks must pass.
with expected(signature,body_md5) as (values
 ('public.submit_organizer_application(jsonb)','f17f209d917ddabb5eb914b4d4f1132b'),
  ('public.withdraw_organizer_application(uuid)','2ca9fe85b8632a0b56d02ce1782cb374'),
  ('public.review_organizer_application(uuid,text,text)','2ca9fe85b8632a0b56d02ce1782cb374'),
  ('public.reserve_organizer_invitation(text,text,text)','ba6cbb870846313af3904a6b703b8c18'),
  ('public.acquire_organizer_invitation(uuid)','69cf7ab08502fa8393be1f30887f0a55'),
  ('public.finish_organizer_invitation(uuid,uuid,uuid,boolean)','fba61706ebdf246e6da469f0f032b90f'),
  ('public.promote_participant_to_organizer(uuid)','6f33a139c1e833c2f3d9b549ee71406a'),
  ('public.begin_organizer_acceptance(uuid,text,text)','e89b8c04ddcfa5a16a4d11627fd4f8b1'),
  ('public.check_organizer_acceptance(uuid,text)','319d98599d9ab2bb059b3dfc0016a3c0'),
  ('public.complete_organizer_acceptance(uuid,text)','3566cfa9635e7478e4544f1e1104e503'),
  ('public.save_event(uuid,jsonb)','4d8ce73c4ff1e2582316c3fcffc720ca'))
select e.signature,p.oid is not null as function_exists,
 coalesce(md5(btrim(replace(p.prosrc,chr(13),''),E' \t\n\r'))=e.body_md5,false) as reviewed_body_matches,
 coalesce(p.prosecdef,false) as security_definer,
 coalesce('search_path=""'=any(p.proconfig),false) as empty_search_path
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) order by e.signature;

-- No application function is executed by these privilege checks.
with expected(signature,authenticated_execute,service_execute) as (values
 ('public.submit_organizer_application(jsonb)',true,null::boolean),
 ('public.withdraw_organizer_application(uuid)',true,null::boolean),
 ('public.review_organizer_application(uuid,text,text)',true,null::boolean),
 ('public.save_event(uuid,jsonb)',true,null::boolean),
 ('public.reserve_organizer_invitation(text,text,text)',true,null::boolean),
 ('public.acquire_organizer_invitation(uuid)',true,null::boolean),
 ('public.promote_participant_to_organizer(uuid)',true,null::boolean),
 ('public.finish_organizer_invitation(uuid,uuid,uuid,boolean)',false,true),
 ('public.begin_organizer_acceptance(uuid,text,text)',false,true),
 ('public.check_organizer_acceptance(uuid,text)',false,true),
 ('public.complete_organizer_acceptance(uuid,text)',false,true))
select e.signature,
 coalesce(has_function_privilege('anon',p.oid,'EXECUTE')=false,false) as anon_denied,
 coalesce(has_function_privilege('authenticated',p.oid,'EXECUTE')=e.authenticated_execute,false) as authenticated_grant_correct,
 case when e.service_execute is null then null else coalesce(has_function_privilege('service_role',p.oid,'EXECUTE')=e.service_execute,false) end as service_grant_correct,
 not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') and p.oid is not null as public_execute_denied
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) order by e.signature;

with target as (select to_regclass('public.organizer_invitations') as oid)
select 'invitation table exists and RLS enabled' as check_name,coalesce((select relrowsecurity from pg_class where oid=target.oid),false) as passed from target
union all select 'authenticated has no table writes',target.oid is not null and not coalesce(has_table_privilege('authenticated',target.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true) from target
union all select 'anon has no table access',target.oid is not null and not coalesce(has_table_privilege('anon',target.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),true) from target;

with target as (select to_regclass('public.organizer_invitations') as oid)
select role_name,case when target.oid is not null then not has_any_column_privilege(role_name,target.oid,'INSERT,UPDATE,REFERENCES') else false end as browser_column_writes_denied
from target cross join (values ('anon'),('authenticated')) roles(role_name);

-- Only approved safe columns are browser-readable, and only Admin rows pass RLS.
with columns(name,expected_select) as (values
 ('id',true),('email',true),('first_name',true),('last_name',true),('invited_by',true),('user_id',true),('state',true),
 ('last_attempt_at',true),('provider_accepted_at',true),('expires_at',true),('accepted_at',true),('verified_at',true),('created_at',true),
 ('acceptance_hash',false),('acceptance_attempt',false),('attempt_id',false))
select col.name,col.expected_select,
 case when a.attnum is not null then has_column_privilege('authenticated',c.oid,a.attnum,'SELECT')=col.expected_select else false end as authenticated_select_correct,
 case when a.attnum is not null then not has_column_privilege('anon',c.oid,a.attnum,'SELECT') else false end as anon_denied
from columns col left join pg_class c on c.oid=to_regclass('public.organizer_invitations')
left join pg_attribute a on a.attrelid=c.oid and a.attname=col.name and not a.attisdropped order by col.name;

select count(*)=0 as retired_proof_upload_policy_absent from pg_policies
where schemaname='storage' and tablename='objects' and policyname='Requirements: own upload';
-- Inspect ALL remaining INSERT/ALL storage policies for alternate access to organizer-requirements.
select policyname,permissive,roles,cmd,qual,with_check from pg_policies
where schemaname='storage' and tablename='objects' and cmd in ('INSERT','ALL') order by policyname;

-- Should be an empty workflow table immediately after its first migration, before any approved use.
select case when to_regclass('public.organizer_invitations') is null then 'MISSING'
 else query_to_xml($count$select state,count(*)::text as row_count from public.organizer_invitations group by state order by state$count$,false,true,'')::text end as invitation_state_counts_xml;
-- Compare all existing-data fingerprints, role counts, history, trigger definitions and read policies to preflight.
-- No synthetic invitations, accounts, promotions, or emails are needed for this validation.
rollback;
