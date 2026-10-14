// Isolated data-migration QA. Never connects to Supabase or reads credentials.
// Install the test engine only in the ignored directory (no application dependency):
// npm install --prefix .next/reference-db-qa --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
// node scripts/reference-data-check.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "../.next/reference-db-qa/node_modules/@electric-sql/pglite/dist/index.js";

const migration = readFileSync("supabase/migrations/20261015030000_official_colleges_programs.sql", "utf8");
const catalogue = JSON.parse(migration.split("$catalogue$")[1]);
const postflight = readFileSync("supabase/reference-data-postflight.sql", "utf8");
assert.deepEqual(JSON.parse(postflight.split("$expected$")[1]), catalogue);
assert.doesNotMatch(migration, /create\s+(?:temporary|temp)\s+table/i);
assert.doesNotMatch(migration, /eventhub_(?:colleges_before|programs_before|profiles_before|expected_programs)/);
const originalColleges = readFileSync("supabase/migrations/20261009202618_lookups.sql", "utf8");
const originalPrograms = readFileSync("supabase/migrations/20261011102140_revision2_corrections.sql", "utf8");
const collegeTable = originalColleges.slice(originalColleges.indexOf("create table public.colleges"), originalColleges.indexOf("create table public.event_categories"));
const programTable = originalPrograms.slice(originalPrograms.indexOf("create table public.programs"), originalPrograms.indexOf("create trigger programs_set_updated_at"));

async function database() {
  const db = new PGlite();
  // Use the real lookup table definitions. Minimal related fixtures exercise the same FK.
  await db.exec(`${collegeTable}\n${programTable}
    create table public.profiles (id uuid primary key, college_id smallint references public.colleges(id), program_id smallint,
      foreign key (college_id, program_id) references public.programs(college_id, id),
      check (program_id is null or college_id is not null));
    create table public.events (id integer primary key, host_college_id smallint references public.colleges(id));
    create table public.test_lookup_writes (id integer generated always as identity primary key);
    create function public.test_track_lookup() returns trigger language plpgsql as $$
      begin insert into public.test_lookup_writes default values; return new; end; $$;
    create trigger test_college_writes after insert or update on public.colleges for each row execute function public.test_track_lookup();
    create trigger test_program_writes after insert or update on public.programs for each row execute function public.test_track_lookup();
  `);
  return db;
}
async function rows(db, sql) { return (await db.query(sql)).rows; }
async function snapshot(db) {
  return Promise.all(["colleges", "programs", "profiles", "events", "test_lookup_writes"].map(table => rows(db, `select * from public.${table} order by id`)));
}
async function assertCatalogue(db) {
  const colleges = await rows(db, "select id,name from public.colleges where is_active order by name");
  const programs = await rows(db, "select college_id,name from public.programs where is_active order by name");
  assert.equal(colleges.length, 8);
  assert.equal(programs.length, 24);
  for (const college of colleges) {
    const expected = catalogue.find(c => c.name === college.name);
    assert.ok(expected);
    assert.deepEqual(programs.filter(p => p.college_id === college.id).map(p => p.name).sort(), [...expected.programs].sort());
  }
}
async function rejectsAtomically(setup, message) {
  const db = await database();
  try {
    await db.exec(setup);
    const before = await snapshot(db);
    await assert.rejects(db.exec(migration), message);
    await db.exec("rollback");
    assert.deepEqual(await snapshot(db), before);
  } finally { await db.close(); }
}

let db = await database();
try {
  await db.exec(migration);
  await assertCatalogue(db);
  await db.exec(readFileSync("supabase/reference-data-preflight.sql", "utf8"));
  const verification = await db.exec(postflight);
  assert.deepEqual(verification.find(result => result.rows[0]?.active_colleges !== undefined).rows[0], {
    active_colleges: 8, active_programs: 24, active_official_colleges: 8,
    active_official_programs: 24, catalogue_relationship_mismatches: 0,
    active_programs_without_active_college: 0,
  });
  console.log("ok fresh database: exact eight colleges, 24 programs, full names and ownership");
} finally { await db.close(); }

db = await database();
try {
  // The DO statement owns every setup/snapshot step, even without the outer wrapper.
  const standalone = migration.slice(migration.indexOf('do $update_catalogue$'), migration.indexOf('$update_catalogue$;') + '$update_catalogue$;'.length);
  const failed = standalone.replace("  raise notice 'Catalogue assertions passed", "  raise exception 'Injected late failure';\n  raise notice 'Catalogue assertions passed");
  const initial = await snapshot(db);
  await assert.rejects(db.exec(failed), /Injected late failure/);
  assert.deepEqual(await snapshot(db), initial);
  await db.exec(standalone);
  await assertCatalogue(db);
  const before = await snapshot(db);
  await db.exec(standalone);
  assert.deepEqual(await snapshot(db), before);
  // Simulate a late assertion error: even an autocommitted DO must roll back all its writes.
  await assert.rejects(db.exec(failed), /Injected late failure/);
  assert.deepEqual(await snapshot(db), before);
  console.log('ok self-contained DO, no temporary tables, standalone rerun and late-error rollback');
} finally { await db.close(); }

db = await database();
try {
  await db.exec('begin; create temporary table eventhub_colleges_before on commit drop as select id,code from public.colleges; commit;');
  await assert.rejects(db.query('select * from eventhub_colleges_before'), e => e.code === '42P01');
  console.log('ok original missing-relation mechanism reproduced after ON COMMIT DROP boundary');
} finally { await db.close(); }

db = await database();
try {
  await db.exec(`
    insert into public.colleges(id,code,name) overriding system value values
      (15,'DEV-A','Development College A (test data)'), (16,'DEV-B','Development College B (test data)'),
      (17,'KEEP-CAS','College of Arts and Sciences');
    insert into public.programs(id,college_id,name) overriding system value values
      (8,15,'BS Development Testing'), (9,15,'BS Sample Studies'), (10,16,'BS Placeholder Science'),
      (11,17,'Bachelor of Arts in Communication (BACOMM)');
    select setval(pg_get_serial_sequence('public.colleges','id'),17);
    select setval(pg_get_serial_sequence('public.programs','id'),11);
    insert into public.profiles values
      ('00000000-0000-4000-8000-000000000001',null,null), ('00000000-0000-4000-8000-000000000002',17,11);
    insert into public.events values (1,17);
  `);
  const profiles = await rows(db, "select * from public.profiles order by id");
  await db.exec(migration);
  await assertCatalogue(db);
  assert.deepEqual(await rows(db, "select * from public.profiles order by id"), profiles);
  assert.deepEqual(await rows(db, "select * from public.events"), [{ id: 1, host_college_id: 17 }]);
  assert.deepEqual(await rows(db, "select id,is_active from public.colleges where id in (15,16) order by id"), [{ id: 15, is_active: false }, { id: 16, is_active: false }]);
  assert.equal((await rows(db, "select code from public.colleges where id=17"))[0].code, "KEEP-CAS");
  assert.equal((await rows(db, "select name from public.programs where id=11"))[0].name, "Bachelor of Arts in Communication");
  const firstRun = await snapshot(db);
  await db.exec(migration);
  assert.deepEqual(await snapshot(db), firstRun);
  console.log("ok existing IDs, college codes, profiles and event references preserved; placeholders retained inactive; rerun performs no writes");
  const other = (await rows(db, "select id from public.colleges where code='CAMS'"))[0].id;
  await assert.rejects(db.query("update public.profiles set college_id=$1 where program_id=11", [other]), e => e.code === "23503");
  const valid = (await rows(db, "select college_id,id from public.programs where name='Bachelor of Science in Nursing'"))[0];
  await db.query("update public.profiles set college_id=$1,program_id=$2 where id='00000000-0000-4000-8000-000000000001'", [valid.college_id, valid.id]);
  console.log("ok invalid college/program save rejected by FK; valid pair saves");
} finally { await db.close(); }

await rejectsAtomically("insert into public.colleges(code,name) values ('OTHER','Unexpected College')", /Unexpected active college/);
await rejectsAtomically("insert into public.colleges(code,name) values ('CAS','College of Arts and Sciences'); insert into public.programs(college_id,name) select id,'Unknown Program' from public.colleges", /Unexpected active program/);
await rejectsAtomically("insert into public.colleges(code,name) values ('CAS','College of Arts and Sciences'),('DUP','college of arts and sciences')", /Ambiguous college name/);
await rejectsAtomically("insert into public.colleges(code,name) values ('CAS','College of Arts and Sciences'); insert into public.programs(college_id,name) select id,n from public.colleges cross join (values ('Bachelor of Arts in Communication'),('Bachelor of Arts in Communication (BACOMM)')) as names(n)", /Ambiguous program/);
await rejectsAtomically("insert into public.colleges(code,name,is_active) values ('CAS','Conflicting old college',false)", /College code CAS is already assigned/);
console.log("ok unknown records, duplicate names and code conflicts abort with full rollback");

const placeholder = `
  insert into public.colleges(id,code,name) overriding system value values (15,'DEV-A','Development College A (test data)');
  insert into public.programs(id,college_id,name) overriding system value values (8,15,'BS Development Testing');
  select setval(pg_get_serial_sequence('public.colleges','id'),15);
  select setval(pg_get_serial_sequence('public.programs','id'),8);
`;
await rejectsAtomically(`${placeholder} insert into public.profiles values ('00000000-0000-4000-8000-000000000001',15,null)`, /Placeholder deactivation blocked: 1 reference\(s\) in public.profiles/);
await rejectsAtomically(`${placeholder} insert into public.profiles values ('00000000-0000-4000-8000-000000000001',15,8)`, /Placeholder deactivation blocked/);
await rejectsAtomically(`${placeholder} insert into public.events values (1,15)`, /Placeholder deactivation blocked: 1 reference\(s\) in public.events/);
await rejectsAtomically(`${placeholder}
  create table public.extra_program_refs (id integer primary key, college_id smallint, program_id smallint,
    foreign key (college_id,program_id) references public.programs(college_id,id));
  insert into public.extra_program_refs values (1,15,8);
`, /Placeholder deactivation blocked: 1 reference\(s\) in public.extra_program_refs/);
await rejectsAtomically(`${placeholder}
  create table public.extra_college_refs (id integer primary key, college_id smallint references public.colleges(id));
  insert into public.extra_college_refs values (1,15);
`, /Placeholder deactivation blocked: 1 reference\(s\) in public.extra_college_refs/);
await rejectsAtomically(`${placeholder} insert into public.programs(college_id,name,is_active) values (15,'Historical unapproved program',false)`, /Placeholder deactivation blocked: 1 reference\(s\) in public.programs/);
console.log("ok profile, event, additional single/composite FK references and unexpected inactive child programs block deactivation atomically");
