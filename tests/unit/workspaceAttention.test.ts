import { describe, it, expect } from "vitest";
import { agentAttention, agencyAttention, oldestWaitingHours, topListings, waitingLeads } from "../../src/lib/workspaceAttention.js";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

const lead = (status: string, h = 1, extra: Record<string, unknown> = {}) => ({ status, createdDate: hoursAgo(h), ...extra }) as never;
const listing = (extra: Record<string, unknown> = {}) =>
  ({ listingStatus: "PUBLISHED", images: ["a", "b", "c"], lastConfirmedAvailableDate: daysAgo(1), views: 0, updatedDate: daysAgo(1), ...extra }) as never;

describe("what an agent should look at first", () => {
  it("says nothing when everything is fine", () => {
    expect(agentAttention({ leads: [lead("CONVERTED"), lead("LOST")], properties: [listing()], now })).toEqual([]);
  });

  it("counts enquiries that still wait for a reply and ignores archived ones", () => {
    const leads = [lead("NEW"), lead("ASSIGNED"), lead("NEW", 1, { isArchived: true }), lead("CONTACTED")];
    expect(waitingLeads(leads)).toHaveLength(2);
    const [item] = agentAttention({ leads, properties: [], now });
    expect(item).toMatchObject({ id: "waiting-leads", count: 2, tab: "leads", tone: "warning" });
  });

  it("turns red once the oldest enquiry has waited more than a day", () => {
    const [item] = agentAttention({ leads: [lead("NEW", 30), lead("NEW", 2)], properties: [], now });
    expect(item.tone).toBe("danger");
    expect(item.en).toContain("over a day");
    expect(oldestWaitingHours([lead("NEW", 30)], now)).toBe(30);
    expect(oldestWaitingHours([lead("CONTACTED", 90)], now)).toBe(0);
  });

  it("flags published listings whose availability must be reconfirmed, red when close to being paused", () => {
    const due = agentAttention({ leads: [], properties: [listing({ lastConfirmedAvailableDate: daysAgo(15) })], now });
    expect(due[0]).toMatchObject({ id: "stale-listings", tone: "warning", count: 1, tab: "properties" });
    const late = agentAttention({ leads: [], properties: [listing({ lastConfirmedAvailableDate: daysAgo(25) })], now });
    expect(late[0].tone).toBe("danger");
  });

  it("does not nag about stale drafts or paused listings", () => {
    const items = agentAttention({ leads: [], properties: [listing({ listingStatus: "PAUSED", lastConfirmedAvailableDate: daysAgo(40) })], now });
    expect(items.find(i => i.id === "stale-listings")).toBeUndefined();
  });

  it("mentions drafts and thin photo sets as low-priority tips, sorted after the urgent items", () => {
    const items = agentAttention({
      leads: [lead("NEW")],
      properties: [listing({ listingStatus: "DRAFT" }), listing({ images: ["x"] })],
      now
    });
    expect(items.map(i => i.id)).toEqual(["waiting-leads", "drafts", "few-photos"]);
    expect(items.map(i => i.tone)).toEqual(["warning", "info", "info"]);
  });

  it("speaks Arabic and English, with singular and plural", () => {
    const [one] = agentAttention({ leads: [lead("NEW")], properties: [], now });
    expect(one.en).toContain("1 enquiry is waiting");
    expect(one.ar).toContain("استفسار ينتظر");
    const [many] = agentAttention({ leads: [lead("NEW"), lead("NEW")], properties: [], now });
    expect(many.en).toContain("2 enquiries are waiting");
    expect(many.ar).toContain("استفسارات تنتظر");
  });
});

describe("what an agency owner should look at first", () => {
  const base = { properties: [], agentsWithoutListings: 0, pendingInvitations: 0, now };

  it("separates enquiries nobody owns, which come first, from ones waiting on the team", () => {
    const items = agencyAttention({ ...base, leads: [lead("NEW", 1, { agentId: "a1" }), lead("NEW", 1), lead("NEW", 1)] });
    expect(items[0]).toMatchObject({ id: "unassigned-leads", count: 2, tone: "danger", tab: "leads" });
    expect(items.find(i => i.id === "waiting-leads")).toMatchObject({ count: 1, tab: "leads" });
  });

  it("reports pending invitations and agents without listings", () => {
    const items = agencyAttention({ ...base, leads: [], pendingInvitations: 2, agentsWithoutListings: 1 });
    expect(items.map(i => i.id).sort()).toEqual(["idle-agents", "pending-invites"]);
    expect(items.every(i => i.tab === "team" && i.tone === "info")).toBe(true);
  });

  it("is empty for a healthy agency", () => {
    expect(agencyAttention({ ...base, leads: [lead("CONVERTED")], properties: [listing()] })).toEqual([]);
  });
});

describe("the listings that are working", () => {
  it("ranks live listings with views by views, and skips the rest", () => {
    const list = [
      listing({ views: 5, id: "a" }),
      listing({ views: 50, id: "b" }),
      listing({ views: 0, id: "c" }),
      listing({ views: 99, id: "d", listingStatus: "DRAFT" }),
      listing({ views: 20, id: "e" })
    ];
    expect(topListings(list as never[], 2).map((p: any) => p.id)).toEqual(["b", "e"]);
  });
});
