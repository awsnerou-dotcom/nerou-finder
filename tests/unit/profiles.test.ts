import { describe, it, expect } from "vitest";
import {
  bumpDay, findBySlug, listingShareMessage, listingShareUrl, profilePath, profileSlug, profileUrl, publicReviewerName,
  reviewRequestMessage, shortId, sumLastDays, whatsappShareLink
} from "../../src/lib/profiles.js";

describe("profile addresses", () => {
  it("builds a readable slug that ends with a stable code", () => {
    const slug = profileSlug("agents", { id: "user-agent-1", name: "Faisal Hassan" });
    expect(slug).toMatch(/^faisal-hassan-[a-z0-9]{6}$/);
    expect(profileSlug("agents", { id: "user-agent-1", name: "Faisal Hassan" })).toBe(slug);
  });

  it("gives two people with the same name different addresses", () => {
    expect(profileSlug("agents", { id: "a1", name: "Ali Khan" })).not.toBe(profileSlug("agents", { id: "a2", name: "Ali Khan" }));
  });

  it("falls back to a plain word for a name with no latin letters", () => {
    expect(profileSlug("agents", { id: "x1", name: "فيصل حسن" })).toMatch(/^agent-[a-z0-9]{6}$/);
    expect(profileSlug("agencies", { id: "x1", name: "" })).toMatch(/^agency-[a-z0-9]{6}$/);
  });

  it("finds the owner by the code, even after a rename, and rejects junk", () => {
    const people = [{ id: "u1", name: "A" }, { id: "u2", name: "B" }];
    const old = profileSlug("agents", { id: "u2", name: "Old Name" });
    expect(findBySlug(people, old)?.id).toBe("u2");
    expect(findBySlug(people, "no-code-here")).toBeUndefined();
    expect(findBySlug(people, "")).toBeUndefined();
    expect(findBySlug(people, `x-${shortId("nobody")}`)).toBeUndefined();
  });

  it("makes the page, review and share links, English and Arabic", () => {
    expect(profilePath("agents", "ali-123456")).toBe("/agents/ali-123456");
    expect(profilePath("agencies", "elite-123456", true)).toBe("/ar/agencies/elite-123456");
    expect(profileUrl("https://x.qa/", "agents", "ali-123456", { review: true })).toBe("https://x.qa/agents/ali-123456?review=1");
    expect(profileUrl("https://x.qa", "agents", "ali-123456", { shared: true, isRtl: true })).toBe("https://x.qa/ar/agents/ali-123456?sh=1");
    expect(listingShareUrl("https://x.qa/", "p1")).toBe("https://x.qa/properties/p1?sh=1");
    expect(listingShareUrl("https://x.qa", "p1", true)).toBe("https://x.qa/ar/properties/p1?sh=1");
  });
});

describe("messages", () => {
  it("writes the listing message with price, place and link", () => {
    const m = listingShareMessage({ title: "2BR in Lusail", price: 1500000, currency: "QAR", district: "Lusail", url: "https://x.qa/properties/p1?sh=1", isRtl: false });
    expect(m).toContain("2BR in Lusail - Lusail");
    expect(m).toContain("QAR 1,500,000");
    expect(m).toContain("https://x.qa/properties/p1?sh=1");
    expect(listingShareMessage({ title: "شقة", price: 5000, url: "u", isRtl: true, period: "/شهر" })).toContain("QAR 5,000/شهر");
  });

  it("builds a WhatsApp link, with or without a phone, escaping the text", () => {
    expect(whatsappShareLink("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
    expect(whatsappShareLink("hi", "+974 5555 1234")).toBe("https://wa.me/97455551234?text=hi");
  });

  it("asks for a review politely, by first name when known", () => {
    const en = reviewRequestMessage({ clientName: "Mariam Al-Kuwari", agentName: "Faisal", url: "https://x.qa/agents/f?review=1", isRtl: false });
    expect(en).toContain("Hi Mariam,");
    expect(en).toContain("https://x.qa/agents/f?review=1");
    expect(reviewRequestMessage({ agentName: "Faisal", url: "u", isRtl: true })).toContain("مرحباً،");
  });
});

describe("counting visits", () => {
  const now = Date.parse("2026-11-14T10:00:00Z");
  it("sums the last N days including today and ignores older days", () => {
    const rec = { "2026-11-14": 3, "2026-11-10": 2, "2026-10-01": 50 };
    expect(sumLastDays(rec, 30, now)).toBe(5);
    expect(sumLastDays(rec, 1, now)).toBe(3);
    expect(sumLastDays(undefined, 30, now)).toBe(0);
  });

  it("adds one to today and drops entries older than 120 days", () => {
    const next = bumpDay({ "2026-11-14": 1, "2025-01-01": 9 }, now);
    expect(next["2026-11-14"]).toBe(2);
    expect(next["2025-01-01"]).toBeUndefined();
    expect(bumpDay(undefined, now)).toEqual({ "2026-11-14": 1 });
  });
});

describe("reviewer names on a public page", () => {
  it("keeps the first name and the initial of the last", () => {
    expect(publicReviewerName("Mariam Al-Kuwari")).toBe("Mariam A.");
    expect(publicReviewerName("Sara")).toBe("Sara");
    expect(publicReviewerName("")).toBe("Verified client");
    expect(publicReviewerName(undefined)).toBe("Verified client");
  });
});

import { wrapLines } from "../../src/lib/shareCard.js";

describe("fitting the title on the share card", () => {
  const measure = (s: string) => s.length * 10; // every letter 10px wide
  it("breaks at spaces so no line is wider than the box", () => {
    const lines = wrapLines("Luxury two bedroom apartment with sea view in Porto Arabia", 250, measure, 3);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every(l => measure(l) <= 250)).toBe(true);
    expect(lines.join(" ")).toBe("Luxury two bedroom apartment with sea view in Porto Arabia");
  });
  it("cuts the last line with an ellipsis when the text does not fit", () => {
    const lines = wrapLines("one two three four five six seven eight nine ten", 100, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(lines.every(l => measure(l) <= 100)).toBe(true);
  });
  it("copes with empty text and one very long word", () => {
    expect(wrapLines("", 100, measure, 2)).toEqual([]);
    expect(wrapLines("Supercalifragilisticexpialidocious", 100, measure, 2)).toEqual(["Supercalifragilisticexpialidocious"]);
  });
});
