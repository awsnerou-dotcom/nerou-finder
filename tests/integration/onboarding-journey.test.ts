import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app, checkSubscriptionExpiryAndReminders } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { DOCUMENT_DECLARATION } from "../../src/types.js";
import { TRIAL_DAYS } from "../../src/lib/onboarding.js";
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

const adminToken = () => jwt.sign({ id: "user-platform-admin", email: "admin@test.local", role: "PLATFORM_ADMIN", fullName: "Test Admin" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const admin = () => ({ Authorization: `Bearer ${adminToken()}` });
const DAY = 24 * 60 * 60 * 1000;

interface Mail { to: string; subject: string; html: string; type: string }
const allMail = async () => (await request(app).get("/api/admin/emails").set(admin()).expect(200)).body as Mail[];
const mailTo = async (email: string) => (await allMail()).filter(m => m.to === email);
const ofType = (mails: Mail[], type: string) => mails.filter(m => m.type === type);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function uploadAllRequiredDocuments(token: string) {
  const mine = await request(app).get("/api/verification-documents/mine").set("Authorization", `Bearer ${token}`).expect(200);
  const required = mine.body.required as string[];
  for (const documentType of required) {
    const up = await request(app).post("/api/verification-documents/upload").set("Authorization", `Bearer ${token}`).attach("file", PNG, { filename: "doc.png", contentType: "image/png" }).expect(200);
    await request(app).post("/api/verification-documents").set("Authorization", `Bearer ${token}`)
      .send({ documentType, fileUrl: up.body.fileRef, declarationAccepted: true, declarationVersion: DOCUMENT_DECLARATION.version }).expect(200);
  }
  return required;
}

async function approveAllDocuments(ownerEmail: string) {
  const docs = (await request(app).get("/api/admin/verification-documents").set(admin()).expect(200)).body as { id: string; applicantEmail: string; status: string }[];
  const mine = docs.filter(d => d.applicantEmail === ownerEmail);
  for (const d of mine) await request(app).post("/api/admin/verification-documents/review").set(admin()).send({ documentId: d.id, status: "APPROVED" }).expect(200);
  return mine.length;
}

describe("a company's journey, from sign-up to verified", () => {
  const email = uniqueEmail("journey-co");
  let token = "";
  let orgId = "";
  let userId = "";

  it("signs up on the free trial: not verified yet, a 60-day trial recorded, the team and the applicant both emailed", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await signupAndVerify(app, uniqueIp(), {
      email, password: "correct-horse-battery-staple", fullName: "Journey Owner", phone: "+974 5555 7100",
      role: "AGENCY_ADMIN", orgName: `Journey Realty ${Date.now()}`, orgType: "AGENCY", selectedPlanId: "plan-trial"
    });
    expect(res.status).toBe(200);
    token = res.body.token;
    userId = res.body.user.id;
    orgId = res.body.user.orgId;
    // the account is NOT verified just for signing up
    expect(res.body.user.verificationStatus).toBe("PENDING");
    expect(res.body.user.applicationStatus).toBe("PENDING_APPROVAL");
    const org = readDb().organizations.find(o => o.id === orgId)!;
    expect(org.verificationStatus).toBe("PENDING");
    expect(org.subscriptionPlanId).toBe("plan-trial");
    // the trial is two months, not one
    const days = (new Date(org.subscriptionExpiry).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.5);
    expect(days).toBeLessThan(TRIAL_DAYS + 0.5);

    const mails = await mailTo(email);
    const welcome = ofType(mails, "welcome");
    expect(welcome).toHaveLength(1);
    expect(welcome[0].html).toContain("We received your application");
    expect(welcome[0].html).toContain("60-day free trial");
    expect(welcome[0].html).toMatch(/[؀-ۿ]/); // and in Arabic
    expect((await allMail()).some(m => m.type === "subscription_request" && m.subject.includes(org.name))).toBe(true);
  });

  it("is emailed when the team approves the application", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).patch(`/api/admin/users/${userId}/application-status`).set(admin()).send({ status: "AWAITING_PAYMENT" }).expect(200);
    const sent = ofType(await mailTo(email), "application_awaiting_payment");
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("approved your application");
    expect(sent[0].html).toContain("60-day free trial");
    // repeating the same step does not email again
    await request(app).patch(`/api/admin/users/${userId}/application-status`).set(admin()).send({ status: "AWAITING_PAYMENT" }).expect(200);
    expect(ofType(await mailTo(email), "application_awaiting_payment")).toHaveLength(1);
  });

  it("is emailed when the plan is confirmed: the trial has started, and the documents are next (no claim of being verified yet)", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const expiry = new Date(Date.now() + TRIAL_DAYS * DAY).toISOString().slice(0, 10);
    await request(app).post("/api/admin/organizations/subscription").set(admin())
      .send({ orgId, planId: "plan-trial", startDate: new Date().toISOString().slice(0, 10), expiryDate: expiry, status: "ACTIVE", activationMethod: "MANUAL" }).expect(200);
    const sent = ofType(await mailTo(email), "subscription_approval");
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("free trial has started");
    expect(sent[0].html).toContain(expiry);
    expect(sent[0].html).toContain("upload your documents");
    expect(sent[0].html).not.toMatch(/Approved\s*&amp;\s*Verified|verified and fully approved/i);
    expect(readDb().organizations.find(o => o.id === orgId)!.verificationStatus).toBe("PENDING"); // still not verified
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.user.applicationStatus).toBe("AWAITING_DOCUMENTS");
  });

  it("is emailed, and so is the team, when the last required document is uploaded", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const required = await uploadAllRequiredDocuments(token);
    expect(required.length).toBeGreaterThan(0);
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.user.applicationStatus).toBe("UNDER_VERIFICATION");
    expect(ofType(await mailTo(email), "application_under_verification")).toHaveLength(1);
    expect(ofType(await mailTo(email), "document_submitted")).toHaveLength(required.length);
    expect((await allMail()).some(m => m.type === "documents_ready" && m.html.includes("uploaded all"))).toBe(true);
  });

  it("is verified, and emailed, only when the documents are approved", async (ctx) => {
    if (!dbReady) return ctx.skip();
    expect(readDb().organizations.find(o => o.id === orgId)!.verificationStatus).toBe("PENDING");
    const n = await approveAllDocuments(email);
    expect(n).toBeGreaterThan(0);
    expect(readDb().organizations.find(o => o.id === orgId)!.verificationStatus).toBe("APPROVED");
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body.user.applicationStatus).toBe("ACTIVE");
    const mails = await mailTo(email);
    expect(ofType(mails, "document_review")).toHaveLength(n);
    const verified = ofType(mails, "account_verified");
    expect(verified).toHaveLength(1);
    expect(verified[0].html).toContain("your company is");
    expect(verified[0].html).toContain("verified badge");
  });
});

describe("an independent agent's journey", () => {
  const email = uniqueEmail("journey-agent");
  let token = "";
  let userId = "";

  it("signs up on the trial: not verified yet, the plan and a 60-day trial recorded, the team told", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await signupAndVerify(app, uniqueIp(), {
      email, password: "correct-horse-battery-staple", fullName: "Journey Agent", phone: "+974 5555 7200", role: "AGENT", selectedPlanId: "plan-trial"
    });
    expect(res.status).toBe(200);
    token = res.body.token;
    userId = res.body.user.id;
    expect(res.body.user.verificationStatus).toBe("PENDING");
    expect(res.body.user.subscriptionPlanId).toBe("plan-trial");
    expect(res.body.user.subscriptionStatus).toBe("PENDING_APPROVAL");
    const days = (new Date(res.body.user.subscriptionExpiry).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.5);
    expect(days).toBeLessThan(TRIAL_DAYS + 0.5);
    expect(ofType(await mailTo(email), "welcome")[0].html).toContain("We received your application");
    expect((await allMail()).some(m => m.type === "application_agent" && m.html.includes("Journey Agent"))).toBe(true);
  });

  it("is emailed when the plan is confirmed (this was silent before), then verified and emailed on approval", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).patch(`/api/admin/users/${userId}/application-status`).set(admin()).send({ status: "AWAITING_PAYMENT" }).expect(200);
    const expiry = new Date(Date.now() + TRIAL_DAYS * DAY).toISOString().slice(0, 10);
    await request(app).post(`/api/admin/users/${userId}/subscription`).set(admin()).send({ planId: "plan-trial", expiryDate: expiry, status: "ACTIVE", activationMethod: "MANUAL" }).expect(200);
    const sent = ofType(await mailTo(email), "subscription_approval");
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("free trial has started");
    expect(sent[0].html).toContain("upload your documents");

    await uploadAllRequiredDocuments(token);
    expect(ofType(await mailTo(email), "application_under_verification")).toHaveLength(1);
    expect(readDb().users.find(u => u.id === userId)!.verificationStatus).toBe("PENDING");
    await approveAllDocuments(email);
    expect(readDb().users.find(u => u.id === userId)!.verificationStatus).toBe("APPROVED");
    const verified = ofType(await mailTo(email), "account_verified");
    expect(verified).toHaveLength(1);
    expect(verified[0].html).toContain("your account is");
  });
});

describe("an agent invited by a company", () => {
  it("starts unverified too: the company's verification covers them, not their own signup", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const baseOrg = readDb().organizations.find(o => o.id === "org-agency-1")!;
    const db = readDb();
    const orgId = `org-invite-${Date.now()}`;
    db.organizations.push({ ...baseOrg, id: orgId, name: `Invite Co ${Date.now()}`, email: uniqueEmail("invite-org"), verificationStatus: "PENDING", verifiedByAdmin: undefined } as never);
    const token = `invite-${Date.now()}`;
    db.invitations = [...(db.invitations || []), { id: `inv-${Date.now()}`, token, orgId, orgName: "Invite Co", email: uniqueEmail("invitee"), invitedRole: "AGENT", status: "PENDING", invitedBy: "x", createdDate: new Date().toISOString(), expiresDate: new Date(Date.now() + DAY).toISOString() } as never];
    writeDb(db);
    const email = uniqueEmail("invited");
    const res = await request(app).post("/api/auth/signup").set("X-Forwarded-For", uniqueIp())
      .send({ email, password: "correct-horse-battery-staple", fullName: "Invited Agent", phone: "+974 5555 7300", role: "AGENT", inviteToken: token });
    expect(res.status).toBe(200);
    expect(res.body.user.orgId).toBe(orgId);
    expect(res.body.user.verificationStatus).toBe("PENDING");
    expect(res.body.user.applicationStatus).toBe("ACTIVE");
    // an invited agent is welcomed plainly: there is no application to review
    const welcome = ofType(await mailTo(email), "welcome");
    expect(welcome).toHaveLength(1);
    expect(welcome[0].html).toContain("created successfully");
    expect(welcome[0].html).not.toContain("We received your application");
  });
});

describe("a buyer's account", () => {
  it("is ready at once, with nothing to verify", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const email = uniqueEmail("journey-buyer");
    const res = await signupAndVerify(app, uniqueIp(), { email, password: "correct-horse-battery-staple", fullName: "Journey Buyer", phone: "+974 5555 7400", role: "REGISTERED" });
    expect(res.status).toBe(200);
    expect(res.body.user.verificationStatus).toBe("APPROVED");
    expect(res.body.user.applicationStatus).toBeUndefined();
    const welcome = ofType(await mailTo(email), "welcome");
    expect(welcome[0].html).toContain("created successfully");
    expect(welcome[0].html).not.toContain("We received your application");
  });
});

describe("a manual verification decision", () => {
  it("is emailed to the company: verified, rejected, suspended (and nothing for 'pending')", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const db = readDb();
    const baseOrg = db.organizations.find(o => o.id === "org-agency-1")!;
    const orgId = `org-manual-${Date.now()}`;
    const orgEmail = uniqueEmail("manual-org");
    db.organizations.push({ ...baseOrg, id: orgId, name: `Manual Co ${Date.now()}`, email: orgEmail, verificationStatus: "PENDING", verifiedByAdmin: undefined } as never);
    writeDb(db);
    for (const status of ["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]) {
      await request(app).post("/api/admin/verify-org").set(admin()).send({ orgId, status }).expect(200);
    }
    const sent = ofType(await mailTo(orgEmail), "verification_changed");
    expect(sent.map(m => m.subject)).toEqual(expect.arrayContaining([expect.stringContaining("is verified"), expect.stringContaining("could not verify"), expect.stringContaining("suspended")]));
    expect(sent).toHaveLength(3);
  });
});

describe("trial and subscription reminders", () => {
  function seedOrg(over: Record<string, unknown>) {
    const db = readDb();
    const base = db.organizations.find(o => o.id === "org-agency-1")!;
    const email = uniqueEmail("remind-org");
    const id = `org-remind-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    db.organizations.push({ ...base, id, name: `Remind Co ${id}`, email, subscriptionReminders: undefined, ...over } as never);
    writeDb(db);
    return { id, email };
  }
  const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

  it("sends one message at 7 days, one on the last day and one when it ends, each only once", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const o = seedOrg({ subscriptionStatus: "ACTIVE", subscriptionPlanId: "plan-trial", subscriptionExpiry: inDays(5) });
    checkSubscriptionExpiryAndReminders();
    checkSubscriptionExpiryAndReminders(); // a second run the same day sends nothing new
    let sent = ofType(await mailTo(o.email), "subscription_d7");
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("free trial");
    expect(sent[0].html).toContain("ends in 7 days");

    // time passes: the last day, then the end
    let db = readDb(); db.organizations.find(x => x.id === o.id)!.subscriptionExpiry = inDays(0.5); writeDb(db);
    checkSubscriptionExpiryAndReminders();
    expect(ofType(await mailTo(o.email), "subscription_d1")).toHaveLength(1);
    db = readDb(); db.organizations.find(x => x.id === o.id)!.subscriptionExpiry = inDays(-1); writeDb(db);
    checkSubscriptionExpiryAndReminders();
    sent = ofType(await mailTo(o.email), "subscription_expired");
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("has ended");
  });

  it("starts over when the subscription is renewed to a new date", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const o = seedOrg({ subscriptionStatus: "ACTIVE", subscriptionPlanId: "plan-basic", subscriptionExpiry: inDays(3) });
    checkSubscriptionExpiryAndReminders();
    expect(ofType(await mailTo(o.email), "subscription_d7")).toHaveLength(1);
    const db = readDb(); db.organizations.find(x => x.id === o.id)!.subscriptionExpiry = inDays(4); writeDb(db);
    checkSubscriptionExpiryAndReminders();
    expect(ofType(await mailTo(o.email), "subscription_d7")).toHaveLength(2);
  });

  it("leaves alone a subscription that was never activated, one that ended long ago, and one far from its end", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const pending = seedOrg({ subscriptionStatus: "PENDING_APPROVAL", subscriptionExpiry: inDays(2) });
    const longAgo = seedOrg({ subscriptionStatus: "ACTIVE", subscriptionExpiry: inDays(-40) });
    const far = seedOrg({ subscriptionStatus: "ACTIVE", subscriptionExpiry: inDays(200) });
    checkSubscriptionExpiryAndReminders();
    for (const o of [pending, longAgo, far]) {
      expect((await mailTo(o.email)).filter(m => m.type.startsWith("subscription_"))).toHaveLength(0);
    }
  });

  it("reminds an independent agent about their own plan, but not an agent covered by a company", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const db = readDb();
    const base = db.users.find(u => u.id === "user-agent-1")!;
    const ind = { ...base, id: `user-remind-ind-${Date.now()}`, email: uniqueEmail("remind-ind"), orgId: undefined, subscriptionStatus: "ACTIVE", subscriptionPlanId: "plan-trial", subscriptionExpiry: inDays(6), subscriptionReminders: undefined };
    const covered = { ...base, id: `user-remind-cov-${Date.now()}`, email: uniqueEmail("remind-cov"), orgId: "org-agency-1", subscriptionStatus: "ACTIVE", subscriptionPlanId: "plan-trial", subscriptionExpiry: inDays(6), subscriptionReminders: undefined };
    db.users.push(ind as never, covered as never);
    writeDb(db);
    checkSubscriptionExpiryAndReminders();
    expect(ofType(await mailTo(ind.email), "subscription_d7")).toHaveLength(1);
    expect(ofType(await mailTo(covered.email), "subscription_d7")).toHaveLength(0);
  });
});
