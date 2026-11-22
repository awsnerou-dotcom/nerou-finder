import { describe, it, expect } from "vitest";
import {
  slugify, stripLang, withLang, parseLandingPath, landingPath, buildLandingPages, landingText, relatedLandings, landingLabel, areaNameFor, listingMetaAr, listingsFor, listingTitle, listingCrumbs
} from "../../src/lib/seo.js";
import { applyHead, applyRootContent, landingBodyHtml, landingJsonLd, jsonLdScript, esc, propertyBodyHtml, areaBodyHtml, breadcrumbJsonLd } from "../../src/lib/seoHtml.js";
import type { Property } from "../../src/types.js";

const prop = (o: Partial<Record<keyof Property, unknown>> & { id: string }): Property => ({
  title: "Nice flat", propertyType: "APARTMENT", transactionType: "FOR_RENT", district: "Lusail", city: "Lusail", price: 7000, currency: "QAR",
  rentalPeriod: "MONTHLY", bedrooms: 2, bathrooms: 2, area: 100, sizeUnit: "SQM", listingStatus: "PUBLISHED", images: ["/a.jpg"], ...o
} as unknown as Property);

describe("language in the URL", () => {
  it("splits /ar from the page path and puts it back", () => {
    expect(stripLang("/ar")).toEqual({ lang: "ar", path: "/" });
    expect(stripLang("/ar/plans-pricing")).toEqual({ lang: "ar", path: "/plans-pricing" });
    expect(stripLang("/plans-pricing")).toEqual({ lang: "en", path: "/plans-pricing" });
    expect(stripLang("/area-guides")).toEqual({ lang: "en", path: "/area-guides" }); // "/ar" must be a whole segment
    expect(withLang("/", "ar")).toBe("/ar");
    expect(withLang("/properties/x", "ar")).toBe("/ar/properties/x");
    expect(withLang("/properties/x", "en")).toBe("/properties/x");
  });
});

describe("landing page URLs", () => {
  it("builds and parses them in both directions", () => {
    expect(slugify("The Pearl-Qatar")).toBe("the-pearl-qatar");
    expect(landingPath({ tx: "rent", type: "apartments", area: "lusail" })).toBe("/apartments-for-rent-in-lusail");
    expect(landingPath({ tx: "sale" })).toBe("/properties-for-sale-in-qatar");
    expect(parseLandingPath("/villas-for-sale-in-west-bay")).toEqual({ lang: "en", spec: { tx: "sale", type: "villas", area: "west-bay" } });
    expect(parseLandingPath("/ar/properties-for-rent-in-qatar/")).toEqual({ lang: "ar", spec: { tx: "rent", type: undefined, area: undefined } });
  });

  it("rejects anything that is not a real combination", () => {
    expect(parseLandingPath("/spaceships-for-rent-in-lusail")).toBeNull();
    expect(parseLandingPath("/apartments-for-rent")).toBeNull();
    expect(parseLandingPath("/apartments-for-hire-in-lusail")).toBeNull();
    expect(parseLandingPath("/apartments-for-rent-in-<script>")).toBeNull();
    expect(parseLandingPath("/properties/abc")).toBeNull();
  });
});

describe("which landing pages exist", () => {
  it("only makes pages that have listings, and ignores unpublished ones", () => {
    const pages = buildLandingPages([
      prop({ id: "1" }),
      prop({ id: "2", listingStatus: "PAUSED" as any, district: "West Bay" })
    ]);
    expect(pages.map(p => p.path)).toContain("/apartments-for-rent-in-lusail");
    expect(pages.some(p => p.path.includes("west-bay"))).toBe(false);
    expect(pages.some(p => p.path.includes("for-sale"))).toBe(false);
  });

  it("when several pages show exactly the same listings, only the most specific one is the original", () => {
    const pages = buildLandingPages([prop({ id: "1" })]);
    const specific = pages.find(p => p.path === "/apartments-for-rent-in-lusail")!;
    expect(specific.indexable).toBe(true);
    for (const other of ["/properties-for-rent-in-qatar", "/apartments-for-rent-in-qatar", "/properties-for-rent-in-lusail"]) {
      const p = pages.find(x => x.path === other)!;
      expect(p.indexable).toBe(false);
      expect(p.canonicalPath).toBe("/apartments-for-rent-in-lusail");
    }
  });

  it("gives a broader page its own identity once it shows more than a narrower one", () => {
    const pages = buildLandingPages([prop({ id: "1" }), prop({ id: "2", propertyType: "VILLA" as any, district: "West Bay" })]);
    expect(pages.find(p => p.path === "/apartments-for-rent-in-lusail")!.indexable).toBe(true);
    expect(pages.find(p => p.path === "/villas-for-rent-in-west-bay")!.indexable).toBe(true);
    const all = pages.find(p => p.path === "/properties-for-rent-in-qatar")!;
    expect(all.indexable).toBe(true);
    expect(all.listings).toHaveLength(2);
  });

  it("treats commercial leases as rent and hotel apartments as apartments", () => {
    const l = listingsFor([prop({ id: "1", transactionType: "COMMERCIAL_LEASE" as any, propertyType: "HOTEL_APARTMENT" as any })], { tx: "rent", type: "apartments" });
    expect(l).toHaveLength(1);
  });
});

describe("what a landing page says", () => {
  const listings = [prop({ id: "1", price: 6000, bedrooms: 1 }), prop({ id: "2", price: 10000, bedrooms: 3 })];
  const landing = buildLandingPages(listings).find(p => p.path === "/apartments-for-rent-in-lusail")!;
  const ctx = { lang: "en" as const, areaName: areaNameFor("Lusail") };

  it("writes the title, text and numbers from the real listings", () => {
    const t = landingText(landing, ctx);
    expect(t.h1).toBe("Apartments for Rent in Lusail, Qatar");
    expect(t.title.length).toBeLessThanOrEqual(63);
    expect(t.title).toContain("2 Verified Listings");
    expect(t.intro).toContain("QAR 6,000 to QAR 10,000 per month");
    expect(t.intro).toContain("average QAR 8,000");
    expect(t.intro).toContain("1 to 3 bedrooms");
    expect(t.description.length).toBeLessThanOrEqual(300);
    expect(t.faq.length).toBe(3);
    expect(t.breadcrumbs[0].path).toBe("/");
    expect(t.breadcrumbs[t.breadcrumbs.length - 1].path).toBe("/apartments-for-rent-in-lusail");
  });

  it("does not say 'from X to X' when every listing costs the same", () => {
    const one = buildLandingPages([prop({ id: "1", price: 7000 }), prop({ id: "2", price: 7000 })]).find(p => p.path === "/apartments-for-rent-in-lusail")!;
    const t = landingText(one, ctx);
    expect(t.intro).toContain("Price: QAR 7,000 per month");
    expect(t.intro).not.toContain("to QAR");
    expect(t.faq[0].a).toContain("the price is QAR 7,000 per month");
    expect(landingText(one, { lang: "ar", areaName: ctx.areaName }).intro).toContain("السعر 7,000 ر.ق شهريًا");
  });

  it("writes real Arabic, with the Arabic district name", () => {
    const t = landingText(landing, { lang: "ar", areaName: areaNameFor("Lusail") });
    expect(t.h1).toBe("شقق للإيجار في لوسيل، قطر");
    expect(t.intro).toMatch(/[؀-ۿ]/);
    expect(t.intro).toContain("شهريًا");
    expect(t.faq[0].q).toContain("لوسيل");
  });

  it("uses a location table's Arabic name when there is one", () => {
    expect(areaNameFor("Somewhere New", [{ name: "Somewhere New", nameAr: "مكان جديد" } as any]).ar).toBe("مكان جديد");
    expect(areaNameFor("Unknown Place").ar).toBe("Unknown Place");
  });

  it("links related pages that exist and skips itself", () => {
    const all = buildLandingPages([...listings, prop({ id: "3", propertyType: "VILLA" as any, district: "West Bay", transactionType: "FOR_SALE" as any, price: 3000000 })]);
    const cur = all.find(p => p.path === "/apartments-for-rent-in-lusail")!;
    const rel = relatedLandings(all, cur);
    expect(rel.every(r => r.path !== cur.path && r.indexable)).toBe(true);
    expect(rel.length).toBeGreaterThan(0);
    expect(landingLabel(cur, "en")).toBe("Apartments for rent in Lusail");
    expect(landingLabel(cur, "ar")).toBe("شقق للإيجار في لوسيل");
  });

  it("has an Arabic search snippet for a listing", () => {
    const d = listingMetaAr(prop({ id: "1" }));
    expect(d).toContain("شقق للإيجار في لوسيل");
    expect(d).toContain("7,000");
  });
});

describe("the HTML a crawler receives", () => {
  const shell = `<!doctype html><html lang="en"><head><title>Old</title><meta name="description" content="old" /><link rel="canonical" href="https://x/" /><meta property="og:url" content="https://x/" /><meta property="og:title" content="old" /><meta property="og:locale" content="en_US" /></head><body><div id="root"></div></body></html>`;
  const landing = buildLandingPages([prop({ id: "1", title: 'Tricky "title" <b>' })])[0];
  const text = landingText(landing, { lang: "en", areaName: undefined });

  it("rewrites the head, adds hreflang and robots, and escapes everything", () => {
    const out = applyHead(shell, { lang: "ar", title: 'A "title" <x>', description: "d & d", canonical: "https://x/ar/p", alternates: { en: "https://x/p", ar: "https://x/ar/p" } });
    expect(out).toContain('<html lang="ar" dir="rtl">');
    expect(out).toContain("<title>A &quot;title&quot; &lt;x&gt;</title>");
    expect(out).toContain('<link rel="canonical" href="https://x/ar/p" />');
    expect(out).toContain('hreflang="en" href="https://x/p"');
    expect(out).toContain('hreflang="ar" href="https://x/ar/p"');
    expect(out).toContain('hreflang="x-default" href="https://x/p"');
    expect(out).toContain('content="ar_QA"');
    expect(out).toContain('name="robots" content="index,follow');
    expect(out).not.toContain("<x>");
  });

  it("can mark a page noindex", () => {
    expect(applyHead(shell, { lang: "en", title: "t", description: "d", canonical: "https://x/", noindex: true })).toContain('content="noindex,follow"');
  });

  it("puts readable content and links into the app root", () => {
    const body = landingBodyHtml({ landing, text, lang: "en", related: [{ path: "/villas-for-sale-in-qatar", label: "Villas" }] });
    const out = applyRootContent(shell, body);
    expect(out).toContain('<div id="root" data-ssr="1">');
    expect(out).toContain("<h1>");
    expect(out).toContain('href="/properties/1"');
    expect(out).toContain("Tricky &quot;title&quot; &lt;b&gt;");
    expect(out).toContain('href="/villas-for-sale-in-qatar"');
    expect(out).not.toContain("<b>");
    // the shell's generic no-JavaScript block is removed so the page has one H1
    // ...but the head's <noscript> (it loads the fonts for visitors without JavaScript) stays
    const withNoscript = shell
      .replace("</head>", '<noscript><link rel="stylesheet" href="https://fonts.example/x.css" /></noscript></head>')
      .replace("</body>", "<noscript><h1>Generic</h1></noscript></body>");
    const cleaned = applyRootContent(withNoscript, body);
    expect(cleaned).not.toContain("Generic");
    expect(cleaned).toContain("fonts.example/x.css");
  });

  it("keeps Arabic links on the Arabic version of the site", () => {
    const body = landingBodyHtml({ landing, text: landingText(landing, { lang: "ar" }), lang: "ar", related: [{ path: "/villas-for-sale-in-qatar", label: "فلل" }] });
    expect(body).toContain('href="/ar/properties/1"');
    expect(body).toContain('href="/ar/villas-for-sale-in-qatar"');
    expect(body).toContain('dir="rtl"');
  });

  it("builds structured data: a collection, breadcrumbs and FAQ, and can't be broken out of", () => {
    const ld = landingJsonLd({ landing, text, lang: "en", origin: "https://x" }) as any[];
    expect(ld.map(x => x["@type"])).toEqual(["CollectionPage", "BreadcrumbList", "FAQPage"]);
    expect(ld[0].mainEntity.itemListElement[0].url).toBe("https://x/properties/1");
    expect(jsonLdScript({ a: "</script><script>alert(1)" })).not.toContain("</script><script>");
    expect(esc("<&>")).toBe("&lt;&amp;&gt;");
  });
});

describe("the page of one listing", () => {
  it("is titled from its facts, not from the agent's headline", () => {
    const villa = prop({ id: "v", title: "For Rent: Luxurious Standalone Villa in Al", propertyType: "VILLA", district: "Al Markhiya", city: "Doha", bedrooms: 5, price: 40000 });
    const t = listingTitle(villa, "en");
    expect(t).toBe("5-Bed Villa for Rent in Al Markhiya - QAR 40,000/mo");
    expect(t).not.toContain("Luxurious");
    expect(t.length).toBeLessThanOrEqual(62);
  });

  it("says nothing about bedrooms for a shop or a plot, and handles a sale and a studio", () => {
    // the brand is added when it still fits in a search result, and dropped first when it does not
    expect(listingTitle(prop({ id: "s", propertyType: "SHOP", bedrooms: 3, district: "Al Sadd", price: 9000 }), "en")).toBe("Shop for Rent in Al Sadd - QAR 9,000/mo | Nerou Finder");
    expect(listingTitle(prop({ id: "l", propertyType: "LAND", transactionType: "FOR_SALE", district: "Lusail", price: 2500000, bedrooms: 0 }), "en")).toBe("Plot of land for Sale in Lusail - QAR 2,500,000 | Nerou Finder");
    expect(listingTitle(prop({ id: "st", propertyType: "STUDIO", bedrooms: 0, district: "Lusail", price: 3500 }), "en")).toBe("Studio for Rent in Lusail - QAR 3,500/mo | Nerou Finder");
  });

  it("is real Arabic with the Arabic district, and falls back to Qatar without a district", () => {
    const ar = listingTitle(prop({ id: "a", propertyType: "APARTMENT", district: "West Bay", bedrooms: 2, price: 8000 }), "ar");
    expect(ar).toContain("شقة للإيجار في الخليج الغربي");
    expect(ar).toContain("غرفتا نوم");
    expect(listingTitle(prop({ id: "a1", district: "West Bay", bedrooms: 1, price: 5000 }), "ar")).toContain("غرفة نوم");
    expect(listingTitle(prop({ id: "a3", district: "West Bay", bedrooms: 3, price: 5000 }), "ar")).toContain("3 غرف نوم");
    expect(ar).toContain("8,000 ر.ق شهريًا");
    expect(listingTitle(prop({ id: "n", district: "" }), "en")).toContain("in Qatar");
  });

  it("keeps Arabic letters out of an English title, and bedrooms off a room or a shop", () => {
    const arabicDistrict = prop({ id: "d", propertyType: "VILLA", district: "الصخامة", city: "Doha", bedrooms: 4, price: 13000 });
    expect(listingTitle(arabicDistrict, "en")).toBe("4-Bed Villa for Rent in Doha - QAR 13,000/mo | Nerou Finder");
    expect(listingTitle(prop({ ...arabicDistrict, id: "d2", city: "قطر" }), "en")).toBe("4-Bed Villa for Rent in Qatar - QAR 13,000/mo | Nerou Finder");
    // ...but the location table's English name is used when it has one, and the Arabic title keeps the Arabic district
    const table = [{ id: "l", name: "Al Sakhama", nameAr: "الصخامة", type: "DISTRICT" }] as never;
    expect(listingTitle(arabicDistrict, "en", table)).toContain("in Al Sakhama");
    expect(listingTitle(arabicDistrict, "ar")).toContain("في الصخامة");
    expect(listingTitle(prop({ id: "r", propertyType: "ROOM", transactionType: "FOR_SALE", district: "Umm Salal Mohammed", bedrooms: 4, price: 1200 }), "en")).toBe("Room for Sale in Umm Salal Mohammed - QAR 1,200 | Nerou Finder");
  });

  it("never grows past a search result's width", () => {
    const long = prop({ id: "x", propertyType: "COMPOUND", district: "Al Wukair Heights Extension", price: 123456789, bedrooms: 6 });
    expect(listingTitle(long, "en").length).toBeLessThanOrEqual(62);
  });

  it("has a breadcrumb up to the most specific search page that lists it", () => {
    const a = prop({ id: "1", propertyType: "VILLA", district: "Lusail" });
    const b = prop({ id: "2", propertyType: "VILLA", district: "Lusail" });
    const pages = buildLandingPages([a, b]).filter(l => l.indexable && l.listings.some(x => x.id === "1"));
    const crumbs = listingCrumbs(a, pages, "en", [], "A villa");
    expect(crumbs.map(c => c.name)).toEqual(["Home", "Villas for rent in Lusail", "A villa"]);
    expect(crumbs[1].path).toBe("/villas-for-rent-in-lusail");
    expect(listingCrumbs(a, [], "ar", [], "x").map(c => c.name)).toEqual(["الرئيسية", "x"]);
  });

  it("writes the breadcrumb as structured data with addresses in the page's language", () => {
    const ld = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Villas", path: "/villas-for-rent-in-lusail" }], "ar", "https://x") as any;
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement[1]).toMatchObject({ position: 2, item: "https://x/ar/villas-for-rent-in-lusail" });
  });

  it("gives each photo its own alt text, and links up through the breadcrumb", () => {
    const p = prop({ id: "9", title: "Garden villa", district: "Lusail", images: ["/1.jpg", "/2.jpg", "/3.jpg"] });
    const html = propertyBodyHtml(p, "en", [], [{ name: "Home", path: "/" }, { name: "Villas for rent in Lusail", path: "/villas-for-rent-in-lusail" }, { name: "Garden villa", path: "/properties/9" }]);
    expect(html).toContain('alt="Garden villa - Lusail"');
    expect(html).toContain('alt="Garden villa - Lusail - photo 2"');
    expect(html).toContain('alt="Garden villa - Lusail - photo 3"');
    expect(html).toContain('href="/villas-for-rent-in-lusail"');
    expect(propertyBodyHtml(p, "ar", [], []).includes("<nav")).toBe(false);
  });
});

describe("an area guide page", () => {
  it("leads on to prices, all-Qatar searches and other areas instead of ending", () => {
    const html = areaBodyHtml({
      title: "Lusail", overview: "A new city.", highlights: [], lang: "en", links: [],
      crumbs: [{ name: "Home", path: "/" }, { name: "Area guides", path: "/area-guides" }, { name: "Lusail", path: "/areas/lusail-city" }],
      sections: [
        { heading: "Prices in this area", links: [{ path: "/average-rent-in-lusail", label: "Average rent in Lusail" }] },
        { heading: "Empty group", links: [] },
        { heading: "Other area guides", links: [{ path: "/areas/west-bay", label: "West Bay" }] }
      ]
    });
    expect(html).toContain('href="/area-guides"');
    expect(html).toContain("Prices in this area");
    expect(html).toContain('href="/average-rent-in-lusail"');
    expect(html).toContain('href="/areas/west-bay"');
    expect(html).not.toContain("Empty group");
    expect(html.match(/<h1>/g)?.length).toBe(1);
  });

  it("keeps its Arabic links on the Arabic site", () => {
    const html = areaBodyHtml({ title: "لوسيل", overview: "x", highlights: [], lang: "ar", links: [], sections: [{ heading: "مناطق أخرى", links: [{ path: "/areas/west-bay", label: "الخليج الغربي" }] }] });
    expect(html).toContain('href="/ar/areas/west-bay"');
  });
});
