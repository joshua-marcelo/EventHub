import { PDFDocument,StandardFonts,rgb,type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import { BRAND } from "@/lib/branding";
export type CertificateSnapshot={recipient_name:string;event_title:string;event_date:string;certificate_number:string;verification_code:string;issuer_name:string;template_version:number};
function color(hex:string){return rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]);}
function printable(value:string,font:PDFFont){
 return [...value.replace(/[\r\n\t]/g," ")].map(c=>{try{font.encodeText(c);return c;}catch{return c.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7e]/g,"?");}}).join("");
}
export async function renderCertificate(c:CertificateSnapshot,origin:string,logo:Uint8Array){
 if(c.template_version!==1)throw Error("Unsupported certificate template.");
 const pdf=await PDFDocument.create(),page=pdf.addPage([841.89,595.28]),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),serif=await pdf.embedFont(StandardFonts.TimesRoman);
 const ink=color(BRAND.charcoal),orange=color(BRAND.orange),muted=rgb(.38,.42,.46),width=page.getWidth();
 page.drawRectangle({x:24,y:24,width:width-48,height:page.getHeight()-48,borderColor:ink,borderWidth:1});
 page.drawRectangle({x:24,y:page.getHeight()-32,width:width-48,height:8,color:orange});
 const image=await pdf.embedPng(logo),dimensions=image.scaleToFit(190,48);page.drawImage(image,{x:(width-dimensions.width)/2,y:486,width:dimensions.width,height:dimensions.height});
 function centered(text:string,y:number,size:number,font=regular,max=720,tint=ink){const clean=printable(text,font);size=Math.min(size,max/(font.widthOfTextAtSize(clean,1)||1));page.drawText(clean,{x:(width-font.widthOfTextAtSize(clean,size))/2,y,size,font,color:tint});}
 centered("CERTIFICATE OF PARTICIPATION",427,28,bold);
 centered("This certificate is presented to",382,13,regular,720,muted);
 centered(c.recipient_name,330,37,serif);
 page.drawLine({start:{x:170,y:310},end:{x:width-170,y:310},color:orange,thickness:1});
 centered("for participating in",281,13,regular,720,muted);
 centered(c.event_title,246,23,bold);
 const date=new Date(c.event_date+"T00:00:00+08:00").toLocaleDateString("en-PH",{timeZone:"Asia/Manila",month:"long",day:"numeric",year:"numeric"});
 centered(date,211,13);centered(`Issued by ${c.issuer_name} through EventHub`,166,12,regular,650,muted);
 const url=`${origin.replace(/\/$/,"")}/verify/${c.verification_code}`;
 const qr=await pdf.embedPng(await QRCode.toDataURL(url,{width:256,margin:2,errorCorrectionLevel:"M"}));
 page.drawImage(qr,{x:width-132,y:47,width:80,height:80});
 page.drawText("Scan to verify",{x:width-127,y:37,size:9,font:regular,color:muted});
 page.drawText(printable(c.certificate_number,regular),{x:52,y:82,size:12,font:bold,color:ink});
 page.drawText("Digitally issued • Verify authenticity using the QR code.",{x:52,y:61,size:10,font:regular,color:muted});
 pdf.setTitle(`Certificate of participation — ${c.certificate_number}`);pdf.setAuthor("EventHub");pdf.setSubject(c.event_title);
 return pdf.save();
}
