import { it,expect } from "vitest";
import { csvRow } from "./csv";
it("quotes delimiters/newlines and prevents spreadsheet formulas",()=>{expect(csvRow(['Dela Cruz, Ana','A "quote"',"Line\nbreak",null])).toBe('"Dela Cruz, Ana","A ""quote""","Line\nbreak",""\r\n');for(const text of ["=HYPERLINK()","+1","-1","@SUM(A1)"," \t=cmd","\r=cmd","\u200b=cmd"])expect(csvRow([text])).toContain('"'+"'");expect(csvRow(["María",2026])).toBe('"María","2026"\r\n');});
