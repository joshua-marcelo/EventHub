-- Official client-supplied catalogue. Data only: no schema, RLS or role changes.
-- Manual execution only: verify development project ldhpbfujqnyovovabvcg in SQL Editor.
-- Keep this as the single catalogue definition; all pickers read these tables.
begin;
-- All setup, snapshots, changes and assertions live in ONE atomic statement.
-- No temporary tables or state from previous SQL Editor executions are required.
do $update_catalogue$
declare
  catalogue constant jsonb := $catalogue$[
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
  ]$catalogue$::jsonb;
  wanted record;
  program_name text;
  v_college_id smallint;
  v_program_id smallint;
  matches smallint[];
  official_colleges smallint[] := '{}';
  official_programs smallint[] := '{}';
  legacy_colleges smallint[];
  legacy_programs smallint[];
  dependency record;
  join_predicate text;
  exclusion text;
  reference_count bigint;
  colleges_before jsonb;
  programs_before jsonb;
  profiles_before jsonb;
  profiles_after jsonb;
begin
  perform set_config('lock_timeout', '5s', true);
  -- Fail instead of silently hiding dependent rows behind RLS.
  perform set_config('row_security', 'off', true);
  lock table public.colleges, public.programs in share row exclusive mode;
  lock table public.profiles in share mode;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) into colleges_before
  from (select id, code from public.colleges) s;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) into programs_before
  from (select id, college_id from public.programs) s;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) into profiles_before
  from (select id, college_id, program_id from public.profiles) s;

  -- Only these explicitly audited development placeholders may be deactivated.
  select coalesce(array_agg(c.id), '{}'::smallint[]) into legacy_colleges
  from public.colleges c
  where (c.code, c.name) in (
    ('DEV-A', 'Development College A (test data)'),
    ('DEV-B', 'Development College B (test data)')
  );

  select coalesce(array_agg(p.id), '{}'::smallint[]) into legacy_programs
  from public.programs p join public.colleges c on c.id = p.college_id
  where c.id = any(legacy_colleges) and (
    (c.code = 'DEV-A' and p.name in ('BS Development Testing', 'BS Sample Studies'))
    or (c.code = 'DEV-B' and p.name = 'BS Placeholder Science')
  );

  -- Discover ALL incoming foreign keys, including future tables and composite FKs.
  -- Share locks prevent new references between this audit and COMMIT.
  for dependency in
    select distinct ns.nspname, t.relname, t.oid
    from pg_constraint fk
    join pg_class t on t.oid = fk.conrelid
    join pg_namespace ns on ns.oid = t.relnamespace
    where fk.contype = 'f' and fk.confrelid in ('public.colleges'::regclass, 'public.programs'::regclass)
    order by t.oid
  loop
    execute format('lock table %I.%I in share mode', dependency.nspname, dependency.relname);
  end loop;

  for dependency in
    select fk.*, ns.nspname, t.relname
    from pg_constraint fk
    join pg_class t on t.oid = fk.conrelid
    join pg_namespace ns on ns.oid = t.relnamespace
    where fk.contype = 'f' and fk.confrelid in ('public.colleges'::regclass, 'public.programs'::regclass)
    order by fk.oid
  loop
    select string_agg(format('source.%I = target.%I', src.attname, dst.attname), ' and ' order by k.position)
    into join_predicate
    from unnest(dependency.conkey, dependency.confkey) with ordinality as k(src_num, dst_num, position)
    join pg_attribute src on src.attrelid = dependency.conrelid and src.attnum = k.src_num
    join pg_attribute dst on dst.attrelid = dependency.confrelid and dst.attnum = k.dst_num;

    exclusion := '';
    -- Expected placeholder programs keep their college FK even when both become inactive.
    -- Any other child program (including inactive ones) still blocks deactivation.
    if dependency.conrelid = 'public.programs'::regclass
      and dependency.confrelid = 'public.colleges'::regclass
      and cardinality(dependency.conkey) = 1
      and join_predicate = 'source.college_id = target.id' then
      exclusion := ' and not (source.id = any($2))';
    end if;

    execute format(
      'select count(*) from %I.%I source join %s target on %s where target.is_active and target.id = any($1)%s',
      dependency.nspname, dependency.relname, dependency.confrelid::regclass, join_predicate, exclusion
    ) into reference_count using
      case when dependency.confrelid = 'public.colleges'::regclass then legacy_colleges else legacy_programs end,
      legacy_programs;
    if reference_count > 0 then
      raise exception 'Placeholder deactivation blocked: % reference(s) in %.% via %. No catalogue changes committed; obtain further approval.',
        reference_count, dependency.nspname, dependency.relname, dependency.conname;
    end if;
  end loop;

  if exists (
    select 1 from public.colleges c
    where c.is_active and not (c.id = any(legacy_colleges))
      and not exists (
        select 1 from jsonb_to_recordset(catalogue) as d(name text)
        where lower(btrim(d.name)) = lower(btrim(c.name))
      )
  ) then
    raise exception 'Unexpected active college. Review reference-data-preflight.sql and map existing IDs before applying.';
  end if;

  for wanted in select * from jsonb_to_recordset(catalogue) as d(code text, name text, programs jsonb)
  loop
    select array_agg(c.id) into matches from public.colleges c
    where lower(btrim(c.name)) = lower(btrim(wanted.name));
    if coalesce(cardinality(matches), 0) > 1 then
      raise exception 'Ambiguous college name: %. Existing IDs must be reviewed, not merged automatically.', wanted.name;
    elsif coalesce(cardinality(matches), 0) = 1 then
      v_college_id := matches[1];
      -- Preserve the existing ID and code, even if its code differs from our new-row default.
      update public.colleges c set name = wanted.name, is_active = true
      where c.id = v_college_id and (c.name is distinct from wanted.name or not c.is_active);
    else
      if exists (select 1 from public.colleges c where c.code = wanted.code) then
        raise exception 'College code % is already assigned to a different name. Review the mapping.', wanted.code;
      end if;
      insert into public.colleges(code, name) values (wanted.code, wanted.name)
      returning id into v_college_id;
    end if;
    official_colleges := array_append(official_colleges, v_college_id);

    for program_name in select value from jsonb_array_elements_text(wanted.programs) as names(value)
    loop
      -- Reuse complete labels with an old appended abbreviation, e.g. "... (BSIT)".
      -- If both versions exist, abort rather than choosing a potentially referenced ID.
      select array_agg(p.id) into matches from public.programs p
      where p.college_id = v_college_id
        and lower(btrim(regexp_replace(btrim(p.name), '\s+\([A-Za-z][A-Za-z0-9 .&/-]*\)$', ''))) = lower(program_name);
      if coalesce(cardinality(matches), 0) > 1 then
        raise exception 'Ambiguous program in %: %. Review existing IDs first.', wanted.name, program_name;
      elsif coalesce(cardinality(matches), 0) = 1 then
        update public.programs p set name = program_name, is_active = true
        where p.id = matches[1] and (p.name is distinct from program_name or not p.is_active);
        official_programs := array_append(official_programs, matches[1]);
      else
        insert into public.programs(college_id, name) values (v_college_id, program_name)
        returning id into v_program_id;
        official_programs := array_append(official_programs, v_program_id);
      end if;
    end loop;
  end loop;

  if exists (
    select 1 from public.programs p join public.colleges c on c.id = p.college_id
    where p.is_active and not (p.id = any(official_programs))
      and not (
        c.id = any(legacy_colleges) and (
          (c.code = 'DEV-A' and p.name in ('BS Development Testing', 'BS Sample Studies'))
          or (c.code = 'DEV-B' and p.name = 'BS Placeholder Science')
        )
      )
  ) then
    raise exception 'Unexpected active program. Review the catalogue mapping; no records have been committed.';
  end if;

  update public.programs set is_active = false
  where is_active and id = any(legacy_programs);
  update public.colleges set is_active = false
  where is_active and id = any(legacy_colleges);

  if (select count(*) from public.colleges where is_active) <> 8
    or (select count(*) from public.programs where is_active) <> 24 then
    raise exception 'Catalogue count check failed; expected 8 active colleges and 24 active programs.';
  end if;

  if exists (
    select 1 from (
      select d.name as college_name, p.name as program_name
      from jsonb_to_recordset(catalogue) as d(name text, programs jsonb)
      cross join lateral jsonb_array_elements_text(d.programs) as p(name)
    ) expected
    full join (
      select c.name as college_name, p.name as program_name
      from public.programs p join public.colleges c on c.id = p.college_id
      where p.is_active and c.is_active
    ) actual using (college_name, program_name)
    where expected.program_name is null or actual.program_name is null
  ) then
    raise exception 'Official names or program-to-college relationships do not match the approved catalogue.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb) into profiles_after
  from (select id, college_id, program_id from public.profiles) s;
  if (select count(*) from jsonb_to_recordset(colleges_before) as b(id smallint, code text)
      join public.colleges c on c.id = b.id and c.code = b.code)
       <> jsonb_array_length(colleges_before)
    or (select count(*) from jsonb_to_recordset(programs_before) as b(id smallint, college_id smallint)
      join public.programs p on p.id = b.id and p.college_id = b.college_id)
       <> jsonb_array_length(programs_before)
    or profiles_before is distinct from profiles_after then
    raise exception 'Existing identifiers or profile relationships changed. Rolling back.';
  end if;
  raise notice 'Catalogue assertions passed: 8 active official colleges, 24 active official programs, exact names and ownership; existing identifiers and profile relationships preserved. Commit must still succeed.';
end;
$update_catalogue$;
commit;
-- Run supabase/reference-data-postflight.sql separately to inspect committed results.
