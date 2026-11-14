import { describe, it, expect } from "vitest";
import { checkPrice, monthlyPrice, validatePriceCheckInput } from "../../src/lib/priceCheck.js";

let n = 0;
const rent = (price: number, over: Record<string, unknown> = {}) => ({
  id: `r${n++}`, title: "Flat", price, area: 100, bedrooms: 2, propertyType: "APARTMENT", transactionType: "FOR_RENT", rentalPeriod: "MONTHLY",
  city: "Doha", district: "Lusail", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", ...over
}) as never;
const sale = (price: number, over: Record<string, unknown> = {}) => rent(price, { transactionType: "FOR_SALE", rentalPeriod: undefined, ...over });

// a district whose typical 2-bedroom rent is 8,000 a month
const market = () => [7000, 7600, 8000, 8000, 8400, 9000].map(p => rent(p));
const ask = (price: number, over: Record<string, unknown> = {}) => ({ deal: "RENT" as const, city: "Doha", district: "Lusail", propertyType: "APARTMENT", bedrooms: 2, price, ...over });

describe("the verdict on a price", () => {
  it("calls a price near the typical one fair, and says what the typical is", () => {
    const r = checkPrice(ask(8200), market());
    expect(r).toMatchObject({ ok: true, verdict: "fair", typical: 8000, comparableCount: 6, basis: "district-type-bedrooms", perMonth: true });
    expect(r.ok && r.target).toBeNull();
  });

  it("calls a dearer price above or far above the market, with a target and what it costs a year", () => {
    const above = checkPrice(ask(9000), market());
    expect(above).toMatchObject({ ok: true, verdict: "above", differencePercent: 13, difference: 1000, yearlyDifference: 12000, target: 8000 });
    const far = checkPrice(ask(11000), market());
    expect(far).toMatchObject({ ok: true, verdict: "far-above", target: 8000 });
  });

  it("calls a cheaper price below the market, and a much cheaper one far below", () => {
    expect(checkPrice(ask(6900), market())).toMatchObject({ ok: true, verdict: "below", differencePercent: -14 });
    const far = checkPrice(ask(5500), market());
    expect(far).toMatchObject({ ok: true, verdict: "far-below", suspiciouslyLow: false });
  });

  it("warns that a price far under the market is more likely bait than a bargain", () => {
    const r = checkPrice(ask(4500), market());
    expect(r).toMatchObject({ ok: true, verdict: "far-below", suspiciouslyLow: true });
  });

  it("says how many comparable listings are cheaper than the asked price", () => {
    const r = checkPrice(ask(8100), market());
    expect(r.ok && r.cheaperThanPercent).toBe(67); // 4 of the 6 are cheaper (7000, 7600, 8000, 8000)
  });

  it("compares per square metre when the size is given, so a big flat is not called dear for its size", () => {
    const all = [100, 100, 100, 100].map(a => rent(8000, { area: a }));
    const big = checkPrice(ask(12000, { areaSqm: 150 }), all); // 80 per sqm both ways
    expect(big).toMatchObject({ ok: true, measure: "per-sqm", verdict: "fair", typical: 12000 });
    const total = checkPrice(ask(12000), all);
    expect(total).toMatchObject({ ok: true, measure: "total", verdict: "far-above" });
  });

  it("brings yearly and weekly rents to a month before comparing", () => {
    expect(monthlyPrice({ price: 96000, transactionType: "FOR_RENT", rentalPeriod: "YEARLY" } as never)).toBe(8000);
    const all = [96000, 96000, 96000].map(p => rent(p, { rentalPeriod: "YEARLY" }));
    expect(checkPrice(ask(8000), all)).toMatchObject({ ok: true, verdict: "fair", typical: 8000 });
  });

  it("works for a purchase, in whole prices with no per-month wording", () => {
    const all = [1_000_000, 1_100_000, 1_200_000, 1_300_000].map(p => sale(p));
    const r = checkPrice({ ...ask(1_500_000), deal: "SALE" }, all);
    expect(r).toMatchObject({ ok: true, verdict: "far-above", perMonth: false, yearlyDifference: null });
  });
});

describe("how many listings back it up", () => {
  it("falls back from bedrooms to type to the whole district, and then to the city", () => {
    const oneBed = [rent(5000, { bedrooms: 1 }), rent(5200, { bedrooms: 1 }), rent(5400, { bedrooms: 1 })];
    expect(checkPrice(ask(5000, { bedrooms: 3 }), oneBed)).toMatchObject({ ok: true, basis: "district-type" });
    const mixed = [rent(5000, { propertyType: "VILLA" }), rent(7000, { propertyType: "VILLA" }), rent(9000, { propertyType: "VILLA" })];
    expect(checkPrice(ask(7000), mixed)).toMatchObject({ ok: true, basis: "district" });
    const cityWide = [1, 2, 3, 4, 5].map(i => rent(6000 + i * 200, { district: `Other ${i}` }));
    expect(checkPrice(ask(7000), cityWide)).toMatchObject({ ok: true, basis: "city-type-bedrooms" });
  });

  it("reports low, medium and high confidence by the number of listings", () => {
    const some = (k: number) => Array.from({ length: k }, (_, i) => rent(7500 + i * 100));
    expect(checkPrice(ask(8000), some(3))).toMatchObject({ confidence: "low" });
    expect(checkPrice(ask(8000), some(6))).toMatchObject({ confidence: "medium" });
    expect(checkPrice(ask(8000), some(12))).toMatchObject({ confidence: "high" });
  });

  it("says so, rather than inventing a verdict, when there are too few listings", () => {
    expect(checkPrice(ask(8000), [rent(7000), rent(8000)])).toEqual({ ok: false, reason: "not-enough-data", comparableCount: 2 });
    expect(checkPrice(ask(8000), [])).toEqual({ ok: false, reason: "not-enough-data", comparableCount: 0 });
  });

  it("ignores listings that are not live, not approved, or for the other deal", () => {
    const noise = [rent(1000, { listingStatus: "DRAFT" }), rent(1000, { verificationStatus: "PENDING" }), sale(1000)];
    expect(checkPrice(ask(8000), [...market(), ...noise])).toMatchObject({ ok: true, comparableCount: 6, typical: 8000 });
  });

  it("offers the three listings closest in price", () => {
    const r = checkPrice(ask(8000), market());
    expect(r.ok && r.similar.map(s => s.price)).toEqual([8000, 8000, 7600].sort((a, b) => Math.abs(a - 8000) - Math.abs(b - 8000)));
    expect(r.ok && r.similar).toHaveLength(3);
  });
});

describe("checking the form", () => {
  const good = { deal: "RENT", city: "Doha", district: "Lusail", propertyType: "APARTMENT", price: "8,500", bedrooms: 2 };
  it("accepts a good form, reading a price typed with commas", () => {
    const v = validatePriceCheckInput(good);
    expect(v).toMatchObject({ ok: true, value: { deal: "RENT", price: 8500, bedrooms: 2 } });
  });
  it("rejects missing or silly values with a plain message", () => {
    const bad = (over: Record<string, unknown>) => { const v = validatePriceCheckInput({ ...good, ...over }); return "error" in v ? v.error : "ok"; };
    expect(bad({ deal: "x" })).toMatch(/rent or for a purchase/);
    expect(bad({ city: "" })).toMatch(/municipality/);
    expect(bad({ district: "" })).toMatch(/area/);
    expect(bad({ propertyType: "" })).toMatch(/property type/);
    expect(bad({ price: "abc" })).toMatch(/price/);
    expect(bad({ price: -5 })).toMatch(/price/);
    expect(bad({ price: 5e10 })).toMatch(/price/);
    expect(bad({ bedrooms: 2.5 })).toMatch(/Bedrooms/);
    expect(bad({ area: 3 })).toMatch(/size/);
  });
});
