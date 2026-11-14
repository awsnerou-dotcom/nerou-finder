// Bringing an agent's listings in from somewhere else: a spreadsheet saved as CSV, a JSON feed, or an XML feed in the style the big
// portals use. Whatever the format, every record goes through the same reader, which understands the common column names in English
// and Arabic, converts what needs converting (a yearly rent to a month, square feet to metres, codes like RS/AP to words), matches the
// area to the platform's own, finds the photos, removes phone numbers from the text, and says exactly why a row cannot be used.
// A row that is usable but incomplete (no size, an area we do not know) comes through as incomplete, so it can only be saved as a draft.
// Pure functions, unit tested; the server does the fetching, saving and photo downloading.

import { parseCsv } from "./crm.js";
import { foldText, makeTitle, matchFurnishing, matchPlace, matchTransaction, matchType, normalizeDigits, stripContact } from "./listingFromText.js";
import type { PlaceRef } from "./listingFromText.js";
import { shortId } from "./profiles.js";
import { parseXml, XmlError } from "./xmlLite.js";

export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_IMAGES = 8;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export type ImportFormat = "csv" | "json" | "xml";

export interface ImportedListing {
  externalId: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  propertyType: string;
  transactionType: "FOR_RENT" | "FOR_SALE";
  /** a rent is per month */
  price: number;
  area: number;
  bedrooms?: number;
  bathrooms?: number;
  city: string;
  district: string;
  furnishing?: "FULLY_FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED";
  images: string[];
  /** false when something needed to publish is missing: it can then only be saved as a draft */
  complete: boolean;
  /** what a person should know about this row (a conversion made, a thing missing) */
  notes: string[];
}

export type ImportRowResult = { ok: true; listing: ImportedListing } | { ok: false; reason: string };

export function detectFormat(content: string): ImportFormat {
  const t = content.replace(/^\uFEFF/, "").trimStart();
  if (t.startsWith("<")) return "xml";
  if (t.startsWith("[") || t.startsWith("{")) return "json";
  return "csv";
}

// ---------------------------------------------------------------------------------------------
// From text to records
// ---------------------------------------------------------------------------------------------

export function csvToRecords(text: string): Record<string, unknown>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** A JSON array of listings, or an object that holds one under a usual name ("listings", "properties", "data"...). */
export function jsonToRecords(text: string): Record<string, unknown>[] {
  const data = JSON.parse(text.replace(/^\uFEFF/, ""));
  const list = Array.isArray(data) ? data : (["listings", "properties", "data", "items", "results", "ads"] as const).map(k => (data as Record<string, unknown>)?.[k]).find(Array.isArray);
  if (!Array.isArray(list)) throw new Error("The JSON is not a list of listings.");
  return list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The repeated record nodes of a parsed XML tree: the largest array of objects found (Property Finder style: list > property[]). */
export function xmlTreeToRecords(tree: unknown): Record<string, unknown>[] {
  let best: Record<string, unknown>[] = [];
  const walk = (node: unknown, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(node)) {
      const objs = node.filter(isObj);
      if (objs.length > best.length) best = objs;
      objs.forEach(o => walk(o, depth + 1));
    } else if (isObj(node)) {
      for (const v of Object.values(node)) walk(v, depth + 1);
    }
  };
  walk(tree, 0);
  // a feed with exactly one listing parses as a single object, not an array: take the first object that looks like a listing
  if (best.length === 0 && isObj(tree)) {
    const inner = Object.values(tree).find(isObj);
    const rec = inner && Object.values(inner).find(isObj);
    if (rec) best = [rec];
  }
  return best;
}

/** One record flattened to simple keys: nested names are joined with "_", a repeated value (several photos) becomes a list. */
export function flattenRecord(rec: Record<string, unknown>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const put = (key: string, value: string) => {
    const k = key.replace(/^@_/, "");
    const have = out[k];
    if (have === undefined) out[k] = value;
    else out[k] = Array.isArray(have) ? [...have, value] : [have, value];
  };
  const walk = (node: unknown, prefix: string) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) { node.forEach(n => walk(n, prefix)); return; }
    if (isObj(node)) {
      if ("#text" in node && prefix) put(prefix, String(node["#text"]));
      for (const [k, v] of Object.entries(node)) {
        if (k === "#text") continue;
        if (k.startsWith("@_")) continue; // attributes (updated-at, watermark flags...) are not listing data
        walk(v, prefix ? `${prefix}_${k}` : k);
      }
      return;
    }
    if (prefix) put(prefix, String(node));
  };
  walk(rec, "");
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reading one record
// ---------------------------------------------------------------------------------------------

const key = (s: string) => foldText(s).replace(/[^a-z0-9ء-ي]/g, "");

const ALIASES: Record<string, string[]> = {
  externalId: ["id", "ref", "reference", "referencenumber", "refno", "refnumber", "listingid", "externalid", "propertyid", "adid", "رقمالاعلان", "المرجع", "الرقمالمرجعي", "رقمالمرجع"],
  title: ["title", "titleen", "name", "listingtitle", "adtitle", "propertytitle", "العنوان", "عنوانالاعلان", "اسمالعقار"],
  titleAr: ["titlear", "arabictitle", "titlearabic", "العنوانعربي", "العنوانبالعربي"],
  description: ["description", "descriptionen", "desc", "details", "about", "adtext", "text", "الوصف", "تفاصيل", "نصالاعلان", "الاعلان"],
  descriptionAr: ["descriptionar", "arabicdescription", "descriptionarabic", "الوصفعربي", "الوصفبالعربي"],
  transaction: ["offeringtype", "transaction", "transactiontype", "dealtype", "purpose", "listingtype", "for", "deal", "rentorsale", "offering", "الغرض", "نوعالصفقه", "نوعالمعامله", "ايجارامبيع", "للايجارامللبيع"],
  propertyType: ["propertytype", "type", "category", "kind", "proptype", "نوعالعقار", "النوع", "العقار"],
  price: ["price", "rent", "amount", "askingprice", "listingprice", "السعر", "الايجار", "المبلغ", "سعر"],
  priceYearly: ["priceyearly", "yearlyprice", "yearlyrent", "annualrent", "الايجارالسنوي"],
  priceMonthly: ["pricemonthly", "monthlyprice", "monthlyrent", "الايجارالشهري"],
  priceSale: ["pricesale", "saleprice", "سعرالبيع"],
  period: ["rentalperiod", "period", "frequency", "pricefrequency", "paymentperiod", "rentperiod", "فتره", "فترهالايجار", "الدفع"],
  size: ["size", "sqm", "areasqm", "builtuparea", "plotarea", "propertysize", "totalarea", "sizesqm", "المساحه", "مساحه", "المساحهمتر"],
  sizeSqft: ["sqft", "sizesqft", "areasqft", "المساحهقدم"],
  area: ["area"],
  bedrooms: ["bedrooms", "bedroom", "beds", "bed", "br", "bhk", "numberofbedrooms", "غرف", "عددالغرف", "غرفالنوم", "غرفنوم"],
  bathrooms: ["bathrooms", "bathroom", "baths", "bath", "numberofbathrooms", "حمامات", "عددالحمامات", "الحمامات"],
  city: ["city", "municipality", "town", "البلديه", "المدينه"],
  district: ["district", "community", "location", "locality", "neighborhood", "neighbourhood", "subcommunity", "zone", "المنطقه", "الحي", "الموقع", "المنطقهالحي"],
  furnished: ["furnished", "furnishing", "furnishingstatus", "furnishedstatus", "الفرش", "مفروش", "الاثاث"],
  images: ["images", "photos", "photo", "photourl", "photourls", "pictures", "picture", "image", "imageurl", "imageurls", "imagelinks", "gallery", "صور", "الصور", "روابطالصور", "صوره"]
};

const ALIAS_LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [field, names] of Object.entries(ALIASES)) for (const n of names) m.set(n, field);
  return m;
})();

/** Maps each column of a record to the field it means (where we know it), keeping the raw value. */
function byField(flat: Record<string, string | string[]>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(flat)) {
    const field = ALIAS_LOOKUP.get(key(name));
    if (field && out[field] === undefined) out[field] = value;
  }
  return out;
}

const text = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

function toNumber(v: string | string[] | undefined): number | undefined {
  const s = normalizeDigits(text(v)).replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(/,/g, ".");
  if (!s || !/\d/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// portal codes: Property Finder / Bayut style offering and property types
const OFFERING_CODES: Record<string, "FOR_RENT" | "FOR_SALE"> = { rs: "FOR_SALE", cs: "FOR_SALE", rr: "FOR_RENT", cr: "FOR_RENT", sale: "FOR_SALE", rent: "FOR_RENT", s: "FOR_SALE", r: "FOR_RENT" };
const TYPE_CODES: Record<string, string> = {
  ap: "APARTMENT", vh: "VILLA", vi: "VILLA", th: "TOWNHOUSE", ph: "PENTHOUSE", st: "STUDIO", ha: "HOTEL_APARTMENT", cd: "COMPOUND", of: "OFFICE",
  sh: "SHOP", rt: "RETAIL", wh: "WAREHOUSE", lp: "LAND", lc: "LAND", bu: "BUILDING", bl: "BUILDING", ch: "CHALET", fm: "FARM", rm: "ROOM"
};
const ENUM_TYPES = new Set(["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "COMPOUND", "STUDIO", "ROOM", "OFFICE", "RETAIL", "SHOP", "WAREHOUSE", "BUILDING", "LAND", "HOTEL_APARTMENT", "CHALET", "FARM", "OTHER"]);

function toTransaction(v: string): "FOR_RENT" | "FOR_SALE" | undefined {
  const t = foldText(v).replace(/[^a-z0-9ء-ي ]/g, " ").trim();
  if (!t) return undefined;
  if (OFFERING_CODES[t]) return OFFERING_CODES[t];
  if (/commercial.*(lease|rent)/.test(t)) return "FOR_RENT";
  if (/commercial.*sale/.test(t)) return "FOR_SALE";
  return matchTransaction(t);
}

function toType(v: string): string | undefined {
  const raw = v.trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (ENUM_TYPES.has(upper)) return upper;
  const code = foldText(raw).replace(/[^a-z]/g, "");
  if (raw.length <= 3 && TYPE_CODES[code]) return TYPE_CODES[code];
  return matchType(foldText(raw));
}

function toImages(v: string | string[] | undefined): string[] {
  const parts = (Array.isArray(v) ? v : [v ?? ""]).flatMap(s => s.split(/[|;\n\r\t ]+|,\s+/));
  const out: string[] = [];
  for (const p of parts) {
    const u = p.trim();
    if (/^https?:\/\/\S+$/i.test(u) && !out.includes(u)) out.push(u);
    if (out.length >= IMPORT_MAX_IMAGES) break;
  }
  return out;
}

const NO_BEDROOMS = new Set(["LAND", "OFFICE", "SHOP", "RETAIL", "WAREHOUSE", "BUILDING", "FARM", "OTHER"]);

export function normalizeImportRow(raw: Record<string, unknown>, places: PlaceRef[]): ImportRowResult {
  const f = byField(flattenRecord(raw));
  const notes: string[] = [];

  // the deal
  const transaction = toTransaction(text(f.transaction)) ?? toTransaction(`${text(f.title)} ${text(f.description)}`);
  if (!transaction) return { ok: false, reason: "Could not tell whether it is for rent or for sale." };

  // the type (a studio is a studio even when the type column says apartment)
  let propertyType = toType(text(f.propertyType)) ?? matchType(foldText(`${text(f.title)} ${text(f.description)}`));
  if (!propertyType) return { ok: false, reason: "Could not tell the property type." };
  if (/studio|استديو|استوديو/.test(foldText(`${text(f.title)} ${text(f.propertyType)}`)) && propertyType === "APARTMENT") propertyType = "STUDIO";

  // the price: a yearly figure is brought to a month for a rent
  let price: number | undefined;
  const yearly = toNumber(f.priceYearly);
  const monthly = toNumber(f.priceMonthly);
  const sale = toNumber(f.priceSale);
  const plain = toNumber(f.price);
  if (transaction === "FOR_RENT") {
    if (monthly !== undefined) price = monthly;
    else if (yearly !== undefined) { price = Math.round(yearly / 12); notes.push("Yearly rent converted to a monthly figure."); }
    else if (plain !== undefined) {
      const period = foldText(`${text(f.period)}`);
      if (/year|annual|سنو|سنه/.test(period) || (plain >= 30000 && !/month|شهر/.test(period))) {
        price = Math.round(plain / 12);
        notes.push(/year|annual|سنو|سنه/.test(period) ? "Yearly rent converted to a monthly figure." : "The rent looks like a yearly figure, so it was divided by 12: check it.");
      } else price = plain;
    }
  } else {
    price = sale ?? plain ?? yearly ?? monthly;
  }
  if (price === undefined || !(price > 0) || price >= 1_000_000_000) return { ok: false, reason: "Missing or invalid price." };

  // the size: "area" is a size when it is a number and a place when it is text
  let areaSqm: number | undefined = toNumber(f.size);
  let placeText = text(f.district);
  if (areaSqm === undefined) {
    const sqft = toNumber(f.sizeSqft);
    if (sqft !== undefined) { areaSqm = Math.round(sqft * 0.092903 * 10) / 10; notes.push("Size converted from square feet."); }
  }
  const plainArea = text(f.area);
  if (plainArea) {
    if (/^[\d.,\s]+(sqm|m2|m²|sq\.?\s?m)?$/i.test(normalizeDigits(plainArea).trim())) { if (areaSqm === undefined) areaSqm = toNumber(plainArea); }
    else if (!placeText) placeText = plainArea;
  }
  if (areaSqm !== undefined && (areaSqm < 10 || areaSqm > 100000)) areaSqm = undefined;

  // the place
  const cityText = text(f.city).trim();
  const matched = matchPlace(`${placeText} ${cityText}`.trim(), places);
  let city = cityText;
  let district = placeText.trim();
  let placeKnown = false;
  if (matched && matched.place.type !== "MUNICIPALITY") {
    district = matched.place.name;
    const muni = places.find(p => p.id === matched.municipalityId);
    city = muni?.name || cityText || "Doha";
    placeKnown = true;
  } else if (matched) {
    city = matched.place.name;
  }
  if (!district) return { ok: false, reason: "Missing the area." };
  if (!city) city = "Doha";
  district = district.slice(0, 80);
  city = city.slice(0, 80);
  if (!placeKnown) notes.push(`The area "${district}" is not on our list: check it before publishing.`);

  // rooms
  const noBedrooms = NO_BEDROOMS.has(propertyType);
  let bedrooms = toNumber(f.bedrooms);
  if (propertyType === "STUDIO") bedrooms = 0;
  if (bedrooms !== undefined && (bedrooms < 0 || bedrooms > 20 || !Number.isInteger(bedrooms))) bedrooms = undefined;
  let bathrooms = toNumber(f.bathrooms);
  if (bathrooms !== undefined && (bathrooms < 0 || bathrooms > 20 || !Number.isInteger(bathrooms))) bathrooms = undefined;

  // the words
  const rawDescription = text(f.description);
  const cleaned = stripContact(rawDescription);
  if (cleaned.removed) notes.push("Phone numbers, e-mails or links were removed from the description.");
  const descAr = text(f.descriptionAr) ? stripContact(text(f.descriptionAr)).text.slice(0, 2000) : undefined;
  const titleGiven = text(f.title).trim();
  const title = (titleGiven || makeTitle({ transaction, propertyType, bedrooms, placeName: district }, cleaned.text)).slice(0, 120);
  const description = (cleaned.text || `${title}${areaSqm ? `, ${Math.round(areaSqm)} sqm` : ""}.`).slice(0, 2000);

  const images = toImages(f.images);
  if (images.length === 0) notes.push("No photos found: add them after importing.");

  const furnishing = matchFurnishing(foldText(text(f.furnished))) ?? (/^(yes|true|1|نعم)$/i.test(text(f.furnished).trim()) ? "FULLY_FURNISHED" : /^(no|false|0|لا)$/i.test(text(f.furnished).trim()) ? "UNFURNISHED" : undefined);

  const complete = areaSqm !== undefined && (noBedrooms || bedrooms !== undefined) && placeKnown;
  if (areaSqm === undefined) notes.push("No size: add it before publishing.");
  if (!noBedrooms && bedrooms === undefined) notes.push("No bedroom count: add it before publishing.");

  const given = text(f.externalId).trim();
  const externalId = (given || `auto-${shortId(`${title}|${price}|${district}|${bedrooms ?? ""}|${areaSqm ?? ""}`)}`).slice(0, 80);

  return {
    ok: true,
    listing: {
      externalId, title, ...(text(f.titleAr).trim() ? { titleAr: text(f.titleAr).trim().slice(0, 120) } : {}),
      description, ...(descAr ? { descriptionAr: descAr } : {}),
      propertyType, transactionType: transaction, price: Math.round(price), area: areaSqm ?? 0,
      ...(bedrooms !== undefined ? { bedrooms } : {}), ...(bathrooms !== undefined ? { bathrooms } : {}),
      city, district, ...(furnishing ? { furnishing } : {}), images, complete, notes
    }
  };
}

export interface ImportReadResult {
  format: ImportFormat;
  listings: ImportedListing[];
  skipped: { row: number; reason: string }[];
  /** how many records the file held (before the row cap) */
  total: number;
  truncated: boolean;
}

/** All records of a parsed file or feed through the reader: usable listings (duplicates inside the file removed) and the reasons for the rest. */
export function readImportRecords(records: Record<string, unknown>[], places: PlaceRef[], format: ImportFormat): ImportReadResult {
  const total = records.length;
  const truncated = total > IMPORT_MAX_ROWS;
  const listings: ImportedListing[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();
  records.slice(0, IMPORT_MAX_ROWS).forEach((rec, i) => {
    const r = normalizeImportRow(rec, places);
    if ("reason" in r) { skipped.push({ row: i + 1, reason: r.reason }); return; }
    if (seen.has(r.listing.externalId)) { skipped.push({ row: i + 1, reason: `Repeats the reference ${r.listing.externalId} from an earlier row.` }); return; }
    seen.add(r.listing.externalId);
    listings.push(r.listing);
  });
  return { format, listings, skipped, total, truncated };
}

/** A blank spreadsheet with the columns we read and one example row, to download, fill in and upload. */
export function importTemplateCsv(): string {
  const header = ["reference", "title", "type", "for", "price", "size_sqm", "bedrooms", "bathrooms", "area", "city", "furnished", "description", "photos"];
  const example = ["A-101", "2-bedroom apartment in Lusail", "apartment", "rent", "8500", "120", "2", "2", "Lusail", "Doha", "yes", "Bright flat with a marina view, close to the tram.", "https://example.com/1.jpg|https://example.com/2.jpg"];
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return `\uFEFF${header.join(",")}\n${example.map(cell).join(",")}\n`;
}

/** Reads a file or a feed in any of the three formats. Throws an Error with a plain message when the content cannot be used. */
export function readImportContent(content: string, places: PlaceRef[]): ImportReadResult {
  if (!content || !content.trim()) throw new Error("The file is empty.");
  if (content.length > IMPORT_MAX_BYTES) throw new Error("The file is too large (2 MB at most).");
  const format = detectFormat(content);
  let records: Record<string, unknown>[];
  try {
    records = format === "csv" ? csvToRecords(content) : format === "json" ? jsonToRecords(content) : xmlTreeToRecords(parseXml(content));
  } catch (e) {
    if (e instanceof XmlError) throw new Error(e.message);
    if (e instanceof SyntaxError) throw new Error("That is not valid JSON.");
    throw e;
  }
  if (records.length === 0) throw new Error(format === "csv" ? "We found no rows under the column names. Use the template, or save your sheet as CSV (UTF-8)." : "We found no listings in that file.");
  return readImportRecords(records, places, format);
}
