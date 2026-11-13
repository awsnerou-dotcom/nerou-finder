import { describe, it, expect } from "vitest";
import { computeMarketPositions, isBelowMarket, BELOW_MARKET_PERCENT } from "../../src/lib/marketPosition.js";
import { compareWithMarket } from "../../src/lib/marketComparison.js";
import type { Property } from "../../src/types.js";

let n = 0;
const prop = (over: Record<string, unknown> = {}): Property => ({
  id: `p${++n}`, title: "x", price: 1_000_000, area: 100, sizeUnit: "SQM", city: "Doha", district: "West Bay",
  propertyType: "APARTMENT", transactionType: "FOR_SALE", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", ...over
} as unknown as Property);

describe("market position of every listing", () => {
  it("gives each listing its distance from the median of the OTHERS", () => {
    // per-sqm values 8000, 9000, 10000, 11000, 12000
    const l = [8000, 9000, 10000, 11000, 12000].map(per => prop({ price: per * 100 }));
    const pos = computeMarketPositions(l);
    // for the 8000 one the others are 9000, 10000, 11000, 12000: median 10500
    expect(pos.get(l[0].id)).toEqual({ percent: -24, position: "below" });
    // for the 12000 one the others are 8000, 9000, 10000, 11000: median 9500
    expect(pos.get(l[4].id)).toEqual({ percent: 26, position: "above" });
    // for the 10000 one the others are 8000, 9000, 11000, 12000: median 10000
    expect(pos.get(l[2].id)).toEqual({ percent: 0, position: "in-line" });
  });

  it("agrees exactly with the listing page's comparison for every listing (same groups, same median, same band)", () => {
    const rnd = (() => { let s = 42; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
    const districts = ["West Bay", "The Pearl", "Lusail"];
    const types = ["APARTMENT", "VILLA", "PENTHOUSE"];
    const deals = ["FOR_SALE", "FOR_RENT", "OFF_PLAN", "COMMERCIAL_LEASE"];
    const all: Property[] = [];
    for (let i = 0; i < 160; i++) {
      all.push(prop({
        district: districts[Math.floor(rnd() * 3)], city: rnd() < 0.9 ? "Doha" : "Lusail",
        propertyType: types[Math.floor(rnd() * 3)], transactionType: deals[Math.floor(rnd() * 4)],
        price: Math.round(200_000 + rnd() * 3_000_000), area: Math.round(40 + rnd() * 300),
        rentalPeriod: rnd() < 0.3 ? "YEARLY" : undefined,
        listingStatus: rnd() < 0.1 ? "DRAFT" : "PUBLISHED", verificationStatus: rnd() < 0.1 ? "PENDING" : "APPROVED"
      }));
    }
    const pos = computeMarketPositions(all);
    let compared = 0;
    for (const p of all) {
      const live = p.listingStatus === "PUBLISHED" && p.verificationStatus === "APPROVED";
      const cmp = compareWithMarket(p, all);
      const mine = pos.get(p.id);
      if (live && cmp.comparable) {
        compared++;
        expect(mine, p.id).toEqual({ percent: cmp.differencePercent, position: cmp.position });
      } else if (!live) {
        expect(mine, p.id).toBeUndefined(); // only live, approved listings are placed
      }
    }
    expect(compared).toBeGreaterThan(40); // the comparison above actually exercised many listings
  });

  it("says nothing for a listing with fewer than three neighbours, a draft, or one that cannot be measured", () => {
    const two = [prop(), prop(), prop()];
    expect(computeMarketPositions(two).size).toBe(0); // each has only two others
    const four = [prop(), prop(), prop(), prop()];
    expect(computeMarketPositions(four).size).toBe(4);
    const odd = [prop({ area: 0 }), prop({ price: 0 }), prop({ district: "" }), prop({ listingStatus: "DRAFT" }), prop({ verificationStatus: "PENDING" })];
    expect(computeMarketPositions([...four, ...odd]).size).toBe(4);
  });

  it("keeps rentals and sales apart, and uses the same property type when there are enough of them", () => {
    const sales = [9000, 10000, 11000].map(per => prop({ price: per * 100 }));
    const rents = [50, 60, 70].map(per => prop({ transactionType: "FOR_RENT", price: per * 100 }));
    const me = prop({ price: 800_000 }); // 8000 per sqm
    const pos = computeMarketPositions([...sales, ...rents, me]);
    expect(pos.get(me.id)).toMatchObject({ position: "below", percent: -20 }); // median of the sales, never the rents
    const villas = [30000, 31000, 32000].map(per => prop({ propertyType: "VILLA", price: per * 100 }));
    const pos2 = computeMarketPositions([...sales, ...villas, me]);
    expect(pos2.get(me.id)).toMatchObject({ percent: -20 }); // apartments only, not dragged up by the villas
  });

  it("calls a listing 'below market' only from 10% under the median", () => {
    expect(BELOW_MARKET_PERCENT).toBe(10);
    expect(isBelowMarket({ percent: -10, position: "below" })).toBe(true);
    expect(isBelowMarket({ percent: -9, position: "below" })).toBe(false);
    expect(isBelowMarket({ percent: 20, position: "above" })).toBe(false);
    expect(isBelowMarket({ percent: -3, position: "in-line" })).toBe(false);
    expect(isBelowMarket(undefined)).toBe(false);
  });
});
