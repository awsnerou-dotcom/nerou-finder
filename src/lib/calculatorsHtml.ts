// The calculator pages as a search engine reads them: the explanation, the steps and the questions in
// plain HTML, plus structured data (a free web app, the questions, the breadcrumb). The tool itself is
// the app, which loads over this for people.

import type { Lang } from "./seo.js";
import { SITE_NAME, SITE_NAME_AR, withLang } from "./seo.js";
import { esc, breadcrumbJsonLd } from "./seoHtml.js";
import type { CalcTool } from "./calculatorsContent.js";
import { CALC_TOOLS, pick } from "./calculatorsContent.js";

const crumbs = (tool: CalcTool, lang: Lang) => [
  { name: lang === "ar" ? "الرئيسية" : "Home", path: "/" },
  { name: pick(tool.h1, lang), path: tool.path }
];

export function calcBodyHtml(tool: CalcTool, lang: Lang, extraLinks: { path: string; label: string }[] = []): string {
  const ar = lang === "ar";
  const others = CALC_TOOLS.filter(t => t.key !== tool.key);
  const nav = `<nav aria-label="${ar ? "مسار التنقل" : "Breadcrumb"}"><ol style="list-style:none;display:flex;gap:8px;padding:0;flex-wrap:wrap">${crumbs(tool, lang).map(b => `<li><a href="${esc(withLang(b.path, lang))}">${esc(b.name)}</a></li>`).join("<li aria-hidden=\"true\">/</li>")}</ol></nav>`;
  return `<main dir="${ar ? "rtl" : "ltr"}" style="max-width:1100px;margin:0 auto;padding:16px;font-family:system-ui,sans-serif">
    ${nav}
    <h1>${esc(pick(tool.h1, lang))}</h1>
    <p>${esc(pick(tool.intro, lang))}</p>
    <h2>${ar ? "كيف تستعملها" : "How to use it"}</h2>
    <ol>${tool.steps.map(s => `<li>${esc(pick(s, lang))}</li>`).join("")}</ol>
    <h2>${ar ? "أسئلة شائعة" : "Frequently asked questions"}</h2>
    ${tool.faq.map(f => `<h3>${esc(pick(f.q, lang))}</h3><p>${esc(pick(f.a, lang))}</p>`).join("\n    ")}
    <h2>${ar ? "حاسبات أخرى" : "More free tools"}</h2>
    <ul>${[...others.map(o => ({ path: o.path, label: pick(o.h1, lang) })), ...extraLinks].map(l => `<li><a href="${esc(withLang(l.path, lang))}">${esc(l.label)}</a></li>`).join("")}</ul>
  </main>`;
}

export function calcJsonLd(tool: CalcTool, lang: Lang, origin: string): unknown[] {
  const url = `${origin}${withLang(tool.path, lang)}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: pick(tool.h1, lang),
      description: pick(tool.description, lang),
      url,
      inLanguage: lang,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: 0, priceCurrency: "QAR" },
      isAccessibleForFree: true,
      publisher: { "@type": "Organization", name: lang === "ar" ? SITE_NAME_AR : SITE_NAME, url: `${origin}/` }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: tool.faq.map(f => ({ "@type": "Question", name: pick(f.q, lang), acceptedAnswer: { "@type": "Answer", text: pick(f.a, lang) } }))
    },
    breadcrumbJsonLd(crumbs(tool, lang), lang, origin)
  ];
}
