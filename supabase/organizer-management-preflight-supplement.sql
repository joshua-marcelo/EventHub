-- READ ONLY supplement. Run alongside the COMPLETE original preflight, not instead of it.
-- Development project ldhpbfujqnyovovabvcg, primary database, SQL Editor role postgres.
-- Save result sets privately. These statements inspect source/ACLs; they never invoke RPCs.
begin transaction isolation level repeatable read, read only;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

-- Existence alone cannot establish that authorization helpers are safe or compatible.
with targets(signature) as (values
 ('private.is_admin()'),('private.is_permanent_user()'),('private.is_active_organizer()'),
 ('private.log_audit(text,text,uuid,jsonb)'),('public.set_organizer_status(uuid,text,text)'))
select t.signature,p.oid is not null as exists,pg_get_userbyid(p.proowner) as owner,
 p.prosecdef as security_definer,p.proconfig as settings,
 pg_get_function_arguments(p.oid) as arguments_with_defaults,
 pg_get_functiondef(p.oid) as definition,
 case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') end as anon_execute,
 case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') end as authenticated_execute
from targets t left join pg_proc p on p.oid=to_regprocedure(t.signature)
order by t.signature;

-- A CREATE TRIGGER definition does not include its function body. Inspect both.
-- Verify safe initial roles, email synchronization, identity locks, and status side effects.
select n.nspname as table_schema,c.relname as table_name,t.tgname,t.tgenabled,
 pg_get_triggerdef(t.oid,true) as trigger_definition,
 p.oid::regprocedure::text as trigger_function,pg_get_userbyid(p.proowner) as owner,
 p.prosecdef as security_definer,p.proconfig as settings,
 pg_get_functiondef(p.oid) as function_definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and
 ((n.nspname='public' and c.relname in ('profiles','organizer_applications','events'))
 or (n.nspname='auth' and c.relname='users'))
order by n.nspname,c.relname,t.tgname;

-- All signatures/overloads: new management RPC names should be absent before migration 2.
-- Inspect unexpected overloads or prior manual changes; never hide them with IF NOT EXISTS.
select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and p.proname in
 ('submit_organizer_application','withdraw_organizer_application','review_organizer_application',
 'reserve_organizer_invitation','acquire_organizer_invitation','finish_organizer_invitation',
 'promote_participant_to_organizer','begin_organizer_acceptance','check_organizer_acceptance',
 'complete_organizer_acceptance','save_event')
order by signature;

-- Expected false throughout: existing application history must remain browser-read-only.
-- Inspect RLS separately in the original preflight; ACLs and RLS are separate checks.
with target as (select to_regclass('public.organizer_applications') as oid)
select r.role_name,target.oid is not null as table_exists,
 has_table_privilege(r.role_name,target.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as any_table_write,
 has_any_column_privilege(r.role_name,target.oid,'INSERT,UPDATE,REFERENCES') as any_column_write
from target cross join (values ('anon'),('authenticated')) r(role_name);

rollback;
