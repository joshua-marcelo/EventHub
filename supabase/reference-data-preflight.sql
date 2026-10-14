-- READ ONLY. Run with privileged database access BEFORE approving the migration.
-- Counts only; no student names, email addresses or other profile content is returned.
-- Standalone: no temporary tables, migration, or prior SQL Editor session required.
begin transaction isolation level repeatable read read only;
set local row_security = off;

select current_database() as database_name, current_user as database_role,
  current_setting('search_path') as search_path;
-- Database name alone does not establish the hosted project: verify dashboard project ref.

select fk.conrelid::regclass as referencing_table, fk.conname as constraint_name,
  fk.confrelid::regclass as referenced_table, pg_get_constraintdef(fk.oid) as definition
from pg_constraint fk
where fk.contype = 'f'
  and fk.confrelid in ('public.colleges'::regclass, 'public.programs'::regclass)
order by fk.conrelid, fk.conname;

select c.id, c.code, c.name, c.is_active,
  (select count(*) from public.profiles p where p.college_id = c.id) as profile_references,
  (select count(*) from public.events e where e.host_college_id = c.id) as event_references
from public.colleges c order by c.id;

select p.id, p.college_id, c.name as college_name, p.name, p.is_active,
  (select count(*) from public.profiles s where s.program_id = p.id) as profile_references
from public.programs p join public.colleges c on c.id = p.college_id order by p.college_id, p.id;

select lower(btrim(name)) as duplicate_college_name, array_agg(id order by id) as ids
from public.colleges group by lower(btrim(name)) having count(*) > 1;

select college_id,
  lower(btrim(regexp_replace(btrim(name), '\s+\([A-Za-z][A-Za-z0-9 .&/-]*\)$', ''))) as duplicate_program_name,
  array_agg(id order by id) as ids
from public.programs group by college_id, 2 having count(*) > 1;

select count(*) as invalid_profile_pairs
from public.profiles s
where s.program_id is not null and not exists (
  select 1 from public.programs p where p.id = s.program_id and p.college_id = s.college_id
);

rollback;
