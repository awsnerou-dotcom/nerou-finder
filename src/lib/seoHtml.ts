// Turns the landing-page data from seo.ts into HTML a search engine can read without running any
// JavaScript: the head tags (title, description, canonical, language alternates, structured data)
// and a plain semantic body (heading, text, listings, links, FAQ). The app then loads over the top
// and takes over for people.

import type { Property } from "../types.js";
import type { Lang, Landing, LandingText } from "./seo.js";
import { SITE_NAME, SITE_NAME_AR, withLang } from "./seo.js";

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON for a <script type="application/ld+json">: "<" is escaped so listing text can never close the tag. */
export function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

export const absoluteUrl = (origin: string, pathOrUrl: string) => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${origin}${pathOrUrl}`);

// ---------------------------------------------------------------------------------------------
// Head tags
// ---------------------------------------------------------------------------------------------

export interface HeadOptions {
  lang: Lang;
  title: string; // plain text, escaped here
  description: string;
  canonical: string; // absolute
  /** English and Arabic versions of this page (absolute URLs); omit a side that does not exist. */
  alternates?: { en?: string; ar?: string };
  noindex?: boolean;
  image?: string; // absolute
  jsonLd?: unknown[];
}

const replaceAll = (html: string, re: RegExp, to: string) => html.replace(re, () => to);

/**
 * Rewrites the shell's head for one page. Tags the shell already has are replaced in place;
 * robots, language alternates and structured data are added.
 */
export function applyHead(html: string, o: HeadOptions): string {
  const title = esc(o.title);
  const desc = esc(o.description);
  const url = esc(o.canonical);
  let out = html;
  out = out.replace(/<html lang="[^"]*"[^>]*>/, () => `<html lang="${o.lang}" dir="${o.lang === "ar" ? "rtl" : "ltr"}">`);
  out = replaceAll(out, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  out = replaceAll(out, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${desc}" />`);
  out = replaceAll(out, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`);
  out = replaceAll(out, /<meta property="og:url" content="[^"]*"\s*\/?>/g, `<meta property="og:url" content="${url}" />`);
  out = replaceAll(out, /<meta name="twitter:url" content="[^"]*"\s*\/?>/g, `<meta name="twitter:url" content="${url}" />`);
  out = replaceAll(out, /<meta property="og:title" content="[^"]*"\s*\/?>/g, `<meta property="og:title" content="${title}" />`);
  out = replaceAll(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/g, `<meta name="twitter:title" content="${title}" />`);
  out = replaceAll(out, /<meta property="og:description" content="[^"]*"\s*\/?>/g, `<meta property="og:description" content="${desc}" />`);
  out = replaceAll(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/g, `<meta name="twitter:description" content="${desc}" />`);
  out = replaceAll(out, /<meta property="og:locale" content="[^"]*"\s*\/?>/, `<meta property="og:locale" content="${o.lang === "ar" ? "ar_QA" : "en_US"}" />`);
  out = replaceAll(out, /<meta property="og:locale:alternate" content="[^"]*"\s*\/?>/, `<meta property="og:locale:alternate" content="${o.lang === "ar" ? "en_US" : "ar_QA"}" />`);
  if (o.image) {
    const img = esc(o.image);
    out = replaceAll(out, /<meta property="og:image" content="[^"]*"\s*\/?>/g, `<meta property="og:image" content="${img}" />`);
    out = replaceAll(out, /<meta name="twitter:image" content="[^"]*"\s*\/?>/g, `<meta name="twitter:image" content="${img}" />`);
    out = out.replace(/\s*<meta property="og:image:(?:width|height)" content="[^"]*"\s*\/?>/g, "");
  }

  const extra: string[] = [];
  extra.push(o.noindex ? `<meta name="robots" content="noindex,follow" />` : `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />`);
  if (o.alternates && (o.alternates.en || o.alternates.ar)) {
    if (o.alternates.en) extra.push(`<link rel="alternate" hreflang="en" href="${esc(o.alternates.en)}" />`);
    if (o.alternates.ar) extra.push(`<link rel="alternate" hreflang="ar" href="${esc(o.alternates.ar)}" />`);
    extra.push(`<link rel="alternate" hreflang="x-default" href="${esc(o.alternates.en || o.alternates.ar!)}" />`);
  }
  for (const ld of o.jsonLd || []) extra.push(jsonLdScript(ld));
  const block = extra.join("\n    ");
  return out.includes("</head>") ? out.replace("</head>", () => `    ${block}\n  </head>`) : out + block;
}

/** Puts server-rendered content into the empty app root. The app replaces it when it loads. */
export function applyRootContent(html: string, content: string): string {
  return html
    .replace(/<div id="root"><\/div>/, () => `<div id="root" data-ssr="1">${content}</div>`)
    // the shell's generic English no-JavaScript text would add a second, unrelated H1 to this page
    .replace(/\s*<noscript>[\s\S]*?<\/noscript>/, "");
}

// ---------------------------------------------------------------------------------------------
// Landing page body
// ---------------------------------------------------------------------------------------------

const money = (p: Property) => {
  const cur = p.currency || "QAR";
  const n = Math.round(p.price).toLocaleString("en-US");
  const tx = String(p.transactionType);
  const isRent = tx.includes("RENT") || tx.includes("LEASE");
  const per = isRent ? ({ MONTHLY: "/month", YEARLY: "/year", WEEKLY: "/week", DAILY: "/day" } as Record<string, string>)[p.rentalPeriod || "MONTHLY"] : "";
  return `${cur} ${n}${per}`;
};

export function listingCardHtml(p: Property, lang: Lang): string {
  const ar = lang === "ar";
  const img = p.images && p.images[0];
  const bits = [
    money(p),
    p.bedrooms === 0 ? (ar ? "استوديو" : "Studio") : typeof p.bedrooms === "number" ? `${p.bedrooms} ${ar ? "غرف نوم" : "bd"}` : "",
    typeof p.bathrooms === "number" && p.bathrooms > 0 ? `${p.bathrooms} ${ar ? "حمامات" : "ba"}` : "",
    p.area ? `${Math.round(p.area)} ${p.sizeUnit === "SQFT" ? (ar ? "قدم²" : "sqft") : (ar ? "م²" : "sqm")}` : "",
    p.district || ""
  ].filter(Boolean).join(" · ");
  return `<article>
      <a href="${esc(withLang(`/properties/${p.id}`, lang))}">${img ? `<img src="${esc(img)}" alt="${esc(`${(p.title || "").trim()} - ${p.district || ""}`)}" width="320" height="220" loading="lazy" />` : ""}</a>
      <h3><a href="${esc(withLang(`/properties/${p.id}`, lang))}">${esc((p.title || "").trim())}</a></h3>
      <p>${esc(bits)}</p>
    </article>`;
}

export interface LandingBodyInput {
  landing: Landing;
  text: LandingText;
  lang: Lang;
  related: { path: string; label: string }[];
  areaGuide?: { slug: string; title: string };
  otherLang?: { path: string; label: string };
  listingLimit?: number;
}

export function landingBodyHtml(i: LandingBodyInput): string {
  const { landing, text, lang } = i;
  const ar = lang === "ar";
  const shown = landing.listings.slice(0, i.listingLimit ?? 24);
  return `<main dir="${ar ? "rtl" : "ltr"}" style="max-width:1100px;margin:0 auto;padding:16px;font-family:system-ui,sans-serif">
    <nav aria-label="${ar ? "مسار التنقل" : "Breadcrumb"}"><ol style="list-style:none;display:flex;gap:8px;padding:0;flex-wrap:wrap">${text.breadcrumbs.map(b => `<li><a href="${esc(withLang(b.path, lang))}">${esc(b.name)}</a></li>`).join("<li aria-hidden=\"true\">/</li>")}</ol></nav>
    <h1>${esc(text.h1)}</h1>
    <p>${esc(text.intro)}</p>
    ${i.areaGuide ? `<p><a href="${esc(withLang(`/areas/${i.areaGuide.slug}`, lang))}">${esc(i.areaGuide.title)}</a></p>` : ""}
    <section aria-label="${ar ? "الإعلانات" : "Listings"}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px">
    ${shown.map(p => listingCardHtml(p, lang)).join("\n    ")}
    </section>
    ${landing.listings.length > shown.length ? `<p>${ar ? `يعرض ${shown.length} من ${landing.listings.length} إعلانًا.` : `Showing ${shown.length} of ${landing.listings.length} listings.`}</p>` : ""}
    <section><h2>${ar ? "أسئلة شائعة" : "Frequently asked questions"}</h2>
    ${text.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n    ")}
    </section>
    ${i.related.length ? `<section><h2>${ar ? "عمليات بحث ذات صلة" : "Related searches"}</h2><ul>${i.related.map(r => `<li><a href="${esc(withLang(r.path, lang))}">${esc(r.label)}</a></li>`).join("")}</ul></section>` : ""}
    ${i.otherLang ? `<p><a href="${esc(i.otherLang.path)}" hreflang="${ar ? "en" : "ar"}">${esc(i.otherLang.label)}</a></p>` : ""}
  </main>`;
}

// ---------------------------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------------------------

export function landingJsonLd(input: { landing: Landing; text: LandingText; lang: Lang; origin: string }): unknown[] {
  const { landing, text, lang, origin } = input;
  const url = `${origin}${withLang(landing.path, lang)}`;
  const items = landing.listings.slice(0, 24).map((p, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    url: `${origin}${withLang(`/properties/${p.id}`, lang)}`,
    name: (p.title || "").trim(),
    ...(p.images && p.images[0] ? { image: absoluteUrl(origin, p.images[0]) } : {})
  }));
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      url,
      name: text.h1,
      description: text.description,
      inLanguage: lang,
      isPartOf: { "@id": `${origin}/#website` },
      mainEntity: { "@type": "ItemList", numberOfItems: landing.listings.length, itemListElement: items }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: text.breadcrumbs.map((b, idx) => ({ "@type": "ListItem", position: idx + 1, name: b.name, item: `${origin}${withLang(b.path, lang)}` }))
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: text.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
    }
  ];
}

export const brandFor = (lang: Lang) => (lang === "ar" ? SITE_NAME_AR : SITE_NAME);

// ---------------------------------------------------------------------------------------------
// Other pages: a property, an area guide, the home page, the plain pages
// ---------------------------------------------------------------------------------------------

const wrap = (lang: Lang, inner: string) =>
  `<main dir="${lang === "ar" ? "rtl" : "ltr"}" style="max-width:1100px;margin:0 auto;padding:16px;font-family:system-ui,sans-serif">${inner}</main>`;

export function linkList(items: { path: string; label: string }[], lang: Lang): string {
  return `<ul>${items.map(i => `<li><a href="${esc(withLang(i.path, lang))}">${esc(i.label)}</a></li>`).join("")}</ul>`;
}

export function propertyBodyHtml(p: Property, lang: Lang, links: { path: string; label: string }[]): string {
  const ar = lang === "ar";
  const specs = [
    money(p),
    p.bedrooms === 0 ? (ar ? "استوديو" : "Studio") : typeof p.bedrooms === "number" ? `${p.bedrooms} ${ar ? "غرف نوم" : "bedrooms"}` : "",
    typeof p.bathrooms === "number" && p.bathrooms > 0 ? `${p.bathrooms} ${ar ? "حمامات" : "bathrooms"}` : "",
    p.area ? `${Math.round(p.area)} ${p.sizeUnit === "SQFT" ? (ar ? "قدم²" : "sqft") : (ar ? "م²" : "sqm")}` : "",
    [p.district, p.city].filter(Boolean).join(", ")
  ].filter(Boolean).join(" · ");
  const imgs = (p.images || []).slice(0, 6);
  return wrap(lang, `
    <h1>${esc((p.title || "").trim())}</h1>
    <p>${esc(specs)}</p>
    ${imgs.map(src => `<img src="${esc(src)}" alt="${esc(`${(p.title || "").trim()} - ${p.district || ""}`)}" width="480" height="320" loading="lazy" />`).join("")}
    <p>${esc((p.description || "").replace(/\s+/g, " ").trim().slice(0, 1500))}</p>
    ${links.length ? `<h2>${ar ? "عقارات مشابهة" : "More like this"}</h2>${linkList(links, lang)}` : ""}`);
}

export function areaBodyHtml(i: {
  title: string; overview: string; highlights: string[]; lang: Lang; links: { path: string; label: string }[];
}): string {
  const ar = i.lang === "ar";
  return wrap(i.lang, `
    <h1>${esc(i.title)}</h1>
    <p>${esc(i.overview)}</p>
    ${i.highlights.length ? `<h2>${ar ? "أبرز المعالم" : "Highlights"}</h2><ul>${i.highlights.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
    ${i.links.length ? `<h2>${ar ? "العقارات المتاحة في هذه المنطقة" : "Properties in this area"}</h2>${linkList(i.links, i.lang)}` : ""}`);
}

export function homeBodyHtml(i: {
  lang: Lang; h1: string; intro: string; popular: { path: string; label: string }[]; areas: { path: string; label: string }[]; pages: { path: string; label: string }[];
}): string {
  const ar = i.lang === "ar";
  return wrap(i.lang, `
    <h1>${esc(i.h1)}</h1>
    <p>${esc(i.intro)}</p>
    ${i.popular.length ? `<h2>${ar ? "عمليات بحث شائعة" : "Popular searches"}</h2>${linkList(i.popular, i.lang)}` : ""}
    <h2>${ar ? "أدلة المناطق" : "Area guides"}</h2>${linkList(i.areas, i.lang)}
    <h2>${ar ? "صفحات" : "Pages"}</h2>${linkList(i.pages, i.lang)}`);
}

export function simpleBodyHtml(i: { lang: Lang; h1: string; intro: string; links: { path: string; label: string }[] }): string {
  return wrap(i.lang, `<h1>${esc(i.h1)}</h1><p>${esc(i.intro)}</p>${i.links.length ? linkList(i.links, i.lang) : ""}`);
}

/** hreflang pair + robots for a page whose head was already written (used on the English originals). */
export function addAlternates(html: string, alts: { en?: string; ar?: string }, robots?: string): string {
  const parts: string[] = [];
  if (robots) parts.push(`<meta name="robots" content="${esc(robots)}" />`);
  if (alts.en) parts.push(`<link rel="alternate" hreflang="en" href="${esc(alts.en)}" />`);
  if (alts.ar) parts.push(`<link rel="alternate" hreflang="ar" href="${esc(alts.ar)}" />`);
  if (alts.en || alts.ar) parts.push(`<link rel="alternate" hreflang="x-default" href="${esc(alts.en || alts.ar!)}" />`);
  const block = parts.join("\n    ");
  return html.includes("</head>") ? html.replace("</head>", () => `    ${block}\n  </head>`) : html + block;
}
