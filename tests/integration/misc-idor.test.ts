import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";
import { uniqueEmail, uniqueIp } from "../helpers.js";

let dbReady = false;

beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

describe("support ticket replies require auth and ticket ownership", () => {
  it("rejects an unauthenticated reply attempt", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const createRes = await request(app).post("/api/support/tickets").send({
      userEmail: uniqueEmail("ticket-creator"),
      userName: "Ticket Creator",
      category: "TECHNICAL",
      priority: "MEDIUM",
      subject: "Test ticket",
      description: "Testing that replies require auth.",
    });
    expect(createRes.status).toBe(200);
    const ticketId = createRes.body.ticket.id;

    const replyRes = await request(app)
      .post(`/api/support/tickets/${ticketId}/reply`)
      .send({ message: "Anonymous reply attempt", senderRole: "PLATFORM_ADMIN" });

    expect(replyRes.status).toBe(401);
  });

  it("rejects a reply from an authenticated user who does not own the ticket", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const createRes = await request(app).post("/api/support/tickets").send({
      userEmail: uniqueEmail("ticket-owner"),
      userName: "Ticket Owner",
      category: "TECHNICAL",
      priority: "MEDIUM",
      subject: "Another test ticket",
      description: "Testing ownership scoping on replies.",
    });
    const ticketId = createRes.body.ticket.id;

    const ip = uniqueIp();
    const signupRes = await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email: uniqueEmail("unrelated-user"),
      password: "correct-horse-battery-staple",
      fullName: "Unrelated User",
      phone: "+974 5555 9200",
      role: "REGISTERED",
    });

    const replyRes = await request(app)
      .post(`/api/support/tickets/${ticketId}/reply`)
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      .send({ message: "I should not be able to post this." });

    expect(replyRes.status).toBe(403);
  });
});

describe("org subscription upgrade requires org-admin/platform-admin", () => {
  it("rejects an authenticated user who does not belong to the target org", async (ctx) => {
    if (!dbReady) return ctx.skip();

    const ip = uniqueIp();
    const signupRes = await request(app).post("/api/auth/signup").set("X-Forwarded-For", ip).send({
      email: uniqueEmail("upgrade-attacker"),
      password: "correct-horse-battery-staple",
      fullName: "Upgrade Attacker",
      phone: "+974 5555 9300",
      role: "REGISTERED",
    });

    const res = await request(app)
      .post("/api/organizations/upgrade")
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      // org-agency-1 is one of the seeded default organizations this account has no ties to.
      .send({ orgId: "org-agency-1", planId: "plan-developer" });

    expect(res.status).toBe(403);
  });
});
