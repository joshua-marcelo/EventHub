import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { lookupSchema } from "@/lib/validation/lookup";

const sql = readFileSync("supabase/migrations/20261015030000_official_colleges_programs.sql", "utf8");
const catalogue = JSON.parse(sql.split("$catalogue$")[1]) as { code: string; name: string; programs: string[] }[];
const science = (name: string) => `Bachelor of Science in ${name}`;

describe("client-approved college/program catalogue", () => {
  it("has exactly the eight colleges and 24 correctly assigned full program labels", () => {
    expect(Object.fromEntries(catalogue.map(c => [c.name, c.programs]))).toEqual({
      "College of Arts and Sciences": ["Bachelor of Arts in Communication", "Bachelor of Arts in Political Science", science("Psychology"), science("Social Work")],
      "College of Allied Medical Sciences": [science("Medical Technology"), science("Pharmacy"), science("Physical Therapy"), science("Radiologic Technology"), science("Respiratory Therapy")],
      "College of Business and Accountancy": [science("Accountancy"), science("Business Administration"), science("Management Accounting"), science("Real Estate Management"), science("Accounting Information Management")],
      "College of Criminal Justice Education": [science("Criminology")],
      "College of Engineering and Computer Technology": [science("Information Technology"), science("Computer Engineering"), science("Electronics and Communications Engineering")],
      "College of Hospitality and Tourism Management": [science("Tourism Management"), science("Hospitality Management"), science("Nutrition and Dietetics")],
      "College of Education": ["Bachelor of Elementary Education", "Bachelor of Secondary Education"],
      "College of Nursing": [science("Nursing")],
    });
    expect(catalogue).toHaveLength(8);
    expect(catalogue.flatMap(c => c.programs)).toHaveLength(24);
  });

  it("contains unique codes and names accepted by the existing lookup validation", () => {
    expect(new Set(catalogue.map(c => c.code)).size).toBe(8);
    const programs = catalogue.flatMap(c => c.programs);
    expect(new Set(programs).size).toBe(24);
    for (const c of catalogue) {
      expect(lookupSchema.safeParse({ kind: "colleges", id: null, code: c.code, name: c.name, is_active: true }).success).toBe(true);
      for (const name of c.programs) {
        expect(name).toMatch(/^Bachelor of /);
        expect(name).not.toMatch(/[()]/);
        expect(lookupSchema.safeParse({ kind: "programs", id: null, college_id: 1, name, is_active: true }).success).toBe(true);
      }
    }
  });
});
