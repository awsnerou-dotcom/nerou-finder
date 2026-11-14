import { describe, it, expect } from "vitest";
import {
  bedroomsLabel, buildPriceReports, findReport, parseReportPath, qar, reportPath, reportText, roundedFigure
} from "../../src/lib/priceReports.js";

let n = 0;
const listing = (district: string, price: number, over: Record<string, unknown> = {}) => ({
  id: `p${n++}`, title: ` ${district} flat `, price, area: 100, bedrooms: 2, propertyType: "APARTMENT", transactionType: "FOR_RENT", rentalPeriod: "MONTHLY",
  city: "Doha", district, listingStatus: "PUBLISHED", verificationStatus: "APPROVED", createdDate: "2026-10-01T00:00:00Z", updatedDate: "2026-11-10T00:00:00Z", ...over
}) as never;

const lusail = [6000, 7000, 8000, 9000, 10000].map(p => listing("Lusail", p));
const sadd = [4000, 4500, 5000].map(p => listing("Al Sadd", p));
const few = [listing("Wakrah", 3000), listing("Wakrah", 3200)];
const all = [...lusail, ...sadd, ...few];

describe("which pages exist", () => {
  it("makes a rent report for each area with enough live listings, plus one for the whole country", () => {
    const reports = buildPriceReports(all);
    const rent = reports.filter(r => r.deal === "RENT");
    expect(rent.map(r => r.slug).sort()).toEqual(["al-sadd", "lusail", "qatar"]);
    expect(findReport(reports, "RENT", "wakrah")).toBeUndefined(); // two listings: too few to say anything
    expect(reports.filter(r => r.deal === "SALE")).toEqual([]);
  });

  it("only counts live, approved listings, and keeps rent and sale apart", () => {
    const noise = [listing("Lusail", 1, { listingStatus: "DRAFT" }), listing("Lusail", 1, { verificationStatus: "PENDING" })];
    const sales = [1_000_000, 1_100_000, 1_200_000].map(p => listing("Lusail", p, { transactionType: "FOR_SALE", rentalPeriod: undefined }));
    const reports = buildPriceReports([...lusail, ...noise, ...sales]);
    expect(findReport(reports, "RENT", "lusail")?.count).toBe(5);
    expect(findReport(reports, "SALE", "lusail")).toMatchObject({ count: 3, median: 1_100_000 });
  });

  it("works out the typical figure, the usual range and the extremes from real prices", () => {
    const r = findReport(buildPriceReports(all), "RENT", "lusail")!;
    expect(r).toMatchObject({ count: 5, median: 8000, average: 8000, p25: 7000, p75: 9000, min: 6000, max: 10000, scope: "area", district: "Lusail", city: "Doha" });
    expect(r.medianPerSqm).toBe(80);
    expect(r.cheapest.map(c => c.price)).toEqual([6000, 7000, 8000]);
    expect(r.updated).toBe("2026-11-10");
  });

  it("brings yearly rents to a month", () => {
    const yearly = [72000, 84000, 96000].map(p => listing("Lusail", p, { rentalPeriod: "YEARLY" }));
    expect(findReport(buildPriceReports(yearly), "RENT", "lusail")?.median).toBe(7000);
  });

  it("splits by bedrooms, keeping only groups of at least two", () => {
    const mixed = [
      listing("Lusail", 5000, { bedrooms: 1 }), listing("Lusail", 5400, { bedrooms: 1 }),
      listing("Lusail", 8000, { bedrooms: 2 }), listing("Lusail", 8400, { bedrooms: 2 }), listing("Lusail", 9000, { bedrooms: 2 }),
      listing("Lusail", 20000, { bedrooms: 5 })
    ];
    const r = findReport(buildPriceReports(mixed), "RENT", "lusail")!;
    expect(r.byBedrooms.map(b => [b.bedrooms, b.count, b.median])).toEqual([[1, 2, 5200], [2, 3, 8400]]);
  });

  it("gives the country page the figures across every area", () => {
    const c = findReport(buildPriceReports(all), "RENT", "qatar")!;
    expect(c).toMatchObject({ scope: "country", count: 10, district: "Qatar", districtAr: "قطر" }); // 5 + 3 + the 2 in Wakrah
  });

  it("uses the Arabic name from the location table when there is one", () => {
    const reports = buildPriceReports(all, [{ id: "l1", name: "Lusail", nameAr: "لوسيل", type: "AREA" } as never]);
    expect(findReport(reports, "RENT", "lusail")?.districtAr).toBe("لوسيل");
  });
});

describe("addresses", () => {
  it("builds and reads them back", () => {
    expect(reportPath("RENT", "lusail")).toBe("/average-rent-in-lusail");
    expect(reportPath("SALE", "the-pearl-qatar")).toBe("/property-prices-in-the-pearl-qatar");
    expect(parseReportPath("/average-rent-in-lusail")).toEqual({ deal: "RENT", slug: "lusail" });
    expect(parseReportPath("/property-prices-in-the-pearl-qatar/")).toEqual({ deal: "SALE", slug: "the-pearl-qatar" });
    expect(parseReportPath("/average-rent-in-")).toBeNull();
    expect(parseReportPath("/average-rent-in-Lusail")).toBeNull();
    expect(parseReportPath("/properties/abc")).toBeNull();
  });
});

describe("what a report says", () => {
  const reports = buildPriceReports(all);
  const lus = findReport(reports, "RENT", "lusail")!;
  const country = findReport(reports, "RENT", "qatar")!;

  it("states the real figures in the title, description and text", () => {
    const t = reportText(lus, "en", { year: 2026, country });
    expect(t.title).toBe("Average Rent in Lusail (2026): Prices by Bedrooms | Nerou Finder");
    expect(t.description).toContain("QAR 8,000 a month");
    expect(t.description).toContain("5 live listings");
    expect(t.intro).toContain("between QAR 7,000 and QAR 9,000");
    expect(t.intro).toContain("QAR 80 per square metre per month");
    expect(t.h1).toBe("Average rent in Lusail");
  });

  it("answers the questions people ask, including how the area compares with the country", () => {
    const t = reportText(lus, "en", { year: 2026, country });
    const qs = t.faq.map(f => f.q);
    expect(qs).toContain("What is the average rent in Lusail?");
    expect(qs).toContain("How much is a 2 bedrooms to rent in Lusail?");
    expect(qs).toContain("Is Lusail expensive compared with the rest of Qatar?");
    expect(qs).toContain("Where do these numbers come from?");
    expect(t.faq.find(f => f.q.startsWith("Is Lusail"))!.a).toMatch(/above|below|close to/);
  });

  it("is written in Arabic too, with the Arabic area name", () => {
    const withAr = buildPriceReports(all, [{ id: "l1", name: "Lusail", nameAr: "لوسيل", type: "AREA" } as never]);
    const t = reportText(findReport(withAr, "RENT", "lusail")!, "ar", { year: 2026 });
    expect(t.h1).toBe("متوسط الإيجار في لوسيل");
    expect(t.title).toContain("لوسيل");
    expect(t.description).toContain("QAR 8,000 شهرياً");
  });

  it("builds a breadcrumb trail, shorter for the country page", () => {
    expect(reportText(lus, "en", { year: 2026 }).breadcrumbs.map(b => b.path)).toEqual(["/", "/average-rent-in-qatar", "/average-rent-in-lusail"]);
    expect(reportText(country, "en", { year: 2026 }).breadcrumbs.map(b => b.path)).toEqual(["/", "/average-rent-in-qatar"]);
  });

  it("speaks of a purchase as prices, not rent", () => {
    const sales = [1_000_000, 1_100_000, 1_200_000].map(p => listing("Lusail", p, { transactionType: "FOR_SALE", rentalPeriod: undefined }));
    const r = findReport(buildPriceReports(sales), "SALE", "lusail")!;
    const t = reportText(r, "en", { year: 2026 });
    expect(t.h1).toBe("Property prices in Lusail");
    expect(t.description).toContain("QAR 1,100,000");
    expect(t.description).not.toContain("a month");
  });
});

describe("small helpers", () => {
  it("rounds to figures a person would say", () => {
    expect(roundedFigure("RENT", 7823)).toBe(7800);
    expect(roundedFigure("SALE", 1_103_000)).toBe(1_105_000);
    expect(roundedFigure("RENT", 3)).toBe(50);
  });
  it("formats money and bedroom counts", () => {
    expect(qar(1234567)).toBe("QAR 1,234,567");
    expect(bedroomsLabel(0, "en")).toBe("Studio");
    expect(bedroomsLabel(1, "en")).toBe("1 bedroom");
    expect(bedroomsLabel(3, "ar")).toBe("3 غرف نوم");
  });
});
