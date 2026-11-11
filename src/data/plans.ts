// The subscription plans a fresh install starts with, and the rule for replacing the earlier ones.
//
// Prices are in QAR per month and are shown only INSIDE the platform (to the people who hold the plan and
// to the admins). The public pages never show a price: visitors see what each plan includes and send a
// request, and the team replies with the plan and price that suits them (see POST /api/plan-requests).
//
// -1 is the "unlimited" sentinel. These limits are informational (nothing in server.ts enforces a hard
// cap against them - see SubscriptionPlan in src/types.ts), except the monthly self-service boost caps,
// which live in DEFAULT_MONTHLY_BOOST_CAPS and are unchanged.

import type { SubscriptionPlan } from "../types.js";

export const DEFAULT_SUB_PLANS: SubscriptionPlan[] = [
  {
    // one independent agent: 500 QAR / month, unlimited listings, every feature
    id: "plan-basic",
    name: "Standard Broker",
    priceMonthly: 500,
    priceYearly: 6000,
    propertyLimit: -1,
    agentLimit: 1,
    aiLimit: -1,
    analyticsAccess: true,
    featuredListingsLimit: 2
  },
  {
    // a real-estate company: 1,800 QAR / month, unlimited listings, every feature
    id: "plan-premium",
    name: "Enterprise Agency",
    priceMonthly: 1800,
    priceYearly: 21600,
    propertyLimit: -1,
    agentLimit: 10,
    aiLimit: -1,
    analyticsAccess: true,
    featuredListingsLimit: 15
  },
  {
    // a developer: 2,000 QAR / month, unlimited listings, every feature
    id: "plan-developer",
    name: "Master Developer",
    priceMonthly: 2000,
    priceYearly: 24000,
    propertyLimit: -1,
    agentLimit: 50,
    aiLimit: -1,
    analyticsAccess: true,
    featuredListingsLimit: 50
  },
  {
    id: "plan-trial",
    name: "60-Day Free Trial",
    priceMonthly: 0,
    priceYearly: 0,
    propertyLimit: -1,
    agentLimit: -1,
    aiLimit: -1,
    analyticsAccess: true,
    featuredListingsLimit: -1
  }
];

type PlanNumbers = Pick<SubscriptionPlan, "priceMonthly" | "priceYearly" | "propertyLimit" | "agentLimit" | "aiLimit" | "analyticsAccess" | "featuredListingsLimit">;

/** The first plans this platform was seeded with. A stored plan still equal to one of these has never been edited by an admin. */
const OLD_PLAN_SEEDS: Record<string, PlanNumbers> = {
  "plan-basic": { priceMonthly: 500, priceYearly: 4800, propertyLimit: 15, agentLimit: 1, aiLimit: 50, analyticsAccess: false, featuredListingsLimit: 2 },
  "plan-premium": { priceMonthly: 1800, priceYearly: 18000, propertyLimit: 100, agentLimit: 10, aiLimit: 500, analyticsAccess: true, featuredListingsLimit: 15 },
  "plan-developer": { priceMonthly: 4500, priceYearly: 45000, propertyLimit: 500, agentLimit: 50, aiLimit: 2000, analyticsAccess: true, featuredListingsLimit: 50 }
};

const NUMBER_KEYS: (keyof PlanNumbers)[] = ["priceMonthly", "priceYearly", "propertyLimit", "agentLimit", "aiLimit", "analyticsAccess", "featuredListingsLimit"];

/**
 * Brings the stored plans up to the current ones - but only a plan that is still exactly the old seed. A plan
 * an admin has changed in any way (price, limits, features) is never touched. Returns how many were replaced.
 */
export function upgradeSeededPlans(stored: SubscriptionPlan[]): number {
  let n = 0;
  for (const plan of stored) {
    const old = OLD_PLAN_SEEDS[plan.id];
    const next = DEFAULT_SUB_PLANS.find(p => p.id === plan.id);
    if (!old || !next) continue;
    if (NUMBER_KEYS.every(k => plan[k] === old[k])) {
      for (const k of NUMBER_KEYS) (plan as unknown as Record<string, unknown>)[k] = next[k];
      n += 1;
    }
  }
  return n;
}

/** The plan fields visitors may see: everything except what it costs. */
export function publicPlan(plan: SubscriptionPlan): Omit<SubscriptionPlan, "priceMonthly" | "priceYearly"> {
  const { priceMonthly: _m, priceYearly: _y, ...rest } = plan;
  return rest;
}
