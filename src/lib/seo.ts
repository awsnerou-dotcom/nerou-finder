// Search-engine pages that don't need the server or the browser: which landing pages exist, what
// their URLs are, and what they say. Everything a landing page says is computed from the real
// published listings - counts, prices, sizes - so a page can never promise what isn't there, and a
// page with nothing to show simply does not exist.
//
// Why this shape: people search "apartments for rent in Lusail" or "شقق للإيجار في لوسيل", and the
// sites that win those searches have one real, crawlable page per such combination (Property
// Finder: /en/rent/lusail/apartments-for-rent.html; Qatar Living: ...-3-bedroom-apartments-for-
// rent-doha), in both languages, each with its own title, text and listings in the HTML itself.

import type { LocationItem, Property } from "../types.js";

export type Lang = "en" | "ar";

export const SITE_NAME = "Nerou Finder";
export const SITE_NAME_AR = "نيرو فايندر";

// ---------------------------------------------------------------------------------------------
// Language in the URL: /ar/... is the Arabic version of /...
// ---------------------------------------------------------------------------------------------

export function stripLang(pathname: string): { lang: Lang; path: string } {
  if (pathname === "/ar" || pathname === "/ar/") return { lang: "ar", path: "/" };
  if (pathname.startsWith("/ar/")) return { lang: "ar", path: pathname.slice(3) || "/" };
  return { lang: "en", path: pathname || "/" };
}

export function withLang(path: string, lang: Lang): string {
  if (lang === "en") return path;
  return path === "/" ? "/ar" : `/ar${path}`;
}

// ---------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------

/** ASCII URL slug: "The Pearl-Qatar" -> "the-pearl-qatar". */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface TypeGroup {
  slug: string; // plural, used in URLs: "apartments"
  en: string; // "Apartments"
  enSingular: string;
  ar: string; // "شقق"
  types: string[]; // PropertyType values
}

export const TYPE_GROUPS: TypeGroup[] = [
  { slug: "apartments", en: "Apartments", enSingular: "apartment", ar: "شقق", types: ["APARTMENT", "HOTEL_APARTMENT"] },
  { slug: "studios", en: "Studios", enSingular: "studio", ar: "استوديوهات", types: ["STUDIO"] },
  { slug: "villas", en: "Villas", enSingular: "villa", ar: "فلل", types: ["VILLA"] },
  { slug: "townhouses", en: "Townhouses", enSingular: "townhouse", ar: "تاون هاوس", types: ["TOWNHOUSE"] },
  { slug: "penthouses", en: "Penthouses", enSingular: "penthouse", ar: "بنتهاوس", types: ["PENTHOUSE"] },
  { slug: "compounds", en: "Compound homes", enSingular: "compound home", ar: "وحدات في مجمعات سكنية", types: ["COMPOUND"] },
  { slug: "offices", en: "Offices", enSingular: "office", ar: "مكاتب", types: ["OFFICE"] },
  { slug: "shops", en: "Shops", enSingular: "shop", ar: "محلات تجارية", types: ["SHOP", "RETAIL"] },
  { slug: "warehouses", en: "Warehouses", enSingular: "warehouse", ar: "مستودعات", types: ["WAREHOUSE"] },
  { slug: "land", en: "Land", enSingular: "plot of land", ar: "أراضي", types: ["LAND"] },
  { slug: "rooms", en: "Rooms", enSingular: "room", ar: "غرف", types: ["ROOM"] }
];

export type Tx = "rent" | "sale";
export const TX_INFO: Record<Tx, { types: string[]; en: string; ar: string; enTitle: string }> = {
  rent: { types: ["FOR_RENT", "COMMERCIAL_LEASE"], en: "for rent", ar: "للإيجار", enTitle: "for Rent" },
  sale: { types: ["FOR_SALE", "COMMERCIAL_SALE", "LAND_SALE"], en: "for sale", ar: "للبيع", enTitle: "for Sale" }
};

/** Arabic names for the commonest districts, used when the location table has none. */
const AR_FALLBACK: Record<string, string> = {
  "west bay": "الخليج الغربي", "the pearl": "اللؤلؤة", "pearl qatar": "اللؤلؤة", "the pearl qatar": "اللؤلؤة", "porto arabia": "بورتو أرابيا", "the pearl-qatar": "اللؤلؤة", "lusail": "لوسيل", "lusail city": "لوسيل",
  "al sadd": "السد", "al waab": "الوعب", "old airport": "المطار القديم", "msheireb": "مشيرب", "bin mahmoud": "بن محمود",
  "doha": "الدوحة", "al rayyan": "الريان", "al wakrah": "الوكرة", "al khor": "الخور", "umm salal": "أم صلال",
  "al daayen": "الدعين", "madinat khalifa": "مدينة خليفة", "al gharrafa": "الغرافة", "al thumama": "الثمامة",
  "al mansoura": "المنصورة", "al nasr": "النصر", "fox hills": "فوكس هيلز", "legtaifiya": "لقطيفية", "marina district": "ديستركت مارينا",
  "west bay lagoon": "لاجون الخليج الغربي", "al duhail": "الدحيل", "onaiza": "عنيزة", "al maamoura": "المعمورة", "mushaireb": "مشيرب"
};

export interface AreaName { slug: string; en: string; ar: string }

export function areaNameFor(name: string, locations: LocationItem[] = []): AreaName {
  const key = name.trim().toLowerCase();
  const loc = locations.find(l => l.name?.trim().toLowerCase() === key);
  return { slug: slugify(name), en: name.trim(), ar: loc?.nameAr?.trim() || AR_FALLBACK[key] || name.trim() };
}

// ---------------------------------------------------------------------------------------------
// Landing pages
// ---------------------------------------------------------------------------------------------

export interface LandingSpec {
  tx: Tx;
  type?: string; // TypeGroup.slug
  area?: string; // area slug
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function landingPath(spec: LandingSpec): string {
  return `/${spec.type || "properties"}-for-${spec.tx}-in-${spec.area || "qatar"}`;
}

/** "/ar/villas-for-sale-in-lusail" -> { lang: "ar", spec: {tx:"sale", type:"villas", area:"lusail"} } */
export function parseLandingPath(pathname: string): { lang: Lang; spec: LandingSpec } | null {
  const { lang, path } = stripLang(pathname.replace(/\/+$/, "") || "/");
  const m = path.match(/^\/([a-z0-9-]+?)-for-(rent|sale)-in-([a-z0-9-]+)$/);
  if (!m) return null;
  const [, typeSlug, tx, areaSlug] = m;
  if (typeSlug !== "properties" && !TYPE_GROUPS.some(g => g.slug === typeSlug)) return null;
  if (!SLUG_RE.test(areaSlug)) return null;
  return {
    lang,
    spec: { tx: tx as Tx, type: typeSlug === "properties" ? undefined : typeSlug, area: areaSlug === "qatar" ? undefined : areaSlug }
  };
}

/** A listing a visitor can actually see: the same rule the sitemap and the public API use. */
export function isPublishedListing(p: Pick<Property, "listingStatus">): boolean {
  const s = p.listingStatus as unknown as string;
  return s === "PUBLISHED" || s === "ACTIVE" || s === "APPROVED";
}

function matches(p: Property, spec: LandingSpec): boolean {
  if (!TX_INFO[spec.tx].types.includes(p.transactionType as unknown as string)) return false;
  if (spec.type) {
    const g = TYPE_GROUPS.find(x => x.slug === spec.type);
    if (!g || !g.types.includes(p.propertyType as unknown as string)) return false;
  }
  if (spec.area && slugify(p.district || "") !== spec.area) return false;
  return true;
}

export function listingsFor(properties: Property[], spec: LandingSpec): Property[] {
  return properties.filter(p => isPublishedListing(p) && matches(p, spec));
}

export interface Landing {
  spec: LandingSpec;
  path: string;
  listings: Property[];
  /** The page search engines should treat as the original. Equal to `path` unless a broader page shows exactly the same listings. */
  canonicalPath: string;
  indexable: boolean;
}

function specificity(s: LandingSpec): number {
  // broader = smaller: all of Qatar < one type < one area < one type in one area
  return (s.area ? 2 : 0) + (s.type ? 1 : 0);
}

/**
 * Every landing page that has something to show. When several pages would list exactly the same
 * properties (e.g. "apartments in Lusail", "properties in Lusail" and "apartments in Qatar" when
 * Lusail's only listing is one apartment) the MOST SPECIFIC one is the original - it is the search
 * people actually make - and the others keep working for visitors but point their canonical at it,
 * so the site does not offer search engines a pile of near-identical pages.
 */
export function buildLandingPages(properties: Property[]): Landing[] {
  const live = properties.filter(isPublishedListing);
  const areas = new Set(live.map(p => slugify(p.district || "")).filter(Boolean));
  const out: Landing[] = [];
  for (const tx of ["rent", "sale"] as Tx[]) {
    const specs: LandingSpec[] = [{ tx }];
    for (const g of TYPE_GROUPS) specs.push({ tx, type: g.slug });
    for (const area of areas) {
      specs.push({ tx, area });
      for (const g of TYPE_GROUPS) specs.push({ tx, type: g.slug, area });
    }
    const made = specs
      .map(spec => ({ spec, path: landingPath(spec), listings: listingsFor(live, spec) }))
      .filter(l => l.listings.length > 0)
      .sort((a, b) => specificity(b.spec) - specificity(a.spec)); // most specific first
    const originalOf = new Map<string, string>(); // listing-set signature -> the page that owns it
    for (const l of made) {
      const sig = l.listings.map(p => p.id).sort().join("|");
      if (!originalOf.has(sig)) originalOf.set(sig, l.path);
      const canonicalPath = originalOf.get(sig)!;
      out.push({ ...l, canonicalPath, indexable: canonicalPath === l.path });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// What a landing page says
// ---------------------------------------------------------------------------------------------

const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

export interface LandingContext {
  areaName?: AreaName;
  areaGuide?: { slug: string; overview: string; overviewAr: string };
  lang: Lang;
}

export interface LandingText {
  title: string;
  description: string;
  h1: string;
  intro: string;
  facts: string[];
  faq: { q: string; a: string }[];
  breadcrumbs: { name: string; path: string }[];
}

function priceSummary(listings: Property[], tx: Tx) {
  const prices = listings
    .filter(p => typeof p.price === "number" && p.price > 0 && (p.currency || "QAR") === "QAR" && (tx === "sale" || !p.rentalPeriod || p.rentalPeriod === "MONTHLY"))
    .map(p => p.price);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices), avg: prices.reduce((a, b) => a + b, 0) / prices.length, n: prices.length };
}

function bedroomSummary(listings: Property[]) {
  const beds = listings.map(p => p.bedrooms).filter(b => typeof b === "number" && b >= 0);
  if (beds.length === 0) return null;
  return { min: Math.min(...beds), max: Math.max(...beds) };
}

/** Title that stays near 60 characters: drops the brand before it drops the place. */
function fitTitle(core: string, brand: string): string {
  const full = `${core} | ${brand}`;
  return full.length <= 62 ? full : core.length <= 62 ? core : core.slice(0, 59).trimEnd() + "…";
}

export function landingText(landing: Landing, ctx: LandingContext): LandingText {
  const { spec, listings } = landing;
  const lang = ctx.lang;
  const ar = lang === "ar";
  const group = TYPE_GROUPS.find(g => g.slug === spec.type);
  const n = listings.length;
  const placeEn = ctx.areaName ? `${ctx.areaName.en}, Qatar` : "Qatar";
  const placeAr = ctx.areaName ? `${ctx.areaName.ar}، قطر` : "قطر";
  const typeEn = group ? group.en : "Properties";
  const typeAr = group ? group.ar : "عقارات";
  const txEn = TX_INFO[spec.tx];
  const price = priceSummary(listings, spec.tx);
  const beds = bedroomSummary(listings);
  const per = spec.tx === "rent" ? (ar ? " شهريًا" : " per month") : "";

  const h1 = ar ? `${typeAr} ${txEn.ar} في ${placeAr}` : `${typeEn} ${txEn.enTitle} in ${placeEn}`;
  const title = ar
    ? fitTitle(`${h1} - ${n} ${n === 1 ? "إعلان موثّق" : "إعلانات موثّقة"}`, SITE_NAME_AR)
    : fitTitle(`${h1} - ${n} Verified ${n === 1 ? "Listing" : "Listings"}`, SITE_NAME);

  const facts: string[] = [];
  if (price) {
    facts.push(ar
      ? (price.min === price.max ? `السعر ${fmtNum(price.min)} ر.ق${per}` : `الأسعار من ${fmtNum(price.min)} إلى ${fmtNum(price.max)} ر.ق${per}${price.n > 1 ? ` (المتوسط ${fmtNum(price.avg)} ر.ق)` : ""}`)
      : (price.min === price.max ? `Price: QAR ${fmtNum(price.min)}${per}` : `Prices from QAR ${fmtNum(price.min)} to QAR ${fmtNum(price.max)}${per}${price.n > 1 ? ` (average QAR ${fmtNum(price.avg)})` : ""}`));
  }
  if (beds) {
    facts.push(ar
      ? (beds.min === beds.max ? `عدد غرف النوم: ${beds.min === 0 ? "استوديو" : beds.min}` : `من ${beds.min === 0 ? "استوديو" : beds.min} إلى ${beds.max} غرف نوم`)
      : (beds.min === beds.max ? `Bedrooms: ${beds.min === 0 ? "studio" : beds.min}` : `${beds.min === 0 ? "Studio" : beds.min} to ${beds.max} bedrooms`));
  }

  const verifiedEn = "Every agent's licence is verified and each listing's availability is confirmed before it is published.";
  const verifiedAr = "يتم التحقق من رخصة كل وسيط، ويُؤكَّد توفر كل عقار قبل نشره.";
  const guideBitEn = ctx.areaGuide ? ` ${ctx.areaGuide.overview.split(/(?<=[.!?])\s/)[0]}` : "";
  const guideBitAr = ctx.areaGuide ? ` ${ctx.areaGuide.overviewAr.split(/(?<=[.!?۔])\s/)[0]}` : "";

  const intro = ar
    ? `${n === 1 ? "إعلان موثّق واحد" : `${n} إعلانات موثّقة`} لـ${typeAr} ${txEn.ar} في ${placeAr}. ${facts.join("، ")}${facts.length ? ". " : ""}${verifiedAr}${guideBitAr}`
    : `${n} verified ${n === 1 ? "listing" : "listings"} of ${typeEn.toLowerCase()} ${txEn.en} in ${placeEn}. ${facts.join(". ")}${facts.length ? ". " : ""}${verifiedEn}${guideBitEn}`;

  const description = (ar
    ? `تصفّح ${n} ${n === 1 ? "إعلانًا" : "إعلانات"} لـ${typeAr} ${txEn.ar} في ${placeAr}${price ? ` بأسعار تبدأ من ${fmtNum(price.min)} ر.ق${per}` : ""}. وسطاء موثّقون وتوفر مؤكَّد قبل النشر.`
    : `Browse ${n} ${typeEn.toLowerCase()} ${txEn.en} in ${placeEn}${price ? ` from QAR ${fmtNum(price.min)}${per}` : ""}. Licence-verified agents, availability confirmed before publishing.`
  ).slice(0, 300);

  const faq: { q: string; a: string }[] = [];
  if (price) {
    faq.push(ar
      ? { q: `كم سعر ${typeAr} ${txEn.ar} في ${placeAr}؟`, a: `بحسب الإعلانات المنشورة الآن على نيرو فايندر، ${price.min === price.max ? `السعر ${fmtNum(price.min)} ر.ق${per}` : `تتراوح الأسعار بين ${fmtNum(price.min)} و${fmtNum(price.max)} ر.ق${per}`}. تتغير الأسعار بحسب المبنى والمساحة والتأثيث.` }
      : { q: `How much are ${typeEn.toLowerCase()} ${txEn.en} in ${placeEn}?`, a: `Based on the listings published on Nerou Finder right now, ${price.min === price.max ? `the price is QAR ${fmtNum(price.min)}${per}` : `prices range from QAR ${fmtNum(price.min)} to QAR ${fmtNum(price.max)}${per}`}. Prices vary with the building, size and furnishing.` });
  }
  faq.push(ar
    ? { q: "هل الإعلانات موثّقة؟", a: "نعم. يتم التحقق من رخصة كل وسيط، ويُؤكَّد توفر كل عقار قبل نشره، ويظهر كل عقار مرة واحدة فقط." }
    : { q: "Are these listings verified?", a: "Yes. Every agent's licence is verified, each listing's availability is confirmed before it is published, and each unit is listed once." });
  faq.push(ar
    ? { q: "كيف أحجز معاينة؟", a: "افتح أي إعلان واضغط على طلب معاينة، وسيؤكد لك الوسيط الموعد." }
    : { q: "How do I arrange a viewing?", a: "Open any listing and request a viewing. The agent confirms the time with you." });

  const home = { name: ar ? "الرئيسية" : "Home", path: "/" };
  const breadcrumbs = [home];
  if (spec.area || spec.type) breadcrumbs.push({ name: ar ? `عقارات ${txEn.ar} في قطر` : `Properties ${txEn.en} in Qatar`, path: landingPath({ tx: spec.tx }) });
  if (spec.area && spec.type) breadcrumbs.push({ name: ar ? `عقارات ${txEn.ar} في ${ctx.areaName?.ar || ""}` : `Properties ${txEn.en} in ${ctx.areaName?.en || ""}`, path: landingPath({ tx: spec.tx, area: spec.area }) });
  breadcrumbs.push({ name: h1, path: landing.path });
  // collapse a duplicate when the page is itself the breadcrumb's parent level
  const seen = new Set<string>();
  const crumbs = breadcrumbs.filter(b => (seen.has(b.path) ? false : (seen.add(b.path), true)));

  return { title, description, h1, intro, facts, faq, breadcrumbs: crumbs };
}

/** Pages worth linking to from a landing page: its siblings that exist and are indexable. */
export function relatedLandings(all: Landing[], current: Landing, limit = 8): Landing[] {
  const ok = all.filter(l => l.indexable && l.path !== current.path);
  const score = (l: Landing) =>
    (l.spec.area === current.spec.area ? 2 : 0) + (l.spec.type === current.spec.type ? 2 : 0) + (l.spec.tx === current.spec.tx ? 1 : 0);
  return ok.sort((a, b) => score(b) - score(a) || b.listings.length - a.listings.length).slice(0, limit);
}

/** Short label for a landing page, e.g. in a "popular searches" list. */
export function landingLabel(l: Landing, lang: Lang, locations: LocationItem[] = []): string {
  const g = TYPE_GROUPS.find(x => x.slug === l.spec.type);
  const district = l.listings[0]?.district;
  const area = l.spec.area && district ? areaNameFor(district, locations) : null;
  return lang === "ar"
    ? `${g ? g.ar : "عقارات"} ${TX_INFO[l.spec.tx].ar} في ${area ? area.ar : "قطر"}`
    : `${g ? g.en : "Properties"} ${TX_INFO[l.spec.tx].en} in ${area ? area.en : "Qatar"}`;
}

/** Arabic search snippet for a listing page, built from its structured fields (never the agent's free text). */
export function listingMetaAr(p: Property, locations: LocationItem[] = []): string {
  const g = TYPE_GROUPS.find(x => x.types.includes(p.propertyType as unknown as string));
  const isRent = TX_INFO.rent.types.includes(p.transactionType as unknown as string);
  const area = p.district ? areaNameFor(p.district, locations).ar : "";
  const parts = [
    `${g ? g.ar : "عقار"} ${isRent ? TX_INFO.rent.ar : TX_INFO.sale.ar}${area ? ` في ${area}` : ""}، قطر`,
    p.bedrooms === 0 ? "استوديو" : typeof p.bedrooms === "number" ? `${p.bedrooms} غرف نوم` : "",
    p.area ? `${Math.round(p.area)} ${p.sizeUnit === "SQFT" ? "قدم²" : "م²"}` : "",
    p.price ? `${Math.round(p.price).toLocaleString("en-US")} ${p.currency === "USD" ? "دولار" : "ر.ق"}${isRent ? " شهريًا" : ""}` : "",
    "من وسيط موثّق الرخصة على نيرو فايندر."
  ].filter(Boolean);
  const out = parts.join(" · ");
  return out.length > 160 ? out.slice(0, 157).trimEnd() + "…" : out;
}
