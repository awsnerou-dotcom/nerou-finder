import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app, checkDocumentExpiryAndReminders } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { DOCUMENT_DECLARATION } from "../../src/types.js";
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

const admin = () => ({ Authorization: `Bearer ${jwt.sign({ id: "user-platform-admin", email: "admin@test.local", role: "PLATFORM_ADMIN", fullName: "Test Admin" }, process.env.JWT_SECRET!, { expiresIn: "1h" })}` });
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

async function agencyWithToken() {
  const res = await signupAndVerify(app, uniqueIp(), {
    email: uniqueEmail("doc-expiry"), password: "correct-horse-battery-staple", fullName: "Expiry Owner", phone: "+974 5555 7200",
    role: "AGENCY_ADMIN", orgName: `Expiry Realty ${Date.now()}`, orgType: "AGENCY", selectedPlanId: "plan-trial"
  });
  return { token: res.body.token as string, orgId: res.body.user.orgId as string };
}

async function submit(token: string, documentType: string, expiryDate?: string) {
  const up = await request(app).post("/api/verification-documents/upload").set("Authorization", `Bearer ${token}`).attach("file", PNG, { filename: "doc.png", contentType: "image/png" }).expect(200);
  return request(app).post("/api/verification-documents").set("Authorization", `Bearer ${token}`)
    .send({ documentType, fileUrl: up.body.fileRef, expiryDate, declarationAccepted: true, declarationVersion: DOCUMENT_DECLARATION.version });
}
const review = (body: object) => request(app).post("/api/admin/verification-documents/review").set(admin()).send(body);

describe("a verification document with a date that has passed", () => {
  it("cannot be uploaded: today, a past date or a broken date are refused, a future one is kept", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await agencyWithToken();
    for (const bad of [day(0), day(-400), "01/02/2027", "2027-02-31"]) {
      const res = await submit(token, "COMMERCIAL_REGISTRATION", bad);
      expect(res.status, bad).toBe(400);
    }
    const ok = await submit(token, "COMMERCIAL_REGISTRATION", day(200));
    expect(ok.status).toBe(200);
    expect(ok.body.document.expiryDate).toBe(day(200));
  });

  it("cannot be approved as it is; the admin corrects the date and it then stays approved through the daily check", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token, orgId } = await agencyWithToken();
    const id = (await submit(token, "COMMERCIAL_REGISTRATION", day(100))).body.document.id as string;
    // what is already stored for accounts that typed the issue date before this rule existed
    const db = readDb();
    const stored = db.verificationDocuments!.find(d => d.id === id)!;
    stored.expiryDate = day(-30);
    stored.status = "EXPIRED" as never;
    writeDb(db);

    const refused = await review({ documentId: id, status: "APPROVED" }).expect(400);
    expect(refused.body.error).toContain("has passed");
    await review({ documentId: id, status: "APPROVED", expiryDate: day(-1) }).expect(400);
    await review({ documentId: id, status: "APPROVED", expiryDate: "soon" }).expect(400);

    await review({ documentId: id, status: "APPROVED", expiryDate: day(365) }).expect(200);
    checkDocumentExpiryAndReminders();
    const after = readDb().verificationDocuments!.find(d => d.id === id && d.orgId === orgId)!;
    expect(after.status).toBe("APPROVED");
    expect(after.expiryDate).toBe(day(365));
  });

  it("can be approved with no expiry date at all, and can still be rejected", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await agencyWithToken();
    const first = (await submit(token, "COMMERCIAL_REGISTRATION", day(100))).body.document.id as string;
    const second = (await submit(token, "TRADE_LICENSE", day(100))).body.document.id as string;
    const db = readDb();
    for (const d of db.verificationDocuments!) if (d.id === first || d.id === second) d.expiryDate = day(-5);
    writeDb(db);

    await review({ documentId: first, status: "APPROVED", expiryDate: "" }).expect(200);
    await review({ documentId: second, status: "REJECTED", rejectionReason: "Old copy" }).expect(200);
    checkDocumentExpiryAndReminders();
    const docs = readDb().verificationDocuments!;
    expect(docs.find(d => d.id === first)).toMatchObject({ status: "APPROVED" });
    expect(docs.find(d => d.id === first)!.expiryDate).toBeUndefined();
    expect(docs.find(d => d.id === second)!.status).toBe("REJECTED");
  });
});
