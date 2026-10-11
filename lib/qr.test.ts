import { expect,it } from "vitest";
import { createRequire } from "node:module";
import { RGBLuminanceSource,HybridBinarizer,BinaryBitmap,QRCodeReader } from "@zxing/library";
import { registrationQr,registrationUrl } from "./qr";
const { PNG } = createRequire(import.meta.url)("pngjs"); // Installed by qrcode.
it("registration PNG decodes to the canonical static event URL without credentials or a token", async () => {
  const url = registrationUrl("https://eventhub.example/","12345678-1234-4234-8234-123456789abc");
  expect(url).toBe("https://eventhub.example/events/12345678-1234-4234-8234-123456789abc");
  const data = await registrationQr(url); const png = PNG.sync.read(Buffer.from(data.split(",")[1],"base64"));
  const pixels = new Int32Array(png.width * png.height);
  for(let i=0;i<pixels.length;i++) pixels[i]=(png.data[i*4]<<16)|(png.data[i*4+1]<<8)|png.data[i*4+2];
  const decoded = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,png.width,png.height))));
  expect(decoded.getText()).toBe(url); expect(png.width).toBe(1024);
});
