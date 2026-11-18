import { describe, it, expect } from "vitest";
import type { Property } from "../../src/types.js";
import type { PlaceRef } from "../../src/lib/listingFromText.js";
import {
  ChatMemoryStore, answerInstantly, buildAnswer, parsePrice, parseRequest, recognizedCount, refineCriteria, searchListings, monthlyPrice
} from "../../src/lib/instantSearch.js";
import { foldText } from "../../src/lib/listingFromText.js";

const places: PlaceRef[] = [
  { id: "m-doha", name: "Doha", nameAr: "الدوحة", type: "MUNICIPALITY" },
  { id: "a-lusail", name: "Lusail", nameAr: "لوسيل", type: "AREA", parentId: "m-doha" },
  { id: "a-westbay", name: "West Bay", nameAr: "الخليج الغربي", type: "AREA", parentId: "m-doha" },
  { id: "m-rayyan", name: "Al Rayyan", nameAr: "الريان", type: "MUNICIPALITY" },
  { id: "a-waab", name: "Al Waab", nameAr: "الوعب", type: "AREA", parentId: "m-rayyan" }
];

const now = new Date().toISOString();
function prop(id: string, over: Record<string, unknown>): Property {
  return {
    id, listingId: id, title: `Listing ${id}`, description: "A home.", propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 9000, currency: "QAR",
    rentalPeriod: "MONTHLY", area: 100, sizeUnit: "SQM", city: "Doha", district: "Lusail", latitude: 25.3, longitude: 51.5, bedrooms: 2, bathrooms: 2,
    furnished: "NO", parking: false, amenities: [], images: [], agentId: "a", orgId: "o", verificationStatus: "APPROVED", listingStatus: "PUBLISHED",
    qualityScore: 80, createdDate: now, updatedDate: now, priceHistory: [], ...over
  } as unknown as Property;
}

const catalogue = [
  prop("p1", { price: 9500 }),
  prop("p2", { price: 15000 }),
  prop("p3", { price: 8000, district: "West Bay" }),
  prop("p4", { propertyType: "VILLA", transactionType: "FOR_SALE", price: 4_500_000, district: "Al Waab", city: "Al Rayyan", bedrooms: 5 }),
  prop("p5", { price: 11000, bedrooms: 3, amenities: ["Swimming Pool", "Gym"], furnished: "YES" }),
  prop("p6", { price: 84000, rentalPeriod: "YEARLY", bedrooms: 1 })
];

describe("reading the budget", () => {
  it("understands a maximum, a minimum and a range, with k and million", () => {
    expect(parsePrice("under 12,000 qar")).toEqual({ max: 12000 });
    expect(parsePrice("budget 8000")).toEqual({ max: 8000 });
    expect(parsePrice("12,000 qar")).toEqual({ max: 12000 });
    expect(parsePrice("up to 15k")).toEqual({ max: 15000 });
    expect(parsePrice("villa 2.5 million")).toEqual({ max: 2_500_000 });
    expect(parsePrice("above 1 million")).toEqual({ min: 1_000_000 });
    expect(parsePrice("at least 5000")).toEqual({ min: 5000 });
    expect(parsePrice("between 5000 and 8000")).toEqual({ min: 5000, max: 8000 });
    expect(parsePrice("5000-8000")).toEqual({ min: 5000, max: 8000 });
  });

  it("reads Arabic wording and Arabic digits", () => {
    expect(parsePrice(foldText("بأقل من 12,000 ريال"))).toEqual({ max: 12000 });
    expect(parsePrice(foldText("ميزانيتي ١٠٠٠٠ ريال"))).toEqual({ max: 10000 });
    expect(parsePrice(foldText("فيلا بحدود 3 مليون"))).toEqual({ max: 3_000_000 });
    expect(parsePrice(foldText("من 5000 الى 8000"))).toEqual({ min: 5000, max: 8000 });
  });

  it("does not mistake bedrooms, bathrooms or sizes for a price", () => {
    expect(parsePrice("2 bedrooms 2 bathrooms")).toEqual({});
    expect(parsePrice("3-bedroom 150 sqm apartment")).toEqual({});
    expect(parsePrice(foldText("شقة 3 غرف مساحة 120 متر"))).toEqual({});
  });
});

describe("reading a request", () => {
  it("English: what, where, how big, how much", () => {
    const c = parseRequest("2-bedroom apartment for rent in Lusail under 12,000 QAR", places);
    expect(c).toMatchObject({ deal: "RENT", bedsMin: 2, bedsMax: 2, maxPrice: 12000 });
    expect(c.types).toEqual(["APARTMENT", "HOTEL_APARTMENT"]);
    expect(c.place?.id).toBe("a-lusail");
  });

  it("Arabic: the same request", () => {
    const c = parseRequest("شقة غرفتين للإيجار في لوسيل بأقل من 12,000 ريال", places);
    expect(c).toMatchObject({ deal: "RENT", bedsMin: 2, bedsMax: 2, maxPrice: 12000 });
    expect(c.types).toEqual(["APARTMENT", "HOTEL_APARTMENT"]);
    expect(c.place?.id).toBe("a-lusail");
  });

  it("a villa for sale in Al Rayyan with a budget in millions", () => {
    const c = parseRequest("فيلا عائلية للبيع في الريان بميزانية 3 مليون", places);
    expect(c).toMatchObject({ deal: "SALE", types: ["VILLA"], maxPrice: 3_000_000 });
    expect(c.place?.id).toBe("m-rayyan");
  });

  it("studios, 'or more' bedrooms, furnishing, off-plan and features", () => {
    const studio = parseRequest("furnished studio to rent", places);
    expect(studio).toMatchObject({ types: ["STUDIO"], furnished: "YES", deal: "RENT" });
    expect(studio.bedsMin).toBeUndefined(); // a studio has no bedroom count to match
    const many = parseRequest("3+ bedroom villa", places);
    expect(many.bedsMin).toBe(3);
    expect(many.bedsMax).toBeUndefined();
    expect(parseRequest("off-plan investment", places).deal).toBe("OFF_PLAN");
    expect(parseRequest("استثمار على المخطط", places).deal).toBe("OFF_PLAN");
    expect(parseRequest("apartment with pool, parking and sea view", places).features).toEqual(expect.arrayContaining(["pool", "parking", "seaView"]));
    expect(parseRequest("شقة مع مسبح ومصعد", places).features).toEqual(expect.arrayContaining(["pool", "elevator"]));
    expect(parseRequest("I want to buy a villa", places).deal).toBe("SALE");
  });

  it("a request that names nothing is not understood by the rules", () => {
    expect(recognizedCount(parseRequest("hello, what is the best area for families?", places))).toBe(0);
    expect(recognizedCount(parseRequest("مرحبا كيف حالك", places))).toBe(0);
    expect(recognizedCount(parseRequest("2 bedrooms in Lusail", places))).toBeGreaterThanOrEqual(2);
  });
});

describe("finding the listings", () => {
  const ids = (hits: { property: Property }[]) => hits.map(h => h.property.id).sort();

  it("matches exactly when it can", () => {
    const c = parseRequest("2-bedroom apartment for rent in Lusail under 12,000 QAR", places);
    const out = searchListings(catalogue, c, places);
    expect(ids(out.hits)).toEqual(["p1"]);
    expect(out.relaxed).toEqual([]);
    expect(out.total).toBe(1);
  });

  it("counts a yearly rent by the month", () => {
    expect(monthlyPrice({ price: 84000, rentalPeriod: "YEARLY" })).toBe(7000);
    const out = searchListings(catalogue, parseRequest("1 bedroom apartment for rent in Lusail under 7,500", places), places);
    expect(ids(out.hits)).toEqual(["p6"]);
  });

  it("a city includes the areas inside it, in either language", () => {
    const en = searchListings(catalogue, parseRequest("apartment for rent in Doha", places), places);
    expect(ids(en.hits)).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
    expect(ids(en.hits)).not.toContain("p4");
    const ar = searchListings(catalogue, parseRequest("شقة للإيجار في الدوحة", places), places);
    expect(ids(ar.hits)).toEqual(ids(en.hits));
    const rayyan = searchListings(catalogue, parseRequest("villa for sale in Al Rayyan", places), places);
    expect(ids(rayyan.hits)).toEqual(["p4"]);
  });

  it("loosens one thing at a time and says what", () => {
    const budget = searchListings(catalogue, parseRequest("2 bedroom apartment for rent in Lusail under 8,000", places), places);
    expect(ids(budget.hits)).toEqual(["p1"]); // 9,500 is within 25% of 8,000
    expect(budget.relaxed).toEqual(["budget"]);

    const extras = searchListings(catalogue, parseRequest("2 bedroom apartment for rent in Lusail with a pool", places), places);
    expect(ids(extras.hits)).toEqual(expect.arrayContaining(["p1", "p2"]));
    expect(extras.relaxed).toEqual(["extras"]);

    const area = searchListings(catalogue, parseRequest("villa for sale in Lusail", places), places);
    expect(ids(area.hits)).toEqual(["p4"]);
    expect(area.relaxed).toContain("area");
  });

  it("finds nothing only when nothing is close", () => {
    const out = searchListings(catalogue, parseRequest("warehouse for sale", places), places);
    expect(out.hits).toHaveLength(0);
    expect(out.relaxed).toEqual([]);
  });

  it("ranks listings with the wanted extras higher", () => {
    const out = searchListings(catalogue, parseRequest("apartment for rent in Lusail with a pool", places), places);
    expect(out.hits[0].property.id).toBe("p5");
  });

  it("never returns more than the cap, and says how many there are", () => {
    const many = Array.from({ length: 20 }, (_, i) => prop(`m${i}`, { price: 5000 + i }));
    const out = searchListings(many, parseRequest("apartment for rent in Lusail", places), places);
    expect(out.hits).toHaveLength(6);
    expect(out.total).toBe(20);
    expect(buildAnswer(parseRequest("apartment for rent in Lusail", places), out).replyEn).toContain("best 6 of 20");
  });
});

describe("follow-ups", () => {
  const first = parseRequest("2 bedroom apartment for rent in Lusail under 12,000", places);
  const lastResults = [catalogue[0]];

  it("'cheaper' lowers the budget, 'more bedrooms' raises the bedrooms, 'a different area' leaves the area", () => {
    expect(refineCriteria(first, "Show cheaper options", lastResults, places)!.maxPrice).toBe(10200);
    expect(refineCriteria(first, "أرني خيارات أرخص", lastResults, places)!.maxPrice).toBe(10200);
    const more = refineCriteria(first, "With more bedrooms", lastResults, places)!;
    expect(more.bedsMin).toBe(3);
    expect(more.bedsMax).toBeUndefined();
    const away = refineCriteria(first, "In a different area", lastResults, places)!;
    expect(away.place).toBeUndefined();
    expect(away.excludePlaces).toEqual(expect.arrayContaining(["Lusail"]));
    const out = searchListings(catalogue, away, places);
    expect(out.hits.map(h => h.property.district)).not.toContain("Lusail");
    expect(out.hits.map(h => h.property.district)).toContain("West Bay");
  });

  it("a new detail is added to the last request", () => {
    const withPool = refineCriteria(first, "with a pool", lastResults, places)!;
    expect(withPool.features).toContain("pool");
    expect(withPool.maxPrice).toBe(12000); // the rest is kept
    expect(withPool.place?.id).toBe("a-lusail");
  });

  it("a new kind of property or deal starts a new search", () => {
    const fresh = refineCriteria(first, "villas for sale in Al Rayyan", lastResults, places)!;
    expect(fresh.deal).toBe("SALE");
    expect(fresh.types).toEqual(["VILLA"]);
    expect(fresh.maxPrice).toBeUndefined(); // the old budget does not follow it
    expect(fresh.bedsMin).toBeUndefined();
  });

  it("something it cannot read is left to the model", () => {
    expect(refineCriteria(first, "thanks, that was helpful", lastResults, places)).toBeNull();
    expect(refineCriteria(parseRequest("hello", places), "cheaper", [], places)).toBeNull(); // nothing to be cheaper than
  });
});

describe("answering at once", () => {
  it("answers a clear request in both languages, with the reason for each match", () => {
    const r = answerInstantly("2-bedroom apartment for rent in Lusail under 12,000 QAR", catalogue, places)!;
    expect(r.answer.matches.map(m => m.propertyId)).toEqual(["p1"]);
    expect(r.answer.replyEn).toBe("Found 1 2-bedroom apartment for rent in Lusail up to QAR 12,000 a month. Here they are.");
    expect(r.answer.replyAr).toContain("وجدت عقاراً واحداً");
    expect(r.answer.matches[0].whyMatchEn).toBe("2 bedrooms · QAR 9,500/month · Lusail · within your budget");
    expect(r.answer.matches[0].whyMatchAr).toContain("ضمن ميزانيتك");
  });

  it("says plainly when it had to loosen something", () => {
    const r = answerInstantly("2 bedroom apartment for rent in Lusail under 8,000", catalogue, places)!;
    expect(r.answer.replyEn).toContain("loosened the budget");
    expect(r.answer.replyAr).toContain("خففت الميزانية");
  });

  it("says plainly when there is nothing, and what to try", () => {
    const r = answerInstantly("warehouse for sale", catalogue, places)!;
    expect(r.answer.matches).toHaveLength(0);
    expect(r.answer.replyEn).toContain("wider budget");
    expect(r.answer.replyAr).toContain("ميزانية أوسع");
  });

  it("hands a request it cannot read to the model", () => {
    expect(answerInstantly("what is the best area for families?", catalogue, places)).toBeNull();
  });

  it("uses what the chat remembers for the next message", () => {
    const first = answerInstantly("2 bedroom apartment for rent in Doha under 10,000", catalogue, places)!;
    expect(first.answer.matches.map(m => m.propertyId).sort()).toEqual(["p1", "p3"]); // 9,500 and 8,000
    const memory = { criteria: first.criteria, ids: first.answer.matches.map(m => m.propertyId), at: Date.now() };
    const next = answerInstantly("cheaper please", catalogue, places, memory)!;
    expect(next.criteria.maxPrice).toBe(8500); // 15% under 10,000
    expect(next.answer.matches.map(m => m.propertyId)).toEqual(["p3"]); // only the 8,000 one fits
  });

  it("is fast: a thousand listings in well under 50 milliseconds", () => {
    const big = Array.from({ length: 1000 }, (_, i) => prop(`b${i}`, { price: 3000 + (i % 40) * 250, district: i % 2 ? "Lusail" : "West Bay", bedrooms: i % 5 }));
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) answerInstantly("2 bedroom apartment for rent in Lusail under 8,000", big, places);
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });
});

describe("the chat's memory", () => {
  it("forgets the oldest when full and what is too old", () => {
    const store = new ChatMemoryStore(3, 1000);
    const c = { features: [] };
    for (const id of ["a", "b", "c", "d"]) store.set(id, { criteria: c, ids: [] }, 0);
    expect(store.size).toBe(3);
    expect(store.get("a", 0)).toBeUndefined();
    expect(store.get("d", 500)).toBeDefined();
    expect(store.get("d", 2000)).toBeUndefined(); // expired
    expect(store.get(undefined)).toBeUndefined();
  });
});
