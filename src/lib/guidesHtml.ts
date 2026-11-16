// The HTML search engines get for /guides and /guides/<slug> (the app loads over it for people): a plain semantic page with the
// guide's text, its questions and answers, and links onward, plus structured data (Article, FAQ, breadcrumbs).

import type { Guide } from "../data/guideTypes.js";
import { GUIDE_CATEGORIES, GUIDES, GUIDES_PATH, guidePath, guideText, hubText, linkLabel, readMinutes, relatedGuides } from "./guides.js";
import { SITE_NAME, SITE_NAME_AR, withLang, type Lang } from "./seo.js";
import { esc } from "./seoHtml.js";

const wrap = (lang: Lang, inner: string) =>
  `<main dir="${lang === "ar" ? "rtl" : "ltr"}" style="max-width:820px;margin:0 auto;padding:16px;font-family:system-ui,sans-serif;line-height:1.6">${inner}</main>`;

const brand = (lang: Lang) => (lang === "ar" ? SITE_NAME_AR : SITE_NAME);
const link = (path: string, lang: Lang, label: string) => `<a href="${esc(withLang(path, lang))}">${esc(label)}</a>`;

function crumbs(lang: Lang, guide?: Guide): { name: string; path: string }[] {
  const ar = lang === "ar";
  const out = [{ name: ar ? "الرئيسية" : "Home", path: "/" }, { name: hubText(lang).h1, path: GUIDES_PATH }];
  if (guide) out.push({ name: guideText(guide, lang).title, path: guidePath(guide.slug) });
  return out;
}

const otherLangLink = (path: string, lang: Lang) =>
  `<p><a href="${esc(withLang(path, lang === "ar" ? "en" : "ar"))}" hreflang="${lang === "ar" ? "en" : "ar"}">${lang === "ar" ? "English version" : "النسخة العربية"}</a></p>`;

export function guideBodyHtml(g: Guide, lang: Lang): string {
  const ar = lang === "ar";
  const t = guideText(g, lang);
  const go = g.links.map(p => ({ path: p, label: linkLabel(p, lang) })).filter((x): x is { path: string; label: string } => !!x.label);
  const rel = relatedGuides(g);
  return wrap(lang, `
    <nav aria-label="${ar ? "مسار التنقل" : "Breadcrumb"}"><ol style="list-style:none;display:flex;gap:8px;padding:0;flex-wrap:wrap">${crumbs(lang, g).map(b => `<li>${link(b.path, lang, b.name)}</li>`).join("<li aria-hidden=\"true\">/</li>")}</ol></nav>
    <article>
      <h1>${esc(t.title)}</h1>
      <p>${ar ? "آخر تحديث" : "Updated"}: <time datetime="${esc(g.updated)}">${esc(g.updated)}</time> · ${readMinutes(g, lang)} ${ar ? "د للقراءة" : "min read"}</p>
      <p><strong>${esc(t.summary)}</strong></p>
      ${t.sections.map(s => `<section><h2>${esc(s.h)}</h2>${s.p.map(x => `<p>${esc(x)}</p>`).join("")}${s.list.length ? `<ul>${s.list.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</section>`).join("\n      ")}
      <section><h2>${ar ? "أسئلة شائعة" : "Frequently asked questions"}</h2>
      ${t.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("\n      ")}
      </section>
      <p><em>${ar ? "معلومات عامة وليست استشارة قانونية أو مالية. القواعد والرسوم تتغير، فتأكد من الحالية لدى الجهة المختصة." : "General information, not legal or financial advice. Rules and fees change: confirm the current ones with the relevant authority."}</em></p>
    </article>
    ${go.length ? `<section><h2>${ar ? "الخطوة التالية" : "Next step"}</h2><ul>${go.map(x => `<li>${link(x.path, lang, x.label)}</li>`).join("")}</ul></section>` : ""}
    ${rel.length ? `<section><h2>${ar ? "أدلة ذات صلة" : "Related guides"}</h2><ul>${rel.map(r => `<li>${link(guidePath(r.slug), lang, guideText(r, lang).title)}</li>`).join("")}</ul></section>` : ""}
    ${otherLangLink(guidePath(g.slug), lang)}`);
}

export function hubBodyHtml(lang: Lang): string {
  const ar = lang === "ar";
  const t = hubText(lang);
  return wrap(lang, `
    <nav aria-label="${ar ? "مسار التنقل" : "Breadcrumb"}"><ol style="list-style:none;display:flex;gap:8px;padding:0;flex-wrap:wrap">${crumbs(lang).map(b => `<li>${link(b.path, lang, b.name)}</li>`).join("<li aria-hidden=\"true\">/</li>")}</ol></nav>
    <h1>${esc(t.h1)}</h1>
    <p>${esc(t.intro)}</p>
    ${GUIDE_CATEGORIES.map(c => {
      const list = GUIDES.filter(g => g.category === c.id);
      if (!list.length) return "";
      return `<section><h2>${esc(ar ? c.label.ar : c.label.en)}</h2><p>${esc(ar ? c.blurb.ar : c.blurb.en)}</p><ul>${list.map(g => `<li>${link(guidePath(g.slug), lang, guideText(g, lang).title)}: ${esc(guideText(g, lang).description)}</li>`).join("")}</ul></section>`;
    }).join("\n    ")}
    ${otherLangLink(GUIDES_PATH, lang)}`);
}

const breadcrumbLd = (origin: string, lang: Lang, guide?: Guide) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs(lang, guide).map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: `${origin}${withLang(b.path, lang)}` }))
});

export function guideJsonLd(g: Guide, lang: Lang, origin: string): unknown[] {
  const t = guideText(g, lang);
  const url = `${origin}${withLang(guidePath(g.slug), lang)}`;
  const org = { "@type": "Organization", name: brand(lang), url: `${origin}/` };
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: t.title,
      description: t.description,
      inLanguage: lang,
      datePublished: g.published,
      dateModified: g.updated,
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      author: org,
      publisher: org
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: t.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
    },
    breadcrumbLd(origin, lang, g)
  ];
}

export function hubJsonLd(lang: Lang, origin: string): unknown[] {
  const t = hubText(lang);
  const url = `${origin}${withLang(GUIDES_PATH, lang)}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: t.h1,
      description: t.description,
      inLanguage: lang,
      url,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: GUIDES.length,
        itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}${withLang(guidePath(g.slug), lang)}`, name: guideText(g, lang).title }))
      }
    },
    breadcrumbLd(origin, lang)
  ];
}
