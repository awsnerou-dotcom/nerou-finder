import { describe, it, expect } from "vitest";
import type { Property } from "../../src/types.js";
import { buildTwin, isRentType, twinTransactionType, validateTwinRequest } from "../../src/lib/twinListing.js";

const NOW = new Date("2026-11-19T09:00:00Z");
function listing(over: Record<string, unknown> = {}): Property {
  return {
    id: "p-src", listingId: "N-11111", title: "Bright 2-bedroom in Lusail", titleAr: "شقة غرفتين في لوسيل", description: "A bright home.", descriptionAr: "منزل مشرق.",
    propertyType: "APARTMENT", transactionType: "FOR_SALE", price: 2_400_000, currency: "QAR", area: 110, sizeUnit: "SQM", city: "Doha", district: "Lusail",
    latitude: 25.4, longitude: 51.5, exactLocation: true, bedrooms: 2, bathrooms: 2, furnished: "YES", parking: true, amenities: ["Pool", "Gym"],
    images: ["/a.jpg", "/b.jpg"], agentId: "agent-1", orgId: "org-1", verificationStatus: "APPROVED", listingStatus: "PUBLISHED", qualityScore: 90,
    createdDate: "2026-01-01T00:00:00Z", updatedDate: "2026-02-01T00:00:00Z", priceHistory: [{ price: 2_500_000, date: "2026-01-01" }, { price: 2_400_000, date: "2026-02-01" }],
    views: 120, uniqueViews: 80, viewsByDay: { "2026-02-01": 4 }, savedCount: 3, floorNumber: 12, unitNumber: "1204", buildingName: "Tower A", tenureType: "FREEHOLD",
    sourceFeedId: "feed-1", externalListingId: "ext-9", isFeedImported: true, ...over
  } as unknown as Property;
}
const input = { price: 9500, id: "p-twin", listingId: "N-22222", now: NOW };

describe("which listings can be offered the other way", () => {
  it("a sale becomes a letting and back, commercial too; off-plan and land have no other way", () => {
    expect(twinTransactionType("FOR_SALE")).toBe("FOR_RENT");
    expect(twinTransactionType("FOR_RENT")).toBe("FOR_SALE");
    expect(twinTransactionType("COMMERCIAL_SALE")).toBe("COMMERCIAL_LEASE");
    expect(twinTransactionType("COMMERCIAL_LEASE")).toBe("COMMERCIAL_SALE");
    expect(twinTransactionType("OFF_PLAN")).toBeNull();
    expect(twinTransactionType("LAND_SALE")).toBeNull();
    expect(isRentType("FOR_RENT")).toBe(true);
    expect(isRentType("FOR_SALE")).toBe(false);
  });
});

describe("checking the request", () => {
  const ok = { transactionType: "FOR_SALE" } as Pick<Property, "transactionType" | "twinId">;
  it("accepts a positive price, and a known rental period", () => {
    expect(validateTwinRequest(ok, { price: 9500 })).toBeNull();
    expect(validateTwinRequest(ok, { price: "9,500".replace(",", ""), rentalPeriod: "YEARLY" })).toBeNull();
  });
  it("refuses a missing, zero, negative, silly or non-numeric price", () => {
    for (const price of [undefined, null, "", 0, -5, "abc", Infinity, 1e12]) expect(validateTwinRequest(ok, { price }), String(price)).toMatch(/price/i);
  });
  it("refuses an unknown rental period, a second twin, and a kind that has no other way", () => {
    expect(validateTwinRequest(ok, { price: 1, rentalPeriod: "FOREVER" })).toMatch(/rental period/i);
    expect(validateTwinRequest({ ...ok, twinId: "x" }, { price: 1 })).toMatch(/already/i);
    expect(validateTwinRequest({ transactionType: "OFF_PLAN" } as never, { price: 1 })).toMatch(/cannot also/i);
  });
});

describe("the second listing", () => {
  it("copies the unit and changes only the offer: deal, price, rent period, dates, a fresh history, linked back", () => {
    const t = buildTwin(listing(), input);
    expect(t).toMatchObject({
      id: "p-twin", listingId: "N-22222", transactionType: "FOR_RENT", price: 9500, rentalPeriod: "MONTHLY", currency: "QAR",
      title: "Bright 2-bedroom in Lusail", titleAr: "شقة غرفتين في لوسيل", description: "A bright home.", district: "Lusail", city: "Doha",
      area: 110, bedrooms: 2, bathrooms: 2, floorNumber: 12, unitNumber: "1204", buildingName: "Tower A", latitude: 25.4, longitude: 51.5, exactLocation: true,
      agentId: "agent-1", orgId: "org-1", twinId: "p-src", listingStatus: "PUBLISHED", verificationStatus: "APPROVED", qualityScore: 90
    });
    expect(t.images).toEqual(["/a.jpg", "/b.jpg"]);
    expect(t.amenities).toEqual(["Pool", "Gym"]);
    expect(t.priceHistory).toEqual([{ price: 9500, date: "2026-11-19" }]);
    expect(t.createdDate).toBe(NOW.toISOString());
    expect(t.lastConfirmedAvailableDate).toBe(NOW.toISOString());
  });

  it("does not carry one offer's numbers into the other: views, saves, feed links, sale-only terms", () => {
    const t = buildTwin(listing(), input);
    for (const k of ["views", "uniqueViews", "viewsByDay", "savedCount", "sourceFeedId", "externalListingId", "isFeedImported", "tenureType"]) {
      expect((t as unknown as Record<string, unknown>)[k], k).toBeUndefined();
    }
  });

  it("a sale made from a letting leaves the letting terms behind", () => {
    const rent = listing({ transactionType: "FOR_RENT", price: 9000, rentalPeriod: "MONTHLY", deposit: 9000, cheques: 4, contractLength: "12 months", commissions: 1 });
    const t = buildTwin(rent, { ...input, price: 2_300_000 });
    expect(t.transactionType).toBe("FOR_SALE");
    expect(t.rentalPeriod).toBeUndefined();
    for (const k of ["deposit", "cheques", "contractLength", "commissions"]) expect((t as unknown as Record<string, unknown>)[k], k).toBeUndefined();
  });

  it("takes the period given for a letting, defaults to monthly, and gives a sale none", () => {
    expect(buildTwin(listing(), { ...input, rentalPeriod: "YEARLY" }).rentalPeriod).toBe("YEARLY");
    expect(buildTwin(listing(), input).rentalPeriod).toBe("MONTHLY");
    expect(buildTwin(listing({ transactionType: "FOR_RENT", rentalPeriod: "YEARLY" }), { ...input, rentalPeriod: "YEARLY" }).rentalPeriod).toBeUndefined();
  });

  it("a listing that is not live gives a draft, so each offer is published on purpose", () => {
    for (const status of ["DRAFT", "PAUSED", "SOLD", "RENTED"]) {
      const t = buildTwin(listing({ listingStatus: status }), input);
      expect(t.listingStatus, status).toBe("DRAFT");
      expect(t.verificationStatus, status).toBe("PENDING");
    }
  });

  it("does not change the listing it was made from", () => {
    const src = listing();
    const before = JSON.stringify(src);
    buildTwin(src, input);
    expect(JSON.stringify(src)).toBe(before);
  });

  it("refuses a listing with no other way", () => {
    expect(() => buildTwin(listing({ transactionType: "OFF_PLAN" }), input)).toThrow();
  });
});
