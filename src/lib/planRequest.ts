// The public "request a plan" form: what a visitor may send, checked before anything is stored. Pure
// functions, unit tested. A request becomes a prospect in the admin sales pipeline (see POST
// /api/plan-requests); the team then replies with the plan and price that suits the person.

import type { ProspectKind } from "../types.js";
import { validateProspectInput } from "./prospects.js";

export const REQUESTABLE_PLANS = ["plan-basic", "plan-premium", "plan-developer"] as const;

export interface PlanRequestInput {
  name: string;
  company?: string;
  email: string;
  phone: string;
  planId?: string; // omitted when the person is not sure which plan they need
  agents?: number;
  message?: string;
  kind: ProspectKind;
}
export type PlanRequestValidation =
  | { ok: true; spam: false; value: PlanRequestInput }
  | { ok: true; spam: true }
  | { ok: false; error: string };

export function kindForPlan(planId?: string): ProspectKind {
  if (planId === "plan-basic") return "AGENT";
  if (planId === "plan-premium") return "AGENCY";
  if (planId === "plan-developer") return "DEVELOPER";
  return "OTHER";
}

export const MAX_REQUEST_MESSAGE = 1500;

export function validatePlanRequest(raw: Record<string, unknown>): PlanRequestValidation {
  // A hidden field real visitors never see or fill: a bot that fills every field is quietly ignored.
  if (typeof raw.website === "string" && raw.website.trim() !== "") return { ok: true, spam: true };

  if (raw.consent !== true) return { ok: false, error: "Please tick the box to agree to be contacted about your request." };

  const planId = typeof raw.planId === "string" && (REQUESTABLE_PLANS as readonly string[]).includes(raw.planId) ? raw.planId : undefined;
  const kind = kindForPlan(planId);

  const contact = validateProspectInput({ name: raw.fullName, company: raw.companyName, email: raw.email, phone: raw.phone, kind, source: "WEBSITE" });
  if (contact.ok === false) return { ok: false, error: contact.error };
  if (!contact.value.email) return { ok: false, error: "Please add your email address." };
  if (!contact.value.phone) return { ok: false, error: "Please add your phone number." };

  let agents: number | undefined;
  if (raw.agents !== undefined && raw.agents !== null && raw.agents !== "") {
    const n = Number(raw.agents);
    if (!Number.isInteger(n) || n < 1 || n > 1000) return { ok: false, error: "The number of agents must be a whole number from 1 to 1000." };
    agents = n;
  }

  let message: string | undefined;
  if (typeof raw.message === "string" && raw.message.trim()) {
    message = raw.message.replace(/\s+/g, " ").trim();
    if (message.length > MAX_REQUEST_MESSAGE) return { ok: false, error: `Your message is too long (up to ${MAX_REQUEST_MESSAGE} characters).` };
  }

  return {
    ok: true,
    spam: false,
    value: { name: contact.value.name, company: contact.value.company, email: contact.value.email, phone: contact.value.phone, planId, agents, message, kind }
  };
}

/** One line for the prospect's history. */
export function describePlanRequest(v: PlanRequestInput, planName?: string): string {
  const bits = [planName ? `Asked about the ${planName} plan` : "Asked for a plan - not sure which one"];
  if (v.agents) bits.push(`${v.agents} agent${v.agents === 1 ? "" : "s"}`);
  const line = `Subscription request from the website. ${bits.join(", ")}.`;
  return v.message ? `${line} Message: ${v.message}` : line;
}
