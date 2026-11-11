import { describe, it, expect } from "vitest";
import { DEFAULT_SUB_PLANS, upgradeSeededPlans, publicPlan } from "../../src/data/plans.js";
import { validatePlanRequest, kindForPlan, describePlanRequest } from "../../src/lib/planRequest.js";
import type { SubscriptionPlan } from "../../src/types.js";

const OLD: SubscriptionPlan[] = [
  { id: "plan-basic", name: "Standard Broker", priceMonthly: 500, priceYearly: 4800, propertyLimit: 15, agentLimit: 1, aiLimit: 50, analyticsAccess: false, featuredListingsLimit: 2 },
  { id: "plan-premium", name: "Enterprise Agency", priceMonthly: 1800, priceYearly: 18000, propertyLimit: 100, agentLimit: 10, aiLimit: 500, analyticsAccess: true, featuredListingsLimit: 15 },
  { id: "plan-developer", name: "Master Developer", priceMonthly: 4500, priceYearly: 45000, propertyLimit: 500, agentLimit: 50, aiLimit: 2000, analyticsAccess: true, featuredListingsLimit: 50 }
];
const clone = () => JSON.parse(JSON.stringify(OLD)) as SubscriptionPlan[];
const byId = (list: SubscriptionPlan[], id: string) => list.find(p => p.id === id)!;

describe("the plans a fresh install starts with", () => {
  it("prices the three paid plans 500 / 1,800 / 2,000 with unlimited listings and every feature", () => {
    const basic = byId(DEFAULT_SUB_PLANS, "plan-basic");
    const premium = byId(DEFAULT_SUB_PLANS, "plan-premium");
    const dev = byId(DEFAULT_SUB_PLANS, "plan-developer");
    expect([basic.priceMonthly, premium.priceMonthly, dev.priceMonthly]).toEqual([500, 1800, 2000]);
    for (const p of [basic, premium, dev]) {
      expect(p.propertyLimit).toBe(-1);
      expect(p.aiLimit).toBe(-1);
      expect(p.analyticsAccess).toBe(true);
    }
  });

  it("leaves the paid-advertising (featured slot) numbers as they were, and the trial free", () => {
    expect(DEFAULT_SUB_PLANS.filter(p => p.id !== "plan-trial").map(p => p.featuredListingsLimit)).toEqual([2, 15, 50]);
    expect(byId(DEFAULT_SUB_PLANS, "plan-trial")).toMatchObject({ priceMonthly: 0, priceYearly: 0 });
  });
});

describe("upgrading stored plans", () => {
  it("replaces a plan that is still exactly the old seed", () => {
    const stored = clone();
    expect(upgradeSeededPlans(stored)).toBe(3);
    expect(byId(stored, "plan-developer").priceMonthly).toBe(2000);
    expect(byId(stored, "plan-basic")).toMatchObject({ propertyLimit: -1, analyticsAccess: true, aiLimit: -1 });
    expect(byId(stored, "plan-premium").priceMonthly).toBe(1800);
  });

  it("keeps the admin's name and is a no-op the second time", () => {
    const stored = clone();
    byId(stored, "plan-basic").name = "Solo Agent";
    upgradeSeededPlans(stored);
    expect(byId(stored, "plan-basic").name).toBe("Solo Agent");
    expect(upgradeSeededPlans(stored)).toBe(0);
  });

  it("never touches a plan an admin has changed", () => {
    const stored = clone();
    byId(stored, "plan-developer").priceMonthly = 3900; // an admin edited the price
    byId(stored, "plan-basic").propertyLimit = 20; // an admin edited a limit
    expect(upgradeSeededPlans(stored)).toBe(1); // only plan-premium was untouched
    expect(byId(stored, "plan-developer").priceMonthly).toBe(3900);
    expect(byId(stored, "plan-basic").propertyLimit).toBe(20);
  });

  it("ignores plans it does not know", () => {
    const custom: SubscriptionPlan[] = [{ ...OLD[0], id: "plan-custom" }];
    expect(upgradeSeededPlans(custom)).toBe(0);
    expect(custom[0].propertyLimit).toBe(15);
  });
});

describe("what visitors may see of a plan", () => {
  it("drops both prices and nothing else", () => {
    const pub = publicPlan(OLD[1]) as Record<string, unknown>;
    expect("priceMonthly" in pub).toBe(false);
    expect("priceYearly" in pub).toBe(false);
    expect(pub).toMatchObject({ id: "plan-premium", agentLimit: 10, featuredListingsLimit: 15 });
  });
});

describe("validating a plan request", () => {
  const good = { fullName: "Sara Al Thani", companyName: "Gulf Realty", email: "sara@gulf.test", phone: "+974 5555 1234", planId: "plan-premium", agents: 6, message: "We have six agents.", consent: true };

  it("accepts a complete request and maps the plan to the kind of prospect", () => {
    const r = validatePlanRequest(good);
    expect(r).toMatchObject({ ok: true, spam: false });
    if ("value" in r) expect(r.value).toMatchObject({ name: "Sara Al Thani", company: "Gulf Realty", planId: "plan-premium", agents: 6, kind: "AGENCY" });
    expect(kindForPlan("plan-basic")).toBe("AGENT");
    expect(kindForPlan("plan-developer")).toBe("DEVELOPER");
    expect(kindForPlan(undefined)).toBe("OTHER");
  });

  it("needs the consent box, an email and a phone number", () => {
    expect(validatePlanRequest({ ...good, consent: false })).toMatchObject({ ok: false });
    expect(validatePlanRequest({ ...good, consent: "true" })).toMatchObject({ ok: false });
    expect(validatePlanRequest({ ...good, email: "" })).toMatchObject({ ok: false });
    expect(validatePlanRequest({ ...good, phone: "" })).toMatchObject({ ok: false });
    expect(validatePlanRequest({ ...good, fullName: " " })).toMatchObject({ ok: false });
  });

  it("allows 'not sure' (no plan) but drops a plan id it does not offer", () => {
    for (const planId of [undefined, "", "plan-trial", "plan-nope"]) {
      const r = validatePlanRequest({ ...good, planId });
      expect(r).toMatchObject({ ok: true });
      if ("value" in r) { expect(r.value.planId).toBeUndefined(); expect(r.value.kind).toBe("OTHER"); }
    }
  });

  it("checks the number of agents and the message length", () => {
    expect(validatePlanRequest({ ...good, agents: 0 })).toMatchObject({ ok: false });
    expect(validatePlanRequest({ ...good, agents: 1.5 })).toMatchObject({ ok: false });
    expect(validatePlanRequest({ ...good, agents: 5000 })).toMatchObject({ ok: false });
    expect(validatePlanRequest({ ...good, agents: "" })).toMatchObject({ ok: true });
    expect(validatePlanRequest({ ...good, message: "x".repeat(1600) })).toMatchObject({ ok: false });
  });

  it("quietly ignores a bot that fills the hidden field", () => {
    expect(validatePlanRequest({ ...good, website: "http://spam.example" })).toEqual({ ok: true, spam: true });
    expect(validatePlanRequest({ ...good, website: "  " })).toMatchObject({ ok: true, spam: false });
  });

  it("describes the request in one line for the prospect's history", () => {
    const r = validatePlanRequest(good);
    if (!("value" in r)) throw new Error("expected a valid request");
    expect(describePlanRequest(r.value, "Enterprise Agency")).toContain("Enterprise Agency");
    expect(describePlanRequest(r.value, "Enterprise Agency")).toContain("6 agents");
    expect(describePlanRequest({ ...r.value, planId: undefined, agents: undefined, message: undefined })).toContain("not sure");
  });
});
