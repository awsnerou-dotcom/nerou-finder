import { describe, it, expect } from "vitest";
import { leadStatusLabel, listingStatusLabel, timeAgo } from "../../src/lib/statusLabels.js";

describe("status names", () => {
  it("names every lead status in both languages instead of printing the enum", () => {
    expect(leadStatusLabel("VIEWING_REQUESTED", false)).toBe("Viewing requested");
    expect(leadStatusLabel("CONVERTED", true)).toBe("تمت الصفقة");
    expect(leadStatusLabel("NEW", true)).toBe("جديد");
  });
  it("names listing statuses and falls back to a readable form for an unknown one", () => {
    expect(listingStatusLabel("PUBLISHED", false)).toBe("Live");
    expect(listingStatusLabel("PAUSED", true)).toBe("متوقف");
    expect(listingStatusLabel("SOMETHING_NEW", false)).toBe("Something new");
  });
});

describe("how long ago", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it("counts minutes, hours and days", () => {
    expect(timeAgo(ago(20_000), now, false)).toBe("just now");
    expect(timeAgo(ago(5 * 60_000), now, false)).toBe("5 min ago");
    expect(timeAgo(ago(3 * 3_600_000), now, false)).toBe("3 h ago");
    expect(timeAgo(ago(2 * 86_400_000), now, true)).toBe("منذ 2 يوم");
  });
  it("shows a date after a month and nothing for a bad date", () => {
    expect(timeAgo(ago(60 * 86_400_000), now, false)).toMatch(/2026/);
    expect(timeAgo("nonsense", now, false)).toBe("");
    expect(timeAgo(undefined, now, false)).toBe("");
  });
  it("never goes negative for a date slightly in the future", () => {
    expect(timeAgo(new Date(now + 60_000).toISOString(), now, false)).toBe("just now");
  });
});
