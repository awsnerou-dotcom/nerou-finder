import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app, runCrmReminders } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { Lead, LeadStatus, ViewingRequest } from "../../src/types.js";
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
    fullName: `Crm ${label}`,
    phone: "+974 5555 9700",
    role: "AGENT"
  });
  return { token: res.body.token as string, id: res.body.user.id as string };
}

function adminTokenFor(userId: string, role = "AGENCY_ADMIN") {
  return jwt.sign({ id: userId, email: "x@test.local", role, fullName: "Org Admin" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

let seq = 0;
function addLead(agentId: string, over: Partial<Lead> = {}): Lead {
  const db = readDb();
  const now = new Date().toISOString();
  const lead: Lead = {
    id: `lead-crm-${Date.now()}-${seq++}`,
    visitorName: "Test Client",
    visitorPhone: "+974 5555 0001",
    visitorEmail: `client-${seq}@example.com`,
    message: "Interested",
    contactMethod: "INQUIRY",
    status: LeadStatus.NEW,
    agentId,
    createdDate: now,
    updatedDate: now,
    ...over
  };
  db.leads.unshift(lead);
  writeDb(db);
  return lead;
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const leadInDb = (id: string) => readDb().leads.find(l => l.id === id)!;

describe("pipeline: moving a lead", () => {
  it("lets the owner move it, records the timeline, and clears the follow-up when it closes", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("pipe-owner");
    const lead = addLead(a.id);
    await request(app).patch(`/api/leads/${lead.id}/follow-up`).set(auth(a.token)).send({ nextFollowUpDate: "2099-01-01" }).expect(200);

    const moved = await request(app).post("/api/leads/status").set(auth(a.token)).send({ leadId: lead.id, status: "CONTACTED" });
    expect(moved.status).toBe(200);
    expect(leadInDb(lead.id).status).toBe("CONTACTED");
    expect(leadInDb(lead.id).stageHistory?.map(s => s.status)).toEqual(["CONTACTED"]);
    expect(leadInDb(lead.id).nextFollowUpDate).toBeTruthy();

    await request(app).post("/api/leads/status").set(auth(a.token)).send({ leadId: lead.id, status: "LOST", lostReason: "Bought elsewhere" }).expect(200);
    expect(leadInDb(lead.id).nextFollowUpDate).toBeUndefined();
    expect(leadInDb(lead.id).lostReason).toBe("Bought elsewhere");
  });

  it("refuses another agent (this used to work for any signed-in user), unknown statuses, and anonymous callers", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const owner = await newAgent("pipe-own2");
    const stranger = await newAgent("pipe-stranger");
    const lead = addLead(owner.id);

    await request(app).post("/api/leads/status").set(auth(stranger.token)).send({ leadId: lead.id, status: "LOST" }).expect(403);
    expect(leadInDb(lead.id).status).toBe("NEW");
    await request(app).post("/api/leads/status").set(auth(owner.token)).send({ leadId: lead.id, status: "BOGUS" }).expect(400);
    await request(app).post("/api/leads/status").send({ leadId: lead.id, status: "LOST" }).expect(401);
  });

  it("lets the admin of the owner's organisation move it, and nobody from another organisation", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await newAgent("pipe-org-agent");
    const admin = await newAgent("pipe-org-admin");
    const outsider = await newAgent("pipe-org-outsider");
    const db = readDb();
    db.users.find(u => u.id === agent.id)!.orgId = "org-crm-1";
    db.users.find(u => u.id === admin.id)!.orgId = "org-crm-1";
    db.users.find(u => u.id === outsider.id)!.orgId = "org-crm-2";
    writeDb(db);
    const lead = addLead(agent.id, { orgId: "org-crm-1" });

    await request(app).post("/api/leads/status").set(auth(adminTokenFor(admin.id))).send({ leadId: lead.id, status: "CONTACTED" }).expect(200);
    await request(app).post("/api/leads/status").set(auth(adminTokenFor(outsider.id))).send({ leadId: lead.id, status: "LOST" }).expect(403);
  });
});

describe("follow-up date", () => {
  it("stores a bare date as 08:00 Qatar time, clears with null, rejects junk and strangers", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("fu-owner");
    const stranger = await newAgent("fu-stranger");
    const lead = addLead(a.id, { reminderCount: 2, lastReminderAt: "2026-01-01T00:00:00.000Z" });

    const set = await request(app).patch(`/api/leads/${lead.id}/follow-up`).set(auth(a.token)).send({ nextFollowUpDate: "2026-12-01" });
    expect(set.status).toBe(200);
    expect(leadInDb(lead.id).nextFollowUpDate).toBe("2026-12-01T05:00:00.000Z");
    // a new date re-arms the reminders
    expect(leadInDb(lead.id).reminderCount).toBe(0);
    expect(leadInDb(lead.id).lastReminderAt).toBeUndefined();

    await request(app).patch(`/api/leads/${lead.id}/follow-up`).set(auth(a.token)).send({ nextFollowUpDate: null }).expect(200);
    expect(leadInDb(lead.id).nextFollowUpDate).toBeUndefined();
    await request(app).patch(`/api/leads/${lead.id}/follow-up`).set(auth(a.token)).send({ nextFollowUpDate: "tomorrow" }).expect(400);
    await request(app).patch(`/api/leads/${lead.id}/follow-up`).set(auth(a.token)).send({ nextFollowUpDate: "2026-02-31" }).expect(400);
    await request(app).patch(`/api/leads/${lead.id}/follow-up`).set(auth(stranger.token)).send({ nextFollowUpDate: "2026-12-01" }).expect(403);
  });
});

describe("viewing schedule", () => {
  it("lets the agent schedule a viewing (confirmed, lead moves to viewing scheduled), reschedule it, and keeps strangers out", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("view-owner");
    const stranger = await newAgent("view-stranger");
    const lead = addLead(a.id, { status: LeadStatus.CONTACTED });

    await request(app).post("/api/viewings").set(auth(stranger.token)).send({ leadId: lead.id, preferredDate: "2026-12-05", preferredTimeSlot: "10:00" }).expect(403);
    await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "05/12/2026", preferredTimeSlot: "10:00" }).expect(400);
    await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-12-05", preferredTimeSlot: "" }).expect(400);

    const created = await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-12-05", preferredTimeSlot: "10:00", notes: "Gate code 1234" });
    expect(created.status).toBe(200);
    const v: ViewingRequest = created.body.viewing;
    expect(v).toMatchObject({ status: "CONFIRMED", agentId: a.id, scheduledByAgent: true, leadId: lead.id });
    expect(leadInDb(lead.id).status).toBe("VIEWING_SCHEDULED");

    // reschedule: new slot, still confirmed, reminder re-armed
    const dbBefore = readDb();
    dbBefore.viewings.find(x => x.id === v.id)!.reminderSentFor = "2026-12-05|10:00";
    writeDb(dbBefore);
    await request(app).patch(`/api/viewings/${v.id}`).set(auth(stranger.token)).send({ preferredDate: "2026-12-06" }).expect(403);
    const moved = await request(app).patch(`/api/viewings/${v.id}`).set(auth(a.token)).send({ preferredDate: "2026-12-06", preferredTimeSlot: "16:30" });
    expect(moved.status).toBe(200);
    const stored = readDb().viewings.find(x => x.id === v.id)!;
    expect(stored).toMatchObject({ preferredDate: "2026-12-06", preferredTimeSlot: "16:30", status: "CONFIRMED" });
    expect(stored.reminderSentFor).toBeUndefined();
  });

  it("refuses status changes from strangers (this used to work for any signed-in user) and unknown statuses", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("vstat-owner");
    const stranger = await newAgent("vstat-stranger");
    const lead = addLead(a.id);
    const created = await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-12-05", preferredTimeSlot: "10:00" });
    const id = created.body.viewing.id;

    await request(app).post("/api/viewings/status").set(auth(stranger.token)).send({ viewingId: id, status: "CANCELLED" }).expect(403);
    await request(app).post("/api/viewings/status").set(auth(a.token)).send({ viewingId: id, status: "NOPE" }).expect(400);
    await request(app).post("/api/viewings/status").set(auth(a.token)).send({ viewingId: id, status: "COMPLETED" }).expect(200);
  });

  it("confirming a requested viewing moves an early-stage lead to viewing scheduled", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("vconfirm");
    const lead = addLead(a.id, { status: LeadStatus.VIEWING_REQUESTED });
    const db = readDb();
    db.viewings.unshift({ id: `view-crm-${Date.now()}`, leadId: lead.id, propertyId: "", agentId: a.id, preferredDate: "2026-12-05", preferredTimeSlot: "11:00", status: "REQUESTED", createdDate: new Date().toISOString() });
    writeDb(db);
    const id = readDb().viewings[0].id;
    await request(app).post("/api/viewings/status").set(auth(a.token)).send({ viewingId: id, status: "CONFIRMED" }).expect(200);
    expect(leadInDb(lead.id).status).toBe("VIEWING_SCHEDULED");
  });

  it("shows an organisation admin the viewings of every agent in the organisation, an agent only their own", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a1 = await newAgent("vorg-a1");
    const a2 = await newAgent("vorg-a2");
    const admin = await newAgent("vorg-admin");
    const db = readDb();
    for (const u of [a1, a2, admin]) db.users.find(x => x.id === u.id)!.orgId = "org-crm-v";
    writeDb(db);
    const l1 = addLead(a1.id, { orgId: "org-crm-v" });
    const l2 = addLead(a2.id, { orgId: "org-crm-v" });
    const v1 = (await request(app).post("/api/viewings").set(auth(a1.token)).send({ leadId: l1.id, preferredDate: "2026-12-05", preferredTimeSlot: "10:00" })).body.viewing.id;
    const v2 = (await request(app).post("/api/viewings").set(auth(a2.token)).send({ leadId: l2.id, preferredDate: "2026-12-05", preferredTimeSlot: "12:00" })).body.viewing.id;

    const asAdmin = await request(app).get("/api/viewings").set(auth(adminTokenFor(admin.id)));
    expect(asAdmin.body.map((v: ViewingRequest) => v.id)).toEqual(expect.arrayContaining([v1, v2]));
    const asA1 = await request(app).get("/api/viewings").set(auth(a1.token));
    expect(asA1.body.map((v: ViewingRequest) => v.id)).toEqual([v1]);
  });
});

describe("deals & commissions", () => {
  const sale = { dealType: "SALE", dealValue: 2_000_000, commissionRate: 2, propertyTitle: "Villa West Bay", clientName: "Ali" };

  it("computes the commission from the rate, marks the linked lead as won, and lists it back", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("deal-basic");
    const lead = addLead(a.id, { status: LeadStatus.NEGOTIATION });
    const res = await request(app).post("/api/deals").set(auth(a.token)).send({ ...sale, leadId: lead.id });
    expect(res.status).toBe(200);
    expect(res.body.deal).toMatchObject({ agentId: a.id, commissionAmount: 40000, commissionRate: 2, commissionStatus: "EXPECTED", status: "CLOSED", currency: "QAR", leadId: lead.id });
    expect(leadInDb(lead.id).status).toBe("CONVERTED");
    const list = await request(app).get("/api/deals").set(auth(a.token));
    expect(list.body.map((d: any) => d.id)).toEqual([res.body.deal.id]);
  });

  it("takes an explicit commission amount over the rate", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("deal-amount");
    const res = await request(app).post("/api/deals").set(auth(a.token)).send({ ...sale, commissionAmount: 25000 });
    expect(res.body.deal.commissionAmount).toBe(25000);
  });

  it("rejects bad input", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("deal-bad");
    const post = (body: object) => request(app).post("/api/deals").set(auth(a.token)).send({ ...sale, ...body });
    await post({ dealType: "LEASE" }).expect(400);
    await post({ dealValue: -5 }).expect(400);
    await post({ dealValue: 0 }).expect(400);
    await post({ dealValue: "abc" }).expect(400);
    await post({ commissionRate: 150 }).expect(400);
    await post({ commissionAmount: 99_000_000 }).expect(400);
    await post({ closedDate: "yesterday" }).expect(400);
    await post({ propertyTitle: "" }).expect(400);
    await post({ leadId: "no-such-lead" }).expect(404);
    await request(app).post("/api/deals").send(sale).expect(401);
  });

  it("keeps deals private to their agent: others see none of it and cannot edit or delete it", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const owner = await newAgent("deal-owner");
    const stranger = await newAgent("deal-stranger");
    const id = (await request(app).post("/api/deals").set(auth(owner.token)).send(sale)).body.deal.id;

    expect((await request(app).get("/api/deals").set(auth(stranger.token))).body).toEqual([]);
    await request(app).patch(`/api/deals/${id}`).set(auth(stranger.token)).send({ dealValue: 1 }).expect(404);
    await request(app).delete(`/api/deals/${id}`).set(auth(stranger.token)).expect(404);
    expect(readDb().deals!.some(d => d.id === id)).toBe(true);
    // cannot attach a deal to somebody else's lead either
    const foreignLead = addLead(owner.id);
    await request(app).post("/api/deals").set(auth(stranger.token)).send({ ...sale, leadId: foreignLead.id }).expect(403);
  });

  it("recomputes the commission on edit, stamps the received date, cancels, and deletes", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("deal-edit");
    const id = (await request(app).post("/api/deals").set(auth(a.token)).send(sale)).body.deal.id;

    let r = await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ dealValue: 3_000_000 });
    expect(r.body.deal.commissionAmount).toBe(60000); // 2% of the new value
    r = await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ commissionStatus: "RECEIVED" });
    expect(r.body.deal.commissionStatus).toBe("RECEIVED");
    expect(r.body.deal.commissionReceivedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    r = await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ commissionStatus: "EXPECTED" });
    expect(r.body.deal.commissionReceivedDate).toBeUndefined();
    r = await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ status: "CANCELLED" });
    expect(r.body.deal.status).toBe("CANCELLED");
    await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ status: "WHATEVER" }).expect(400);
    await request(app).delete(`/api/deals/${id}`).set(auth(a.token)).expect(200);
    expect(readDb().deals!.some(d => d.id === id)).toBe(false);
  });

  it("gives an organisation admin the whole organisation's deals and lets them record one only for their own agents", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await newAgent("deal-org-agent");
    const admin = await newAgent("deal-org-admin");
    const outsider = await newAgent("deal-org-outsider");
    const db = readDb();
    db.users.find(u => u.id === agent.id)!.orgId = "org-crm-d";
    db.users.find(u => u.id === admin.id)!.orgId = "org-crm-d";
    db.users.find(u => u.id === outsider.id)!.orgId = "org-crm-other";
    writeDb(db);
    const adminToken = adminTokenFor(admin.id);

    const agentDeal = (await request(app).post("/api/deals").set(auth(agent.token)).send(sale)).body.deal.id;
    const viaAdmin = await request(app).post("/api/deals").set(auth(adminToken)).send({ ...sale, agentId: agent.id });
    expect(viaAdmin.status).toBe(200);
    expect(viaAdmin.body.deal.agentId).toBe(agent.id);
    expect(viaAdmin.body.deal.orgId).toBe("org-crm-d");
    await request(app).post("/api/deals").set(auth(adminToken)).send({ ...sale, agentId: outsider.id }).expect(400);

    const adminList = await request(app).get("/api/deals").set(auth(adminToken));
    expect(adminList.body.map((d: any) => d.id)).toEqual(expect.arrayContaining([agentDeal, viaAdmin.body.deal.id]));
    expect((await request(app).get("/api/deals").set(auth(outsider.token))).body).toEqual([]);
    await request(app).patch(`/api/deals/${agentDeal}`).set(auth(adminToken)).send({ notes: "checked" }).expect(200);
  });
});

describe("reports (CSV export)", () => {
  it("exports the caller's own data as Excel-friendly CSV, nobody else's", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("exp-owner");
    const b = await newAgent("exp-other");
    addLead(a.id, { visitorName: "Mine, Client", message: 'He said "call me"\nafter 5' });
    addLead(b.id, { visitorName: "Someone Else's Client" });

    const res = await request(app).get("/api/crm/export?kind=leads").set(auth(a.token)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="nerou-leads-\d{4}-\d{2}-\d{2}\.csv"/);
    const text = res.body as string;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"Mine, Client"');
    expect(text).toContain('"He said ""call me""\nafter 5"');
    expect(text).not.toContain("Someone Else's Client");
  });

  it("defuses spreadsheet formulas typed by a visitor (CSV injection)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("exp-inject");
    addLead(a.id, { visitorName: "=HYPERLINK(\"http://evil.example\",\"click\")", message: "@SUM(1+1)" });
    const res = await request(app).get("/api/crm/export?kind=leads").set(auth(a.token)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
    });
    const text = res.body as string;
    expect(text).not.toMatch(/(^|,)"?=HYPERLINK/m);
    expect(text).toContain("'=HYPERLINK");
    expect(text).not.toMatch(/(^|,)"?@SUM/m);
  });

  it("exports deals, viewings and the monthly commission summary; filters by date; validates input", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("exp-kinds");
    const body = { dealType: "SALE", dealValue: 1_000_000, commissionRate: 2, propertyTitle: "Villa", clientName: "Ali" };
    await request(app).post("/api/deals").set(auth(a.token)).send({ ...body, closedDate: "2026-09-10" }).expect(200);
    await request(app).post("/api/deals").set(auth(a.token)).send({ ...body, closedDate: "2026-10-12", commissionStatus: "RECEIVED" }).expect(200);
    const get = (q: string) => request(app).get(`/api/crm/export?${q}`).set(auth(a.token)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
    });

    const monthly = (await get("kind=monthly")).body as string;
    expect(monthly).toContain("2026-10,1,1000000,0,20000,20000,0");
    expect(monthly).toContain("2026-09,1,1000000,0,20000,0,20000");
    const octOnly = (await get("kind=deals&from=2026-10-01&to=2026-10-31")).body as string;
    expect(octOnly).toContain("2026-10-12");
    expect(octOnly).not.toContain("2026-09-10");
    expect((await get("kind=viewings")).status).toBe(200);
    expect((await get("kind=nonsense")).status).toBe(400);
    expect((await get("kind=deals&from=bad")).status).toBe(400);
    await request(app).get("/api/crm/export?kind=deals").expect(401);
  });
});

describe("Sales Desk overview and settings", () => {
  it("returns only the caller's records, with names filled in, and saves the reminder preference", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("ov-owner");
    const b = await newAgent("ov-other");
    const mine = addLead(a.id, { visitorName: "Overview Client" });
    addLead(b.id, { visitorName: "Not Mine" });
    await request(app).get("/api/crm/overview").expect(401);

    const res = await request(app).get("/api/crm/overview").set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body.leads.map((l: any) => l.id)).toEqual([mine.id]);
    expect(res.body.leads[0].agentName).toBe("Crm ov-owner");
    expect(res.body.isOrgAdmin).toBe(false);
    expect(res.body.canEditDeals).toBe(true);
    expect(res.body.settings.followUpRemindersEnabled).toBe(true);

    await request(app).patch("/api/crm/settings").set(auth(a.token)).send({ followUpRemindersEnabled: "no" }).expect(400);
    await request(app).patch("/api/crm/settings").set(auth(a.token)).send({ followUpRemindersEnabled: false }).expect(200);
    expect((await request(app).get("/api/crm/overview").set(auth(a.token))).body.settings.followUpRemindersEnabled).toBe(false);
  });
});

describe("automatic reminders", () => {
  const MORNING = Date.parse("2026-11-10T08:00:00Z"); // 11:00 in Qatar
  const NIGHT = Date.parse("2026-11-09T23:30:00Z"); // 02:30 in Qatar

  it("sends one digest per agent when follow-ups are due, flags the leads, and never repeats it", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-owner");
    const due1 = addLead(a.id, { visitorName: "Due One", nextFollowUpDate: "2026-11-10T05:00:00.000Z" });
    const due2 = addLead(a.id, { visitorName: "Due Two", nextFollowUpDate: "2026-11-09T05:00:00.000Z" });
    const later = addLead(a.id, { visitorName: "Later", nextFollowUpDate: "2026-11-20T05:00:00.000Z" });

    const first = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(first.leads).toBe(2);
    expect(first.emails).toBe(1); // one email for both clients, not one each
    expect(leadInDb(due1.id).lastReminderAt).toBeTruthy();
    expect(leadInDb(due2.id).lastReminderAt).toBeTruthy();
    expect(leadInDb(later.id).lastReminderAt).toBeUndefined();
    expect(readDb().notifications!.some(n => n.userId === a.id && n.type === "followup_reminder")).toBe(true);

    const second = runCrmReminders(MORNING + 60 * 60 * 1000, { onlyAgentIds: [a.id] });
    expect(second).toMatchObject({ leads: 0, viewings: 0, emails: 0 });
  });

  it("stays silent overnight in Qatar and sends in the morning instead", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-night");
    const lead = addLead(a.id, { nextFollowUpDate: "2026-11-09T05:00:00.000Z" });
    expect(runCrmReminders(NIGHT, { onlyAgentIds: [a.id] })).toMatchObject({ leads: 0, emails: 0 });
    expect(leadInDb(lead.id).lastReminderAt).toBeUndefined();
    expect(runCrmReminders(MORNING, { onlyAgentIds: [a.id] })).toMatchObject({ leads: 1, emails: 1 });
  });

  it("respects an agent who turned the emails off (the in-app notice still arrives)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-off");
    await request(app).patch("/api/crm/settings").set(auth(a.token)).send({ followUpRemindersEnabled: false }).expect(200);
    addLead(a.id, { nextFollowUpDate: "2026-11-09T05:00:00.000Z" });
    const r = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(r.leads).toBe(1);
    expect(r.emails).toBe(0);
    expect(readDb().notifications!.some(n => n.userId === a.id && n.type === "followup_reminder")).toBe(true);
  });

  it("nudges an unanswered new lead after a day, and leaves archived, won and lost leads alone", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-stale");
    const old = new Date(MORNING - 30 * 60 * 60 * 1000).toISOString();
    const stale = addLead(a.id, { createdDate: old, updatedDate: old });
    const archived = addLead(a.id, { createdDate: old, updatedDate: old, isArchived: true });
    const won = addLead(a.id, { createdDate: old, updatedDate: old, status: LeadStatus.CONVERTED });
    const r = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(r.leads).toBe(1);
    expect(leadInDb(stale.id).reminderCount).toBe(1);
    expect(leadInDb(archived.id).lastReminderAt).toBeUndefined();
    expect(leadInDb(won.id).lastReminderAt).toBeUndefined();
  });

  it("reminds agent and client about a confirmed viewing tomorrow, once, and again after a reschedule", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-view");
    const lead = addLead(a.id, { visitorEmail: "viewer@example.com" });
    const created = await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-11-11", preferredTimeSlot: "10:00" });
    const id = created.body.viewing.id;

    const first = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(first.viewings).toBe(1);
    expect(first.emails).toBe(2); // the agent and the client
    expect(readDb().viewings.find(v => v.id === id)!.reminderSentFor).toBe("2026-11-11|10:00");
    expect(runCrmReminders(MORNING + 3600_000, { onlyAgentIds: [a.id] }).viewings).toBe(0);

    await request(app).patch(`/api/viewings/${id}`).set(auth(a.token)).send({ preferredTimeSlot: "15:00" }).expect(200);
    expect(runCrmReminders(MORNING + 2 * 3600_000, { onlyAgentIds: [a.id] }).viewings).toBe(1);
  });

  it("does not remind about viewings that are not confirmed or are more than a day away", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-view-skip");
    const lead = addLead(a.id);
    const far = (await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-11-20", preferredTimeSlot: "10:00" })).body.viewing.id;
    const cancelled = (await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-11-11", preferredTimeSlot: "12:00" })).body.viewing.id;
    await request(app).post("/api/viewings/status").set(auth(a.token)).send({ viewingId: cancelled, status: "CANCELLED" }).expect(200);
    const r = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(r.viewings).toBe(0);
    expect(readDb().viewings.find(v => v.id === far)!.reminderSentFor).toBeUndefined();
  });
});
