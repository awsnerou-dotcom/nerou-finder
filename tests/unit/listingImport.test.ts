import { describe, it, expect } from "vitest";
import {
  csvToRecords, detectFormat, flattenRecord, importTemplateCsv, jsonToRecords, normalizeImportRow, readImportRecords, xmlTreeToRecords, IMPORT_MAX_ROWS
} from "../../src/lib/listingImport.js";

const places = [
  { id: "m-doha", name: "Doha", nameAr: "الدوحة", type: "MUNICIPALITY" },
  { id: "a-lusail", name: "Lusail", nameAr: "لوسيل", type: "AREA", parentId: "m-doha" },
  { id: "a-westbay", name: "West Bay", nameAr: "الخليج الغربي", type: "AREA", parentId: "m-doha" },
  { id: "m-rayyan", name: "Al Rayyan", nameAr: "الريان", type: "MUNICIPALITY" },
  { id: "a-sailiya", name: "Al Sailiya", nameAr: "السيلية", type: "AREA", parentId: "m-rayyan" }
];

const row = (r: Record<string, unknown>) => normalizeImportRow(r, places);
const ok = (r: Record<string, unknown>) => {
  const x = row(r);
  if ("reason" in x) throw new Error(`expected a listing, got: ${x.reason}`);
  return x.listing;
};
const reason = (r: Record<string, unknown>) => { const x = row(r); return "reason" in x ? x.reason : "ok"; };

describe("a spreadsheet row, in English", () => {
  const listing = ok({ reference: "A-101", title: "2BR flat in Lusail", type: "apartment", for: "rent", price: "8,500", size_sqm: "120", bedrooms: "2", bathrooms: "2", area: "Lusail", furnished: "yes", description: "Bright flat. Call 5551 2345", photos: "https://x.qa/1.jpg|https://x.qa/2.jpg" });
  it("reads every field", () => {
    expect(listing).toMatchObject({ externalId: "A-101", title: "2BR flat in Lusail", propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 8500, area: 120, bedrooms: 2, bathrooms: 2, city: "Doha", district: "Lusail", furnishing: "FULLY_FURNISHED" });
    expect(listing.images).toEqual(["https://x.qa/1.jpg", "https://x.qa/2.jpg"]);
  });
  it("is complete, removes the phone number and says so", () => {
    expect(listing.complete).toBe(true);
    expect(listing.description).not.toMatch(/5551|2345/);
    expect(listing.notes.join(" ")).toMatch(/removed/);
  });
});

describe("a spreadsheet row, in Arabic", () => {
  it("understands Arabic column names, digits and words", () => {
    const l = ok({ "رقم الاعلان": "55", "العنوان": "شقة في السيلية", "نوع العقار": "شقة", "الغرض": "للايجار", "السعر": "١٢٠٠٠", "المساحة": "١٦٠", "عدد الغرف": "٣", "عدد الحمامات": "٣", "المنطقة": "السيلية" });
    expect(l).toMatchObject({ externalId: "55", propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 12000, area: 160, bedrooms: 3, bathrooms: 3, district: "Al Sailiya", city: "Al Rayyan" });
  });
});

describe("prices", () => {
  const base = { type: "apartment", for: "rent", size: "100", bedrooms: "2", bathrooms: "2", area: "Lusail" };
  it("brings a yearly rent to a month, saying so", () => {
    const l = ok({ ...base, price: "96000", rentalperiod: "yearly" });
    expect(l.price).toBe(8000);
    expect(l.notes.join(" ")).toMatch(/Yearly rent converted/);
  });
  it("divides a rent that looks yearly but is not labelled, and says to check it", () => {
    const l = ok({ ...base, price: "96000" });
    expect(l.price).toBe(8000);
    expect(l.notes.join(" ")).toMatch(/check it/);
  });
  it("leaves a monthly rent and a sale price as they are", () => {
    expect(ok({ ...base, price: "9000" }).price).toBe(9000);
    expect(ok({ ...base, for: "sale", price: "1,250,000" }).price).toBe(1_250_000);
  });
  it("rejects a missing or silly price", () => {
    expect(reason({ ...base })).toMatch(/price/i);
    expect(reason({ ...base, price: "abc" })).toMatch(/price/i);
    expect(reason({ ...base, price: "0" })).toMatch(/price/i);
  });
});

describe("portal codes and unit conversion", () => {
  it("reads Property Finder style codes and nested price fields", () => {
    const l = ok({ reference_number: "PF-9", offering_type: "RR", property_type: "AP", price: { yearly: "84000" }, size: "1300", bedroom: "2", bathroom: "2", community: "West Bay", title_en: "Sea view flat", description_en: "Nice.", photo: { url: ["https://x.qa/a.jpg", "https://x.qa/b.jpg"] } });
    expect(l).toMatchObject({ externalId: "PF-9", transactionType: "FOR_RENT", propertyType: "APARTMENT", price: 7000, district: "West Bay", city: "Doha" });
    expect(l.images).toHaveLength(2);
  });
  it("converts square feet", () => {
    const l = ok({ type: "apartment", for: "sale", price: "900000", sqft: "1300", bedrooms: "2", bathrooms: "2", area: "Lusail" });
    expect(l.area).toBe(120.8);
    expect(l.notes.join(" ")).toMatch(/square feet/);
  });
  it("treats a numeric 'area' column as the size and a text one as the place", () => {
    expect(ok({ type: "villa", for: "sale", price: "4000000", area: "450", district: "Lusail", bedrooms: "5", bathrooms: "6" })).toMatchObject({ area: 450, district: "Lusail" });
    expect(ok({ type: "villa", for: "sale", price: "4000000", size: "450", area: "West Bay", bedrooms: "5", bathrooms: "6" })).toMatchObject({ area: 450, district: "West Bay" });
  });
  it("makes a studio a studio with no bedrooms", () => {
    expect(ok({ type: "apartment", title: "Studio flat", for: "rent", price: "4000", size: "40", area: "Lusail" })).toMatchObject({ propertyType: "STUDIO", bedrooms: 0 });
  });
});

describe("what makes a row incomplete or unusable", () => {
  const base = { type: "apartment", for: "rent", price: "8000", area: "Lusail", bedrooms: "2", bathrooms: "2" };
  it("is incomplete without a size, an area we know or bedrooms: it can only be a draft", () => {
    expect(ok({ ...base }).complete).toBe(false); // no size
    const noBeds = ok({ ...base, size: "100", bedrooms: "" });
    expect(noBeds.complete).toBe(false);
    expect(noBeds.notes.join(" ")).toMatch(/bedroom/);
    const unknown = ok({ ...base, size: "100", area: "Nowhereville" });
    expect(unknown.complete).toBe(false);
    expect(unknown.district).toBe("Nowhereville");
    expect(unknown.notes.join(" ")).toMatch(/not on our list/);
    expect(ok({ ...base, size: "100" }).complete).toBe(true);
  });
  it("does not need bedrooms for land", () => {
    expect(ok({ type: "land", for: "sale", price: "2000000", size: "600", area: "Lusail" }).complete).toBe(true);
  });
  it("rejects rows with no deal, no type or no area, with a plain reason", () => {
    expect(reason({ type: "apartment", price: "8000", area: "Lusail" })).toMatch(/rent or for sale/);
    expect(reason({ for: "rent", price: "8000", area: "Lusail" })).toMatch(/property type/);
    expect(reason({ type: "apartment", for: "rent", price: "8000" })).toMatch(/area/);
  });
  it("writes a title and a description when the sheet has none", () => {
    const l = ok({ ...base, size: "100" });
    expect(l.title).toBe("2-bedroom apartment for rent in Lusail");
    expect(l.description.length).toBeGreaterThan(10);
  });
  it("keeps only http(s) photo links, at most eight", () => {
    const l = ok({ ...base, size: "100", photos: ["javascript:alert(1)", "ftp://x/a.jpg", ...Array.from({ length: 12 }, (_, i) => `https://x.qa/${i}.jpg`)].join("|") });
    expect(l.images).toHaveLength(8);
    expect(l.images.every(u => u.startsWith("https://"))).toBe(true);
  });
  it("gives a row without a reference a stable one, so re-importing updates instead of duplicating", () => {
    const a = ok({ ...base, size: "100" });
    const b = ok({ ...base, size: "100" });
    expect(a.externalId).toMatch(/^auto-/);
    expect(a.externalId).toBe(b.externalId);
    expect(ok({ ...base, size: "100", price: "8100" }).externalId).not.toBe(a.externalId);
  });
});

describe("whole files and feeds", () => {
  it("detects the format", () => {
    expect(detectFormat("﻿reference,title\n1,a")).toBe("csv");
    expect(detectFormat("  [ {\"a\":1} ]")).toBe("json");
    expect(detectFormat("<?xml version=\"1.0\"?><list/>")).toBe("xml");
  });

  it("reads a CSV including quoted commas and the semicolons Excel uses", () => {
    const comma = csvToRecords('reference,title,type,for,price\nA1,"Flat, sea view",apartment,rent,8000\n');
    expect(comma[0]).toMatchObject({ reference: "A1", title: "Flat, sea view" });
    const semi = csvToRecords("reference;title;type;for;price\nA1;Flat;apartment;rent;8000\n");
    expect(semi[0]).toMatchObject({ reference: "A1", price: "8000" });
    expect(csvToRecords("only a header\n")).toEqual([]);
  });

  it("reads a JSON array or an object that holds one", () => {
    expect(jsonToRecords('[{"a":1},{"a":2}]')).toHaveLength(2);
    expect(jsonToRecords('{"properties":[{"a":1}]}')).toHaveLength(1);
    expect(() => jsonToRecords('{"x":1}')).toThrow(/not a list/);
    expect(() => jsonToRecords("not json")).toThrow();
  });

  it("finds the listings in a parsed XML tree and flattens nested values", () => {
    const tree = { list: { property: [
      { reference_number: "1", price: { yearly: "84000" }, photo: { url: [{ "#text": "https://x.qa/1.jpg", "@_watermark": "no" }, { "#text": "https://x.qa/2.jpg" }] }, "@_id": "7" },
      { reference_number: "2", price: { yearly: "90000" } }
    ] } };
    const recs = xmlTreeToRecords(tree);
    expect(recs).toHaveLength(2);
    const flat = flattenRecord(recs[0]);
    expect(flat.price_yearly).toBe("84000");
    expect(flat.photo_url).toEqual(["https://x.qa/1.jpg", "https://x.qa/2.jpg"]);
    expect(flat["@_id"]).toBeUndefined();
    expect(flat.id).toBeUndefined(); // an attribute is not listing data
  });

  it("reads a feed with a single listing", () => {
    expect(xmlTreeToRecords({ list: { property: { reference_number: "1" } } })).toHaveLength(1);
  });

  it("counts usable rows, lists the skipped ones with reasons, and drops repeats", () => {
    const records = [
      { reference: "A", type: "apartment", for: "rent", price: "8000", area: "Lusail", size: "100", bedrooms: "2", bathrooms: "2" },
      { reference: "B", type: "apartment", for: "rent", area: "Lusail" },
      { reference: "A", type: "apartment", for: "rent", price: "9000", area: "Lusail" },
      { type: "villa", for: "sale", price: "4000000", area: "West Bay", size: "400", bedrooms: "5", bathrooms: "5" }
    ];
    const r = readImportRecords(records, places, "csv");
    expect(r.listings.map(l => l.externalId)[0]).toBe("A");
    expect(r.listings).toHaveLength(2);
    expect(r.skipped).toEqual([
      { row: 2, reason: "Missing or invalid price." },
      { row: 3, reason: "Repeats the reference A from an earlier row." }
    ]);
    expect(r.total).toBe(4);
    expect(r.truncated).toBe(false);
  });

  it("stops at the row cap and says so", () => {
    const many = Array.from({ length: IMPORT_MAX_ROWS + 20 }, (_, i) => ({ reference: `R${i}`, type: "apartment", for: "rent", price: "8000", area: "Lusail" }));
    const r = readImportRecords(many, places, "csv");
    expect(r.listings).toHaveLength(IMPORT_MAX_ROWS);
    expect(r.truncated).toBe(true);
    expect(r.total).toBe(IMPORT_MAX_ROWS + 20);
  });

  it("the template we give out reads back cleanly", () => {
    const r = readImportRecords(csvToRecords(importTemplateCsv()), places, "csv");
    expect(r.skipped).toEqual([]);
    expect(r.listings).toHaveLength(1);
    expect(r.listings[0]).toMatchObject({ externalId: "A-101", propertyType: "APARTMENT", transactionType: "FOR_RENT", price: 8500, area: 120, district: "Lusail", complete: true });
    expect(r.listings[0].images).toHaveLength(2);
  });
});
