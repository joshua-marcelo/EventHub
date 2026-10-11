/** Quote every field and neutralize spreadsheet formulas in untrusted values. */
export function csvRow(values:unknown[]):string {
 return values.map(value=>{let text=String(value??"");if(/^[\s\u0000-\u001f\u200b-\u200f\ufeff]*[=+\-@]/u.test(text)||/^[\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}).join(",")+"\r\n";
}
