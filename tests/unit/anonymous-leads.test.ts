import { describe, it, expect } from "vitest";
import { isAnonymousClickLead, leadsDueForReminder } from "../../src/lib/crm.js";
import { Lead, LeadStatus } from "../../src/types.js";

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: "l", visitorName: "Someone", visitorPhone: "+974 5555 1234", message: "hi", contactMethod: "INQUIRY", status: LeadStatus.NEW,
  agentId: "a", createdDate: "2026-11-01T08:00:00.000Z", updatedDate: "2026-11-01T08:00:00.000Z", ...over
});

describe("isAnonymousClickLead", () => {
  it("recognises the records the Call and WhatsApp buttons log before anyone says who they are", () => {
    expect(isAnonymousClickLead(lead({ visitorPhone: "Call Event" }))).toBe(true);
    expect(isAnonymousClickLead(lead({ visitorPhone: "WhatsApp Event" }))).toBe(true);
    expect(isAnonymousClickLead(lead({ visitorPhone: "" }))).toBe(true);
  });

  it("treats anything with a way to reach the person as a real lead", () => {
    expect(isAnonymousClickLead(lead())).toBe(false);
    expect(isAnonymousClickLead(lead({ visitorPhone: "Call Event", visitorEmail: "a@b.co" }))).toBe(false);
    expect(isAnonymousClickLead(lead({ visitorPhone: "Call Event", visitorWhatsapp: "+974 5555 1234" }))).toBe(false);
    expect(isAnonymousClickLead(lead({ visitorPhone: "٠٠٩٧٤٥٥٥٥١٢٣٤" }))).toBe(false); // Arabic digits count as a number
    expect(isAnonymousClickLead(lead({ visitorPhone: "Call Event", addedManually: true }))).toBe(false); // the agent's own record
  });

  it("is never reminded about, however long it sits", () => {
    const now = Date.parse("2026-11-20T08:00:00Z");
    expect(leadsDueForReminder([lead({ visitorPhone: "Call Event" })], now)).toEqual([]);
    expect(leadsDueForReminder([lead()], now).map(d => d.reason)).toEqual(["unanswered"]); // a real one still is
  });
});
