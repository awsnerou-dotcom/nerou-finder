import { describe, it, expect } from "vitest";
import { foldText, matchPlace, normalizeDigits, parseListingText, splitAds, stripContact } from "../../src/lib/listingFromText.js";

const places = [
  { id: "m-doha", name: "Doha", nameAr: "الدوحة", type: "MUNICIPALITY" },
  { id: "m-rayyan", name: "Al Rayyan", nameAr: "الريان", type: "MUNICIPALITY" },
  { id: "a-lusail", name: "Lusail", nameAr: "لوسيل", type: "AREA", parentId: "m-doha" },
  { id: "a-pearl", name: "The Pearl-Qatar", nameAr: "اللؤلؤة", type: "AREA", parentId: "m-doha" },
  { id: "d-porto", name: "Porto Arabia", nameAr: "بورتو أرابيا", type: "DISTRICT", parentId: "a-pearl" },
  { id: "a-westbay", name: "West Bay", nameAr: "الخليج الغربي", type: "AREA", parentId: "m-doha" },
  { id: "a-sailiya", name: "Al Sailiya", nameAr: "السيلية", type: "AREA", parentId: "m-rayyan" }
];

describe("reading numbers and letters", () => {
  it("turns Arabic digits into ordinary ones", () => {
    expect(normalizeDigits("٧٥٠٠ ر.ق و ١٢٠ م²")).toBe("7500 ر.ق و 120 م²");
    expect(normalizeDigits("١٬٢٠٠٬٠٠٠")).toBe("1,200,000");
  });
  it("compares Arabic spellings loosely", () => {
    expect(foldText("شقة للإيجار في أللؤلؤة")).toBe(foldText("شقه للايجار في اللؤلؤه"));
  });
});

describe("an English ad", () => {
  const ad = "Luxury 2BR apartment for rent in West Bay. 120 sqm, 2 bathrooms, fully furnished. QAR 9,500 per month. Call 5551 2345";
  const p = parseListingText(ad, places);
  it("finds the deal, type, bedrooms, bathrooms, price, size and furnishing", () => {
    expect(p).toMatchObject({ transaction: "FOR_RENT", propertyType: "APARTMENT", bedrooms: 2, bathrooms: 2, price: 9500, areaSqm: 120, furnishing: "FULLY_FURNISHED" });
  });
  it("matches the place to the platform's own and its municipality", () => {
    expect(p).toMatchObject({ placeId: "a-westbay", placeName: "West Bay", municipalityId: "m-doha" });
  });
  it("writes a title and removes the phone number from the description", () => {
    expect(p.title).toBe("2-bedroom apartment for rent in West Bay");
    expect(p.description).not.toMatch(/5551|2345/);
    expect(p.removedContact).toBe(true);
    expect(p.found).toEqual(expect.arrayContaining(["transaction", "propertyType", "bedrooms", "bathrooms", "price", "area", "furnishing", "place"]));
  });
});

describe("an Arabic ad", () => {
  const ad = "شقة للايجار في لوسيل\n٣ غرف نوم و٣ حمامات\nالمساحة ١٦٠ متر\nالسعر ١٢٠٠٠ ريال شهريا\nمفروشة بالكامل\nللتواصل ٥٥٥٥١٢٣٤";
  const p = parseListingText(ad, places);
  it("reads Arabic words and digits", () => {
    expect(p).toMatchObject({ transaction: "FOR_RENT", propertyType: "APARTMENT", bedrooms: 3, bathrooms: 3, price: 12000, areaSqm: 160, furnishing: "FULLY_FURNISHED", placeId: "a-lusail", municipalityId: "m-doha" });
  });
  it("removes the phone number and says so", () => {
    expect(p.description).not.toMatch(/5555|١٢٣٤/);
    expect(p.removedContact).toBe(true);
  });
  it("reads a number written as a word", () => {
    expect(parseListingText("شقة للايجار غرفتين وصالة", places).bedrooms).toBe(2);
    expect(parseListingText("فيلا للبيع اربع غرف", places).bedrooms).toBe(4);
    expect(parseListingText("two bedroom flat to let", places).bedrooms).toBe(2);
  });
});

describe("prices", () => {
  const price = (t: string) => parseListingText(t, places).price;
  it("reads thousands and millions in both languages", () => {
    expect(price("Villa for sale QAR 4.5 million")).toBe(4_500_000);
    expect(price("فيلا للبيع بسعر ٣ مليون ريال")).toBe(3_000_000);
    expect(price("Flat for rent 7.5k QAR")).toBe(7500);
    expect(price("شقة للايجار ٦ الف ريال")).toBe(6000);
    expect(price("Price: 1,250,000")).toBe(1_250_000);
  });
  it("does not mistake a phone number for a price", () => {
    expect(price("Flat for rent. Call 55512345")).toBeUndefined();
    expect(price("Flat for rent +974 5551 2345 QAR 6000")).toBe(6000);
  });
  it("brings a yearly rent to a month and keeps the written figure", () => {
    const p = parseListingText("Apartment for rent QAR 96,000 yearly", places);
    expect(p).toMatchObject({ price: 96000, monthlyRent: 8000 });
    expect(parseListingText("Apartment for rent QAR 8,000 monthly", places).monthlyRent).toBeUndefined();
  });
});

describe("sizes and types", () => {
  it("converts square feet", () => {
    expect(parseListingText("Apartment for rent 1300 sqft", places).areaSqm).toBe(120.8);
  });
  it("picks the most specific type", () => {
    expect(parseListingText("Penthouse apartment for sale", places).propertyType).toBe("PENTHOUSE");
    expect(parseListingText("Studio apartment for rent", places)).toMatchObject({ propertyType: "STUDIO", bedrooms: 0 });
    expect(parseListingText("تاون هاوس للبيع", places).propertyType).toBe("TOWNHOUSE");
    expect(parseListingText("Land for sale 600 sqm", places).propertyType).toBe("LAND");
  });
  it("separates semi, un- and fully furnished", () => {
    expect(parseListingText("semi-furnished flat for rent", places).furnishing).toBe("SEMI_FURNISHED");
    expect(parseListingText("غير مفروش شقة للايجار", places).furnishing).toBe("UNFURNISHED");
    expect(parseListingText("furnished flat for rent", places).furnishing).toBe("FULLY_FURNISHED");
  });
  it("tells rent from sale by what comes first when both words appear", () => {
    expect(parseListingText("For sale: flat (not for rent)", places).transaction).toBe("FOR_SALE");
    expect(parseListingText("For rent: flat, no sale", places).transaction).toBe("FOR_RENT");
  });
});

describe("places", () => {
  it("prefers the district inside an area and the longer name", () => {
    const m = matchPlace("Apartment in Porto Arabia, The Pearl", places);
    expect(m?.place.id).toBe("d-porto");
    expect(m?.municipalityId).toBe("m-doha");
  });
  it("matches Arabic names, and a municipality in another city", () => {
    expect(matchPlace("شقة في اللؤلؤة", places)?.place.id).toBe("a-pearl");
    expect(matchPlace("Villa in Al Sailiya", places)).toMatchObject({ place: { id: "a-sailiya" }, municipalityId: "m-rayyan" });
  });
  it("does not match a name inside another word, and finds nothing for an unknown place", () => {
    expect(matchPlace("Villa in Lusailia", places)).toBeUndefined();
    expect(matchPlace("Flat in Nowhereville", places)).toBeUndefined();
  });
});

describe("when only the city is named", () => {
  it("reports the municipality as the place type, so the form leaves the area to the agent", () => {
    const p = parseListingText("Villa for sale in Doha 4M QAR", places);
    expect(p).toMatchObject({ placeType: "MUNICIPALITY", placeId: "m-doha", municipalityId: "m-doha" });
  });
  it("reports an area as such", () => {
    expect(parseListingText("Flat for rent in Lusail", places)).toMatchObject({ placeType: "AREA", placeId: "a-lusail" });
  });
});

describe("nothing is invented", () => {
  it("leaves out what the text does not say and falls back to its first line for the title", () => {
    const p = parseListingText("Nice place, call me", places);
    expect(p.found).toEqual([]);
    expect(p.price).toBeUndefined();
    expect(p.title).toBe("Nice place, call me");
  });
  it("handles an empty paste", () => {
    expect(parseListingText("", places)).toMatchObject({ found: [], description: "", title: "" });
  });
});

describe("contact details and several ads", () => {
  it("removes phone numbers, e-mails and links but keeps the rest", () => {
    const r = stripContact("Lovely flat. WhatsApp +974 5551 2345 or mail me@x.qa or see https://x.qa/p/1\nQuiet building.");
    expect(r.removed).toBe(true);
    expect(r.text).toContain("Lovely flat.");
    expect(r.text).toContain("Quiet building.");
    expect(r.text).not.toMatch(/5551|me@x|https/);
    expect(stripContact("Nothing private here").removed).toBe(false);
  });
  it("keeps numbers that are not phones, such as a price", () => {
    expect(stripContact("Rent 7500 QAR, 120 sqm").text).toBe("Rent 7500 QAR, 120 sqm");
  });
  it("splits a paste of several ads on dashes or blank lines", () => {
    expect(splitAds("Flat one for rent in Lusail 7000 QAR\n\n\nFlat two for sale in West Bay 1.2M QAR")).toHaveLength(2);
    expect(splitAds("Flat one for rent in Lusail 7000 QAR\n----\nFlat two for sale in West Bay 1.2M QAR\n---\nFlat three for rent in Doha")).toHaveLength(3);
    expect(splitAds("Flat one for rent\nstill the same ad, with a second line")).toHaveLength(1);
    expect(splitAds("hi")).toEqual([]);
  });
});
