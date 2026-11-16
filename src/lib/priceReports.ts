// "Average rent in Lusail", "Property prices in West Bay": one page per area and per deal (rent or sale), plus one for the
// whole country, made only from the live listings, so every figure is real and every page is current. People search for these
// numbers all the time and the sites that answer them with live data win the searches. A page exists only when there are
// enough listings to say something (REPORT_MIN_LISTINGS); with fewer it does not exist rather than guessing. Pure
// functions, unit tested.

import { ListingStatus, VerificationStatus } from "../types.js";
import type { LocationItem, Property } from "../types.js";
import { dealOf } from "./marketComparison.js";
import type { Deal } from "./marketComparison.js";
import { monthlyPrice } from "./priceCheck.js";
import { areaNameFor, areaSlug } from "./seo.js";
import type { Lang } from "./seo.js";
import { percentile } from "./valuation.js";

export const REPORT_MIN_LISTINGS = 3;
export const COUNTRY_SLUG = "qatar";

export interface ReportListing { id: string; title: string; price: number; area: number; bedrooms: number; district: string }
export interface BedroomRow { bedrooms: number; count: number; median: number; min: number; max: number }
export interface TypeRow { type: string; count: number; median: number }

export interface PriceReport {
  deal: Deal;
  scope: "area" | "country";
  slug: string;
  district: string;
  districtAr: string;
  city: string;
  count: number;
  median: number;
  average: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  /** monthly rent (or price) per square metre among listings that state a size; null when too few do */
  medianPerSqm: number | null;
  byBedrooms: BedroomRow[];
  byType: TypeRow[];
  cheapest: ReportListing[];
  /** newest listing change, YYYY-MM-DD */
  updated: string | null;
}

const norm = (s: string | undefined) => (s || "").trim();

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "";
}

const round = (n: number) => Math.round(n);

function statsFor(list: Property[]) {
  const prices = list.map(p => monthlyPrice(p));
  const perSqmValues = list.filter(p => p.area > 0).map(p => monthlyPrice(p) / p.area);
  return {
    median: round(percentile(prices, 50)),
    average: round(prices.reduce((s, v) => s + v, 0) / prices.length),
    p25: round(percentile(prices, 25)),
    p75: round(percentile(prices, 75)),
    min: round(Math.min(...prices)),
    max: round(Math.max(...prices)),
    medianPerSqm: perSqmValues.length >= REPORT_MIN_LISTINGS ? round(percentile(perSqmValues, 50)) : null
  };
}

function breakdowns(list: Property[]): { byBedrooms: BedroomRow[]; byType: TypeRow[] } {
  const beds = new Map<number, Property[]>();
  for (const p of list) if (typeof p.bedrooms === "number") beds.set(p.bedrooms, [...(beds.get(p.bedrooms) || []), p]);
  const byBedrooms = [...beds.entries()]
    .filter(([, l]) => l.length >= 2)
    .sort((a, b) => a[0] - b[0])
    .slice(0, 7)
    .map(([bedrooms, l]) => {
      const prices = l.map(p => monthlyPrice(p));
      return { bedrooms, count: l.length, median: round(percentile(prices, 50)), min: round(Math.min(...prices)), max: round(Math.max(...prices)) };
    });
  const types = new Map<string, Property[]>();
  for (const p of list) types.set(p.propertyType, [...(types.get(p.propertyType) || []), p]);
  const byType = [...types.entries()]
    .filter(([, l]) => l.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([type, l]) => ({ type, count: l.length, median: round(percentile(l.map(p => monthlyPrice(p)), 50)) }));
  return { byBedrooms, byType };
}

function newest(list: Property[]): string | null {
  const days = list.map(p => (p.updatedDate || p.createdDate || "").slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return days.length ? days[days.length - 1] : null;
}

function makeReport(deal: Deal, list: Property[], base: { scope: "area" | "country"; slug: string; district: string; districtAr: string; city: string }): PriceReport {
  const cheapest = [...list]
    .sort((a, b) => monthlyPrice(a) - monthlyPrice(b))
    .slice(0, 3)
    .map(p => ({ id: p.id, title: (p.title || "").trim(), price: round(monthlyPrice(p)), area: p.area, bedrooms: p.bedrooms, district: norm(p.district) }));
  return { deal, ...base, count: list.length, ...statsFor(list), ...breakdowns(list), cheapest, updated: newest(list) };
}

/** Every price report the live listings can support: one per area and deal with enough listings, plus the country pages. */
export function buildPriceReports(properties: Property[], locations: LocationItem[] = []): PriceReport[] {
  const live = properties.filter(p =>
    p.listingStatus === ListingStatus.PUBLISHED && p.verificationStatus === VerificationStatus.APPROVED && p.price > 0 && dealOf(p.transactionType) !== null
  );
  const out: PriceReport[] = [];
  for (const deal of ["RENT", "SALE"] as Deal[]) {
    const ofDeal = live.filter(p => dealOf(p.transactionType) === deal);
    if (ofDeal.length >= REPORT_MIN_LISTINGS) {
      out.push(makeReport(deal, ofDeal, { scope: "country", slug: COUNTRY_SLUG, district: "Qatar", districtAr: "قطر", city: "Qatar" }));
    }
    const groups = new Map<string, Property[]>();
    for (const p of ofDeal) {
      const slug = areaSlug(norm(p.district));
      if (!slug || slug === COUNTRY_SLUG) continue;
      groups.set(slug, [...(groups.get(slug) || []), p]);
    }
    for (const [slug, list] of groups) {
      if (list.length < REPORT_MIN_LISTINGS) continue;
      const typed = mostCommon(list.map(p => norm(p.district)));
      const name = areaNameFor(typed, locations); // the listed spelling when there is one ("Al Waab" for "Alwaab")
      out.push(makeReport(deal, list, { scope: "area", slug, district: name.en, districtAr: name.ar, city: mostCommon(list.map(p => norm(p.city))) }));
    }
  }
  return out;
}

export function reportPath(deal: Deal, slug: string): string {
  return deal === "RENT" ? `/average-rent-in-${slug}` : `/property-prices-in-${slug}`;
}

export function parseReportPath(path: string): { deal: Deal; slug: string } | null {
  const m = /^\/(average-rent-in|property-prices-in)-([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(path);
  if (!m) return null;
  return { deal: m[1] === "average-rent-in" ? "RENT" : "SALE", slug: m[2] };
}

export function findReport(reports: PriceReport[], deal: Deal, slug: string): PriceReport | undefined {
  return reports.find(r => r.deal === deal && r.slug === slug);
}

// ---------------------------------------------------------------------------------------------
// What a report says
// ---------------------------------------------------------------------------------------------

export interface ReportText {
  title: string;
  description: string;
  h1: string;
  intro: string;
  faq: { q: string; a: string }[];
  breadcrumbs: { name: string; path: string }[];
}

/** A figure a person would say: rents to the nearest 50, prices to the nearest 5,000. */
export function roundedFigure(deal: Deal, n: number): number {
  const step = deal === "RENT" ? 50 : 5000;
  return Math.max(step, Math.round(n / step) * step);
}

export const qar = (n: number) => `QAR ${Math.round(n).toLocaleString("en-US")}`;

export function bedroomsLabel(b: number, lang: Lang): string {
  if (b === 0) return lang === "ar" ? "استوديو" : "Studio";
  if (lang === "ar") return b === 1 ? "غرفة نوم" : `${b} غرف نوم`;
  return b === 1 ? "1 bedroom" : `${b} bedrooms`;
}

export function reportText(r: PriceReport, lang: Lang, o: { year: number; country?: PriceReport }): ReportText {
  const ar = lang === "ar";
  const rent = r.deal === "RENT";
  const name = ar ? r.districtAr : r.district;
  const typical = qar(roundedFigure(r.deal, r.median));
  const per = rent ? (ar ? " شهرياً" : " a month") : "";
  const lo = qar(roundedFigure(r.deal, r.p25));
  const hi = qar(roundedFigure(r.deal, r.p75));
  const min = qar(roundedFigure(r.deal, r.min));
  const max = qar(roundedFigure(r.deal, r.max));

  const title = ar
    ? rent ? `متوسط الإيجار في ${name} (${o.year}): الأسعار حسب عدد الغرف | نيرو فايندر` : `أسعار العقارات في ${name} (${o.year}): متوسط البيع | نيرو فايندر`
    : rent ? `Average Rent in ${name} (${o.year}): Prices by Bedrooms | Nerou Finder` : `Property Prices in ${name} (${o.year}): Average Asking Prices | Nerou Finder`;
  const h1 = ar ? (rent ? `متوسط الإيجار في ${name}` : `أسعار العقارات في ${name}`) : (rent ? `Average rent in ${name}` : `Property prices in ${name}`);
  const description = ar
    ? rent
      ? `الإيجار المعتاد في ${name} هو ${typical}${per}، من ${r.count} عقاراً معروضاً الآن. الإيجار حسب عدد الغرف، ونطاق الأسعار، وأرخص المعروض حالياً.`
      : `سعر البيع المعتاد في ${name} هو ${typical}، من ${r.count} عقاراً معروضاً الآن. الأسعار حسب عدد الغرف ونطاقها وأرخص المعروض حالياً.`
    : rent
      ? `The typical rent in ${name} is ${typical}${per}, from ${r.count} live listings. See rent by number of bedrooms, the price range and the cheapest places available now.`
      : `The typical asking price in ${name} is ${typical}, from ${r.count} live listings. See prices by number of bedrooms, the price range and the cheapest places available now.`;

  const sqm = r.medianPerSqm !== null ? qar(r.medianPerSqm) : null;
  const intro = ar
    ? `بناءً على ${r.count} عقاراً معروضاً من وسطاء موثّقي الرخصة، ${rent ? "الإيجار المعتاد" : "سعر البيع المعتاد"} في ${name} هو ${typical}${per}. معظم العقارات بين ${lo} و${hi}، ويمتد النطاق الكامل من ${min} إلى ${max}.${sqm ? ` وهذا يعادل نحو ${sqm} للمتر المربع${rent ? " شهرياً" : ""}.` : ""}`
    : `Based on ${r.count} live listings from licence-verified agents, the typical ${rent ? "rent" : "asking price"} in ${name} is ${typical}${per}. Most listings sit between ${lo} and ${hi}, and the full range runs from ${min} to ${max}.${sqm ? ` That is about ${sqm} per square metre${rent ? " per month" : ""}.` : ""}`;

  const faq: { q: string; a: string }[] = [];
  faq.push(ar
    ? { q: rent ? `ما متوسط الإيجار في ${name}؟` : `ما متوسط سعر العقار في ${name}؟`, a: `${rent ? "الإيجار المعتاد" : "السعر المعتاد"} هو ${typical}${per} (من ${r.count} عقاراً معروضاً). معظم الأسعار بين ${lo} و${hi}.` }
    : { q: rent ? `What is the average rent in ${name}?` : `What is the average property price in ${name}?`, a: `The typical ${rent ? "rent" : "asking price"} is ${typical}${per}, from ${r.count} live listings. Most are between ${lo} and ${hi}.` });
  const two = r.byBedrooms.find(b => b.bedrooms === 2);
  const pick = two || r.byBedrooms[0];
  if (pick) {
    const figure = qar(roundedFigure(r.deal, pick.median));
    const bl = bedroomsLabel(pick.bedrooms, lang);
    faq.push(ar
      ? { q: `كم ${rent ? "إيجار" : "سعر"} ${bl} في ${name}؟`, a: `المعتاد ${figure}${per}، من ${pick.count} عقارات، وتتراوح بين ${qar(roundedFigure(r.deal, pick.min))} و${qar(roundedFigure(r.deal, pick.max))}.` }
      : { q: `How much is a ${bl.toLowerCase()} ${rent ? "to rent" : "to buy"} in ${name}?`, a: `The typical figure is ${figure}${per}, from ${pick.count} listings, ranging from ${qar(roundedFigure(r.deal, pick.min))} to ${qar(roundedFigure(r.deal, pick.max))}.` });
  }
  if (o.country && r.scope === "area" && o.country.median > 0) {
    const diff = Math.round(((r.median - o.country.median) / o.country.median) * 100);
    const word = Math.abs(diff) < 3 ? (ar ? "قريب من" : "close to") : diff > 0 ? (ar ? `أعلى بنحو ${diff}% من` : `about ${diff}% above`) : (ar ? `أقل بنحو ${Math.abs(diff)}% من` : `about ${Math.abs(diff)}% below`);
    faq.push(ar
      ? { q: `هل ${name} ${rent ? "مرتفعة الإيجار" : "مرتفعة الأسعار"} مقارنة ببقية قطر؟`, a: `${rent ? "الإيجار المعتاد" : "السعر المعتاد"} فيها ${word} المتوسط العام في قطر (${qar(roundedFigure(r.deal, o.country.median))}${per}).` }
      : { q: `Is ${name} expensive compared with the rest of Qatar?`, a: `Its typical ${rent ? "rent" : "price"} is ${word} the Qatar-wide typical figure of ${qar(roundedFigure(r.deal, o.country.median))}${per}.` });
  }
  faq.push(ar
    ? { q: "من أين تأتي هذه الأرقام؟", a: "من الإعلانات المنشورة الآن على نيرو فايندر لدى وسطاء موثّقي الرخصة، وتتغير بتغير الإعلانات. هي أسعار معروضة وليست أسعار صفقات مكتملة." }
    : { q: "Where do these numbers come from?", a: "From the listings live now on Nerou Finder from licence-verified agents, so they change as listings change. They are asking prices, not completed deals." });

  const crumbBase = rent ? { name: ar ? "متوسط الإيجار في قطر" : "Average rent in Qatar", path: reportPath("RENT", COUNTRY_SLUG) } : { name: ar ? "أسعار العقارات في قطر" : "Property prices in Qatar", path: reportPath("SALE", COUNTRY_SLUG) };
  const breadcrumbs = [{ name: ar ? "الرئيسية" : "Home", path: "/" }, crumbBase, ...(r.scope === "area" ? [{ name, path: reportPath(r.deal, r.slug) }] : [])];

  return { title, description, h1, intro, faq, breadcrumbs };
}
