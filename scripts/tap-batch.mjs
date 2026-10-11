// Usage: node scripts/tap-batch.mjs supabase/tests/database/<file>.test.sql > batch.sql
// Turns a pgTAP test file into one batch for the Supabase MCP execute_sql tool (DECISIONS.md D-006, D-018).
// pgTAP 1.3 keeps no results table, so every top-level assertion's TAP output is inserted into a
// temp table. The batch ends by raising an exception that carries all TAP lines, which rolls back
// the whole batch (fixtures, rows, `create extension pgtap`).
// Assumes statements end with ";" at end of line and that "$$" bodies contain no ";" (true for our tests).
import { readFileSync } from "node:fs";

const assertion = /^\s*select\s+(ok|is|isnt|throws_ok|lives_ok|results_eq|set_eq|bag_eq|has_[a-z_]+|hasnt_[a-z_]+|col_[a-z_]+|fk_ok|policies_are|policy_roles_are|policy_cmd_is|function_returns|is_definer|isnt_definer|enum_has_labels|matches|alike|cmp_ok|row_eq|is_empty|isnt_empty|pass|fail)\s*\(/i;

const src = readFileSync(process.argv[2], "utf8")
  .split("\n")
  .filter((l) => !/^\s*--/.test(l))
  .join("\n");

const statements = src
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !/^(begin|rollback)$/i.test(s) && !/^select \* from finish\(\)$/i.test(s));

const out = [];
for (const s of statements) {
  out.push(assertion.test(s) ? `insert into tap_out (line) ${s};` : `${s};`);
  if (/^create extension if not exists pgtap/i.test(s)) {
    out.push("create temp table tap_out (n serial primary key, line text);");
    out.push("grant all on table tap_out to public;");
    out.push("grant all on sequence tap_out_n_seq to public;");
  }
}

out.push(`reset role;
do $tap$
declare
  v_lines text;
  v_failed int;
  v_run int;
  v_plan text;
begin
  select string_agg(line, E'\\n' order by n), count(*) filter (where line like 'not ok%'), count(*)
    into v_lines, v_failed, v_run
    from tap_out;
  select value::text into v_plan from __tcache__ where label = 'plan';
  raise exception 'TAP planned=% run=% failed=% %', v_plan, v_run, v_failed, E'\\n' || v_lines;
end
$tap$;`);

process.stdout.write(out.join("\n") + "\n");
