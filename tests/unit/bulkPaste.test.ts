import { describe, it, expect } from "vitest";
import type { PlaceRef } from "../../src/lib/listingFromText.js";
import { adCode, adsToImportRecords } from "../../src/lib/bulkPaste.js";
import { readImportContent } from "../../src/lib/listingImport.js";

const places: PlaceRef[] = [
  { id: "m-doha", name: "Doha", nameAr: "الدوحة", type: "MUNICIPALITY" },
  { id: "a-lusail", name: "Lusail", nameAr: "لوسيل", type: "AREA", parentId: "m-doha" },
  { id: "m-rayyan", name: "Al Rayyan", nameAr: "الريان", type: "MUNICIPALITY" },
  { id: "a-waab", name: "Al Waab", nameAr: "الوعب", type: "AREA", parentId: "m-rayyan" }
];

const AD_EN = "2 bedroom apartment for rent in Lusail\n8,500 QAR per month\n120 sqm, furnished\nCall 5555 1234";
const AD_AR = "فيلا للبيع في الوعب\n5 غرف نوم 4 حمامات\nالسعر 4.5 مليون\nالمساحة 600 متر";
const AD_YEARLY = "شقة للايجار في لوسيل\nالايجار 96,000 ريال سنويا";
const JUNK = "Hello everyone, welcome to my page and thank you for following us";
const text = [AD_EN, AD_AR, JUNK, AD_EN, AD_YEARLY].join("\n---\n");

describe("a paste of many ads", () => {
  const out = adsToImportRecords(text, places);

  it("finds every ad, keeps the usable ones and says why it left the others out", () => {
    expect(out.found).toBe(5);
    expect(out.records).toHaveLength(3);
    expect(out.skipped.map(s => s.index).sort()).toEqual([3, 4]);
    expect(out.skipped.find(s => s.index === 3)!.reason).toMatch(/no price/);
    expect(out.skipped.find(s => s.index === 4)!.reason).toMatch(/twice/);
  });

  it("reads each ad into the columns a file import uses", () => {
    const [en] = out.records;
    expect(en).toMatchObject({ transaction: "rent", type: "APARTMENT", price: 8500, size: 120, bedrooms: 2, city: "Doha", district: "Lusail", furnished: "furnished" });
    expect(String(en.description)).not.toContain("5555"); // the phone number is not carried into the listing
    const villa = out.records[1];
    expect(villa).toMatchObject({ transaction: "sale", type: "VILLA", price: 4_500_000, size: 600, bedrooms: 5, bathrooms: 4, district: "Al Waab", city: "Al Rayyan" });
  });

  it("gives a yearly rent as the monthly figure the platform shows", () => {
    expect(out.records[2]).toMatchObject({ transaction: "rent", price: 8000 });
  });

  it("gives the same ad the same code, so pasting it again updates it instead of adding a second one", () => {
    expect(adCode(AD_EN)).toBe(adCode(`  ${AD_EN.toUpperCase()}  `));
    expect(adCode(AD_EN)).not.toBe(adCode(AD_AR));
    const again = adsToImportRecords(AD_EN, places);
    expect(again.records[0].id).toBe(out.records[0].id);
  });

  it("goes through the same reader as a file: complete ads are ready, the one without bedrooms needs details", () => {
    const read = readImportContent(JSON.stringify(out.records), places);
    expect(read.format).toBe("json");
    expect(read.skipped).toEqual([]);
    expect(read.listings).toHaveLength(3);
    const [en, villa, yearly] = read.listings;
    expect(en).toMatchObject({ transactionType: "FOR_RENT", propertyType: "APARTMENT", price: 8500, area: 120, bedrooms: 2, district: "Lusail", city: "Doha", furnishing: "FULLY_FURNISHED", complete: true });
    expect(villa).toMatchObject({ transactionType: "FOR_SALE", propertyType: "VILLA", price: 4_500_000, complete: true });
    expect(yearly.complete).toBe(false); // no bedrooms, no size: a draft to finish
    expect(en.externalId).toBe(out.records[0].id);
  });

  it("handles a single ad with no separators, an empty paste and too many ads", () => {
    expect(adsToImportRecords(AD_EN, places).records).toHaveLength(1);
    expect(adsToImportRecords("", places)).toEqual({ records: [], found: 0, skipped: [] });
    expect(adsToImportRecords("hi", places).found).toBe(0);
    const many = Array.from({ length: 5 }, (_, i) => `${i + 2} bedroom apartment for rent in Lusail ${7000 + i * 500} QAR`).join("\n---\n");
    const capped = adsToImportRecords(many, places, 3);
    expect(capped.records).toHaveLength(3);
    expect(capped.skipped.some(s => /first 3/.test(s.reason))).toBe(true);
  });
});
