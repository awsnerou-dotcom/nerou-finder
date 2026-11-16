// The shapes behind the Qatar property guides (/guides). Every text has both languages in one place, so a guide can never
// exist in one language only: the unit test fails when a side is missing.

export interface L { en: string; ar: string }
export const L = (en: string, ar: string): L => ({ en, ar });

export type GuideCategory = "renting" | "buying" | "owners" | "living" | "agents";

export interface GuideSection {
  h: L;
  /** paragraphs, in order */
  p?: L[];
  /** a list shown after the paragraphs */
  list?: L[];
}

export interface Guide {
  slug: string;
  category: GuideCategory;
  title: L;
  /** the page's meta description: a complete answer in about 150 characters */
  description: L;
  /** the short answer, shown first (and read out by answer engines) */
  summary: L;
  sections: GuideSection[];
  faq: { q: L; a: L }[];
  /** where to go next: site paths from GUIDE_LINKS, or /areas/<slug> */
  links: string[];
  /** slugs of related guides */
  related: string[];
  published: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD
}
