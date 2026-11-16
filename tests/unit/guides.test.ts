import { describe, it, expect } from "vitest";
import { GUIDES, GUIDE_CATEGORIES, GUIDE_LINKS, getGuide, guideText, hubText, linkLabel, parseGuidePath, readMinutes, relatedGuides } from "../../src/lib/guides.js";
import { guideBodyHtml, guideJsonLd, hubBodyHtml, hubJsonLd } from "../../src/lib/guidesHtml.js";
import { areaSlug, areaNameFor } from "../../src/lib/seo.js";
import { AREA_GUIDES } from "../../src/data/areaGuides.js";
import type { L } from "../../src/data/guideTypes.js";

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;

function allTexts(): { where: string; t: L }[] {
  const out: { where: string; t: L }[] = [];
  for (const g of GUIDES) {
    out.push({ where: `${g.slug}.title`, t: g.title }, { where: `${g.slug}.description`, t: g.description }, { where: `${g.slug}.summary`, t: g.summary });
    g.sections.forEach((s, i) => {
      out.push({ where: `${g.slug}.s${i}.h`, t: s.h });
      (s.p || []).forEach((p, j) => out.push({ where: `${g.slug}.s${i}.p${j}`, t: p }));
      (s.list || []).forEach((p, j) => out.push({ where: `${g.slug}.s${i}.l${j}`, t: p }));
    });
    g.faq.forEach((f, i) => out.push({ where: `${g.slug}.faq${i}.q`, t: f.q }, { where: `${g.slug}.faq${i}.a`, t: f.a }));
  }
  return out;
}

describe("the guides' content", () => {
  it("has a healthy number of guides with unique slugs", () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(GUIDES.map(g => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) expect(g.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("every text exists in both languages, and the Arabic is really Arabic", () => {
    for (const { where, t } of allTexts()) {
      expect(t.en.trim(), `${where} (en)`).not.toBe("");
      expect(t.ar.trim(), `${where} (ar)`).not.toBe("");
      expect(ARABIC.test(t.ar), `${where} has no Arabic letters`).toBe(true);
      expect(LATIN.test(t.en), `${where} has no Latin letters`).toBe(true);
    }
  });

  it("every guide is complete enough to rank: summary, sections, at least three questions, a way onward", () => {
    for (const g of GUIDES) {
      expect(g.sections.length, g.slug).toBeGreaterThanOrEqual(2);
      expect(g.faq.length, g.slug).toBeGreaterThanOrEqual(3);
      expect(g.links.length, g.slug).toBeGreaterThanOrEqual(1);
      expect(g.related.length, g.slug).toBeGreaterThanOrEqual(2);
      for (const s of g.sections) expect((s.p?.length || 0) + (s.list?.length || 0), `${g.slug}: ${s.h.en}`).toBeGreaterThan(0);
      expect(readMinutes(g, "en"), g.slug).toBeGreaterThanOrEqual(1);
      expect(g.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(g.updated >= g.published, g.slug).toBe(true);
    }
  });

  it("meta descriptions fit in a search result", () => {
    for (const g of GUIDES) {
      expect(g.description.en.length, `${g.slug} en`).toBeGreaterThan(70);
      expect(g.description.en.length, `${g.slug} en`).toBeLessThanOrEqual(170);
      expect(g.description.ar.length, `${g.slug} ar`).toBeGreaterThan(60);
      expect(g.description.ar.length, `${g.slug} ar`).toBeLessThanOrEqual(190);
    }
  });

  it("every related guide, link and category exists", () => {
    const categories = new Set(GUIDE_CATEGORIES.map(c => c.id));
    const areaPaths = new Set(AREA_GUIDES.map(a => `/areas/${a.slug}`));
    for (const g of GUIDES) {
      expect(categories.has(g.category), g.slug).toBe(true);
      for (const r of g.related) expect(getGuide(r), `${g.slug} -> ${r}`).toBeDefined();
      expect(g.related).not.toContain(g.slug);
      for (const l of g.links) {
        expect(GUIDE_LINKS[l], `${g.slug} -> ${l} has no label`).toBeDefined();
        if (l.startsWith("/areas/")) expect(areaPaths.has(l), `${g.slug} -> ${l} is not an area guide`).toBe(true);
      }
      expect(relatedGuides(g).length).toBe(g.related.length);
    }
    for (const c of GUIDE_CATEGORIES) expect(GUIDES.some(g => g.category === c.id), `category ${c.id} is empty`).toBe(true);
  });

  it("does not state figures that go out of date as if they were fact", () => {
    // residence thresholds, bank rates and fees change: the guides must send readers to the authority instead
    const text = allTexts().map(x => x.t.en).join("\n");
    expect(text).not.toMatch(/QAR\s?730/i);
    expect(text).not.toMatch(/3[.,]65/);
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s?%\s+(interest|down payment)/i);
  });
});

describe("guide addresses", () => {
  it("recognises the list, a real guide, and nothing else", () => {
    expect(parseGuidePath("/guides")).toEqual({ kind: "hub" });
    expect(parseGuidePath("/guides/")).toEqual({ kind: "hub" });
    const first = GUIDES[0];
    const hit = parseGuidePath(`/guides/${first.slug}`);
    expect(hit && hit.kind === "guide" && hit.guide.slug).toBe(first.slug);
    expect(parseGuidePath("/guides/not-a-real-guide")).toBeNull();
    expect(parseGuidePath("/guides/a/b")).toBeNull();
    expect(parseGuidePath("/guide/x")).toBeNull();
  });

  it("labels the pages a guide can send you to", () => {
    expect(linkLabel("/price-check", "en")).toMatch(/price/i);
    expect(ARABIC.test(linkLabel("/price-check", "ar")!)).toBe(true);
    expect(linkLabel("/nowhere", "en")).toBeNull();
  });
});

describe("the HTML search engines get", () => {
  const g = GUIDES[0];

  it("has one H1, the answer first, the questions, and links onward", () => {
    const html = guideBodyHtml(g, "en");
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain(`<h1>${g.title.en.replace(/&/g, "&amp;")}`.slice(0, 20));
    expect(html.indexOf(g.summary.en.slice(0, 40))).toBeGreaterThan(html.indexOf("<h1>"));
    expect(html).toContain("Frequently asked questions");
    for (const f of g.faq) expect(html).toContain(f.q.en.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;"));
    expect(html).toContain('href="/guides"');
    expect(html).toContain('hreflang="ar"');
    expect(html).toContain('dir="ltr"');
  });

  it("writes the Arabic page right to left with /ar links", () => {
    const html = guideBodyHtml(g, "ar");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('href="/ar/guides"');
    expect(html).toContain(`href="/ar/guides/`);
    expect(ARABIC.test(html)).toBe(true);
  });

  it("describes the article, its questions and its place in the site as structured data", () => {
    const ld = guideJsonLd(g, "en", "https://www.neroufinder.com") as Record<string, any>[];
    const types = ld.map(x => x["@type"]);
    expect(types).toEqual(["Article", "FAQPage", "BreadcrumbList"]);
    expect(ld[0]).toMatchObject({ headline: g.title.en, inLanguage: "en", datePublished: g.published, dateModified: g.updated, url: `https://www.neroufinder.com/guides/${g.slug}` });
    expect(ld[1].mainEntity).toHaveLength(g.faq.length);
    expect(ld[2].itemListElement.map((x: any) => x.item)).toEqual(["https://www.neroufinder.com/", "https://www.neroufinder.com/guides", `https://www.neroufinder.com/guides/${g.slug}`]);
    const ar = guideJsonLd(g, "ar", "https://www.neroufinder.com") as Record<string, any>[];
    expect(ar[0].url).toBe(`https://www.neroufinder.com/ar/guides/${g.slug}`);
  });

  it("lists every guide on the hub, by category, in both languages", () => {
    for (const lang of ["en", "ar"] as const) {
      const html = hubBodyHtml(lang);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      for (const x of GUIDES) expect(html).toContain(`/guides/${x.slug}"`);
      expect(html).toContain(lang === "ar" ? hubText("ar").h1 : hubText("en").h1);
      const ld = hubJsonLd(lang, "https://www.neroufinder.com") as Record<string, any>[];
      expect(ld[0].mainEntity.numberOfItems).toBe(GUIDES.length);
    }
  });

  it("escapes anything that could close a tag", () => {
    const ld = JSON.stringify(guideJsonLd({ ...g, title: { en: "A </script> title", ar: "عنوان" } }, "en", "https://x.test"));
    expect(ld).toContain("</script>"); // the raw data keeps it; the page writer (jsonLdScript) escapes "<"
    expect(guideText(g, "en").title).toBe(g.title.en);
  });
});

describe("one address per area", () => {
  it("treats 'Alwaab', 'Al Waab' and 'al-waab' as the same area", () => {
    expect(areaSlug("Alwaab")).toBe("al-waab");
    expect(areaSlug("Al Waab")).toBe("al-waab");
    expect(areaSlug("al-waab")).toBe("al-waab");
    expect(areaSlug("AL WAAB")).toBe("al-waab");
    expect(areaSlug("Alsadd")).toBe("al-sadd");
  });

  it("leaves every other name alone", () => {
    expect(areaSlug("West Bay")).toBe("west-bay");
    expect(areaSlug("The Pearl-Qatar")).toBe("the-pearl-qatar");
    expect(areaSlug("Lusail")).toBe("lusail");
    expect(areaSlug("Al")).toBe("al");
    expect(areaSlug("Alu")).toBe("alu"); // too short to be "Al" + a name
    expect(areaSlug("Alwaab Compound")).toBe("alwaab-compound");
  });

  it("every area guide's district keeps its address", () => {
    for (const a of AREA_GUIDES) expect(areaSlug(a.district), a.district).toBe(a.district.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^al([a-z]{3,})$/, "al-$1"));
  });

  it("names an alias after the listed place", () => {
    const locations = [{ id: "a-alwaab", name: "Al Waab", nameAr: "الوعب", type: "AREA", isActive: true }] as never;
    expect(areaNameFor("Alwaab", locations)).toEqual({ slug: "al-waab", en: "Al Waab", ar: "الوعب" });
    expect(areaNameFor("Al Waab", locations).slug).toBe("al-waab");
    expect(areaNameFor("Somewhere", locations)).toMatchObject({ slug: "somewhere", en: "Somewhere" });
  });
});
