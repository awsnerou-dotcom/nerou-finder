import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { uniqueIp } from "../helpers.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
const tag = `vo${Date.now().toString(36)}`;
let n = 0;

// A brand-new agency and its admin, approved by default like every signup, with no documents at all.
function seedAgency() {
  const db = readDb();
  const baseUser = db.users.find(u => u.id === "user-agency-admin")!;
  const baseOrg = db.organizations.find(o => o.id === "org-agency-1")!;
  const k = ++n;
  const orgId = `org-vo-${tag}-${k}`;
  const adminId = `user-vo-${tag}-${k}`;
  db.organizations.push({ ...baseOrg, id: orgId, name: `Override Agency ${tag} ${k}`, verificationStatus: "APPROVED", verifiedByAdmin: undefined } as never);
  db.users.push({ ...baseUser, id: adminId, email: `${adminId}@example.test`, orgId, verificationStatus: "APPROVED", applicationStatus: "ACTIVE" } as never);
  writeDb(db);
  return { orgId, adminId };
}

const orgStatus = (orgId: string) => readDb().organizations.find(o => o.id === orgId)!;
const openVerificationPage = (adminId: string) =>
  request(app).get("/api/verification-documents/mine").set("Authorization", `Bearer ${tokenFor(adminId, "AGENCY_ADMIN")}`).set("X-Forwarded-For", uniqueIp()).expect(200);
const adminSets = (orgId: string, status: string) =>
  request(app).post("/api/admin/verify-org").set("Authorization", `Bearer ${tokenFor("user-platform-admin", "PLATFORM_ADMIN")}`).set("X-Forwarded-For", uniqueIp()).send({ orgId, status }).expect(200);

describe("an organisation approved by hand", () => {
  it("without a hand approval, opening the Verification page with no documents takes the default approval away", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { orgId, adminId } = seedAgency();
    await openVerificationPage(adminId);
    expect(orgStatus(orgId).verificationStatus).toBe("PENDING");
  });

  it("keeps its approval when the admin opens the Verification page", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { orgId, adminId } = seedAgency();
    await adminSets(orgId, "APPROVED");
    expect(orgStatus(orgId)).toMatchObject({ verificationStatus: "APPROVED", verifiedByAdmin: true });
    await openVerificationPage(adminId);
    await openVerificationPage(adminId);
    expect(orgStatus(orgId).verificationStatus).toBe("APPROVED");
  });

  it("goes back to following its documents once an admin sets any other status by hand", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { orgId, adminId } = seedAgency();
    await adminSets(orgId, "APPROVED");
    await adminSets(orgId, "PENDING");
    expect(orgStatus(orgId).verifiedByAdmin).toBeUndefined();
    await openVerificationPage(adminId);
    expect(orgStatus(orgId).verificationStatus).toBe("PENDING");
  });

  it("stays suspended when an admin suspends it", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { orgId, adminId } = seedAgency();
    await adminSets(orgId, "APPROVED");
    await adminSets(orgId, "SUSPENDED");
    await openVerificationPage(adminId);
    expect(orgStatus(orgId).verificationStatus).toBe("SUSPENDED");
  });
});
