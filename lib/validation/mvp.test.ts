import { describe,expect,it } from "vitest";
import { applicationSchema,eventSchema } from "./mvp";
const draft = { title:"Campus seminar",description:"",venue:"",category_id:"",host_college_id:"",starts_at:"",ends_at:"",registration_opens_at:"",registration_closes_at:"",capacity:"",approval_mode:"automatic",visibility:"public" };
describe("MVP event validation", () => {
  it("allows a minimal draft without coercing empty choices into zero", () => { const v = eventSchema.parse(draft); expect(v.capacity).toBeNull(); expect(v.category_id).toBeNull(); expect(v.starts_at).toBeNull(); });
  it("interprets event dates in Philippine time", () => { expect(eventSchema.parse({...draft,starts_at:"2026-12-01T09:00"}).starts_at).toBe("2026-12-01T01:00:00.000Z"); });
  it.each(["2026-02-31T09:00","2026-12-01T25:00","not a date"])("rejects invalid calendar date %s", starts_at => expect(eventSchema.safeParse({...draft,starts_at}).success).toBe(false));
  it("rejects reversed registration dates", () => expect(eventSchema.safeParse({...draft,registration_opens_at:"2026-12-01T09:00",registration_closes_at:"2026-12-01T08:00"}).success).toBe(false));
  it("rejects registration after start", () => expect(eventSchema.safeParse({...draft,starts_at:"2026-12-01T09:00",registration_closes_at:"2026-12-01T10:00"}).success).toBe(false));
  it("rejects end before start and spans beyond seven days", () => { for(const ends_at of ["2026-12-01T08:00","2026-12-09T09:00"]) expect(eventSchema.safeParse({...draft,starts_at:"2026-12-01T09:00",ends_at}).success).toBe(false); });
  it.each([0,5001,-1,1.5])("rejects invalid capacity %s", capacity => expect(eventSchema.safeParse({...draft,capacity}).success).toBe(false));
});
describe("Organizer application", () => {
  const application = {organization_name:"Campus Council",position_title:"President",contact_number:"09123456789",reason:"I am authorized to organize student activities for our university council.",proof_document_path:"user/proof.pdf",consent:true};
  it("requires consent and sufficient explanation", () => { expect(applicationSchema.safeParse(application).success).toBe(true); expect(applicationSchema.safeParse({...application,consent:false}).success).toBe(false); expect(applicationSchema.safeParse({...application,reason:"Too short"}).success).toBe(false); });
  it("rejects a non-Philippine mobile number", () => expect(applicationSchema.safeParse({...application,contact_number:"123456"}).success).toBe(false));
});

import { withRegistrationDefaults } from "./mvp";
describe("simplified event form registration defaults", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  const base = { starts_at: "2026-11-10T01:00:00.000Z", registration_opens_at: null, registration_closes_at: null };
  it("opens registration now and closes it at the event start", () => {
    expect(withRegistrationDefaults(base, now)).toMatchObject({ registration_opens_at: "2026-11-01T00:00:00.000Z", registration_closes_at: base.starts_at });
  });
  it("keeps explicit values", () => {
    const set = { ...base, registration_opens_at: "2026-10-20T00:00:00.000Z", registration_closes_at: "2026-11-09T00:00:00.000Z" };
    expect(withRegistrationDefaults(set, now)).toEqual(set);
  });
  it("leaves a draft without a date empty, and never opens after closing", () => {
    expect(withRegistrationDefaults({ ...base, starts_at: null }, now)).toMatchObject({ registration_opens_at: null, registration_closes_at: null });
    expect(withRegistrationDefaults({ ...base, starts_at: "2026-10-01T00:00:00.000Z" }, now).registration_opens_at).toBeNull();
  });
});
