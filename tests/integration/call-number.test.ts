import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app, runCrmReminders } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { LeadStatus } from "../../src/types.js";
import { uniqueEmail, uniqueIp, signupAndVerify } from "../helpers.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

async function newAgent(label: string) {
  const res = await signupAndVerify(app, uniqueIp(), {
    email: uniqueEmail(label),
    password: "correct-horse-battery-staple",
    fullName: `Call ${label}`,
    phone: "+974 5555 9800",
    role: "AGENT"
  });
  return { token: res.body.token as string, id: res.body.user.id as string };
}

let seq = 0;
/** A listing owned by this agent (agent-info and whatsapp-number only read its owner). */
function addProperty(agentId: string, orgId?: string): string {
  const db = readDb();
  const id = `prop-call-${Date.now()}-${seq++}`;
  db.properties.unshift({ id, agentId, orgId, title: "Test listing", images: [], listingStatus: "PUBLISHED" } as any);
  writeDb(db);
  return id;
}
function setContact(agentId: string, contact: { phone?: string; whatsapp?: string }) {
  const db = readDb();
  const u = db.users.find(x => x.id === agentId)!;
  u.phone = contact.phone as string;
  u.whatsapp = contact.whatsapp;
  writeDb(db);
}
const info = (propertyId: string) => request(app).get(`/api/properties/${propertyId}/agent-info`);

describe("which number a listing's Call and WhatsApp buttons use", () => {
  it("calls the listing's own agent, never a placeholder", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("call-own");
    setContact(a.id, { phone: "+974 5100 2233" });
    const res = await info(addProperty(a.id));
    expect(res.status).toBe(200);
    expect(res.body.callNumber).toBe("97451002233");
    expect(res.body.callNumber).not.toBe("97444448888"); // the number the card used to dial for every listing
    expect(res.body.callNumber).not.toBe("97433334444"); // the demo agent's number
  });

  it("dials the voice number but opens WhatsApp on the WhatsApp number when they differ", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("call-both");
    setContact(a.id, { phone: "+974 5100 0001", whatsapp: "+974 5100 0002" });
    const id = addProperty(a.id);
    const res = await info(id);
    expect(res.body.callNumber).toBe("97451000001");
    expect(res.body.phone).toBe("97451000002");
    const wa = await request(app).get(`/api/properties/${id}/whatsapp-number`);
    expect(wa.body.whatsappNumber).toBe("97451000002");
  });

  it("falls back to the WhatsApp number for a call when there is no phone, and understands every way of writing a number", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("call-format");
    setContact(a.id, { phone: "", whatsapp: "00974 5100 0003" });
    expect((await info(addProperty(a.id))).body.callNumber).toBe("97451000003");
    setContact(a.id, { phone: "5100 0004" }); // a local 8-digit number
    expect((await info(addProperty(a.id))).body.callNumber).toBe("97451000004");
    setContact(a.id, { phone: "٠٠٩٧٤٥١٠٠٠٠٠٥" }); // typed on an Arabic keyboard
    expect((await info(addProperty(a.id))).body.callNumber).toBe("97451000005");
  });

  it("uses the agency's number when the agent has none, and offers NO number to call when nobody has one", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("call-org");
    setContact(a.id, { phone: "", whatsapp: undefined });
    const db = readDb();
    db.organizations.unshift({ id: "org-call-1", name: "Call Test Realty", phone: "+974 4400 1100" } as any);
    writeDb(db);
    expect((await info(addProperty(a.id, "org-call-1"))).body.callNumber).toBe("97444001100");

    const noOrg = await info(addProperty(a.id));
    expect(noOrg.body.callNumber).toBe(""); // the Call button says "no number" instead of ringing a stranger
    // WhatsApp still has its configurable platform default as a last resort
    expect(noOrg.body.phone).toMatch(/^\d{8,15}$/);
  });

  it("returns 404 for an unknown listing", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await info("no-such-property").expect(404);
    await request(app).get("/api/properties/no-such-property/whatsapp-number").expect(404);
  });
});

describe("a Call or WhatsApp click is not a client", () => {
  it("keeps anonymous click records out of the Sales Desk, its exports and its reminders", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("click-agent");
    const old = new Date(Date.now() - 5 * 24 * 3600_000).toISOString();
    const base = { visitorEmail: undefined, message: "click", status: LeadStatus.NEW, agentId: a.id, createdDate: old, updatedDate: old };
    const db = readDb();
    db.leads.unshift(
      { id: `lead-click-call-${Date.now()}`, visitorName: "Anonymous Visitor (Phone Link)", visitorPhone: "Call Event", contactMethod: "CALL", ...base },
      { id: `lead-click-wa-${Date.now()}`, visitorName: "Anonymous Visitor (WhatsApp)", visitorPhone: "WhatsApp Event", contactMethod: "WHATSAPP", ...base },
      { id: `lead-real-${Date.now()}`, visitorName: "Real Inquiry", visitorPhone: "+974 5000 8888", contactMethod: "INQUIRY", ...base }
    );
    writeDb(db);

    const overview = await request(app).get("/api/crm/overview").set({ Authorization: `Bearer ${a.token}` });
    expect(overview.body.leads.map((l: any) => l.visitorName)).toEqual(["Real Inquiry"]);

    const csv = await request(app).get("/api/crm/export?kind=leads").set({ Authorization: `Bearer ${a.token}` });
    expect(csv.text).toContain("Real Inquiry");
    expect(csv.text).not.toContain("Anonymous Visitor");

    // only the real inquiry earns a reminder (it has sat unanswered for days)
    const r = runCrmReminders(Date.parse("2026-11-10T08:00:00Z") + 10 * 24 * 3600_000, { onlyAgentIds: [a.id] });
    expect(r.leads).toBe(1);
    expect(readDb().leads.filter(l => l.agentId === a.id && l.lastReminderAt).map(l => l.visitorName)).toEqual(["Real Inquiry"]);
  });
});
