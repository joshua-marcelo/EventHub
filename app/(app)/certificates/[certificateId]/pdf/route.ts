import { readFile } from "node:fs/promises";
import { getCertificate } from "@/lib/certificate-queries";
import { renderCertificate } from "@/lib/certificate-pdf";
import { getAppOrigin } from "@/lib/app-origin";
export async function GET(request:Request,{params}:RouteContext<"/certificates/[certificateId]/pdf">){
 const {certificateId}=await params,c=await getCertificate(certificateId);if(c.revoked_at)return Response.json({error:"Certificate revoked."},{status:410,headers:{"Cache-Control":"private, no-store"}});
 const bytes=await renderCertificate(c,await getAppOrigin(),await readFile(process.cwd()+"/public/images/eventhub-logo.png"));
 return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`${new URL(request.url).searchParams.get("preview")==="1"?"inline":"attachment"}; filename="EventHub-Certificate-${c.certificate_number}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
