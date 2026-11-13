import { describe, it, expect } from "vitest";
import { estimateValue, percentile, validateValuationInput, CITY_LEVEL_MIN_SAMPLE } from "../../src/lib/valuation.js";
import type { Property } from "../../src/types.js";

let n = 0;
const prop = (over: Record<string, unknown> = {}): Property => ({
  id: `v${++n}`, title: `Listing ${n}`, price: 1_000_000, area: 100, sizeUnit: "SQM", city: "Doha", district: "West Bay", bedrooms: 2,
  propertyType: "APARTMENT", transactionType: "FOR_SALE", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", ...over
} as unknown as Property);
const withPer = (pers: number[], over: Record<string, unknown> = {}) => pers.map(per => prop({ price: per * 100, ...over }));
const input = { deal: "SALE" as const, city: "Doha", district: "West Bay", propertyType: "APARTMENT", areaSqm: 120 };

describe("percentiles", () => {
  it("interpolate between values", () => {
    expect(percentile([10], 50)).toBe(10);
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50], 25)).toBe(20);
    expect(percentile([10, 20, 30, 40, 50], 75)).toBe(40);
    expect(percentile([10, 20], 50)).toBe(15);
    expect(percentile([50, 10, 30], 0)).toBe(10);
    expect(percentile([50, 10, 30], 100)).toBe(50);
  });
});

describe("estimating what a property is worth", () => {
  it("gives the middle and a range from the neighbours' price per square metre, times the size", () => {
    const r = estimateValue(input, withPer([8000, 9000, 10000, 11000, 12000]));
    expect(r).toMatchObject({ ok: true, basis: "district-type", comparableCount: 5, medianPerSqm: 10000, lowPerSqm: 9000, highPerSqm: 11000, perMonth: false });
    if (r.ok) {
      expect(r.estimate).toBe(1_200_000); // 10,000 x 120
      expect(r.low).toBe(1_080_000);
      expect(r.high).toBe(1_320_000);
      expect(r.low).toBeLessThanOrEqual(r.estimate);
      expect(r.estimate).toBeLessThanOrEqual(r.high);
    }
  });

  it("refuses to guess when there are too few comparable listings, and says how many it found", () => {
    expect(estimateValue(input, withPer([9000, 10000]))).toEqual({ ok: false, reason: "not-enough-data", comparableCount: 2 });
    expect(estimateValue(input, [])).toEqual({ ok: false, reason: "not-enough-data", comparableCount: 0 });
  });

  it("counts only live, approved listings of the same deal in the same place", () => {
    const noise = [
      ...withPer([1, 1, 1], { listingStatus: "DRAFT" }), ...withPer([1, 1, 1], { verificationStatus: "PENDING" }),
      ...withPer([1, 1, 1], { transactionType: "FOR_RENT" }), ...withPer([1, 1, 1], { district: "The Pearl" }), ...withPer([1, 1, 1], { city: "Lusail" })
    ];
    expect(estimateValue(input, noise)).toMatchObject({ ok: false, comparableCount: 0 });
    expect(estimateValue(input, [...noise, ...withPer([9000, 10000, 11000])])).toMatchObject({ ok: true, comparableCount: 3, medianPerSqm: 10000 });
  });

  it("matches bedrooms when enough listings share them, otherwise widens and says so", () => {
    const twoBed = withPer([10000, 10000, 10000], { bedrooms: 2 });
    const fourBed = withPer([20000, 20000, 20000], { bedrooms: 4 });
    expect(estimateValue({ ...input, bedrooms: 2 }, [...twoBed, ...fourBed])).toMatchObject({ basis: "district-type-bedrooms", medianPerSqm: 10000, comparableCount: 3 });
    // only one 3-bedroom exists: falls back to every apartment in the district
    const r = estimateValue({ ...input, bedrooms: 3 }, [...twoBed, ...fourBed, ...withPer([15000], { bedrooms: 3 })]);
    expect(r).toMatchObject({ basis: "district-type", comparableCount: 7 });
  });

  it("falls back to every type in the district, then to the same type in the city, in that order", () => {
    const villas = withPer([30000, 31000, 32000], { propertyType: "VILLA" });
    expect(estimateValue(input, villas)).toMatchObject({ basis: "district", comparableCount: 3 });
    const elsewhere = withPer([9000, 9500, 10000, 10500, 11000], { district: "Al Sadd" });
    expect(estimateValue(input, elsewhere)).toMatchObject({ ok: true, basis: "city-type", comparableCount: CITY_LEVEL_MIN_SAMPLE });
    expect(estimateValue(input, elsewhere.slice(0, 4))).toMatchObject({ ok: false, reason: "not-enough-data" }); // the city-level group needs five
  });

  it("estimates a rent as a monthly figure whatever period the neighbours were advertised in", () => {
    const rents = [
      prop({ transactionType: "FOR_RENT", price: 4000 }), prop({ transactionType: "FOR_RENT", price: 5000 }),
      prop({ transactionType: "FOR_RENT", price: 72_000, rentalPeriod: "YEARLY" }) // 6,000 a month
    ];
    const r = estimateValue({ ...input, deal: "RENT", areaSqm: 100 }, rents);
    expect(r).toMatchObject({ ok: true, deal: "RENT", perMonth: true, medianPerSqm: 50 });
    if (r.ok) expect(r.estimate).toBe(5000);
  });

  it("rounds the figures the way a person would say them", () => {
    const r = estimateValue({ ...input, areaSqm: 117 }, withPer([8123, 9456, 10789]));
    if (!r.ok) throw new Error("expected an estimate");
    expect(r.estimate % 1000).toBe(0);
    expect(r.low % 1000).toBe(0);
    const rent = estimateValue({ ...input, deal: "RENT", areaSqm: 97 }, withPer([53, 57, 61], { transactionType: "FOR_RENT" }));
    if (!rent.ok) throw new Error("expected a rent estimate");
    expect(rent.estimate % 10).toBe(0);
  });

  it("grades its confidence by how many listings it rests on", () => {
    const conf = (count: number) => { const r = estimateValue(input, withPer(Array.from({ length: count }, (_, i) => 9000 + i * 100))); return r.ok ? r.confidence : "none"; };
    expect([conf(3), conf(4), conf(5), conf(14), conf(15), conf(40)]).toEqual(["low", "low", "medium", "medium", "high", "high"]);
  });

  it("shows the three comparable listings closest in size", () => {
    const l = [60, 90, 116, 127, 200].map((a, i) => prop({ area: a, price: a * 10_000, title: `Size ${a}`, id: `sim-${i}` }));
    const r = estimateValue({ ...input, areaSqm: 120 }, l);
    if (!r.ok) throw new Error("expected an estimate");
    expect(r.similar.map(s => s.title)).toEqual(["Size 116", "Size 127", "Size 90"]);
  });

  it("is case- and space-insensitive about the place, and never trusts a bad size", () => {
    expect(estimateValue({ ...input, city: " doha ", district: "WEST BAY" }, withPer([9000, 10000, 11000]))).toMatchObject({ ok: true });
    expect(estimateValue({ ...input, areaSqm: 0 }, withPer([9000, 10000, 11000]))).toEqual({ ok: false, reason: "invalid", comparableCount: 0 });
    expect(estimateValue({ ...input, areaSqm: NaN }, withPer([9000, 10000, 11000]))).toMatchObject({ ok: false, reason: "invalid" });
  });
});

describe("checking what the owner entered", () => {
  const good = { deal: "SALE", city: "Doha", district: "West Bay", propertyType: "APARTMENT", area: "120", bedrooms: "2" };
  it("accepts a complete form (numbers may arrive as text) and bedrooms are optional", () => {
    expect(validateValuationInput(good)).toEqual({ ok: true, value: { deal: "SALE", city: "Doha", district: "West Bay", propertyType: "APARTMENT", areaSqm: 120, bedrooms: 2 } });
    expect(validateValuationInput({ ...good, bedrooms: undefined })).toMatchObject({ ok: true, value: { bedrooms: undefined } });
    expect(validateValuationInput({ ...good, bedrooms: "" })).toMatchObject({ ok: true, value: { bedrooms: undefined } });
  });
  it("refuses an incomplete or nonsensical one with a message", () => {
    for (const bad of [
      { ...good, deal: "BARTER" }, { ...good, city: " " }, { ...good, district: "" }, { ...good, propertyType: "" },
      { ...good, area: "" }, { ...good, area: "5" }, { ...good, area: "1000000" }, { ...good, area: "abc" },
      { ...good, bedrooms: "2.5" }, { ...good, bedrooms: "-1" }, { ...good, bedrooms: "99" }
    ]) {
      const r = validateValuationInput(bad);
      expect(r.ok).toBe(false);
      if ("error" in r) expect(r.error.length).toBeGreaterThan(5);
    }
  });
});
