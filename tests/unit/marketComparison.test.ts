import { describe, it, expect } from "vitest";
import { compareWithMarket, pricePerSqm, dealOf, COMPARISON_MIN_SAMPLE } from "../../src/lib/marketComparison.js";
import type { Property } from "../../src/types.js";

let n = 0;
const prop = (over: Record<string, unknown> = {}): Property => ({
  id: `p${++n}`, title: "x", price: 1_000_000, area: 100, sizeUnit: "SQM", city: "Doha", district: "West Bay",
  propertyType: "APARTMENT", transactionType: "FOR_SALE", listingStatus: "PUBLISHED", verificationStatus: "APPROVED",
  ...over
} as unknown as Property);

// a district whose sale listings are 9,000 / 10,000 / 11,000 / 10,000 / 12,000 per sqm (median 10,000)
const market = () => [9000, 10000, 11000, 10000, 12000].map(per => prop({ price: per * 100 }));

describe("the price per square metre", () => {
  it("is price / area, and nothing when either is missing", () => {
    expect(pricePerSqm(prop({ price: 2_000_000, area: 200 }))).toBe(10000);
    expect(pricePerSqm(prop({ area: 0 }))).toBeNull();
    expect(pricePerSqm(prop({ price: 0 }))).toBeNull();
    expect(pricePerSqm(prop({ area: undefined }))).toBeNull();
  });

  it("brings every rent to a monthly figure", () => {
    const rent = { transactionType: "FOR_RENT", price: 6000, area: 100 };
    expect(pricePerSqm(prop(rent))).toBe(60);
    expect(pricePerSqm(prop({ ...rent, rentalPeriod: "MONTHLY" }))).toBe(60);
    expect(pricePerSqm(prop({ ...rent, price: 72000, rentalPeriod: "YEARLY" }))).toBe(60);
    expect(pricePerSqm(prop({ ...rent, price: 1000, rentalPeriod: "WEEKLY" }))).toBeCloseTo((1000 * 52) / 12 / 100, 6);
    expect(pricePerSqm(prop({ ...rent, price: 100, rentalPeriod: "DAILY" }))).toBeCloseTo((100 * 365) / 12 / 100, 6);
  });

  it("buckets the deals the way the market index does", () => {
    expect(dealOf("FOR_RENT" as never)).toBe("RENT");
    expect(dealOf("COMMERCIAL_LEASE" as never)).toBe("RENT");
    for (const t of ["FOR_SALE", "OFF_PLAN", "COMMERCIAL_SALE", "LAND_SALE"]) expect(dealOf(t as never)).toBe("SALE");
  });
});

describe("comparing a listing with the market around it", () => {
  it("says how far below or above the district median it is, with the evidence", () => {
    const cheap = prop({ price: 800_000 }); // 8,000 per sqm against a median of 10,000
    const r = compareWithMarket(cheap, [cheap, ...market()]);
    expect(r).toMatchObject({ comparable: true, deal: "SALE", position: "below", differencePercent: -20, medianPricePerSqm: 10000, listingPricePerSqm: 8000, comparableCount: 5, basis: "same-type", perMonth: false });

    const dear = prop({ price: 1_300_000 });
    expect(compareWithMarket(dear, market())).toMatchObject({ position: "above", differencePercent: 30 });
  });

  it("calls anything within 5% of the median in line", () => {
    expect(compareWithMarket(prop({ price: 1_040_000 }), market())).toMatchObject({ position: "in-line", differencePercent: 4 });
    expect(compareWithMarket(prop({ price: 960_000 }), market())).toMatchObject({ position: "in-line", differencePercent: -4 });
    expect(compareWithMarket(prop({ price: 1_060_000 }), market())).toMatchObject({ position: "above" });
  });

  it("never counts the listing itself", () => {
    const me = prop({ price: 5_000_000 });
    const withMe = compareWithMarket(me, [me, ...market()]);
    const without = compareWithMarket(me, market());
    expect(withMe).toEqual(without);
  });

  it("refuses to compare when fewer than three similar listings exist, and still gives the listing's own rate", () => {
    const me = prop({ price: 1_000_000 });
    const two = [prop(), prop()];
    expect(COMPARISON_MIN_SAMPLE).toBe(3);
    expect(compareWithMarket(me, two)).toEqual({ comparable: false, deal: "SALE", district: "West Bay", comparableCount: 2, listingPricePerSqm: 10000 });
    expect(compareWithMarket(me, [])).toMatchObject({ comparable: false, comparableCount: 0 });
  });

  it("only compares like with like: same district and city, same deal, live and approved", () => {
    const me = prop({ price: 1_000_000 });
    const noise = [
      prop({ district: "The Pearl" }), prop({ district: "The Pearl" }), prop({ district: "The Pearl" }),
      prop({ city: "Lusail" }), prop({ city: "Lusail" }), prop({ city: "Lusail" }),
      prop({ transactionType: "FOR_RENT" }), prop({ transactionType: "FOR_RENT" }), prop({ transactionType: "FOR_RENT" }),
      prop({ listingStatus: "DRAFT" }), prop({ listingStatus: "PAUSED" }), prop({ listingStatus: "SOLD" }),
      prop({ verificationStatus: "PENDING" }), prop({ verificationStatus: "REJECTED" }), prop({ verificationStatus: "PENDING" })
    ];
    expect(compareWithMarket(me, noise)).toMatchObject({ comparable: false, comparableCount: 0 });
    // district and city match regardless of case or stray spaces
    const shouting = [1, 2, 3].map(() => prop({ district: " WEST BAY ", city: "doha" }));
    expect(compareWithMarket(me, shouting)).toMatchObject({ comparable: true, comparableCount: 3 });
  });

  it("treats off-plan and commercial sales as sales, and a commercial lease as rent", () => {
    const me = prop({ transactionType: "OFF_PLAN", price: 1_000_000 });
    const sales = [prop({ transactionType: "FOR_SALE" }), prop({ transactionType: "COMMERCIAL_SALE" }), prop({ transactionType: "LAND_SALE" })];
    expect(compareWithMarket(me, sales)).toMatchObject({ comparable: true, deal: "SALE" });
    const lease = prop({ transactionType: "COMMERCIAL_LEASE", price: 5000 });
    expect(compareWithMarket(lease, [1, 2, 3].map(() => prop({ transactionType: "FOR_RENT", price: 5000 })))).toMatchObject({ comparable: true, deal: "RENT", perMonth: true, position: "in-line" });
  });

  it("prefers the same property type when there are enough of them, otherwise uses every type and says so", () => {
    const apartments = [9000, 10000, 11000].map(per => prop({ price: per * 100 }));
    const villas = [30000, 31000, 32000].map(per => prop({ propertyType: "VILLA", price: per * 100 }));
    const me = prop({ price: 1_000_000 });
    expect(compareWithMarket(me, [...apartments, ...villas])).toMatchObject({ basis: "same-type", medianPricePerSqm: 10000, comparableCount: 3 });
    const lone = prop({ propertyType: "PENTHOUSE", price: 1_000_000 });
    const r = compareWithMarket(lone, [...apartments, ...villas]);
    expect(r).toMatchObject({ comparable: true, basis: "any-type", comparableCount: 6 });
  });

  it("uses the median, so one outlier cannot drag the reference", () => {
    const flat = [10000, 10000, 10000, 10000].map(per => prop({ price: per * 100 }));
    const mansion = prop({ price: 90_000_000 });
    const r = compareWithMarket(prop({ price: 1_000_000 }), [...flat, mansion]);
    expect(r).toMatchObject({ medianPricePerSqm: 10000, position: "in-line" });
  });

  it("flags a small sample as low confidence", () => {
    const few = [1, 2, 3, 4].map(() => prop());
    expect(compareWithMarket(prop(), few)).toMatchObject({ comparable: true, lowConfidence: true });
    expect(compareWithMarket(prop(), market())).toMatchObject({ lowConfidence: false });
  });

  it("compares rents on the same monthly basis whatever period each was advertised in", () => {
    const monthly = [4000, 5000, 6000].map(p => prop({ transactionType: "FOR_RENT", price: p }));
    const yearlyMe = prop({ transactionType: "FOR_RENT", rentalPeriod: "YEARLY", price: 60_000 }); // 5,000 a month
    expect(compareWithMarket(yearlyMe, monthly)).toMatchObject({ comparable: true, position: "in-line", medianPricePerSqm: 50, listingPricePerSqm: 50 });
  });

  it("gives nothing to compare for a listing with no area, price or place", () => {
    for (const bad of [{ area: 0 }, { price: 0 }, { district: "" }, { city: "" }]) {
      expect(compareWithMarket(prop(bad), market())).toMatchObject({ comparable: false });
    }
  });
});
