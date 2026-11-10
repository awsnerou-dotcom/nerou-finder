import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../server.js";
import { initDb } from "../../server-db.js";
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
    fullName: `Tour ${label}`,
    phone: "+974 5555 9900",
    role: "AGENT"
  });
  return { token: res.body.token as string, id: res.body.user.id as string };
}

const seen = (a: { token: string; id: string }, body: object) =>
  request(app).post(`/api/users/${a.id}/onboarding-tour-seen`).set("Authorization", `Bearer ${a.token}`).send(body);

describe("remembering which edition of the tour was seen", () => {
  it("stores the edition and never moves it backwards", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tour-ver");
    const first = await seen(a, { seen: true, version: 2 });
    expect(first.status).toBe(200);
    expect(first.body.onboardingTourVersion).toBe(2);
    const older = await seen(a, { seen: true, version: 1 });
    expect(older.body.onboardingTourVersion).toBe(2);
  });

  it("still works for old clients that send no version", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tour-old");
    const res = await seen(a, { seen: true });
    expect(res.status).toBe(200);
    expect(res.body.hasSeenOnboardingTour).toBe(true);
    expect(res.body.onboardingTourVersion).toBe(0);
  });

  it("ignores nonsense versions", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tour-bad");
    for (const bad of ["9", -3, 1.5, 99999, null]) {
      const res = await seen(a, { seen: true, version: bad });
      expect(res.status).toBe(200);
      expect(res.body.onboardingTourVersion).toBe(0);
    }
  });

  it("will not let someone change another person's tour state", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await newAgent("tour-a");
    const b = await newAgent("tour-b");
    const res = await request(app).post(`/api/users/${b.id}/onboarding-tour-seen`).set("Authorization", `Bearer ${a.token}`).send({ seen: true, version: 2 });
    expect(res.status).toBe(403);
  });
});
