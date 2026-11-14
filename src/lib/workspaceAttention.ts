// "Needs your attention" for the agent and agency dashboards: the handful of things that are costing them money right now,
// worked out only from real account data (enquiries waiting for a reply, listings that must be reconfirmed, drafts that
// never went live, enquiries nobody owns). Pure functions, unit tested.

import {
  AVAILABILITY_CONFIRM_DUE_DAYS,
  AVAILABILITY_UNCONFIRMED_DAYS,
  getAvailabilityStaleDays,
  LeadStatus,
  ListingStatus
} from "../types.js";
import type { Lead, Property } from "../types.js";

export type AttentionTone = "danger" | "warning" | "info";

export interface AttentionItem {
  id: string;
  tone: AttentionTone;
  count: number;
  /** the workspace tab where the problem is fixed */
  tab: string;
  en: string;
  ar: string;
}

/** An enquiry that is still unanswered after this long is the one that goes to a competitor. */
export const SLOW_REPLY_HOURS = 24;
/** Photos below this make a listing look unfinished. */
export const MIN_PHOTOS = 3;

const HOUR = 3_600_000;

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** Enquiries nobody has answered yet: still NEW (or just assigned) and not archived. */
export function waitingLeads<T extends Pick<Lead, "status" | "isArchived">>(leads: T[]): T[] {
  return leads.filter(l => !l.isArchived && (l.status === LeadStatus.NEW || l.status === LeadStatus.ASSIGNED));
}

/** Hours the oldest waiting enquiry has been waiting (0 when none). */
export function oldestWaitingHours(leads: Pick<Lead, "status" | "isArchived" | "createdDate">[], now: number): number {
  let oldest = 0;
  for (const l of waitingLeads(leads)) {
    const t = Date.parse(l.createdDate);
    if (!isNaN(t)) oldest = Math.max(oldest, Math.floor((now - t) / HOUR));
  }
  return oldest;
}

type Listing = Pick<Property, "listingStatus" | "images" | "lastConfirmedAvailableDate">;

function publishedStale(properties: Listing[]) {
  return properties.filter(
    p => p.listingStatus === ListingStatus.PUBLISHED && getAvailabilityStaleDays(p.lastConfirmedAvailableDate) >= AVAILABILITY_CONFIRM_DUE_DAYS
  );
}

/** What an independent or agency agent should look at first, most urgent first. Empty list = all clear. */
export function agentAttention(input: {
  leads: Pick<Lead, "status" | "isArchived" | "createdDate">[];
  properties: Listing[];
  now: number;
}): AttentionItem[] {
  const { leads, properties, now } = input;
  const items: AttentionItem[] = [];

  const waiting = waitingLeads(leads).length;
  if (waiting > 0) {
    const slow = oldestWaitingHours(leads, now) >= SLOW_REPLY_HOURS;
    items.push({
      id: "waiting-leads",
      tone: slow ? "danger" : "warning",
      count: waiting,
      tab: "leads",
      en: `${waiting} ${plural(waiting, "enquiry is", "enquiries are")} waiting for your reply${slow ? " (the oldest for over a day)" : ""}`,
      ar: `${waiting} ${plural(waiting, "استفسار ينتظر", "استفسارات تنتظر")} ردك${slow ? " (أقدمها منذ أكثر من يوم)" : ""}`
    });
  }

  const viewings = leads.filter(l => !l.isArchived && l.status === LeadStatus.VIEWING_REQUESTED).length;
  if (viewings > 0) {
    items.push({
      id: "viewings",
      tone: "warning",
      count: viewings,
      tab: "leads",
      en: `${viewings} ${plural(viewings, "client has", "clients have")} asked for a viewing`,
      ar: `${viewings} ${plural(viewings, "عميل طلب", "عملاء طلبوا")} معاينة`
    });
  }

  const stale = publishedStale(properties);
  if (stale.length > 0) {
    const critical = stale.some(p => getAvailabilityStaleDays(p.lastConfirmedAvailableDate) >= AVAILABILITY_UNCONFIRMED_DAYS);
    items.push({
      id: "stale-listings",
      tone: critical ? "danger" : "warning",
      count: stale.length,
      tab: "properties",
      en: `${stale.length} ${plural(stale.length, "listing needs", "listings need")} its availability confirmed${critical ? " before it is paused" : ""}`,
      ar: `${stale.length} ${plural(stale.length, "عقار يحتاج", "عقارات تحتاج")} تأكيد التوفر${critical ? " قبل إيقافها" : ""}`
    });
  }

  const drafts = properties.filter(p => p.listingStatus === ListingStatus.DRAFT || p.listingStatus === ListingStatus.PENDING_REVIEW).length;
  if (drafts > 0) {
    items.push({
      id: "drafts",
      tone: "info",
      count: drafts,
      tab: "properties",
      en: `${drafts} ${plural(drafts, "listing is", "listings are")} not live yet`,
      ar: `${drafts} ${plural(drafts, "عقار غير منشور", "عقارات غير منشورة")} بعد`
    });
  }

  const thin = properties.filter(p => p.listingStatus === ListingStatus.PUBLISHED && (p.images || []).length < MIN_PHOTOS).length;
  if (thin > 0) {
    items.push({
      id: "few-photos",
      tone: "info",
      count: thin,
      tab: "properties",
      en: `${thin} live ${plural(thin, "listing has", "listings have")} fewer than ${MIN_PHOTOS} photos: more photos bring more enquiries`,
      ar: `${thin} ${plural(thin, "عقار منشور فيه", "عقارات منشورة فيها")} أقل من ${MIN_PHOTOS} صور: كلما زادت الصور زادت الاستفسارات`
    });
  }

  return items.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}

/** What an agency owner should look at first: everything an agent sees, plus enquiries nobody owns and idle agents. */
export function agencyAttention(input: {
  leads: Pick<Lead, "status" | "isArchived" | "createdDate" | "agentId">[];
  properties: Listing[];
  agentsWithoutListings: number;
  pendingInvitations: number;
  now: number;
}): AttentionItem[] {
  const { leads, properties, agentsWithoutListings, pendingInvitations, now } = input;
  const items = agentAttention({ leads, properties, now }).filter(i => i.id !== "waiting-leads" && i.id !== "viewings");

  const open = waitingLeads(leads);
  const unowned = open.filter(l => !l.agentId).length;
  const owned = open.length - unowned;
  if (unowned > 0) {
    items.push({
      id: "unassigned-leads",
      tone: "danger",
      count: unowned,
      tab: "leads",
      en: `${unowned} ${plural(unowned, "enquiry has", "enquiries have")} no agent assigned`,
      ar: `${unowned} ${plural(unowned, "استفسار بلا وسيط", "استفسارات بلا وسيط")} مسؤول`
    });
  }
  if (owned > 0) {
    const slow = oldestWaitingHours(leads.filter(l => !!l.agentId), now) >= SLOW_REPLY_HOURS;
    items.push({
      id: "waiting-leads",
      tone: slow ? "danger" : "warning",
      count: owned,
      tab: "leads",
      en: `${owned} ${plural(owned, "enquiry is", "enquiries are")} waiting for your team's first reply${slow ? " (the oldest for over a day)" : ""}`,
      ar: `${owned} ${plural(owned, "استفسار ينتظر", "استفسارات تنتظر")} أول رد من فريقك${slow ? " (أقدمها منذ أكثر من يوم)" : ""}`
    });
  }
  if (pendingInvitations > 0) {
    items.push({
      id: "pending-invites",
      tone: "info",
      count: pendingInvitations,
      tab: "team",
      en: `${pendingInvitations} team ${plural(pendingInvitations, "invitation is", "invitations are")} still not accepted`,
      ar: `${pendingInvitations} ${plural(pendingInvitations, "دعوة", "دعوات")} لم تُقبل بعد`
    });
  }
  if (agentsWithoutListings > 0) {
    items.push({
      id: "idle-agents",
      tone: "info",
      count: agentsWithoutListings,
      tab: "team",
      en: `${agentsWithoutListings} ${plural(agentsWithoutListings, "agent has", "agents have")} no listings yet`,
      ar: `${agentsWithoutListings} ${plural(agentsWithoutListings, "وسيط", "وسطاء")} بلا عقارات بعد`
    });
  }
  return items.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}

const TONE_RANK: Record<AttentionTone, number> = { danger: 0, warning: 1, info: 2 };

/** Best listings first by views (then by how recently they were updated), for the "what is working" panel. */
export function topListings<T extends Pick<Property, "views" | "updatedDate" | "listingStatus">>(properties: T[], limit = 3): T[] {
  return properties
    .filter(p => p.listingStatus === ListingStatus.PUBLISHED && (p.views || 0) > 0)
    .sort((a, b) => (b.views || 0) - (a.views || 0) || Date.parse(b.updatedDate) - Date.parse(a.updatedDate))
    .slice(0, limit);
}
