
-- PRE-FLIGHT: standalone, READ ONLY. Save every result set before any approved changes.
-- Expected project: ldhpbfujqnyovovabvcg (development). No DDL/DML, tests, or role changes.

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
 case when p.oid is not null then pg_has_role((select oid from pg_roles where rolname=current_user),p.proowner,'USAGE') else false end as current_role_can_act_as_function_owner,
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

-- Every dependency below must exist before applying either migration.
with required(signature) as (values
 ('private.is_admin()'),
  ('private.is_permanent_user()'),
  ('private.is_active_organizer()'),
  ('private.log_audit(text,text,uuid,jsonb)'),
  ('auth.uid()'),
  ('auth.role()'),
  ('extensions.gen_random_uuid()'),
  ('public.set_organizer_status(uuid,text,text)'))
select signature,to_regprocedure(signature) is not null as dependency_present from required order by signature;
select coalesce(has_schema_privilege(current_user,to_regnamespace('private'),'USAGE'),false) as can_use_private_schema,
 coalesce(has_schema_privilege(current_user,to_regnamespace('auth'),'USAGE'),false) as can_use_auth_schema,
 coalesce(has_table_privilege(current_user,to_regclass('auth.users'),'SELECT'),false) as can_read_auth_users;

-- Document existing default grants; do not alter them as part of preflight.
select coalesce(has_schema_privilege(current_user,to_regnamespace('public'),'CREATE'),false) as can_create_public_objects;
select n.nspname,c.relname,pg_get_userbyid(c.relowner) as owner,
 pg_has_role((select oid from pg_roles where rolname=current_user),c.relowner,'USAGE') as current_role_can_act_as_owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='storage' and c.relname='objects') or (n.nspname='public' and c.relname='profiles');
select pg_get_userbyid(d.defaclrole) as owner,coalesce(n.nspname,'all schemas') as schema_name,
 d.defaclobjtype,d.defaclacl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
where d.defaclnamespace=0 or n.nspname in ('public','private') order by owner,schema_name,d.defaclobjtype;

-- Existing role flags must not be browser-writable. Keep these false after migration too.
with roles(name) as (values ('anon'),('authenticated')),columns(name) as (values ('is_admin'),('organizer_status'),('organizer_since'),('organizer_status_reason'))
select r.name as role_name,col.name as column_name,
 case when a.attnum is not null then has_column_privilege(pr.oid,c.oid,a.attnum,'UPDATE') else null end as can_update
from roles r left join pg_roles pr on pr.rolname=r.name cross join columns col
left join pg_class c on c.oid=to_regclass('public.profiles')
left join pg_attribute a on a.attrelid=c.oid and a.attname=col.name and not a.attisdropped
order by r.name,col.name;

-- STOP on partial/manual application, conflicting objects, missing dependencies, or source drift.
-- A history row alone is not proof of the effective schema. Missing history does not prove absence.
rollback;
