import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app, runProspectReminders } from "../../server.js";
import { initDb, readDb } from "../../server-db.js";
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

const ADMIN_ID = "user-platform-admin";
const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const admin = () => ({ Authorization: `Bearer ${tokenFor(ADMIN_ID, "PLATFORM_ADMIN")}` });
const MORNING = Date.parse("2026-11-10T08:00:00Z"); // 11:00 in Qatar
const NIGHT = Date.parse("2026-11-09T23:30:00Z"); // 02:30 in Qatar
const inDb = (id: string) => readDb().prospects!.find(p => p.id === id)!;

let seq = 0;
const add = (over: object = {}) =>
  request(app).post("/api/admin/prospects").set(admin()).send({ name: `Prospect ${Date.now()}-${seq++}`, email: uniqueEmail("pros"), kind: "AGENCY", source: "EVENT", ...over });

describe("sales pipeline access", () => {
  it("is for platform admins only", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const agent = await signupAndVerify(app, uniqueIp(), { email: uniqueEmail("pros-agent"), password: "correct-horse-battery-staple", fullName: "Pros Agent", phone: "+974 5555 9811", role: "AGENT" });
    const t = { Authorization: `Bearer ${agent.body.token}` };
    await request(app).get("/api/admin/prospects").set(t).expect(403);
    await request(app).post("/api/admin/prospects").set(t).send({ name: "X", email: "x@y.com" }).expect(403);
    await request(app).get("/api/admin/prospects").expect(401);
    await request(app).get("/api/admin/prospects").set({ Authorization: `Bearer ${tokenFor("user-super-admin", "SUPER_ADMIN")}` }).expect(403);
  });
});

describe("adding and editing prospects", () => {
  it("adds a prospect to NEW with a first history entry, and lists it with stats and owners", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await add({ name: "Gulf Realty", company: "Gulf Realty LLC", expectedMonthly: 1800 });
    expect(res.status).toBe(201);
    const p = res.body.prospect;
    expect(p).toMatchObject({ name: "Gulf Realty", stage: "NEW", ownerId: ADMIN_ID, expectedMonthly: 1800 });
    expect(p.activity[0].type).toBe("created");
    const list = await request(app).get("/api/admin/prospects").set(admin()).expect(200);
    expect(list.body.prospects.some((x: any) => x.id === p.id)).toBe(true);
    expect(list.body.owners.some((o: any) => o.id === ADMIN_ID)).toBe(true);
    expect(list.body.stats.open).toBeGreaterThan(0);
  });

  it("refuses a prospect with no way to reach them, and a duplicate unless told otherwise", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).post("/api/admin/prospects").set(admin()).send({ name: "Nobody" }).expect(400);
    const email = uniqueEmail("dup");
    await add({ email }).then(r => expect(r.status).toBe(201));
    const dup = await add({ email: email.toUpperCase() });
    expect(dup.status).toBe(409);
    expect((await add({ email, allowDuplicate: true })).status).toBe(201);
  });

  it("recognises a prospect who has already registered on the site", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const email = uniqueEmail("registered");
    await signupAndVerify(app, uniqueIp(), { email, password: "correct-horse-battery-staple", fullName: "Already Here", phone: "+974 5555 9822", role: "AGENT" });
    const p = (await add({ email })).body.prospect;
    expect(p.signedUp).toMatchObject({ name: "Already Here", role: "AGENT" });
    expect((await add()).body.prospect.signedUp).toBeNull();
  });

  it("edits details and logs a follow-up change", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = (await add()).body.prospect.id;
    const res = await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ company: "New Co", nextFollowUp: "2026-11-20", followUpNote: "Send the plans" });
    expect(res.status).toBe(200);
    expect(inDb(id)).toMatchObject({ company: "New Co", nextFollowUp: "2026-11-20", followUpNote: "Send the plans" });
    expect(inDb(id).activity.map(a => a.type)).toEqual(expect.arrayContaining(["followup", "edit"]));
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ nextFollowUp: "tomorrow" }).expect(400);
  });
});

describe("moving through the pipeline", () => {
  it("moves stages and records it; LOST needs a reason; WON/LOST clear the follow-up", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = (await add({ nextFollowUp: "2026-11-15" })).body.prospect.id;
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "DEMO" }).expect(200);
    expect(inDb(id).stage).toBe("DEMO");
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "LOST" }).expect(400);
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "NOPE" }).expect(400);
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "LOST", lostReason: "Too expensive" }).expect(200);
    expect(inDb(id)).toMatchObject({ stage: "LOST", lostReason: "Too expensive" });
    expect(inDb(id).nextFollowUp).toBeUndefined();
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "WON" }).expect(200);
    expect(inDb(id).wonAt).toBeTruthy();
    expect(inDb(id).lostReason).toBeUndefined();
    expect(inDb(id).activity.filter(a => a.type === "stage")).toHaveLength(3);
  });

  it("logging a call books the next follow-up but never moves the card: only the person changes the stage", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = (await add()).body.prospect.id;
    const res = await request(app).post(`/api/admin/prospects/${id}/activity`).set(admin()).send({ type: "call", text: "Spoke to the owner", nextFollowUp: "2026-11-18", followUpNote: "Send the offer" });
    expect(res.status).toBe(200);
    expect(inDb(id)).toMatchObject({ stage: "NEW", nextFollowUp: "2026-11-18", followUpNote: "Send the offer" });
    expect(inDb(id).lastContactAt).toBeTruthy();
    // put back in New (or moved on by hand), it stays where it was put however much is logged
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "CONTACTED" }).expect(200);
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "NEW" }).expect(200);
    await request(app).post(`/api/admin/prospects/${id}/activity`).set(admin()).send({ type: "whatsapp", text: "Sent the brochure" }).expect(200);
    await request(app).post(`/api/admin/prospects/${id}/activity`).set(admin()).send({ type: "email", text: "Sent the offer" }).expect(200);
    expect(inDb(id).stage).toBe("NEW");
    expect(inDb(id).activity.filter(a => a.type === "stage")).toHaveLength(2); // only the two moves by hand
    // a plain note is not a contact
    const id2 = (await add()).body.prospect.id;
    await request(app).post(`/api/admin/prospects/${id2}/activity`).set(admin()).send({ type: "note", text: "Found their number" }).expect(200);
    expect(inDb(id2).stage).toBe("NEW");
    expect(inDb(id2).lastContactAt).toBeUndefined();
    await request(app).post(`/api/admin/prospects/${id}/activity`).set(admin()).send({ type: "call", text: "" }).expect(400);
    await request(app).post(`/api/admin/prospects/${id}/activity`).set(admin()).send({ type: "sms", text: "x" }).expect(400);
  });

  it("only a platform admin can be the owner", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = (await add()).body.prospect.id;
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ ownerId: "user-agent-1" }).expect(400);
    expect((await add({ ownerId: "user-agent-1" })).body.prospect.ownerId).toBe(ADMIN_ID);
  });

  it("deletes a prospect", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = (await add()).body.prospect.id;
    await request(app).delete(`/api/admin/prospects/${id}`).set(admin()).expect(200);
    expect(readDb().prospects!.some(p => p.id === id)).toBe(false);
    await request(app).delete(`/api/admin/prospects/${id}`).set(admin()).expect(404);
  });
});

describe("importing a list", () => {
  it("adds the good rows, skips duplicates and bad rows, and says why", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const email = uniqueEmail("imp");
    const res = await request(app).post("/api/admin/prospects/import").set(admin()).send({
      prospects: [
        { name: "Imported One", email, kind: "AGENCY", source: "EVENT" },
        { name: "Imported Dup", email },
        { name: "", email: uniqueEmail("imp2") },
        { name: "No contact" }
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(1);
    expect(res.body.skipped).toHaveLength(3);
    expect(res.body.skipped.map((s: any) => s.row)).toEqual([3, 4, 5]);
    await request(app).post("/api/admin/prospects/import").set(admin()).send({ prospects: [] }).expect(400);
  });
});

describe("follow-up reminders by email", () => {
  it("sends the owner one email for everything due, flags it, and never repeats it the same day", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = (await add({ nextFollowUp: "2026-11-10" })).body.prospect.id;
    const b = (await add({ nextFollowUp: "2026-11-08" })).body.prospect.id;
    const c = (await add({ nextFollowUp: "2026-11-25" })).body.prospect.id;
    const first = runProspectReminders(MORNING, { onlyOwnerIds: [ADMIN_ID] });
    expect(first.prospects).toBeGreaterThanOrEqual(2);
    expect(first.emails).toBe(1); // one digest, not one per prospect
    expect(inDb(a).lastReminderAt).toBeTruthy();
    expect(inDb(b).lastReminderAt).toBeTruthy();
    expect(inDb(c).lastReminderAt).toBeUndefined();
    expect(readDb().notifications!.some(n => n.userId === ADMIN_ID && n.type === "prospect_reminder")).toBe(true);
    const second = runProspectReminders(MORNING + 60 * 60 * 1000, { onlyOwnerIds: [ADMIN_ID] });
    expect(second).toMatchObject({ prospects: 0, emails: 0 });
  });

  it("stays silent overnight in Qatar", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = (await add({ nextFollowUp: "2026-11-09" })).body.prospect.id;
    const night = runProspectReminders(NIGHT, { onlyOwnerIds: [ADMIN_ID] });
    expect(night).toMatchObject({ prospects: 0, emails: 0 });
    expect(inDb(id).lastReminderAt).toBeUndefined();
  });

  it("does not remind about prospects that are won or lost", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = (await add({ nextFollowUp: "2026-11-01" })).body.prospect.id;
    await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "WON" }).expect(200);
    runProspectReminders(MORNING, { onlyOwnerIds: [ADMIN_ID] });
    expect(inDb(id).lastReminderAt).toBeUndefined();
  });

  it("'email me my reminders now' sends the digest to the signed-in admin", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await add({ nextFollowUp: "2020-01-01" });
    const res = await request(app).post("/api/admin/prospects/send-reminders").set(admin()).expect(200);
    expect(res.body.prospects).toBeGreaterThanOrEqual(1);
    expect(res.body.emails).toBe(1);
  });
});

describe("the email that receives the reminders", () => {
  it("starts empty (their sign-in email is used) and shows both addresses", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).patch("/api/admin/prospects/reminder-email").set(admin()).send({ email: "" }).expect(200);
    const res = await request(app).get("/api/admin/prospects").set(admin()).expect(200);
    expect(res.body.reminderEmail).toEqual({ custom: "", login: expect.any(String) });
  });

  it("can be set, cleaned up, changed and cleared, and only by a platform admin", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const set = await request(app).patch("/api/admin/prospects/reminder-email").set(admin()).send({ email: "  Sales.Desk@Example.com " }).expect(200);
    expect(set.body.reminderEmail.custom).toBe("sales.desk@example.com");
    expect((await request(app).get("/api/admin/prospects").set(admin())).body.reminderEmail.custom).toBe("sales.desk@example.com");
    await request(app).patch("/api/admin/prospects/reminder-email").set(admin()).send({ email: "not an email" }).expect(400);
    await request(app).patch("/api/admin/prospects/reminder-email").set(admin()).send({ email: 5 }).expect(400);
    await request(app).patch("/api/admin/prospects/reminder-email").send({ email: "a@b.com" }).expect(401);
    const agent = await signupAndVerify(app, uniqueIp(), { email: uniqueEmail("rem-agent"), password: "correct-horse-battery-staple", fullName: "Rem Agent", phone: "+974 5555 9877", role: "AGENT" });
    await request(app).patch("/api/admin/prospects/reminder-email").set({ Authorization: `Bearer ${agent.body.token}` }).send({ email: "a@b.com" }).expect(403);
    expect((await request(app).patch("/api/admin/prospects/reminder-email").set(admin()).send({ email: "" }).expect(200)).body.reminderEmail.custom).toBe("");
  });

  it("the daily digest and the new-request alert go to the chosen address, and back to the sign-in email once cleared", async (ctx) => {
    if (!dbReady) return ctx.skip();
    // Other test files append to the same mock email log at the same moment, and a write can overwrite
    // another's entry. So each step is tried a few times (each try creates fresh work to email about)
    // until its email shows up among the entries that are new.
    const log = async () => (await request(app).get("/api/admin/emails").set(admin()).expect(200)).body as { id: string; to: string; subject: string }[];
    const emailedTo = async (subjectPart: string, trigger: () => Promise<unknown>) => {
      const seen = new Set((await log()).map(e => e.id));
      for (let attempt = 0; attempt < 6; attempt++) {
        await trigger();
        const sent = (await log()).filter(e => !seen.has(e.id) && e.subject.includes(subjectPart)).map(e => e.to);
        if (sent.length > 0) return sent;
      }
      return [];
    };
    const digest = () => emailedTo("Sales pipeline:", async () => {
      await add({ nextFollowUp: "2020-01-01" });
      await request(app).post("/api/admin/prospects/send-reminders").set(admin()).expect(200);
    });
    const login = (await request(app).get("/api/admin/prospects").set(admin())).body.reminderEmail.login as string;

    await request(app).patch("/api/admin/prospects/reminder-email").set(admin()).send({ email: "inbox@sales.example.com" }).expect(200);
    expect(await digest()).toContain("inbox@sales.example.com");
    expect(await emailedTo("New subscription request", () => request(app).post("/api/plan-requests").set("X-Forwarded-For", uniqueIp())
      .send({ fullName: "Omar", email: uniqueEmail("alert"), phone: "+974 5555 4321", planId: "plan-basic", consent: true }).expect(200)))
      .toContain("inbox@sales.example.com");

    await request(app).patch("/api/admin/prospects/reminder-email").set(admin()).send({ email: "" }).expect(200);
    const after = await digest();
    expect(after).toContain(login);
    expect(after).not.toContain("inbox@sales.example.com");
  });
});
