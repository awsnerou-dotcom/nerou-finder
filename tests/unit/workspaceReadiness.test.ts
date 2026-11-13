import { describe, it, expect } from "vitest";
import { agentChecklist, subscriptionAlert, SUBSCRIPTION_WARNING_DAYS } from "../../src/lib/workspaceReadiness.js";

const full = { verificationStatus: "APPROVED", bio: "Eight years selling waterfront apartments in Pearl Qatar and West Bay.", languages: ["English", "Arabic"], specialties: ["Pearl Qatar"], whatsapp: "+97455551234" } as const;

describe("the agent's profile checklist", () => {
  it("is complete when everything is in place", () => {
    const c = agentChecklist(full as never, { listings: 3, published: 2 });
    expect(c).toMatchObject({ done: 7, total: 7, percent: 100 });
    expect(c.items.every(i => i.done)).toBe(true);
  });

  it("starts at zero for a brand-new, unverified agent with nothing entered", () => {
    const c = agentChecklist({ verificationStatus: "PENDING" } as never, { listings: 0, published: 0 });
    expect(c).toMatchObject({ done: 0, total: 7, percent: 0 });
  });

  it("only counts a bio that is long enough, and ignores blanks", () => {
    expect(agentChecklist({ ...full, bio: "Short." } as never, { listings: 1, published: 1 }).items.find(i => i.id === "bio")!.done).toBe(false);
    expect(agentChecklist({ ...full, bio: "   " } as never, { listings: 1, published: 1 }).items.find(i => i.id === "bio")!.done).toBe(false);
    expect(agentChecklist({ ...full, languages: [], specialties: [], whatsapp: "  " } as never, { listings: 1, published: 1 }).done).toBe(4);
  });

  it("separates 'added a property' from 'published one', and points each task to where it is done", () => {
    const draftOnly = agentChecklist(full as never, { listings: 2, published: 0 });
    expect(draftOnly.items.find(i => i.id === "listing")!.done).toBe(true);
    expect(draftOnly.items.find(i => i.id === "published")!.done).toBe(false);
    const tab = (id: string) => draftOnly.items.find(i => i.id === id)!.tab;
    expect([tab("verification"), tab("bio"), tab("listing"), tab("published")]).toEqual(["verification", "profile", "properties", "properties"]);
  });

  it("has wording in both languages for every task", () => {
    for (const i of agentChecklist({} as never, { listings: 0, published: 0 }).items) {
      expect(i.en && i.ar && i.hintEn && i.hintAr).toBeTruthy();
    }
  });
});

describe("the subscription expiry warning", () => {
  const NOW = Date.parse("2026-11-13T10:00:00Z");
  const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

  it("says nothing without an expiry date, with a bad one, or when it is well ahead", () => {
    expect(subscriptionAlert(undefined, NOW)).toBeNull();
    expect(subscriptionAlert("", NOW)).toBeNull();
    expect(subscriptionAlert("next month maybe", NOW)).toBeNull();
    expect(subscriptionAlert(day(SUBSCRIPTION_WARNING_DAYS + 5), NOW)).toBeNull();
  });

  it("warns in the last two weeks, counting whole days", () => {
    expect(subscriptionAlert(day(10), NOW)).toEqual({ level: "soon", days: 10 });
    expect(subscriptionAlert(day(1), NOW)).toEqual({ level: "soon", days: 1 });
    expect(subscriptionAlert(day(0.5), NOW)).toEqual({ level: "soon", days: 0 });
  });

  it("reports an ended subscription and for how long", () => {
    expect(subscriptionAlert(day(-3), NOW)).toEqual({ level: "expired", days: 3 });
    expect(subscriptionAlert(day(-0.25), NOW)).toEqual({ level: "expired", days: 0 });
  });

  it("treats a plain date as running to the end of that day", () => {
    expect(subscriptionAlert("2026-11-13", NOW)).toEqual({ level: "soon", days: 0 }); // expires tonight, still valid now
    expect(subscriptionAlert("2026-11-12", NOW)).toMatchObject({ level: "expired" });
    expect(subscriptionAlert("2026-11-27", NOW)).toMatchObject({ level: "soon", days: 14 });
    expect(subscriptionAlert("2026-11-28", NOW)).toBeNull();
  });
});
