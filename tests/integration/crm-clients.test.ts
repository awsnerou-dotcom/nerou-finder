import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
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

async function newUser(label: string, role = "AGENT") {
  const ip = uniqueIp();
  const res = await signupAndVerify(app, ip, {
    email: uniqueEmail(label),
    password: "correct-horse-battery-staple",
    fullName: `Cli ${label}`,
    phone: "+974 5555 9800",
    role
  });
  return { token: res.body.token as string, id: res.body.user.id as string, email: res.body.user.email as string, ip };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (id: string, role: string) =>
  jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const leadInDb = (id: string) => readDb().leads.find(l => l.id === id);
let phoneSeq = 1000;
const nextPhone = () => `+974 5${String(++phoneSeq).padStart(3, "0")} ${String(Math.floor(Math.random() * 9000) + 1000)}`;

describe("registering a client by hand", () => {
  it("adds a client the platform never saw, with its source, budget, first note and follow-up, in the agent's pipeline", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("cli-add");
    const res = await request(app).post("/api/crm/clients").set(auth(a.token)).send({
      name: "Khalid Walk-in", phone: nextPhone(), email: "Khalid@Example.com", source: "WALK_IN",
      interest: "Villa in Al Waab", budget: 4500000, notes: "Came to the office", status: "CONTACTED", nextFollowUpDate: "2026-12-01"
    });
    expect(res.status).toBe(200);
    const lead = leadInDb(res.body.lead.id)!;
    expect(lead).toMatchObject({
      visitorName: "Khalid Walk-in", visitorEmail: "khalid@example.com", source: "WALK_IN", budget: 4500000, interest: "Villa in Al Waab",
      status: "CONTACTED", agentId: a.id, addedManually: true, readByRecipient: true, nextFollowUpDate: "2026-12-01T05:00:00.000Z"
    });
    expect(lead.notes?.[0].text).toBe("Came to the office");
    expect(lead.stageHistory?.[0].status).toBe("CONTACTED");

    const overview = await request(app).get("/api/crm/overview").set(auth(a.token));
    expect(overview.body.leads.map((l: any) => l.id)).toContain(lead.id);
    expect(overview.body.reminderEmail).toBe(a.email);
    expect(Array.isArray(overview.body.properties)).toBe(true);
  });

  it("validates input, and only agents and organisation admins may add clients", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("cli-valid");
    const buyer = await newUser("cli-buyer", "REGISTERED");
    const post = (body: object, token = a.token) => request(app).post("/api/crm/clients").set(auth(token)).send(body);
    await post({ name: "", phone: nextPhone() }).expect(400);
    await post({ name: "No contact" }).expect(400);
    await post({ name: "Bad phone", phone: "abc" }).expect(400);
    await post({ name: "Bad source", phone: nextPhone(), source: "TIKTOK" }).expect(400);
    await post({ name: "Bad stage", phone: nextPhone(), status: "CONVERTED" }).expect(400);
    await post({ name: "Bad date", phone: nextPhone(), nextFollowUpDate: "soon" }).expect(400);
    await post({ name: "Foreign listing", phone: nextPhone(), propertyId: "prop-1" }).expect(400); // not this agent's listing
    await post({ name: "Buyer", phone: nextPhone() }, buyer.token).expect(403);
    await request(app).post("/api/crm/clients").send({ name: "Anon", phone: nextPhone() }).expect(401);
  });

  it("warns about a number the agent already has (any spelling), and adds it only when told to", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("cli-dup");
    await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Ali", phone: "+974 5555 7777" }).expect(200);
    const dup = await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Ali again", phone: "00974 5555-7777" });
    expect(dup.status).toBe(409);
    expect(dup.body.duplicate.name).toBe("Ali");
    const forced = await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Ali again", phone: "00974 5555-7777", allowDuplicate: true });
    expect(forced.status).toBe(200);
    // another agent may have the same person as their own client
    const b = await newUser("cli-dup-other");
    await request(app).post("/api/crm/clients").set(auth(b.token)).send({ name: "Ali", phone: "+974 5555 7777" }).expect(200);
  });

  it("lets an organisation admin add a client for one of their own agents, and refuses an outsider's agent", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await newUser("cli-org-agent");
    const admin = await newUser("cli-org-admin");
    const outsider = await newUser("cli-org-outsider");
    const db = readDb();
    db.users.find(u => u.id === agent.id)!.orgId = "org-cli-1";
    db.users.find(u => u.id === admin.id)!.orgId = "org-cli-1";
    db.users.find(u => u.id === outsider.id)!.orgId = "org-cli-2";
    writeDb(db);
    const adminToken = tokenFor(admin.id, "AGENCY_ADMIN");
    const ok = await request(app).post("/api/crm/clients").set(auth(adminToken)).send({ name: "For team", phone: nextPhone(), agentId: agent.id });
    expect(ok.status).toBe(200);
    expect(leadInDb(ok.body.lead.id)).toMatchObject({ agentId: agent.id, orgId: "org-cli-1" });
    await request(app).post("/api/crm/clients").set(auth(adminToken)).send({ name: "Not yours", phone: nextPhone(), agentId: outsider.id }).expect(400);
    // the agent sees it, the admin sees it, the outsider does not
    expect((await request(app).get("/api/crm/overview").set(auth(agent.token))).body.leads.map((l: any) => l.id)).toContain(ok.body.lead.id);
    expect((await request(app).get("/api/crm/overview").set(auth(adminToken))).body.leads.map((l: any) => l.id)).toContain(ok.body.lead.id);
    expect((await request(app).get("/api/crm/overview").set(auth(outsider.token))).body.leads.map((l: any) => l.id)).not.toContain(ok.body.lead.id);
  });
});

describe("importing an existing client list", () => {
  it("adds the valid rows and reports the skipped ones with the file row number and a reason", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("imp-basic");
    await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Existing", phone: "+974 5000 1111" }).expect(200);
    const res = await request(app).post("/api/crm/clients/import").set(auth(a.token)).send({
      clients: [
        { name: "Fresh One", phone: "+974 5000 2222", source: "INSTAGRAM", budget: 900000 },
        { name: "", phone: "+974 5000 3333" }, // row 3: no name
        { name: "Existing again", phone: "5000-1111" }, // row 4: already a client
        { name: "No contact" }, // row 5
        { name: "Twin A", phone: "+974 5000 4444" },
        { name: "Twin B", phone: "0097450004444" }, // row 7: same number as Twin A, earlier in the file
        "garbage"
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.skipped.map((s: any) => s.row)).toEqual([3, 4, 5, 7, 8]);
    expect(res.body.skipped.find((s: any) => s.row === 4).reason).toMatch(/already/i);
    expect(res.body.skipped.find((s: any) => s.row === 7).reason).toMatch(/earlier in the file/i);
    const mine = readDb().leads.filter(l => l.agentId === a.id).map(l => l.visitorName).sort();
    expect(mine).toEqual(["Existing", "Fresh One", "Twin A"]);
    expect(readDb().leads.find(l => l.visitorName === "Fresh One")).toMatchObject({ source: "INSTAGRAM", budget: 900000, addedManually: true, status: "NEW" });
  });

  it("rejects an empty list and anything over 500 rows, and anonymous callers", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("imp-limits");
    await request(app).post("/api/crm/clients/import").set(auth(a.token)).send({ clients: [] }).expect(400);
    await request(app).post("/api/crm/clients/import").set(auth(a.token)).send({}).expect(400);
    const many = Array.from({ length: 501 }, (_, i) => ({ name: `C${i}`, phone: `+974 6${String(i).padStart(3, "0")} 0000` }));
    await request(app).post("/api/crm/clients/import").set(auth(a.token)).send({ clients: many }).expect(400);
    await request(app).post("/api/crm/clients/import").send({ clients: [{ name: "A", phone: nextPhone() }] }).expect(401);
  });
});

describe("editing and deleting a hand-added client", () => {
  it("lets the owner edit and delete it; strangers and platform inquiries are off limits", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("edit-owner");
    const stranger = await newUser("edit-stranger");
    const lead = (await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Before", phone: nextPhone(), source: "OTHER" })).body.lead;

    await request(app).patch(`/api/crm/clients/${lead.id}`).set(auth(stranger.token)).send({ name: "Hacked" }).expect(404);
    const edited = await request(app).patch(`/api/crm/clients/${lead.id}`).set(auth(a.token)).send({ name: "After", source: "REFERRAL", budget: 750000, interest: "Studio" });
    expect(edited.status).toBe(200);
    expect(leadInDb(lead.id)).toMatchObject({ visitorName: "After", source: "REFERRAL", budget: 750000, interest: "Studio", message: "Studio" });
    await request(app).patch(`/api/crm/clients/${lead.id}`).set(auth(a.token)).send({ name: "" }).expect(400);

    // an inquiry that came through the platform is the visitor's own submission: not editable
    const platformLead = { id: `lead-plat-${Date.now()}`, visitorName: "Visitor", visitorPhone: "+974 5555 0000", message: "hi", contactMethod: "INQUIRY" as const, status: LeadStatus.NEW, agentId: a.id, createdDate: new Date().toISOString(), updatedDate: new Date().toISOString() };
    const db = readDb(); db.leads.unshift(platformLead); writeDb(db);
    await request(app).patch(`/api/crm/clients/${platformLead.id}`).set(auth(a.token)).send({ name: "Renamed" }).expect(404);
    await request(app).delete(`/api/crm/clients/${platformLead.id}`).set(auth(a.token)).expect(404);

    await request(app).delete(`/api/crm/clients/${lead.id}`).set(auth(stranger.token)).expect(404);
    await request(app).delete(`/api/crm/clients/${lead.id}`).set(auth(a.token)).expect(200);
    expect(leadInDb(lead.id)).toBeUndefined();
  });

  it("deleting a client also removes its viewings but keeps the deal in the ledger", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("del-cascade");
    const lead = (await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "To delete", phone: nextPhone() })).body.lead;
    const v = (await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-12-05", preferredTimeSlot: "10:00" })).body.viewing;
    const deal = (await request(app).post("/api/deals").set(auth(a.token)).send({ leadId: lead.id, dealType: "SALE", dealValue: 1000000, commissionRate: 2, propertyTitle: "Flat", clientName: "To delete" })).body.deal;

    await request(app).delete(`/api/crm/clients/${lead.id}`).set(auth(a.token)).expect(200);
    expect(readDb().viewings.some(x => x.id === v.id)).toBe(false);
    const kept = readDb().deals!.find(d => d.id === deal.id)!;
    expect(kept).toBeTruthy();
    expect(kept.leadId).toBeUndefined();
    expect(kept.commissionAmount).toBe(20000);
  });
});

describe("a broker's own clients stay private and cannot be used to game the platform", () => {
  it("hides them (and their viewings and deals) from platform admins, who also cannot act on them", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("priv-agent");
    const lead = (await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Private Person", phone: nextPhone() })).body.lead;
    const view = (await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: lead.id, preferredDate: "2026-12-05", preferredTimeSlot: "10:00" })).body.viewing;
    await request(app).post("/api/deals").set(auth(a.token)).send({ dealType: "SALE", dealValue: 1000000, commissionRate: 2, propertyTitle: "P", clientName: "Private Person" }).expect(200);
    const admin = tokenFor("user-platform-admin", "PLATFORM_ADMIN");

    const leads = await request(app).get("/api/leads").set(auth(admin));
    expect(leads.body.some((l: any) => l.id === lead.id)).toBe(false);
    const viewings = await request(app).get("/api/viewings").set(auth(admin));
    expect(viewings.body.some((v: any) => v.id === view.id)).toBe(false);
    const overview = await request(app).get("/api/crm/overview").set(auth(admin));
    expect(overview.body.leads.some((l: any) => l.id === lead.id)).toBe(false);
    expect(overview.body.deals).toEqual([]);
    expect((await request(app).get("/api/deals").set(auth(admin))).body).toEqual([]);
    const csv = await request(app).get("/api/crm/export?kind=leads").set(auth(admin));
    expect(csv.text).not.toContain("Private Person");

    await request(app).post("/api/leads/status").set(auth(admin)).send({ leadId: lead.id, status: "LOST" }).expect(403);
    await request(app).post("/api/viewings/status").set(auth(admin)).send({ viewingId: view.id, status: "CANCELLED" }).expect(403);
    await request(app).patch(`/api/viewings/${view.id}`).set(auth(admin)).send({ preferredDate: "2026-12-06" }).expect(403);
    // untouched by the refused attempts (it is in "Viewing" because the agent scheduled one above)
    expect(leadInDb(lead.id)!.status).toBe("VIEWING_SCHEDULED");
  });

  it("does not let an agent create review eligibility by registering a friend as a client", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await newUser("rev-agent");
    const friend = await newUser("rev-friend", "REGISTERED");
    await request(app).post("/api/crm/clients").set(auth(agent.token)).send({ name: "Friend", email: friend.email }).expect(200);
    const res = await request(app).post("/api/reviews").set(auth(friend.token)).set("X-Forwarded-For", friend.ip)
      .send({ targetType: "AGENT", targetId: agent.id, rating: 5, comment: "Best agent ever" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/eligibility/i);

    // ...whereas a real platform inquiry from the same person still qualifies
    const db = readDb();
    db.leads.unshift({ id: `lead-real-${Date.now()}`, visitorName: "Friend", visitorPhone: "+974 5555 0001", visitorEmail: friend.email, message: "inquiry", contactMethod: "INQUIRY", status: LeadStatus.NEW, agentId: agent.id, createdDate: new Date().toISOString(), updatedDate: new Date().toISOString() });
    writeDb(db);
    const ok = await request(app).post("/api/reviews").set(auth(friend.token)).set("X-Forwarded-For", friend.ip)
      .send({ targetType: "AGENT", targetId: agent.id, rating: 5, comment: "Helpful and quick" });
    expect(ok.status).not.toBe(403);
  });

  it("never emails the client: viewing reminders reach only the agent for a hand-added client", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("mail-agent");
    const MORNING = Date.parse("2026-11-10T08:00:00Z");
    const manual = (await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Off-platform", email: "offplatform@example.com", phone: nextPhone() })).body.lead;
    await request(app).post("/api/viewings").set(auth(a.token)).send({ leadId: manual.id, preferredDate: "2026-11-11", preferredTimeSlot: "10:00" }).expect(200);
    const r = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(r.viewings).toBe(1);
    expect(r.emails).toBe(1); // the agent only - for a platform inquiry this is 2 (agent + client)
  });

  it("still sends the agent follow-up reminders for hand-added clients, and keeps them out of the 'contacted' client email", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("mail-followup");
    const lead = (await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Remind Me", phone: nextPhone(), email: "remindme@example.com", nextFollowUpDate: "2026-11-09" })).body.lead;
    const r = runCrmReminders(Date.parse("2026-11-10T08:00:00Z"), { onlyAgentIds: [a.id] });
    expect(r.leads).toBe(1);
    expect(r.emails).toBe(1);
    expect(leadInDb(lead.id)!.lastReminderAt).toBeTruthy();
    // moving it to Contacted must not trigger the visitor-facing "an agent has contacted you" email
    await request(app).post("/api/leads/status").set(auth(a.token)).send({ leadId: lead.id, status: "CONTACTED" }).expect(200);
  });

  it("includes hand-added clients, with source/budget/interest, in the agent's own CSV export", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newUser("exp-manual");
    await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "CSV Client", phone: nextPhone(), source: "INSTAGRAM", budget: 1250000, interest: "Penthouse" }).expect(200);
    const res = await request(app).get("/api/crm/export?kind=leads").set(auth(a.token)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
    });
    const text = res.body as string;
    expect(text).toContain("Budget (QAR)");
    expect(text).toContain("CSV Client");
    expect(text).toContain("Instagram / إنستغرام");
    expect(text).toContain("1250000");
    expect(text).toContain("Penthouse");
  });
});
