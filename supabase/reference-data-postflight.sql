-- READ ONLY; standalone: no temporary tables or earlier session required.
-- Expected labels are copied from the migration for independent verification.
-- Keep this validation fixture synchronized with the migration's catalogue.
begin transaction isolation level repeatable read read only;
set local row_security = off;

with catalogue as (
  select * from jsonb_to_recordset($expected$[
    {"code":"CAS","name":"College of Arts and Sciences","programs":[
      "Bachelor of Arts in Communication",
      "Bachelor of Arts in Political Science",
      "Bachelor of Science in Psychology",
      "Bachelor of Science in Social Work"
    ]},
    {"code":"CAMS","name":"College of Allied Medical Sciences","programs":[
      "Bachelor of Science in Medical Technology",
      "Bachelor of Science in Pharmacy",
      "Bachelor of Science in Physical Therapy",
      "Bachelor of Science in Radiologic Technology",
      "Bachelor of Science in Respiratory Therapy"
    ]},
    {"code":"CBA","name":"College of Business and Accountancy","programs":[
      "Bachelor of Science in Accountancy",
      "Bachelor of Science in Business Administration",
      "Bachelor of Science in Management Accounting",
      "Bachelor of Science in Real Estate Management",
      "Bachelor of Science in Accounting Information Management"
    ]},
    {"code":"CCJE","name":"College of Criminal Justice Education","programs":[
      "Bachelor of Science in Criminology"
    ]},
    {"code":"CECT","name":"College of Engineering and Computer Technology","programs":[
      "Bachelor of Science in Information Technology",
      "Bachelor of Science in Computer Engineering",
      "Bachelor of Science in Electronics and Communications Engineering"
    ]},
    {"code":"CHTM","name":"College of Hospitality and Tourism Management","programs":[
      "Bachelor of Science in Tourism Management",
      "Bachelor of Science in Hospitality Management",
      "Bachelor of Science in Nutrition and Dietetics"
    ]},
    {"code":"COED","name":"College of Education","programs":[
      "Bachelor of Elementary Education",
      "Bachelor of Secondary Education"
    ]},
    {"code":"CON","name":"College of Nursing","programs":[
      "Bachelor of Science in Nursing"
    ]}
  ]$expected$::jsonb)
    as d(code text, name text, programs jsonb)
), expected as (
  select d.name as college_name, p.name as program_name
  from catalogue d cross join lateral jsonb_array_elements_text(d.programs) p(name)
), actual as (
  select c.name as college_name, p.name as program_name
  from public.programs p join public.colleges c on c.id = p.college_id
  where p.is_active and c.is_active
), differences as (
  (select * from expected except select * from actual)
  union all
  (select * from actual except select * from expected)
)
select
  (select count(*) from public.colleges where is_active) as active_colleges,
  (select count(*) from public.programs where is_active) as active_programs,
  (select count(*) from public.colleges c join catalogue d on d.name=c.name where c.is_active) as active_official_colleges,
  (select count(*) from actual a join expected e using (college_name,program_name)) as active_official_programs,
  (select count(*) from differences) as catalogue_relationship_mismatches,
  (select count(*) from public.programs p left join public.colleges c on c.id=p.college_id
    where p.is_active and (c.id is null or not c.is_active)) as active_programs_without_active_college;
-- Expected summary: 8, 24, 8, 24, 0, 0. Any other result needs investigation.

select c.id as college_id, c.name as college_name, p.id as program_id, p.name as program_name
from public.colleges c join public.programs p on p.college_id=c.id
where c.is_active and p.is_active order by c.name,p.name;

select c.id, c.name, count(p.id) as active_programs
from public.colleges c left join public.programs p on p.college_id=c.id and p.is_active
where c.is_active group by c.id,c.name order by c.name;

-- Retained history, including inactive placeholders. Internal IDs allow comparison to preflight.
select id,name,is_active from public.colleges order by id;
select id,college_id,name,is_active from public.programs order by id;
rollback;
