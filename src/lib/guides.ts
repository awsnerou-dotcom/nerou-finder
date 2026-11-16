// The Qatar property guides (/guides): the list, the categories, the addresses and the plain text of each guide in one language.
// The server turns this into HTML for search engines and the app shows the same text to people, so the two can never disagree.

import { L, type Guide, type GuideCategory } from "../data/guideTypes.js";
import { RENTING_GUIDES } from "../data/guidesRenting.js";
import { BUYING_GUIDES } from "../data/guidesBuying.js";
import type { Lang } from "./seo.js";

export const GUIDES: Guide[] = [...RENTING_GUIDES, ...BUYING_GUIDES];

export const GUIDES_PATH = "/guides";
export const guidePath = (slug: string) => `${GUIDES_PATH}/${slug}`;

export const GUIDE_CATEGORIES: { id: GuideCategory; label: L; blurb: L }[] = [
  { id: "renting", label: L("Renting", "الإيجار"), blurb: L("From the first search to the handover: budget, contract, scams and choosing a home type.", "من أول بحث حتى التسليم: الميزانية والعقد والاحتيال واختيار نوع المنزل.") },
  { id: "living", label: L("Living in Qatar", "العيش في قطر"), blurb: L("Where to live, what the ads mean, moving in and choosing an agent.", "أين تسكن، وماذا تعني الإعلانات، والانتقال، واختيار الوسيط.") },
  { id: "buying", label: L("Buying", "الشراء"), blurb: L("Ownership rules for foreigners, the process step by step, off-plan, finance and rent-or-buy.", "قواعد التملك للأجانب والإجراءات خطوة بخطوة والشراء على المخطط والتمويل وقرار الإيجار أو الشراء.") },
  { id: "owners", label: L("Owners and investors", "الملاك والمستثمرون"), blurb: L("Price your property and work out what it earns.", "سعّر عقارك واحسب عائده.") },
  { id: "agents", label: L("For agents", "للوسطاء"), blurb: L("Write listings that get enquiries and win leads without paid ads.", "اكتب إعلانات تجلب الاستفسارات واكسب العملاء دون إعلانات مدفوعة.") }
];

/** Where a guide can send the reader, with the words for it. Only pages that always exist. */
export const GUIDE_LINKS: Record<string, L> = {
  "/": L("Search verified properties", "ابحث في العقارات الموثّقة"),
  "/price-check": L("Is this price fair? Free price check", "هل هذا السعر عادل؟ فحص مجاني"),
  "/property-valuation": L("What is my property worth? Free valuation", "كم يساوي عقاري؟ تقييم مجاني"),
  "/area-guides": L("Doha area guides", "أدلة مناطق الدوحة"),
  "/plans-pricing": L("Plans for agents and companies", "باقات الوسطاء والشركات"),
  "/areas/west-bay": L("West Bay area guide", "دليل الخليج الغربي"),
  "/areas/the-pearl": L("The Pearl area guide", "دليل اللؤلؤة"),
  "/areas/lusail-city": L("Lusail area guide", "دليل لوسيل"),
  "/areas/al-sadd": L("Al Sadd area guide", "دليل السد"),
  "/areas/msheireb": L("Msheireb area guide", "دليل مشيرب"),
  "/areas/al-waab": L("Al Waab area guide", "دليل الوعب")
};

const pick = (t: L, lang: Lang) => (lang === "ar" ? t.ar : t.en);

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find(g => g.slug === slug);
}

/** "/guides" -> hub; "/guides/<slug>" -> that guide; anything else (or a slug that does not exist) -> null. Takes the path without /ar. */
export function parseGuidePath(path: string): { kind: "hub" } | { kind: "guide"; guide: Guide } | null {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === GUIDES_PATH) return { kind: "hub" };
  const m = /^\/guides\/([a-z0-9-]+)$/.exec(clean);
  if (!m) return null;
  const guide = getGuide(m[1]);
  return guide ? { kind: "guide", guide } : null;
}

export function linkLabel(path: string, lang: Lang): string | null {
  const l = GUIDE_LINKS[path];
  return l ? pick(l, lang) : null;
}

export function relatedGuides(g: Guide): Guide[] {
  return g.related.map(getGuide).filter((x): x is Guide => !!x && x.slug !== g.slug);
}

/** The flat text of a guide in one language. */
export interface GuideText {
  title: string;
  description: string;
  summary: string;
  sections: { h: string; p: string[]; list: string[] }[];
  faq: { q: string; a: string }[];
}

export function guideText(g: Guide, lang: Lang): GuideText {
  return {
    title: pick(g.title, lang),
    description: pick(g.description, lang),
    summary: pick(g.summary, lang),
    sections: g.sections.map(s => ({ h: pick(s.h, lang), p: (s.p || []).map(x => pick(x, lang)), list: (s.list || []).map(x => pick(x, lang)) })),
    faq: g.faq.map(f => ({ q: pick(f.q, lang), a: pick(f.a, lang) }))
  };
}

/** About how many minutes the guide takes to read. */
export function readMinutes(g: Guide, lang: Lang): number {
  const t = guideText(g, lang);
  const words = [t.summary, ...t.sections.flatMap(s => [s.h, ...s.p, ...s.list]), ...t.faq.flatMap(f => [f.q, f.a])].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / (lang === "ar" ? 170 : 200)));
}

export interface GuidesHubText { title: string; description: string; h1: string; intro: string }

export function hubText(lang: Lang): GuidesHubText {
  return lang === "ar"
    ? {
        title: "أدلة العقارات في قطر: الإيجار والشراء والاستثمار | نيرو فايندر",
        description: "أدلة عملية بالعربية والإنجليزية عن الإيجار والشراء والاستثمار العقاري في قطر: العقود والاحتيال وتملك الأجانب والعائد وأفضل المناطق.",
        h1: "أدلة العقارات في قطر",
        intro: "إجابات واضحة عن أسئلة الإيجار والشراء والاستثمار العقاري في قطر، بدون حشو: ما تفحصه قبل التوقيع، وكيف تتجنب الاحتيال، وكيف تحسب العائد، وأين تسكن."
      }
    : {
        title: "Qatar Property Guides: Rent, Buy and Invest | Nerou Finder",
        description: "Practical guides to renting, buying and investing in property in Qatar: contracts, scams, foreign ownership, rental yield and the best areas to live.",
        h1: "Qatar property guides",
        intro: "Clear answers to the questions people ask about renting, buying and investing in property in Qatar: what to check before you sign, how to avoid scams, how to work out the return and where to live."
      };
}

export const guideTitleTag = (g: Guide, lang: Lang) => `${pick(g.title, lang)} | ${lang === "ar" ? "نيرو فايندر" : "Nerou Finder"}`;
