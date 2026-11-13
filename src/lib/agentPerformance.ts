// How fast an agent really answers the enquiries they receive, worked out from data the platform already records, and
// the two badges visitors see because of it. Nothing is self-reported: the clock runs from the day the enquiry arrived
// to the first thing the agent did with it (moving it past "new"/"assigned", or leaving a note). Pure functions, unit tested.

import type { Lead } from "../types.js";

/** only enquiries from the last 90 days count, so a badge reflects how the agent works now */
export const RESPONSE_WINDOW_DAYS = 90;
/** a badge needs this many answered enquiries behind it, so one lucky reply cannot earn one */
export const MIN_RESPONSES = 5;
/** a "Top agent" also needs this many live listings */
export const TOP_AGENT_MIN_LISTINGS = 5;

export type ResponseBadge = "WITHIN_HOUR" | "WITHIN_FEW_HOURS" | "WITHIN_DAY";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_A_REPLY = new Set(["NEW", "ASSIGNED"]);

type LeadLike = Pick<Lead, "createdDate" | "agentId"> & Partial<Pick<Lead, "stageHistory" | "notes">>;

/** the moment the agent first acted on the enquiry, or null if they have not */
export function firstResponseAt(lead: LeadLike): number | null {
  const times: number[] = [];
  for (const h of lead.stageHistory || []) {
    if (!NOT_A_REPLY.has(h.status)) {
      const t = Date.parse(h.date);
      if (Number.isFinite(t)) times.push(t);
    }
  }
  for (const n of lead.notes || []) {
    // a note by the lead's own agent is a reply (a note left by someone else, such as an agency admin, is not the agent's)
    if (lead.agentId && n.authorId === lead.agentId) {
      const t = Date.parse(n.createdDate);
      if (Number.isFinite(t)) times.push(t);
    }
  }
  return times.length ? Math.min(...times) : null;
}

/** minutes from the enquiry arriving to the first reply; null when there is no reply or the dates make no sense */
export function responseMinutes(lead: LeadLike): number | null {
  const at = firstResponseAt(lead);
  const arrived = Date.parse(lead.createdDate);
  if (at === null || !Number.isFinite(arrived) || at < arrived) return null;
  return (at - arrived) / 60000;
}

export interface ResponseStats {
  received: number;
  responded: number;
  medianMinutes: number | null;
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function agentResponseStats(leads: LeadLike[], agentId: string, now: number = Date.now()): ResponseStats {
  const since = now - RESPONSE_WINDOW_DAYS * DAY_MS;
  const mine = leads.filter(l => l.agentId === agentId && Date.parse(l.createdDate) >= since);
  const times = mine.map(responseMinutes).filter((m): m is number => m !== null);
  return { received: mine.length, responded: times.length, medianMinutes: times.length ? median(times) : null };
}

export function responseBadge(stats: ResponseStats): ResponseBadge | null {
  if (stats.responded < MIN_RESPONSES || stats.medianMinutes === null) return null;
  if (stats.medianMinutes <= 60) return "WITHIN_HOUR";
  if (stats.medianMinutes <= 240) return "WITHIN_FEW_HOURS";
  if (stats.medianMinutes <= 24 * 60) return "WITHIN_DAY";
  return null;
}

/** verified, with a real portfolio, and quick (within a few hours) on enough enquiries */
export function isTopAgent(a: { verified: boolean; liveListings: number; stats: ResponseStats }): boolean {
  const badge = responseBadge(a.stats);
  return a.verified && a.liveListings >= TOP_AGENT_MIN_LISTINGS && (badge === "WITHIN_HOUR" || badge === "WITHIN_FEW_HOURS");
}

export interface AgentPerformance {
  badge: ResponseBadge | null;
  top: boolean;
  medianMinutes: number | null;
  responded: number;
}

/** for the public listing: only agents who earned something appear */
export function publicAgentPerformance(
  leads: LeadLike[],
  agents: { id: string; verified: boolean; liveListings: number }[],
  now: number = Date.now()
): Record<string, AgentPerformance> {
  const out: Record<string, AgentPerformance> = {};
  for (const a of agents) {
    const stats = agentResponseStats(leads, a.id, now);
    const badge = responseBadge(stats);
    const top = isTopAgent({ verified: a.verified, liveListings: a.liveListings, stats });
    if (badge || top) out[a.id] = { badge, top, medianMinutes: stats.medianMinutes === null ? null : Math.round(stats.medianMinutes), responded: stats.responded };
  }
  return out;
}

/** "12 min", "3.5 hours", "2 days" - or the Arabic wording */
export function formatReplyTime(minutes: number, isRtl: boolean): string {
  if (minutes < 60) { const m = Math.max(1, Math.round(minutes)); return isRtl ? `${m} دقيقة` : `${m} min`; }
  if (minutes < 24 * 60) { const h = Math.round((minutes / 60) * 10) / 10; return isRtl ? `${h} ساعة` : `${h} h`; }
  const d = Math.round((minutes / (24 * 60)) * 10) / 10;
  return isRtl ? `${d} يوم` : `${d} d`;
}
