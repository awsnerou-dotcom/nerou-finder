import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app, runCrmReminders } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
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
    fullName: `Tsk ${label}`,
    phone: "+974 5555 9900",
    role: "AGENT"
  });
  return { token: res.body.token as string, id: res.body.user.id as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const taskInDb = (id: string) => readDb().tasks!.find(t => t.id === id);
const dealInDb = (id: string) => readDb().deals!.find(d => d.id === id);
const MORNING = Date.parse("2026-11-10T08:00:00Z"); // 11:00 on 10 Nov in Qatar
const NIGHT = Date.parse("2026-11-09T23:30:00Z"); // 02:30 in Qatar

const mkTask = (token: string, over: object = {}) =>
  request(app).post("/api/tasks").set(auth(token)).send({ title: "Call the owner", dueDate: "2026-11-09", dueTime: "09:00", ...over });

describe("tasks: scheduling", () => {
  it("creates a task at a Qatar date and time, and lists it in the Sales Desk overview", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tsk-create");
    const res = await mkTask(a.token, { dueDate: "2026-12-01", dueTime: "14:30", notes: "  bring the keys " });
    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({ agentId: a.id, title: "Call the owner", dueAt: "2026-12-01T11:30:00.000Z", status: "OPEN", notes: "bring the keys" });
    const overview = await request(app).get("/api/crm/overview").set(auth(a.token));
    expect(overview.body.tasks.map((t: any) => t.id)).toContain(res.body.task.id);
  });

  it("defaults the time to 09:00 and rejects bad input and anonymous callers", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tsk-valid");
    const noTime = await request(app).post("/api/tasks").set(auth(a.token)).send({ title: "X", dueDate: "2026-12-01" });
    expect(noTime.body.task.dueAt).toBe("2026-12-01T06:00:00.000Z");
    await mkTask(a.token, { title: "   " }).expect(400);
    await mkTask(a.token, { dueDate: "soon" }).expect(400);
    await mkTask(a.token, { dueDate: "2026-02-31" }).expect(400);
    await mkTask(a.token, { dueTime: "25:00" }).expect(400);
    await mkTask(a.token, { dueTime: "9am" }).expect(400);
    await request(app).post("/api/tasks").send({ title: "X", dueDate: "2026-12-01" }).expect(401);
    const buyer = await signupAndVerify(app, uniqueIp(), { email: uniqueEmail("tsk-buyer"), password: "correct-horse-battery-staple", fullName: "Buyer", phone: "+974 5555 9901", role: "REGISTERED" });
    await mkTask(buyer.body.token).expect(403);
  });

  it("links a task to the agent's own client or deal, and refuses someone else's", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tsk-link");
    const b = await newAgent("tsk-link-other");
    const lead = (await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Linked Client", phone: "+974 5000 7001" })).body.lead;
    const deal = (await request(app).post("/api/deals").set(auth(a.token)).send({ dealType: "SALE", dealValue: 1000000, propertyTitle: "Flat", clientName: "Linked Client" })).body.deal;

    const ok = await mkTask(a.token, { leadId: lead.id, dealId: deal.id });
    expect(ok.status).toBe(200);
    expect(ok.body.task).toMatchObject({ leadId: lead.id, dealId: deal.id });
    const overview = await request(app).get("/api/crm/overview").set(auth(a.token));
    expect(overview.body.tasks.find((t: any) => t.id === ok.body.task.id)).toMatchObject({ leadName: "Linked Client", dealTitle: "Flat" });

    await mkTask(b.token, { leadId: lead.id }).expect(404);
    await mkTask(b.token, { dealId: deal.id }).expect(404);
    await mkTask(a.token, { leadId: "no-such-lead" }).expect(404);
  });

  it("keeps tasks private: strangers and platform admins cannot see, edit or delete them", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const owner = await newAgent("tsk-private");
    const stranger = await newAgent("tsk-stranger");
    const id = (await mkTask(owner.token)).body.task.id;

    expect((await request(app).get("/api/crm/overview").set(auth(stranger.token))).body.tasks).toEqual([]);
    expect((await request(app).get("/api/crm/overview").set(auth(tokenFor("user-platform-admin", "PLATFORM_ADMIN")))).body.tasks).toEqual([]);
    await request(app).patch(`/api/tasks/${id}`).set(auth(stranger.token)).send({ title: "Hacked" }).expect(404);
    await request(app).delete(`/api/tasks/${id}`).set(auth(stranger.token)).expect(404);
    await request(app).patch(`/api/tasks/${id}`).set(auth(tokenFor("user-platform-admin", "PLATFORM_ADMIN"))).send({ title: "Admin" }).expect(404);
    expect(taskInDb(id)!.title).toBe("Call the owner");
  });

  it("lets an organisation admin see the team's tasks and create one for an agent of theirs, never for an outsider's", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await newAgent("tsk-org-agent");
    const admin = await newAgent("tsk-org-admin");
    const outsider = await newAgent("tsk-org-outsider");
    const db = readDb();
    db.users.find(u => u.id === agent.id)!.orgId = "org-tsk-1";
    db.users.find(u => u.id === admin.id)!.orgId = "org-tsk-1";
    db.users.find(u => u.id === outsider.id)!.orgId = "org-tsk-2";
    writeDb(db);
    const adminToken = tokenFor(admin.id, "AGENCY_ADMIN");

    const forAgent = await mkTask(adminToken, { agentId: agent.id });
    expect(forAgent.status).toBe(200);
    expect(forAgent.body.task).toMatchObject({ agentId: agent.id, orgId: "org-tsk-1" });
    await mkTask(adminToken, { agentId: outsider.id }).expect(400);
    expect((await request(app).get("/api/crm/overview").set(auth(agent.token))).body.tasks.map((t: any) => t.id)).toContain(forAgent.body.task.id);
    expect((await request(app).get("/api/crm/overview").set(auth(adminToken))).body.tasks.map((t: any) => t.id)).toContain(forAgent.body.task.id);
    expect((await request(app).get("/api/crm/overview").set(auth(outsider.token))).body.tasks.map((t: any) => t.id)).not.toContain(forAgent.body.task.id);
    await request(app).patch(`/api/tasks/${forAgent.body.task.id}`).set(auth(adminToken)).send({ status: "DONE" }).expect(200);
  });
});

describe("tasks: editing, finishing and snoozing", () => {
  it("edits the title and time (a new time restarts the reminder cycle), finishes and reopens a task", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tsk-edit");
    const id = (await mkTask(a.token)).body.task.id;
    const db = readDb(); const t = db.tasks!.find(x => x.id === id)!; t.lastReminderAt = "2026-11-09T07:00:00.000Z"; t.reminderCount = 2; t.snoozedUntil = "2026-11-09T09:00:00.000Z"; writeDb(db);

    const edited = await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ title: "Call the owner about the price", dueDate: "2026-11-12", dueTime: "16:00" });
    expect(edited.status).toBe(200);
    expect(taskInDb(id)).toMatchObject({ title: "Call the owner about the price", dueAt: "2026-11-12T13:00:00.000Z", reminderCount: 0 });
    expect(taskInDb(id)!.snoozedUntil).toBeUndefined();
    expect(taskInDb(id)!.lastReminderAt).toBeUndefined();
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ title: "" }).expect(400);
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ dueTime: "99:99" }).expect(400);

    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ status: "DONE" }).expect(200);
    expect(taskInDb(id)).toMatchObject({ status: "DONE" });
    expect(taskInDb(id)!.doneAt).toBeTruthy();
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ status: "OPEN" }).expect(200);
    expect(taskInDb(id)!.status).toBe("OPEN");
    expect(taskInDb(id)!.doneAt).toBeUndefined();
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ status: "MAYBE" }).expect(400);
  });

  it("snoozes an open task, rejects unknown snooze options and snoozing a finished task", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tsk-snooze");
    const id = (await mkTask(a.token)).body.task.id;
    const before = Date.now();
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ snooze: "1h" }).expect(200);
    const until = Date.parse(taskInDb(id)!.snoozedUntil!);
    expect(until).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(until).toBeLessThanOrEqual(Date.now() + 61 * 60 * 1000);
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ snooze: "tomorrow" }).expect(200);
    expect(taskInDb(id)!.snoozedUntil).toMatch(/T05:00:00\.000Z$/); // 08:00 Qatar
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ snooze: "forever" }).expect(400);
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ status: "DONE" }).expect(200);
    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ snooze: "1h" }).expect(400);
  });

  it("deletes a task", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tsk-delete");
    const id = (await mkTask(a.token)).body.task.id;
    await request(app).delete(`/api/tasks/${id}`).set(auth(a.token)).expect(200);
    expect(taskInDb(id)).toBeUndefined();
    await request(app).delete(`/api/tasks/${id}`).set(auth(a.token)).expect(404);
  });
});

describe("task reminder emails", () => {
  it("emails once when the time arrives, flags the task, and does not repeat that hour", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-task");
    const due = (await mkTask(a.token, { title: "Due task", dueDate: "2026-11-10", dueTime: "09:00" })).body.task.id; // 06:00Z, before MORNING
    const later = (await mkTask(a.token, { title: "Later task", dueDate: "2026-11-20" })).body.task.id;
    const done = (await mkTask(a.token, { title: "Done task", dueDate: "2026-11-09" })).body.task.id;
    await request(app).patch(`/api/tasks/${done}`).set(auth(a.token)).send({ status: "DONE" }).expect(200);

    const first = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(first).toMatchObject({ tasks: 1, emails: 1 });
    expect(taskInDb(due)).toMatchObject({ reminderCount: 1 });
    expect(taskInDb(due)!.lastReminderAt).toBeTruthy();
    expect(taskInDb(later)!.lastReminderAt).toBeUndefined();
    expect(taskInDb(done)!.lastReminderAt).toBeUndefined();
    expect(readDb().notifications!.some(n => n.userId === a.id && n.type === "task_reminder")).toBe(true);
    expect(runCrmReminders(MORNING + 3600_000, { onlyAgentIds: [a.id] })).toMatchObject({ tasks: 0, emails: 0 });
  });

  it("repeats an unfinished task daily, three reminders in all", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-task-repeat");
    const id = (await mkTask(a.token, { dueDate: "2026-11-05" })).body.task.id;
    const counts: number[] = [];
    for (let day = 0; day < 6; day++) counts.push(runCrmReminders(MORNING + day * 25 * 3600_000, { onlyAgentIds: [a.id] }).tasks);
    expect(counts).toEqual([1, 1, 1, 0, 0, 0]);
    expect(taskInDb(id)!.reminderCount).toBe(3);
  });

  it("a snooze moves the reminder, and a finished task stops reminding", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-task-snooze");
    const id = (await mkTask(a.token, { dueDate: "2026-11-10", dueTime: "09:00" })).body.task.id;
    expect(runCrmReminders(MORNING, { onlyAgentIds: [a.id] }).tasks).toBe(1);

    const db = readDb(); db.tasks!.find(t => t.id === id)!.snoozedUntil = new Date(MORNING + 3 * 3600_000).toISOString(); db.tasks!.find(t => t.id === id)!.reminderCount = 0; writeDb(db);
    expect(runCrmReminders(MORNING + 3600_000, { onlyAgentIds: [a.id] }).tasks).toBe(0); // snoozed
    expect(runCrmReminders(MORNING + 3 * 3600_000 + 1000, { onlyAgentIds: [a.id] }).tasks).toBe(1); // snooze elapsed

    await request(app).patch(`/api/tasks/${id}`).set(auth(a.token)).send({ status: "DONE" }).expect(200);
    expect(runCrmReminders(MORNING + 40 * 3600_000, { onlyAgentIds: [a.id] }).tasks).toBe(0);
  });

  it("stays silent overnight in Qatar and sends in the morning instead; respects an agent who turned emails off", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-task-night");
    const id = (await mkTask(a.token, { dueDate: "2026-11-09", dueTime: "23:00" })).body.task.id; // 20:00Z the 9th
    expect(runCrmReminders(NIGHT, { onlyAgentIds: [a.id] })).toMatchObject({ tasks: 0, emails: 0 });
    expect(taskInDb(id)!.lastReminderAt).toBeUndefined();
    expect(runCrmReminders(MORNING, { onlyAgentIds: [a.id] })).toMatchObject({ tasks: 1, emails: 1 });

    const b = await newAgent("rem-task-off");
    await request(app).patch("/api/crm/settings").set(auth(b.token)).send({ followUpRemindersEnabled: false }).expect(200);
    await mkTask(b.token, { dueDate: "2026-11-09" });
    const r = runCrmReminders(MORNING, { onlyAgentIds: [b.id] });
    expect(r.tasks).toBe(1);
    expect(r.emails).toBe(0);
  });

  it("puts a client follow-up, a task and a lease renewal in ONE email", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("rem-digest");
    const lead = (await request(app).post("/api/crm/clients").set(auth(a.token)).send({ name: "Digest Client", phone: "+974 5000 7100", nextFollowUpDate: "2026-11-09" })).body.lead;
    await mkTask(a.token, { dueDate: "2026-11-09" }).expect(200);
    await request(app).post("/api/deals").set(auth(a.token)).send({
      dealType: "RENT", dealValue: 120000, commissionRate: 5, propertyTitle: "Digest Flat", clientName: "Digest Tenant", closedDate: "2026-01-15", contractEndDate: "2026-12-01"
    }).expect(200);

    const r = runCrmReminders(MORNING, { onlyAgentIds: [a.id] });
    expect(r).toMatchObject({ leads: 1, tasks: 1, renewals: 1, emails: 1 });
    expect(readDb().leads.find(l => l.id === lead.id)!.lastReminderAt).toBeTruthy();
    expect(runCrmReminders(MORNING + 3600_000, { onlyAgentIds: [a.id] })).toMatchObject({ leads: 0, tasks: 0, renewals: 0, emails: 0 });
  });
});

describe("lease renewals", () => {
  const rent = (token: string, over: object = {}) =>
    request(app).post("/api/deals").set(auth(token)).send({
      dealType: "RENT", dealValue: 120000, commissionRate: 5, propertyTitle: "Apartment", clientName: "Tenant", closedDate: "2026-01-15", contractEndDate: "2027-02-05", ...over
    });

  it("records the contract end date on a rental (renewal pending) and validates it", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("ren-create");
    const ok = await rent(a.token);
    expect(ok.status).toBe(200);
    expect(ok.body.deal).toMatchObject({ contractEndDate: "2027-02-05", renewalStatus: "PENDING", renewalRemindersSent: [] });
    await rent(a.token, { dealType: "SALE" }).expect(400); // a sale has no contract
    await rent(a.token, { contractEndDate: "2026-01-15" }).expect(400); // must end after closing
    await rent(a.token, { contractEndDate: "2026-01-01" }).expect(400);
    await rent(a.token, { contractEndDate: "next year" }).expect(400);
    const noEnd = await rent(a.token, { contractEndDate: undefined });
    expect(noEnd.body.deal.contractEndDate).toBeUndefined();
    expect(noEnd.body.deal.renewalStatus).toBeUndefined();
  });

  it("reminds at 90, then 60 and 30 days, each once, and stops when the agent says what happened", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("ren-sweep");
    const id = (await rent(a.token, { contractEndDate: "2027-02-05" })).body.deal.id; // 87 days after 10 Nov 2026
    const sweep = (now: number) => runCrmReminders(now, { onlyAgentIds: [a.id] });

    const DAY = 24 * 3600_000;

    expect(sweep(MORNING)).toMatchObject({ renewals: 1, emails: 1 }); // 87 days left -> the 90-day reminder
    expect(dealInDb(id)!.renewalRemindersSent).toEqual([90]);
    expect(sweep(MORNING + 3600_000)).toMatchObject({ renewals: 0, emails: 0 }); // not twice
    expect(sweep(MORNING + 20 * DAY).renewals).toBe(0); // 67 days left: the 60-day mark is not reached yet

    expect(sweep(MORNING + 27 * DAY).renewals).toBe(1); // 60 days left
    expect(dealInDb(id)!.renewalRemindersSent).toEqual([90, 60]);
    expect(sweep(MORNING + 40 * DAY).renewals).toBe(0); // 47 days left: nothing new

    expect(sweep(MORNING + 57 * DAY).renewals).toBe(1); // 30 days left
    expect(dealInDb(id)!.renewalRemindersSent).toEqual([90, 60, 30]);
    expect(sweep(MORNING + 60 * DAY).renewals).toBe(0); // all three sent
  });

  it("a contract added late gets one reminder covering every threshold already passed", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("ren-late");
    const id = (await rent(a.token, { contractEndDate: "2026-12-01" })).body.deal.id; // 21 days left
    expect(runCrmReminders(MORNING, { onlyAgentIds: [a.id] })).toMatchObject({ renewals: 1, emails: 1 });
    expect(dealInDb(id)!.renewalRemindersSent).toEqual([90, 60, 30]);
    expect(runCrmReminders(MORNING + 24 * 3600_000, { onlyAgentIds: [a.id] }).renewals).toBe(0);
  });

  it("does not remind about a rental marked as not renewing or already renewed, and re-arms when the end date moves", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("ren-status");
    const id = (await rent(a.token, { contractEndDate: "2026-12-01" })).body.deal.id;
    await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ renewalStatus: "NOT_RENEWING" }).expect(200);
    expect(runCrmReminders(MORNING, { onlyAgentIds: [a.id] }).renewals).toBe(0);

    await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ renewalStatus: "PENDING" }).expect(200);
    expect(runCrmReminders(MORNING, { onlyAgentIds: [a.id] }).renewals).toBe(1);
    expect(runCrmReminders(MORNING + 3600_000, { onlyAgentIds: [a.id] }).renewals).toBe(0);
    // a new end date re-arms the reminders
    const moved = await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ contractEndDate: "2026-12-15" });
    expect(moved.body.deal.renewalRemindersSent).toEqual([]);
    expect(runCrmReminders(MORNING + 2 * 3600_000, { onlyAgentIds: [a.id] }).renewals).toBe(1);
    await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ renewalStatus: "SOMETIMES" }).expect(400);
  });

  it("recording the renewal as a new deal marks the old contract renewed", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("ren-renew");
    const old = (await rent(a.token, { contractEndDate: "2026-12-01" })).body.deal;
    const renewed = await rent(a.token, { closedDate: "2026-11-10", contractEndDate: "2027-12-01", renewsDealId: old.id });
    expect(renewed.status).toBe(200);
    expect(renewed.body.deal.renewsDealId).toBe(old.id);
    expect(dealInDb(old.id)!.renewalStatus).toBe("RENEWED");
    expect(runCrmReminders(MORNING, { onlyAgentIds: [a.id] }).renewals).toBe(0); // the old one stopped; the new one is 387 days away
    const stranger = await newAgent("ren-stranger");
    await request(app).post("/api/deals").set(auth(stranger.token)).send({
      dealType: "RENT", dealValue: 1, propertyTitle: "P", clientName: "C", closedDate: "2026-11-10", contractEndDate: "2027-11-10", renewsDealId: old.id
    }).expect(404);
  });

  it("changing a rental into a sale clears the contract, and the contract date can be cleared", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("ren-sale");
    const id = (await rent(a.token)).body.deal.id;
    const cleared = await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ contractEndDate: null });
    expect(cleared.body.deal.contractEndDate).toBeUndefined();
    expect(cleared.body.deal.renewalStatus).toBeUndefined();
    await request(app).patch(`/api/deals/${id}`).set(auth(a.token)).send({ renewalStatus: "RENEWED" }).expect(400); // nothing to renew
    const id2 = (await rent(a.token)).body.deal.id;
    const sale = await request(app).patch(`/api/deals/${id2}`).set(auth(a.token)).send({ dealType: "SALE" });
    expect(sale.body.deal.contractEndDate).toBeUndefined();
    await request(app).patch(`/api/deals/${id2}`).set(auth(a.token)).send({ contractEndDate: "2027-02-05" }).expect(400);
  });
});

describe("exports", () => {
  it("includes contract end and renewal status in the deals CSV, and exports tasks", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("exp-tasks");
    await request(app).post("/api/deals").set(auth(a.token)).send({ dealType: "RENT", dealValue: 120000, propertyTitle: "Csv Flat", clientName: "Csv Tenant", closedDate: "2026-01-15", contractEndDate: "2027-02-05" }).expect(200);
    await mkTask(a.token, { title: "Csv task, with comma", dueDate: "2026-12-01", dueTime: "10:15" }).expect(200);
    const get = (kind: string) => request(app).get(`/api/crm/export?kind=${kind}`).set(auth(a.token)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
    });
    const deals = (await get("deals")).body as string;
    expect(deals).toContain("Contract ends");
    expect(deals).toContain("2027-02-05");
    expect(deals).toContain("Pending / قيد المتابعة");
    const tasks = (await get("tasks")).body as string;
    expect(tasks).toContain('"Csv task, with comma"');
    expect(tasks).toContain("2026-12-01 10:15");
    expect(tasks).toContain("Open / مفتوحة");
  });
});
