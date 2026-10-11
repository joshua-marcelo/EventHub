import QRCode from "qrcode";

export function registrationUrl(origin: string, eventId: string) {
  return `${origin.replace(/\/+$/, "")}/events/${eventId}`;
}
export function registrationQr(url: string) {
  return QRCode.toDataURL(url, { width: 1024, margin: 4, errorCorrectionLevel: "M" });
}
