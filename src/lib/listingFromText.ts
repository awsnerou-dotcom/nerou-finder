// "Paste your ad": agents already write their listings as a WhatsApp message or a post ("شقة للايجار في لوسيل 2 غرف نوم 7500 ر.ق
// مفروشة"). This reads such a text, in Arabic or English, and fills in what it can find: the deal, the property type, bedrooms and
// bathrooms, price, size, furnishing and the place (matched to the platform's own locations). Nothing is guessed: a field that is not
// in the text stays empty, and the agent checks and completes the rest in the normal form. Phone numbers, e-mails and links are
// removed from the description, because enquiries come through the platform. Pure functions, unit tested.

export interface PlaceRef { id: string; name: string; nameAr?: string; type: string; parentId?: string; isActive?: boolean }

export type ParsedField = "transaction" | "propertyType" | "bedrooms" | "bathrooms" | "price" | "area" | "furnishing" | "place";

export interface ParsedListing {
  transaction?: "FOR_RENT" | "FOR_SALE";
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  /** the price as written (a yearly rent is also given per month in `monthlyRent`) */
  price?: number;
  /** set when the text states a yearly rent: the price per month, which is what the platform shows */
  monthlyRent?: number;
  areaSqm?: number;
  furnishing?: "FULLY_FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED";
  municipalityId?: string;
  placeId?: string;
  /** MUNICIPALITY when only the city is named: then there is no area to pick */
  placeType?: string;
  placeName?: string;
  title: string;
  description: string;
  removedContact: boolean;
  found: ParsedField[];
}

const SQFT_TO_SQM = 0.092903;

/** Arabic-Indic and Persian digits to 0-9, Arabic separators to ascii, so one set of rules reads both. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٬،]/g, ",")
    .replace(/٫/g, ".");
}

/** Letters compared loosely: no diacritics, one spelling of alef, ya and ta marbuta, lower case. */
export function foldText(s: string): string {
  return normalizeDigits(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

const AR_NUM: Record<string, number> = { واحد: 1, واحده: 1, اثنين: 2, اثنان: 2, ثنتين: 2, ثلاث: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5, ست: 6, سته: 6, سبع: 7, سبعه: 7 };
const EN_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

const PHONE = /(?:\+?\s?974[\s-]?)?(?<!\d)[3567]\d{3}[\s-]?\d{4}(?!\d)|\+?\d[\d\s-]{8,14}\d/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;

/** Several ads in one paste: split on a line of dashes or on two or more blank lines. */
export function splitAds(text: string): string[] {
  return normalizeDigits(text)
    .split(/\n\s*[-=_*•~]{3,}\s*\n|\n\s*\n\s*\n+/)
    .map(b => b.trim())
    .filter(b => b.length >= 15);
}

export function matchTransaction(f: string): "FOR_RENT" | "FOR_SALE" | undefined {
  const rent = /للايجار|ايجار|\bfor rent\b|\bto let\b|\bfor lease\b|\bto rent\b|\brent\b|\blease\b/.exec(f);
  const sale = /للبيع|\bfor sale\b|\bselling\b|\bto sell\b|\bsale\b|\bبيع\b/.exec(f);
  if (rent && sale) return rent.index <= sale.index ? "FOR_RENT" : "FOR_SALE";
  return rent ? "FOR_RENT" : sale ? "FOR_SALE" : undefined;
}

// most specific first: "penthouse" before "apartment", "hotel apartment" before "apartment"
const TYPES: [RegExp, string][] = [
  [/penthouse|بنتهاوس|بنت هاوس/, "PENTHOUSE"],
  [/town ?house|تاون ?هاوس/, "TOWNHOUSE"],
  [/hotel apartment|شقه فندقيه/, "HOTEL_APARTMENT"],
  [/villa|فيلا|فله|فيله/, "VILLA"],
  [/studio|استديو|استوديو/, "STUDIO"],
  [/compound|مجمع/, "COMPOUND"],
  [/warehouse|مستودع/, "WAREHOUSE"],
  [/office|مكتب/, "OFFICE"],
  [/\bshop\b|محل/, "SHOP"],
  [/chalet|شاليه/, "CHALET"],
  [/\bfarm\b|مزرعه/, "FARM"],
  [/\bland\b|\bplot\b|ارض|قطعه ارض/, "LAND"],
  [/building|عماره|برج/, "BUILDING"],
  [/apartment|\bflat\b|\bapt\b|شقه/, "APARTMENT"]
];

export function matchType(f: string): string | undefined {
  for (const [re, type] of TYPES) if (re.test(f)) return type;
  return undefined;
}

function matchBedrooms(f: string, type: string | undefined): number | undefined {
  if (type === "STUDIO") return 0;
  let m = /(\d{1,2})\s*(?:br\b|bhk|bd\b|beds?\b|bedrooms?|غرف|غرفه|غرفتين)/.exec(f);
  if (m) return Number(m[1]);
  m = /(?:bedrooms?|beds?|غرف|غرفه)\s*[:=-]?\s*(\d{1,2})\b/.exec(f);
  if (m) return Number(m[1]);
  if (/غرفتين|غرفتان/.test(f)) return 2;
  m = new RegExp(`\\b(${Object.keys(EN_NUM).join("|")})[- ]?(?:bed|bedroom|br)s?\\b`).exec(f);
  if (m) return EN_NUM[m[1]];
  m = new RegExp(`(${Object.keys(AR_NUM).join("|")})\\s*(?:غرف|غرفه)`).exec(f);
  if (m) return AR_NUM[m[1]];
  if (/غرفه نوم|1 bedroom|one bedroom/.test(f)) return 1;
  return undefined;
}

function matchBathrooms(f: string): number | undefined {
  let m = /(\d{1,2})\s*(?:baths?\b|bathrooms?|\bba\b|wc\b|حمام|حمامات|دورات? مياه)/.exec(f);
  if (m) return Number(m[1]);
  m = /(?:baths?|bathrooms?|حمامات|حمام)\s*[:=-]?\s*(\d{1,2})\b/.exec(f);
  if (m) return Number(m[1]);
  if (/حمامين|حمامان/.test(f)) return 2;
  return undefined;
}

function matchArea(f: string): number | undefined {
  let m = /(\d{2,6}(?:\.\d+)?)\s*(?:sq\.?\s?m\b|sqm\b|m2\b|m²|square met(?:er|re)s?|متر|م2|م²|م\b)/.exec(f);
  if (m) {
    const n = Number(m[1]);
    return n >= 10 && n <= 100000 ? n : undefined;
  }
  m = /(\d{2,6}(?:\.\d+)?)\s*(?:sq\.?\s?ft\b|sqft\b|square feet|قدم)/.exec(f);
  if (m) {
    const n = Math.round(Number(m[1]) * SQFT_TO_SQM * 10) / 10;
    return n >= 10 && n <= 100000 ? n : undefined;
  }
  return undefined;
}

function toNumber(raw: string, suffix?: string): number | undefined {
  const cleaned = raw.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;
  let n = Number(cleaned);
  if (suffix) {
    if (/^(k|الف|ألف)$/.test(suffix)) n *= 1000;
    else if (/^(m|million|مليون)$/.test(suffix)) n *= 1_000_000;
  }
  return n;
}

const MONEY_SUFFIX = "(k|الف|m|million|مليون)?";
const CURRENCY = "(?:qar|qr|ر\\.?\\s?ق|ريال|riyals?)";

function matchPrice(f: string): number | undefined {
  const tries: RegExp[] = [
    new RegExp(`${CURRENCY}\\s*[:=-]?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*${MONEY_SUFFIX}`),
    new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*${MONEY_SUFFIX}\\s*${CURRENCY}`),
    new RegExp(`(?:price|السعر|بسعر|المطلوب|الايجار|ايجار|rent|asking)\\s*[:=-]?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*${MONEY_SUFFIX}`)
  ];
  for (const re of tries) {
    const m = re.exec(f);
    if (m) {
      const n = toNumber(m[1], m[2]);
      if (n !== undefined && n >= 100 && n < 1_000_000_000) return n;
    }
  }
  return undefined;
}

export function matchFurnishing(f: string): ParsedListing["furnishing"] {
  if (/semi[- ]?furnished|نصف مفروش|شبه مفروش|مفروش جزئيا|نصف مؤثث/.test(f)) return "SEMI_FURNISHED";
  if (/unfurnished|غير مفروش|بدون اثاث|بدون فرش|غير مؤثث|فاضي/.test(f)) return "UNFURNISHED";
  if (/furnished|مفروش|مؤثث/.test(f)) return "FULLY_FURNISHED";
  return undefined;
}

function isLetter(ch: string | undefined): boolean {
  return !!ch && /\p{L}/u.test(ch);
}

/** The platform's place whose name (English or Arabic) is in the text: the most specific and the longest wins. */
export function matchPlace(text: string, places: PlaceRef[]): { place: PlaceRef; municipalityId?: string } | undefined {
  const f = foldText(text);
  const rank = (p: PlaceRef) => (p.type === "DISTRICT" ? 3 : p.type === "AREA" ? 2 : p.type === "MUNICIPALITY" ? 1 : 0);
  let best: { place: PlaceRef; score: number } | undefined;
  for (const p of places) {
    if (p.isActive === false || p.type === "COUNTRY") continue;
    for (const raw of [p.name, p.nameAr]) {
      const name = foldText(raw || "");
      if (name.length < 3) continue;
      let from = 0;
      let at = -1;
      while ((at = f.indexOf(name, from)) !== -1) {
        if (!isLetter(f[at - 1]) && !isLetter(f[at + name.length])) {
          const score = rank(p) * 1000 + name.length;
          if (!best || score > best.score) best = { place: p, score };
          break;
        }
        from = at + 1;
      }
    }
  }
  if (!best) return undefined;
  // walk up to the municipality
  let cur: PlaceRef | undefined = best.place;
  while (cur && cur.type !== "MUNICIPALITY") cur = places.find(p => p.id === cur!.parentId);
  return { place: best.place, municipalityId: cur?.id };
}

const TYPE_WORD: Record<string, string> = {
  APARTMENT: "apartment", VILLA: "villa", TOWNHOUSE: "townhouse", PENTHOUSE: "penthouse", COMPOUND: "compound unit", STUDIO: "studio", ROOM: "room",
  OFFICE: "office", RETAIL: "retail space", SHOP: "shop", WAREHOUSE: "warehouse", BUILDING: "building", LAND: "plot of land", HOTEL_APARTMENT: "hotel apartment", CHALET: "chalet", FARM: "farm", OTHER: "property"
};

export function makeTitle(p: { transaction?: string; propertyType?: string; bedrooms?: number; placeName?: string }, fallback: string): string {
  if (!p.propertyType && !p.placeName) return fallback.split(/\n/)[0].trim().slice(0, 80);
  const beds = p.propertyType === "STUDIO" ? "" : p.bedrooms !== undefined ? (p.bedrooms === 0 ? "studio-size " : `${p.bedrooms}-bedroom `) : "";
  const type = TYPE_WORD[p.propertyType || "OTHER"] || "property";
  const deal = p.transaction === "FOR_RENT" ? " for rent" : p.transaction === "FOR_SALE" ? " for sale" : "";
  const place = p.placeName ? ` in ${p.placeName}` : "";
  const t = `${beds}${type}${deal}${place}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Removes phone numbers, e-mails and links; says whether it removed any. */
export function stripContact(text: string): { text: string; removed: boolean } {
  let removed = false;
  const out = normalizeDigits(text)
    .replace(URL_RE, () => { removed = true; return ""; })
    .replace(EMAIL, () => { removed = true; return ""; })
    .replace(PHONE, m => (m.replace(/\D/g, "").length >= 8 ? ((removed = true), "") : m))
    .replace(/(?:whats\s?app|واتس\s?اب|واتساب|call|اتصل|للتواصل|للاستفسار|contact)\s*[:：-]?\s*$/gim, () => { removed = true; return ""; })
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n")
    .trim();
  return { text: out, removed };
}

export function parseListingText(raw: string, places: PlaceRef[] = []): ParsedListing {
  const original = normalizeDigits(raw || "");
  // numbers inside phone numbers must not be read as prices, sizes or bedrooms
  const readable = original.replace(EMAIL, " ").replace(URL_RE, " ").replace(PHONE, m => (m.replace(/\D/g, "").length >= 8 ? " " : m));
  const f = foldText(readable);
  const found: ParsedField[] = [];

  const transaction = matchTransaction(f);
  if (transaction) found.push("transaction");
  const propertyType = matchType(f);
  if (propertyType) found.push("propertyType");
  const bedrooms = matchBedrooms(f, propertyType);
  if (bedrooms !== undefined) found.push("bedrooms");
  const bathrooms = matchBathrooms(f);
  if (bathrooms !== undefined) found.push("bathrooms");
  const price = matchPrice(f);
  if (price !== undefined) found.push("price");
  const areaSqm = matchArea(f);
  if (areaSqm !== undefined) found.push("area");
  const furnishing = matchFurnishing(f);
  if (furnishing) found.push("furnishing");
  const place = matchPlace(readable, places);
  if (place) found.push("place");

  const yearly = transaction === "FOR_RENT" && price !== undefined && /سنوي|بالسنه|\byearly\b|\bannual(?:ly)?\b|per year|\/\s?year|a year|\/yr|سنويا/.test(f);
  const placeName = place?.place.name;
  const cleaned = stripContact(original);

  return {
    transaction,
    propertyType,
    bedrooms,
    bathrooms,
    price,
    ...(yearly && price !== undefined ? { monthlyRent: Math.round(price / 12) } : {}),
    areaSqm,
    furnishing,
    municipalityId: place?.municipalityId,
    placeId: place?.place.id,
    placeType: place?.place.type,
    placeName,
    title: makeTitle({ transaction, propertyType, bedrooms, placeName }, cleaned.text),
    description: cleaned.text.slice(0, 2000),
    removedContact: cleaned.removed,
    found
  };
}
