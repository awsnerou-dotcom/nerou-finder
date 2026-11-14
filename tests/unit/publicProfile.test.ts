import { describe, it, expect } from "vitest";
import { agentSlug, buildPublicProfile, orgSlug, profileSummary } from "../../src/lib/publicProfile.js";

const user = (over: Record<string, unknown> = {}) => ({
  id: "u1", email: "a@x.qa", fullName: "Faisal Hassan", phone: "+97433334444", role: "AGENT", verificationStatus: "APPROVED",
  bio: "Eight years selling waterfront apartments.", languages: ["English"], specialties: ["Pearl"], orgId: "o1", createdDate: "2024-01-01", ...over
});
const org = (over: Record<string, unknown> = {}) => ({
  id: "o1", name: "Elite Gulf Realty", nameAr: "إيليت", type: "AGENCY", logoUrl: "l.png", email: "o@x.qa", phone: "+97444443333",
  verificationStatus: "APPROVED", createdDate: "2023-01-01", ...over
});
const prop = (id: string, over: Record<string, unknown> = {}) => ({
  id, agentId: "u1", orgId: "o1", title: id, listingStatus: "PUBLISHED", createdDate: "2026-01-01", updatedDate: "2026-01-02", images: [], ...over
});
const review = (id: string, over: Record<string, unknown> = {}) => ({
  id, reviewerId: "r1", targetType: "AGENT", targetId: "u1", rating: 5, comment: "Great", createdDate: "2026-02-01", status: "APPROVED", ...over
});
const db = (over: Record<string, unknown> = {}) => ({
  users: [user(), user({ id: "r1", fullName: "Mariam Al-Kuwari", role: "REGISTERED", verificationStatus: "PENDING", orgId: undefined })],
  organizations: [org()],
  properties: [prop("p1"), prop("p2", { updatedDate: "2026-03-01" }), prop("p3", { listingStatus: "DRAFT" })],
  reviews: [review("v1"), review("v2", { rating: 4, createdDate: "2026-03-01" }), review("v3", { status: "PENDING" })],
  ...over
}) as never;

describe("an agent's public profile", () => {
  it("is found by its slug and shows only what is public", () => {
    const d = db();
    const p = buildPublicProfile(d, "agents", agentSlug((d as any).users[0]))!;
    expect(p).toMatchObject({ kind: "agents", id: "u1", name: "Faisal Hassan", verified: true, listingsCount: 2 });
    expect(p.subtitle.en).toBe("Elite Gulf Realty");
    expect(p.org?.name).toBe("Elite Gulf Realty");
    expect(p.listings.map(l => l.id)).toEqual(["p2", "p1"]); // live only, newest first
    expect(p.rating).toEqual({ average: 4.5, count: 2 });
    expect(p.reviews.map(r => r.id)).toEqual(["v2", "v1"]); // approved only
    expect(p.reviews[0].reviewerName).toBe("Mariam A."); // short name, never the email
    expect(JSON.stringify(p)).not.toMatch(/PENDING|"v3"/);
  });

  it("does not exist for an unknown slug, a non-agent, or an unverified agent with nothing live", () => {
    const d = db();
    expect(buildPublicProfile(d, "agents", "nobody-zzzzzz")).toBeNull();
    expect(buildPublicProfile(d, "agents", agentSlug((d as any).users[1]))).toBeNull(); // a registered visitor
    const hidden = db({ users: [user({ verificationStatus: "PENDING" })], properties: [] });
    expect(buildPublicProfile(hidden, "agents", agentSlug((hidden as any).users[0]))).toBeNull();
  });

  it("still shows an unverified agent who has a live listing, without the verified label", () => {
    const d = db({ users: [user({ verificationStatus: "PENDING" })] });
    const p = buildPublicProfile(d, "agents", agentSlug((d as any).users[0]))!;
    expect(p.verified).toBe(false);
    expect(p.verifiedLabel).toBeUndefined();
  });

  it("labels an independent agent as such and carries the response badge", () => {
    const d = db({ users: [user({ orgId: undefined })] });
    const perf = { u1: { badge: "WITHIN_HOUR", top: true, medianMinutes: 20, responded: 6 } } as never;
    const p = buildPublicProfile(d, "agents", agentSlug((d as any).users[0]), perf)!;
    expect(p.subtitle).toEqual({ en: "Independent agent", ar: "وكيل مستقل" });
    expect(p.org).toBeUndefined();
    expect(p.performance).toMatchObject({ top: true });
  });
});

describe("an agency's public profile", () => {
  it("shows its listings, reviews and team of public agents", () => {
    const d = db({ reviews: [review("a1", { targetType: "AGENCY", targetId: "o1" })] });
    const p = buildPublicProfile(d, "agencies", orgSlug((d as any).organizations[0]))!;
    expect(p).toMatchObject({ kind: "agencies", name: "Elite Gulf Realty", listingsCount: 2, verified: true });
    expect(p.subtitle.en).toBe("Real estate agency");
    expect(p.rating.count).toBe(1);
    expect(p.team?.map(t => t.name)).toEqual(["Faisal Hassan"]);
    expect(p.team?.[0].listings).toBe(2);
  });

  it("is hidden when it is unverified and has nothing live", () => {
    const d = db({ organizations: [org({ verificationStatus: "PENDING" })], properties: [] });
    expect(buildPublicProfile(d, "agencies", orgSlug((d as any).organizations[0]))).toBeNull();
  });

  it("calls a developer a developer", () => {
    const d = db({ organizations: [org({ type: "DEVELOPER" })] });
    expect(buildPublicProfile(d, "agencies", orgSlug((d as any).organizations[0]))!.subtitle.en).toBe("Developer");
  });
});

describe("the one-line summary", () => {
  it("states the facts in both languages", () => {
    const d = db();
    const p = buildPublicProfile(d, "agents", agentSlug((d as any).users[0]))!;
    expect(profileSummary(p, "en")).toContain("2 live listings");
    expect(profileSummary(p, "en")).toContain("rated 4.5 from 2 reviews");
    expect(profileSummary(p, "ar")).toContain("2 عقاراً منشوراً");
    expect(profileSummary(p, "en").length).toBeLessThanOrEqual(300);
  });
});
