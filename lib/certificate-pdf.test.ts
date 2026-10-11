import { it,expect } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { renderCertificate } from "./certificate-pdf";
it("renders a bounded single-page PDF from snapshots, including long names and Unicode",async()=>{
 const bytes=await renderCertificate({recipient_name:"María Dela Cruz 李".repeat(8),event_title:"University seminar ".repeat(8),event_date:"2026-10-11",certificate_number:"CLC-2026-000001",verification_code:"AbCdEfGhIjKlMnOpQrStUv",issuer_name:"College Council",template_version:1},"https://eventhub.test",readFileSync("public/images/eventhub-logo.png"));
 const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBe(1);expect(pdf.getPage(0).getWidth()).toBeCloseTo(841.89);expect(pdf.getTitle()).toContain("CLC-2026-000001");
});
