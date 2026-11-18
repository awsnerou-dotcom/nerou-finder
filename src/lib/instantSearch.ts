// "Nerou Find" without waiting for an AI model. A visitor's request ("2-bedroom apartment in Lusail under 12,000 QAR", "فيلا للبيع في الريان")
// is read by rules, matched against the live listings in the server's memory, and answered in a few milliseconds, in Arabic or English.
// The language model is only needed for open-ended chat that names no deal, type, place, size or budget, and even then a failure never leaves
// the visitor without an answer: server.ts falls back to a clarifying question.
//
// Why rules first: sending the whole catalogue to a model on every search made each answer take many seconds and sometimes fail. A search
// that names what it wants does not need a model to find it, only to be read correctly.

import type { Property } from "../types.js";
import { foldText, matchBedrooms, matchFurnishing, matchPlace, matchTransaction, matchType } from "./listingFromText.js";
import type { PlaceRef } from "./listingFromText.js";
import { areaSlug } from "./seo.js";

export type Deal = "RENT" | "SALE" | "OFF_PLAN";
export type Feature = "pool" | "seaView" | "parking" | "gym" | "garden" | "balcony" | "maid" | "majlis" | "metro" | "elevator";

export interface Criteria {
  deal?: Deal;
  types?: string[];
  bedsMin?: number;
  bedsMax?: number;
  maxPrice?: number;
  minPrice?: number;
  place?: PlaceRef;
  /** places the visitor asked to leave out ("a different area") */
  excludePlaces?: string[];
  furnished?: "YES" | "NO" | "PARTLY";
  features: Feature[];
}

/** How many separate things the request named. Zero means "I do not know what you want yet". */
export function recognizedCount(c: Criteria): number {
  return [c.deal, c.types?.length, c.bedsMin !== undefined || c.bedsMax !== undefined, c.maxPrice !== undefined || c.minPrice !== undefined, c.place, c.furnished, c.features.length]
    .filter(Boolean).length;
}

// ---------------------------------------------------------------------------------------------
// Reading the request
// ---------------------------------------------------------------------------------------------

const TYPE_GROUPS: Record<string, string[]> = {
  APARTMENT: ["APARTMENT", "HOTEL_APARTMENT"],
  STUDIO: ["STUDIO"]
};

const FEATURE_WORDS: [Feature, RegExp][] = [
  ["pool", /\bpool\b|swimming|مسبح|سباحه/],
  ["seaView", /sea view|ocean view|water ?front|marina view|اطلاله بحري|اطلاله علي البحر|اطلاله علي الماء|مطله علي البحر/],
  ["parking", /parking|garage|موقف|كراج|جراج/],
  ["gym", /\bgym\b|fitness|نادي رياضي|جيم/],
  ["garden", /garden|backyard|حديقه|حوش/],
  ["balcony", /balcon|بلكون|شرفه|تراس/],
  ["maid", /maid|غرفه خادمه|غرفه عامله|خادمه/],
  ["majlis", /majlis|مجلس/],
  ["metro", /metro|مترو/],
  ["elevator", /elevator|\blift\b|مصعد/]
];

const NUM = "(\\d[\\d,]*(?:\\.\\d+)?)";
const SUFFIX = "(k|الف|m|million|مليون)?";
const MAX_WORDS = /(under|below|less than|up to|upto|max(?:imum)?|within|not more than|no more than|at most|budget|around|about|اقل من|اقل|لا يزيد|لا تزيد|حد اقصي|اقصي|في حدود|بحدود|ميزانيتي|ميزانيه|تحت|حتي|الي)\s*[:=-]?\s*(?:of|is|قدر)?\s*(?:qar|qr|ر\.?\s?ق|ريال|riyals?)?\s*$/;
const MIN_WORDS = /(over|above|more than|at least|starting (?:from|at)|from|min(?:imum)?|اكثر من|اكتر من|اعلي من|فوق|ابتداء من|بدايه من|لا يقل عن|من)\s*[:=-]?\s*(?:qar|qr|ر\.?\s?ق|ريال|riyals?)?\s*$/;

function toAmount(raw: string, suffix?: string): number | undefined {
  const cleaned = raw.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;
  let n = Number(cleaned);
  if (suffix) {
    if (/^(k|الف)$/.test(suffix)) n *= 1000;
    else n *= 1_000_000;
  }
  return n;
}

/** The budget the request names: a maximum, a minimum, or a range. Numbers that belong to bedrooms, bathrooms or sizes are ignored. */
export function parsePrice(f: string): { min?: number; max?: number } {
  // take out what a number can mean besides money
  const cleaned = f
    .replace(/\d+\s*-?\s*(?:br\b|bhk|bd\b|beds?\b|bedrooms?|baths?\b|bathrooms?|غرف|غرفه|حمام|حمامات|sq\.?\s?m\b|sqm|m2|m²|sq\.?\s?ft|متر|م2|%|years?|سنه|سنوات|floor|طابق)/g, " ");
  const range = new RegExp(`${NUM}\\s*${SUFFIX}\\s*(?:-|–|to|and|الي|و)\\s*${NUM}\\s*${SUFFIX}`).exec(cleaned);
  if (range) {
    const a = toAmount(range[1], range[2] || range[4]);
    const b = toAmount(range[3], range[4] || range[2]);
    if (a !== undefined && b !== undefined && a >= 500 && b >= 500) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const money = new RegExp(`${NUM}\\s*${SUFFIX}(?![\\d\\w])`, "g");
  let m: RegExpExecArray | null;
  while ((m = money.exec(cleaned))) {
    const n = toAmount(m[1], m[2]);
    if (n === undefined) continue;
    // a bare small number is a count, not a price; a figure with k/million or from 1,000 up is money
    if (!m[2] && n < 1000) continue;
    if (n < 500) continue;
    const before = cleaned.slice(Math.max(0, m.index - 28), m.index);
    if (MAX_WORDS.test(before)) return { max: n };
    if (MIN_WORDS.test(before)) return { min: n };
    return { max: n }; // "12,000 QAR" or "budget 12000": what they can spend
  }
  return {};
}

/** Reads one request into criteria. `places` is the platform's location list. */
export function parseRequest(text: string, places: PlaceRef[] = []): Criteria {
  const f = foldText(text);
  const c: Criteria = { features: [] };

  if (/off[- ]?plan|على المخطط|علي المخطط|قيد الانشاء|تحت الانشاء/.test(f)) c.deal = "OFF_PLAN";
  else {
    const t = matchTransaction(f);
    if (t === "FOR_RENT") c.deal = "RENT";
    else if (t === "FOR_SALE") c.deal = "SALE";
    else if (/\bbuy(?:ing)?\b|\bpurchase\b|شراء|اشتري|اشتر|تملك|تمليك/.test(f)) c.deal = "SALE";
    else if (/\brenting\b|استاجر|اجار|استئجار/.test(f)) c.deal = "RENT";
  }

  const type = matchType(f);
  if (type) c.types = TYPE_GROUPS[type] || [type];

  const plus = /(\d{1,2})\s*\+\s*-?\s*(?:br\b|bhk|beds?\b|bedrooms?|غرف|غرفه)/.exec(f); // "3+ bedrooms"
  const beds = plus ? Number(plus[1]) : matchBedrooms(f, type);
  if (beds !== undefined && type !== "STUDIO") {
    const atLeast = /at least|min(?:imum)?|or more|\d\s*\+|فاكثر|او اكثر|علي الاقل|على الاقل/.test(f);
    c.bedsMin = beds;
    if (!atLeast) c.bedsMax = beds;
  }

  const price = parsePrice(f);
  if (price.max !== undefined) c.maxPrice = price.max;
  if (price.min !== undefined) c.minPrice = price.min;

  const place = matchPlace(text, places);
  if (place) c.place = place.place;

  const furnished = matchFurnishing(f);
  if (furnished) c.furnished = furnished === "FULLY_FURNISHED" ? "YES" : furnished === "SEMI_FURNISHED" ? "PARTLY" : "NO";

  for (const [feature, re] of FEATURE_WORDS) if (re.test(f)) c.features.push(feature);
  return c;
}

// ---------------------------------------------------------------------------------------------
// "Cheaper", "more bedrooms", "a different area": a follow-up reads the last request, not a new one
// ---------------------------------------------------------------------------------------------

export function monthlyPrice(p: Pick<Property, "price" | "rentalPeriod">): number {
  if (p.rentalPeriod === "YEARLY") return p.price / 12;
  if (p.rentalPeriod === "WEEKLY") return (p.price * 52) / 12;
  if (p.rentalPeriod === "DAILY") return p.price * 30;
  return p.price;
}

const priceOf = (p: Property, deal?: Deal) => (deal === "RENT" ? monthlyPrice(p) : p.price);
const roundBudget = (n: number) => (n >= 100_000 ? Math.round(n / 5000) * 5000 : n >= 5000 ? Math.round(n / 100) * 100 : Math.round(n / 50) * 50);

/** Turns a short follow-up into new criteria from the previous ones, or null when it is not one of the usual refinements. */
export function refineCriteria(prev: Criteria, text: string, lastResults: Property[], places: PlaceRef[] = []): Criteria | null {
  const f = foldText(text);
  const next: Criteria = { ...prev, features: [...prev.features] };
  let changed = false;
  let usedRefinement = false;

  if (/cheaper|less expensive|lower price|lower budget|ارخص|اقل سعر|اقل تكلفه|سعر اقل|ميزانيه اقل/.test(f)) {
    const known = prev.maxPrice ?? (lastResults.length ? Math.max(...lastResults.map(p => priceOf(p, prev.deal))) : undefined);
    if (known !== undefined) { next.maxPrice = roundBudget(known * 0.85); changed = true; usedRefinement = true; }
  }
  if (/more bedrooms|extra bedroom|bigger|larger|more rooms|اكبر|غرف اكثر|غرف نوم اكثر|بغرف اكثر|زياده غرف|غرف زياده/.test(f)) {
    const known = prev.bedsMax ?? prev.bedsMin ?? (lastResults.length ? Math.max(...lastResults.map(p => p.bedrooms)) : undefined);
    next.bedsMin = (known ?? 1) + 1;
    next.bedsMax = undefined;
    changed = true;
    usedRefinement = true;
  }
  if (/different area|another area|other area|elsewhere|somewhere else|منطقه اخري|منطقه ثانيه|مكان اخر|منطقه مختلفه|مكان ثاني/.test(f)) {
    const away = [prev.place?.name, ...lastResults.map(p => p.district)].filter((x): x is string => !!x);
    next.excludePlaces = [...new Set([...(prev.excludePlaces || []), ...away])];
    next.place = undefined;
    changed = true;
    usedRefinement = true;
  }

  // A request that names a new kind of property or a new deal ("villas for sale") is a fresh search, not a tweak of the last one.
  const fresh = parseRequest(text, places);
  if (!usedRefinement && (fresh.deal || fresh.types)) return recognizedCount(fresh) > 0 ? fresh : null;
  // anything else the visitor said that names something ("with a pool", "in Al Wakrah", "3 bedrooms") overrides the earlier value
  if (fresh.deal) { next.deal = fresh.deal; changed = true; }
  if (fresh.types) { next.types = fresh.types; changed = true; }
  if (fresh.bedsMin !== undefined) { next.bedsMin = fresh.bedsMin; next.bedsMax = fresh.bedsMax; changed = true; }
  if (fresh.maxPrice !== undefined) { next.maxPrice = fresh.maxPrice; changed = true; }
  if (fresh.minPrice !== undefined) { next.minPrice = fresh.minPrice; changed = true; }
  if (fresh.place) { next.place = fresh.place; next.excludePlaces = undefined; changed = true; }
  if (fresh.furnished) { next.furnished = fresh.furnished; changed = true; }
  for (const x of fresh.features) if (!next.features.includes(x)) { next.features.push(x); changed = true; }
  return changed ? next : null;
}

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------

const DEAL_TYPES: Record<Deal, string[]> = {
  RENT: ["FOR_RENT", "COMMERCIAL_LEASE"],
  SALE: ["FOR_SALE", "COMMERCIAL_SALE", "LAND_SALE"],
  OFF_PLAN: ["OFF_PLAN"]
};

const fold = (s: unknown) => foldText(String(s ?? ""));

/** The names a place answers to: itself and everything inside it, in both languages. */
function placeNames(place: PlaceRef, places: PlaceRef[]): Set<string> {
  const ids = new Set<string>([place.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of places) if (p.parentId && ids.has(p.parentId) && !ids.has(p.id)) { ids.add(p.id); grew = true; }
  }
  const names = new Set<string>();
  for (const p of places) {
    if (!ids.has(p.id)) continue;
    for (const n of [p.name, p.nameAr]) if (n) { names.add(fold(n)); names.add(areaSlug(n)); }
  }
  return names;
}

const inPlace = (p: Property, names: Set<string>) =>
  [p.district, p.city].some(v => !!v && (names.has(fold(v)) || names.has(areaSlug(String(v)))));

function hasFeature(p: Property, f: Feature): boolean {
  const bag = fold([...(p.amenities || []), p.viewType, p.title, p.description].join(" "));
  switch (f) {
    case "pool": return !!p.privatePool || /\bpool\b|swimming|مسبح|سباحه/.test(bag);
    case "seaView": return /sea|ocean|water|marina|lagoon|بحر|ماء|مارينا/.test(fold(p.viewType)) || /sea view|ocean view|waterfront|اطلاله بحريه/.test(bag);
    case "parking": return p.parking === true || /parking|garage|موقف|كراج/.test(bag);
    case "gym": return /\bgym\b|fitness|نادي|جيم/.test(bag);
    case "garden": return !!p.backyard || /garden|backyard|حديقه/.test(bag);
    case "balcony": return /balcon|بلكون|شرفه|تراس/.test(bag);
    case "maid": return !!p.maidRoom || /maid|خادمه/.test(bag);
    case "majlis": return !!p.majlis || /majlis|مجلس/.test(bag);
    case "metro": return /metro|مترو/.test(bag);
    case "elevator": return !!p.elevator || /elevator|\blift\b|مصعد/.test(bag);
  }
}

interface Pass { widenBudget?: boolean; looseBeds?: boolean; dropFeatures?: boolean; dropPlace?: boolean }

function matchesPass(p: Property, c: Criteria, pass: Pass, names: Set<string> | undefined, excluded: Set<string> | undefined): boolean {
  if (c.deal && !DEAL_TYPES[c.deal].includes(String(p.transactionType))) return false;
  if (c.types && !c.types.includes(String(p.propertyType))) return false;
  const price = priceOf(p, c.deal);
  const stretch = pass.widenBudget ? 1.25 : 1;
  if (c.maxPrice !== undefined && price > c.maxPrice * stretch) return false;
  if (c.minPrice !== undefined && price < c.minPrice / stretch) return false;
  const slack = pass.looseBeds ? 1 : 0;
  if (c.bedsMin !== undefined && p.bedrooms < c.bedsMin - slack) return false;
  if (c.bedsMax !== undefined && p.bedrooms > c.bedsMax + slack) return false;
  if (!pass.dropPlace && names && !inPlace(p, names)) return false;
  if (excluded && inPlace(p, excluded)) return false;
  if (!pass.dropFeatures) {
    if (c.furnished && p.furnished !== c.furnished) return false;
    for (const f of c.features) if (!hasFeature(p, f)) return false;
  }
  return true;
}

export interface Hit { property: Property; score: number }
export interface SearchOutcome {
  hits: Hit[];
  /** how many listings matched in all (hits is capped) */
  total: number;
  /** what had to be loosened to find anything: empty when the match is exact */
  relaxed: ("extras" | "budget" | "bedrooms" | "area")[];
}

/** The listings that fit, best first. Nothing found? Loosen one thing at a time and say which. */
export function searchListings(properties: Property[], c: Criteria, places: PlaceRef[] = [], limit = 6): SearchOutcome {
  const names = c.place ? placeNames(c.place, places.length ? places : [c.place]) : undefined;
  const excluded = c.excludePlaces?.length ? new Set(c.excludePlaces.flatMap(n => [fold(n), areaSlug(n)])) : undefined;
  const ladder: { pass: Pass; note?: SearchOutcome["relaxed"][number] }[] = [
    { pass: {} },
    { pass: { dropFeatures: true }, note: "extras" },
    { pass: { dropFeatures: true, widenBudget: true }, note: "budget" },
    { pass: { dropFeatures: true, widenBudget: true, looseBeds: true }, note: "bedrooms" },
    { pass: { dropFeatures: true, widenBudget: true, looseBeds: true, dropPlace: true }, note: "area" }
  ];
  const wantedFeatures = c.features.length > 0 || !!c.furnished;
  const relaxed: SearchOutcome["relaxed"] = [];
  for (const step of ladder) {
    if (step.note === "extras" && !wantedFeatures) continue;
    if (step.note === "budget" && c.maxPrice === undefined && c.minPrice === undefined) continue;
    if (step.note === "bedrooms" && c.bedsMin === undefined && c.bedsMax === undefined) continue;
    if (step.note === "area" && !c.place) continue;
    if (step.note) relaxed.push(step.note);
    const found = properties.filter(p => matchesPass(p, c, step.pass, names, excluded));
    if (found.length === 0) continue;
    const now = Date.now();
    const scored = found.map(property => {
      const age = Math.max(0, (now - new Date(property.updatedDate || property.createdDate).getTime()) / 86_400_000);
      let score = 100 + Math.max(0, 10 - age / 6); // fresher is a little better
      for (const f of c.features) if (hasFeature(property, f)) score += 5;
      if (c.furnished && property.furnished === c.furnished) score += 4;
      if (names && inPlace(property, names)) score += 6;
      if (c.maxPrice !== undefined && priceOf(property, c.deal) <= c.maxPrice) score += 3;
      score += Math.min(8, (property.qualityScore || 0) / 12.5);
      return { property, score };
    }).sort((a, b) => b.score - a.score);
    return { hits: scored.slice(0, limit), total: found.length, relaxed };
  }
  return { hits: [], total: 0, relaxed: [] };
}

// ---------------------------------------------------------------------------------------------
// Saying it in words
// ---------------------------------------------------------------------------------------------

const TYPE_EN: Record<string, [string, string]> = {
  APARTMENT: ["apartment", "apartments"], VILLA: ["villa", "villas"], TOWNHOUSE: ["townhouse", "townhouses"], PENTHOUSE: ["penthouse", "penthouses"],
  COMPOUND: ["compound home", "compound homes"], STUDIO: ["studio", "studios"], ROOM: ["room", "rooms"], OFFICE: ["office", "offices"], SHOP: ["shop", "shops"],
  RETAIL: ["retail space", "retail spaces"], WAREHOUSE: ["warehouse", "warehouses"], BUILDING: ["building", "buildings"], LAND: ["plot of land", "plots of land"],
  HOTEL_APARTMENT: ["hotel apartment", "hotel apartments"], CHALET: ["chalet", "chalets"], FARM: ["farm", "farms"]
};
const TYPE_AR: Record<string, string> = {
  APARTMENT: "شقق", VILLA: "فلل", TOWNHOUSE: "تاون هاوس", PENTHOUSE: "بنتهاوس", COMPOUND: "وحدات في مجمعات", STUDIO: "استوديوهات", ROOM: "غرف", OFFICE: "مكاتب",
  SHOP: "محلات", RETAIL: "مساحات تجارية", WAREHOUSE: "مستودعات", BUILDING: "عمارات", LAND: "أراضي", HOTEL_APARTMENT: "شقق فندقية", CHALET: "شاليهات", FARM: "مزارع"
};
const FEATURE_EN: Record<Feature, string> = { pool: "a pool", seaView: "a sea view", parking: "parking", gym: "a gym", garden: "a garden", balcony: "a balcony", maid: "a maid's room", majlis: "a majlis", metro: "metro access", elevator: "a lift" };
const FEATURE_AR: Record<Feature, string> = { pool: "مسبح", seaView: "إطلالة بحرية", parking: "موقف", gym: "نادٍ رياضي", garden: "حديقة", balcony: "شرفة", maid: "غرفة خادمة", majlis: "مجلس", metro: "قرب المترو", elevator: "مصعد" };

const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** "2-bedroom apartments for rent in Lusail up to QAR 12,000", and the same in Arabic. */
export function describeCriteria(c: Criteria, plural = true): { en: string; ar: string } {
  const typeKey = c.types?.[0];
  const noun = typeKey ? TYPE_EN[typeKey] : undefined;
  const beds = c.bedsMin !== undefined && c.bedsMin === c.bedsMax ? (c.bedsMin === 0 ? "" : `${c.bedsMin}-bedroom `) : c.bedsMin !== undefined ? `${c.bedsMin}+ bedroom ` : "";
  const enNoun = noun ? noun[plural ? 1 : 0] : plural ? "properties" : "property";
  const deal = c.deal === "RENT" ? " for rent" : c.deal === "SALE" ? " for sale" : c.deal === "OFF_PLAN" ? " off-plan" : "";
  const place = c.place ? ` in ${c.place.name}` : "";
  const budget = c.maxPrice !== undefined && c.minPrice !== undefined ? ` between QAR ${num(c.minPrice)} and QAR ${num(c.maxPrice)}` : c.maxPrice !== undefined ? ` up to QAR ${num(c.maxPrice)}` : c.minPrice !== undefined ? ` from QAR ${num(c.minPrice)}` : "";
  const per = c.deal === "RENT" && (c.maxPrice !== undefined || c.minPrice !== undefined) ? " a month" : "";
  const extras = [c.furnished === "YES" ? "furnished" : c.furnished === "NO" ? "unfurnished" : c.furnished === "PARTLY" ? "semi-furnished" : "", ...c.features.map(f => `with ${FEATURE_EN[f]}`)].filter(Boolean);
  const en = `${beds}${enNoun}${deal}${place}${budget}${per}${extras.length ? ` (${extras.join(", ")})` : ""}`.replace(/\s+/g, " ").trim();

  const arNoun = typeKey ? TYPE_AR[typeKey] || "عقارات" : "عقارات";
  const arBeds = c.bedsMin !== undefined && c.bedsMin === c.bedsMax ? (c.bedsMin === 0 ? "" : c.bedsMin === 1 ? " بغرفة نوم" : c.bedsMin === 2 ? " بغرفتي نوم" : ` بـ ${c.bedsMin} غرف نوم`) : c.bedsMin !== undefined ? ` بـ ${c.bedsMin} غرف نوم فأكثر` : "";
  const arDeal = c.deal === "RENT" ? " للإيجار" : c.deal === "SALE" ? " للبيع" : c.deal === "OFF_PLAN" ? " على المخطط" : "";
  const arPlace = c.place ? ` في ${c.place.nameAr || c.place.name}` : "";
  const arBudget = c.maxPrice !== undefined && c.minPrice !== undefined ? ` بين ${num(c.minPrice)} و${num(c.maxPrice)} ريال` : c.maxPrice !== undefined ? ` بحد أقصى ${num(c.maxPrice)} ريال` : c.minPrice !== undefined ? ` من ${num(c.minPrice)} ريال` : "";
  const arPer = c.deal === "RENT" && (c.maxPrice !== undefined || c.minPrice !== undefined) ? " شهرياً" : "";
  const arExtras = [c.furnished === "YES" ? "مفروش" : c.furnished === "NO" ? "غير مفروش" : c.furnished === "PARTLY" ? "شبه مفروش" : "", ...c.features.map(f => `مع ${FEATURE_AR[f]}`)].filter(Boolean);
  const ar = `${arNoun}${arBeds}${arDeal}${arPlace}${arBudget}${arPer}${arExtras.length ? ` (${arExtras.join("، ")})` : ""}`.replace(/\s+/g, " ").trim();
  return { en, ar };
}

const RELAXED_EN = { extras: "the extras", budget: "the budget", bedrooms: "the number of bedrooms", area: "the area" } as const;
const RELAXED_AR = { extras: "المزايا", budget: "الميزانية", bedrooms: "عدد الغرف", area: "المنطقة" } as const;

/** Why this listing is in the answer, from its own facts. */
export function whyMatch(p: Property, c: Criteria): { en: string; ar: string } {
  const rent = String(p.transactionType) === "FOR_RENT" || String(p.transactionType) === "COMMERCIAL_LEASE";
  const price = rent ? `QAR ${num(monthlyPrice(p))}/month` : `QAR ${num(p.price)}`;
  const bedsEn = p.bedrooms === 0 ? "Studio" : `${p.bedrooms} bedroom${p.bedrooms === 1 ? "" : "s"}`;
  const bedsAr = p.bedrooms === 0 ? "استوديو" : p.bedrooms === 1 ? "غرفة نوم" : p.bedrooms === 2 ? "غرفتا نوم" : `${p.bedrooms} غرف نوم`;
  const extrasEn = c.features.filter(f => hasFeature(p, f)).map(f => FEATURE_EN[f]);
  const extrasAr = c.features.filter(f => hasFeature(p, f)).map(f => FEATURE_AR[f]);
  const budgetOk = c.maxPrice !== undefined && (rent ? monthlyPrice(p) : p.price) <= c.maxPrice;
  return {
    en: [`${bedsEn}`, price, p.district, budgetOk ? "within your budget" : "", extrasEn.length ? `has ${extrasEn.join(", ")}` : ""].filter(Boolean).join(" · "),
    ar: [bedsAr, `${num(rent ? monthlyPrice(p) : p.price)} ريال${rent ? "/شهر" : ""}`, p.district, budgetOk ? "ضمن ميزانيتك" : "", extrasAr.length ? `فيه ${extrasAr.join("، ")}` : ""].filter(Boolean).join(" · ")
  };
}

export interface InstantAnswer {
  replyEn: string;
  replyAr: string;
  matches: { propertyId: string; whyMatchEn: string; whyMatchAr: string }[];
  total: number;
  relaxed: SearchOutcome["relaxed"];
}

/** "one property", "two properties", "5 properties" in Arabic's own grammar. */
const arCount = (n: number) => (n === 1 ? "عقاراً واحداً" : n === 2 ? "عقارين" : n <= 10 ? `${n} عقارات` : `${n} عقاراً`);

export function buildAnswer(c: Criteria, outcome: SearchOutcome): InstantAnswer {
  const d = describeCriteria(c, outcome.total !== 1);
  const matches = outcome.hits.map(h => {
    const w = whyMatch(h.property, c);
    return { propertyId: h.property.id, whyMatchEn: w.en, whyMatchAr: w.ar };
  });
  if (outcome.hits.length === 0) {
    return {
      replyEn: `I could not find any ${d.en} right now. Try a wider budget, another area or fewer requirements, and I will look again.`,
      replyAr: `لا توجد حالياً ${d.ar}. جرّب ميزانية أوسع أو منطقة أخرى أو شروطاً أقل وسأبحث من جديد.`,
      matches, total: 0, relaxed: []
    };
  }
  const n = outcome.hits.length;
  const more = outcome.total > n ? ` Showing the best ${n} of ${outcome.total}.` : "";
  const moreAr = outcome.total > n ? ` أعرض أفضل ${n} من ${outcome.total}.` : "";
  if (outcome.relaxed.length > 0) {
    const en = outcome.relaxed.map(r => RELAXED_EN[r]).join(" and ");
    const ar = outcome.relaxed.map(r => RELAXED_AR[r]).join(" و");
    return {
      replyEn: `I did not find an exact match for ${d.en}, so I loosened ${en} a little. These are the closest.${more}`,
      replyAr: `لم أجد تطابقاً تاماً مع ${d.ar}، فخففت ${ar} قليلاً. هذه أقرب النتائج.${moreAr}`,
      matches, total: outcome.total, relaxed: outcome.relaxed
    };
  }
  return {
    replyEn: `Found ${outcome.total} ${d.en}.${more || " Here they are."}`,
    replyAr: `وجدت ${arCount(outcome.total)}: ${d.ar}.${moreAr || " تفضّل بالاطلاع عليها."}`,
    matches, total: outcome.total, relaxed: []
  };
}

// ---------------------------------------------------------------------------------------------
// What the chat remembers between messages (so "cheaper" and "a different area" work at once)
// ---------------------------------------------------------------------------------------------

export interface ChatMemory { criteria: Criteria; ids: string[]; at: number }

export class ChatMemoryStore {
  private map = new Map<string, ChatMemory>();
  constructor(private maxEntries = 2000, private ttlMs = 2 * 60 * 60 * 1000) {}
  get(id: string | undefined, now = Date.now()): ChatMemory | undefined {
    if (!id) return undefined;
    const m = this.map.get(id);
    if (!m) return undefined;
    if (now - m.at > this.ttlMs) { this.map.delete(id); return undefined; }
    return m;
  }
  set(id: string | undefined, value: Omit<ChatMemory, "at">, now = Date.now()): void {
    if (!id) return;
    this.map.delete(id); // re-insert at the end: the Map keeps insertion order, so the front is the oldest
    this.map.set(id, { ...value, at: now });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
  get size() { return this.map.size; }
}

/** One request, answered instantly when it names something; `null` means a model is needed to understand it. */
export function answerInstantly(prompt: string, properties: Property[], places: PlaceRef[], memory?: ChatMemory): { criteria: Criteria; answer: InstantAnswer } | null {
  let criteria: Criteria | null = null;
  if (memory) {
    const last = properties.filter(p => memory.ids.includes(p.id));
    criteria = refineCriteria(memory.criteria, prompt, last, places);
  }
  if (!criteria) {
    const fresh = parseRequest(prompt, places);
    if (recognizedCount(fresh) === 0) return null;
    criteria = fresh;
  }
  const outcome = searchListings(properties, criteria, places);
  return { criteria, answer: buildAnswer(criteria, outcome) };
}
