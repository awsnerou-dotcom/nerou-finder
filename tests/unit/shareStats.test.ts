import { describe, it, expect } from "vitest";
import { buildShareStats } from "../../src/lib/shareStats.js";

const now = Date.parse("2026-11-14T10:00:00Z");

describe("share statistics", () => {
  it("adds up profile visits and shared-link visits over the last 30 days", () => {
    const s = buildShareStats({
      profileViewsByDay: { "2026-11-14": 4, "2026-11-01": 6, "2026-09-01": 99 },
      listings: [
        { id: "a", title: "A", shareVisitsByDay: { "2026-11-14": 3, "2026-11-13": 1 }, viewsByDay: { "2026-11-14": 10 } },
        { id: "b", title: "B", shareVisitsByDay: { "2026-11-12": 5, "2026-08-01": 40 }, viewsByDay: { "2026-11-12": 7 } }
      ],
      now
    });
    expect(s.profileViews).toBe(10);
    expect(s.shareVisits).toBe(9);
    expect(s.series).toHaveLength(30);
    expect(s.series[29]).toEqual({ date: "2026-11-14", profile: 4, share: 3 });
    expect(s.series[0].date).toBe("2026-10-16");
  });

  it("ranks the listings that brought the most visitors and skips ones that brought none", () => {
    const s = buildShareStats({
      profileViewsByDay: undefined,
      listings: [
        { id: "a", title: "A", shareVisitsByDay: { "2026-11-14": 3 } },
        { id: "b", title: "B", shareVisitsByDay: { "2026-11-14": 8 } },
        { id: "c", title: "C" }
      ],
      now
    });
    expect(s.top.map(t => t.id)).toEqual(["b", "a"]);
    expect(s.profileViews).toBe(0);
  });

  it("is all zeros for an account with nothing yet", () => {
    const s = buildShareStats({ profileViewsByDay: undefined, listings: [], now });
    expect(s).toMatchObject({ profileViews: 0, shareVisits: 0, top: [] });
    expect(s.series.every(x => x.profile === 0 && x.share === 0)).toBe(true);
  });
});
