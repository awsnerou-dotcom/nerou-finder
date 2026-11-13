import { describe, it, expect } from "vitest";
import { priceDrop, listedDaysAgo, listedLabel, isNewListing, PRICE_DROP_RECENT_DAYS, NEW_LISTING_DAYS } from "../../src/lib/propertySearch.js";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);

describe("a recent price reduction", () => {
  it("is found when the latest price is lower than the one before and the change is recent", () => {
    const d = priceDrop({ price: 920_000, priceHistory: [{ price: 1_000_000, date: day(40) }, { price: 920_000, date: day(5) }] }, NOW);
    expect(d).toEqual({ previous: 1_000_000, percent: 8, date: day(5) });
  });

  it("is not there for a rise, an unchanged price, or a listing with one price", () => {
    expect(priceDrop({ price: 1_100_000, priceHistory: [{ price: 1_000_000, date: day(3) }, { price: 1_100_000, date: day(1) }] }, NOW)).toBeNull();
    expect(priceDrop({ price: 1_000_000, priceHistory: [{ price: 1_000_000, date: day(3) }] }, NOW)).toBeNull();
    expect(priceDrop({ price: 1_000_000, priceHistory: [] }, NOW)).toBeNull();
    expect(priceDrop({ price: 1_000_000, priceHistory: undefined as never }, NOW)).toBeNull();
  });

  it("is not news once the cut is older than the window", () => {
    const old = [{ price: 1_000_000, date: day(100) }, { price: 900_000, date: day(PRICE_DROP_RECENT_DAYS + 1) }];
    expect(priceDrop({ price: 900_000, priceHistory: old }, NOW)).toBeNull();
    const edge = [{ price: 1_000_000, date: day(100) }, { price: 900_000, date: day(PRICE_DROP_RECENT_DAYS - 1) }];
    expect(priceDrop({ price: 900_000, priceHistory: edge }, NOW)).toMatchObject({ percent: 10 });
  });

  it("measures the last cut, after earlier ups and downs", () => {
    const h = [{ price: 1_000_000, date: day(90) }, { price: 1_200_000, date: day(60) }, { price: 1_080_000, date: day(2) }];
    expect(priceDrop({ price: 1_080_000, priceHistory: h }, NOW)).toEqual({ previous: 1_200_000, percent: 10, date: day(2) });
  });

  it("never reports 0%, and ignores a history that does not end at the current price", () => {
    const tiny = priceDrop({ price: 999_999, priceHistory: [{ price: 1_000_000, date: day(1) }, { price: 999_999, date: day(1) }] }, NOW);
    expect(tiny?.percent).toBe(1);
    expect(priceDrop({ price: 800_000, priceHistory: [{ price: 1_000_000, date: day(5) }, { price: 900_000, date: day(2) }] }, NOW)).toBeNull();
  });

  it("copes with bad dates and prices", () => {
    expect(priceDrop({ price: 900_000, priceHistory: [{ price: 1_000_000, date: "x" }, { price: 900_000, date: "not a date" }] }, NOW)).toBeNull();
    expect(priceDrop({ price: 0, priceHistory: [{ price: 5, date: day(1) }, { price: 0, date: day(1) }] }, NOW)).toBeNull();
  });
});

describe("how long ago a listing was published", () => {
  it("counts whole days, never negative, and says nothing for a missing or invalid date", () => {
    expect(listedDaysAgo(new Date(NOW - 3 * 86_400_000 - 5000).toISOString(), NOW)).toBe(3);
    expect(listedDaysAgo(new Date(NOW).toISOString(), NOW)).toBe(0);
    expect(listedDaysAgo(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0);
    expect(listedDaysAgo(undefined, NOW)).toBeNull();
    expect(listedDaysAgo("garbage", NOW)).toBeNull();
  });

  it("is 'new' for a week", () => {
    expect(isNewListing(0)).toBe(true);
    expect(isNewListing(NEW_LISTING_DAYS)).toBe(true);
    expect(isNewListing(NEW_LISTING_DAYS + 1)).toBe(false);
    expect(isNewListing(null)).toBe(false);
  });

  it("is worded in English", () => {
    expect(listedLabel(0, false)).toBe("Listed today");
    expect(listedLabel(1, false)).toBe("Listed yesterday");
    expect(listedLabel(5, false)).toBe("Listed 5 days ago");
    expect(listedLabel(13, false)).toBe("Listed 13 days ago");
    expect(listedLabel(21, false)).toBe("Listed 3 weeks ago");
    expect(listedLabel(59, false)).toBe("Listed 8 weeks ago");
    expect(listedLabel(75, false)).toBe("Listed 2 months ago");
  });

  it("is worded in Arabic with the right number forms", () => {
    expect(listedLabel(0, true)).toBe("نُشر اليوم");
    expect(listedLabel(1, true)).toBe("نُشر أمس");
    expect(listedLabel(2, true)).toBe("نُشر منذ يومين");
    expect(listedLabel(5, true)).toBe("نُشر منذ 5 أيام");
    expect(listedLabel(12, true)).toBe("نُشر منذ 12 يوماً");
    expect(listedLabel(14, true)).toBe("نُشر منذ أسبوعين");
    expect(listedLabel(21, true)).toBe("نُشر منذ 3 أسابيع");
    expect(listedLabel(30 * 2 + 5, true)).toBe("نُشر منذ شهرين");
    expect(listedLabel(30 * 4, true)).toBe("نُشر منذ 4 أشهر");
  });
});
