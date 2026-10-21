import { describe,it,expect } from "vitest";
import { parseScan } from "./attendance";
describe("QR routing",()=>{
 it("accepts attendance only on this origin",()=>{expect(parseScan("https://eventhub.test/scan?t="+"A".repeat(48),"https://eventhub.test")).toEqual({kind:"attendance",token:"A".repeat(48)});expect(parseScan("https://evil.test/scan?t="+"A".repeat(48),"https://eventhub.test").kind).toBe("invalid");});
 it("separates registration and rejects malformed payloads",()=>{expect(parseScan("https://eventhub.test/events/12345678-1234-1234-1234-123456789012","https://eventhub.test").kind).toBe("registration");expect(parseScan("https://eventhub.test/e/ABCDEFGH","https://eventhub.test").kind).toBe("registration");expect(parseScan("https://eventhub.test/scan?t=x","https://eventhub.test").kind).toBe("invalid");expect(parseScan("javascript:alert(1)","https://eventhub.test").kind).toBe("invalid");});
});

