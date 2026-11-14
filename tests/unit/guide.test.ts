import { describe, expect, it } from "vitest";
import { GUIDE_ARTICLES } from "../../src/lib/guideContent.js";
import {
  CATEGORIES, START_PATH, WORKSPACE_TABS, articlesFor, goToFor, kindOf, nextInPath, parseGuideLang, parseRead, pathProgress, searchGuide, serializeRead, suggestArticles
} from "../../src/lib/guide.js";
import type { AccountFacts, Bi, Persona } from "../../src/lib/guide.js";
import { GUIDE_ART_IDS } from "../../src/components/GuideArt.js";

const PERSONAS: Persona[] = ["independent", "agencyAgent", "agencyAdmin"];
const ARABIC = /[؀-ۿ]/;

const texts = (a: (typeof GUIDE_ARTICLES)[number]): { where: string; v: Bi }[] => [
  { where: "title", v: a.title }, { where: "summary", v: a.summary }, { where: "why", v: a.why },
  ...a.steps.flatMap((s, i) => [{ where: `step ${i + 1} title`, v: s.title }, { where: `step ${i + 1} body`, v: s.body }]),
  ...a.tips.map((t, i) => ({ where: `tip ${i + 1}`, v: t })),
  ...(a.link ? [{ where: "link", v: a.link.label }] : [])
];

describe("guide content", () => {
  it("has unique ids and real categories", () => {
    const ids = GUIDE_ARTICLES.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cats = new Set(CATEGORIES.map(c => c.id));
    for (const a of GUIDE_ARTICLES) expect(cats.has(a.category), a.id).toBe(true);
  });

  it("is written in both languages everywhere, and each language is really that language", () => {
    for (const a of GUIDE_ARTICLES) {
      for (const { where, v } of texts(a)) {
        expect(v.en.trim().length, `${a.id} ${where} en`).toBeGreaterThan(3);
        expect(v.ar.trim().length, `${a.id} ${where} ar`).toBeGreaterThan(3);
        expect(ARABIC.test(v.ar), `${a.id} ${where} should be Arabic`).toBe(true);
        // English may quote a brand or an Arabic word, but a sentence of Arabic in the English slot means they were swapped.
        expect((v.en.match(/[؀-ۿ]/g) || []).length, `${a.id} ${where} en has Arabic`).toBeLessThan(3);
      }
    }
  });

  it("gives every article steps, a reason to read and a sensible length", () => {
    for (const a of GUIDE_ARTICLES) {
      expect(a.steps.length, a.id).toBeGreaterThanOrEqual(3);
      expect(a.minutes, a.id).toBeGreaterThan(0);
      expect(a.minutes, a.id).toBeLessThan(10);
      expect(a.audience.length, a.id).toBeGreaterThan(0);
    }
  });

  it("has a picture drawn for every article", () => {
    for (const a of GUIDE_ARTICLES) expect(GUIDE_ART_IDS, a.id).toContain(a.id);
  });

  it("only points a 'try it now' button at sections the workspace really has", () => {
    for (const a of GUIDE_ARTICLES) {
      if (a.goTo?.agent) expect(WORKSPACE_TABS.agent as readonly string[], `${a.id} agent`).toContain(a.goTo.agent);
      if (a.goTo?.agency) expect(WORKSPACE_TABS.agency as readonly string[], `${a.id} agency`).toContain(a.goTo.agency);
    }
  });

  it("offers every reader somewhere to go: a section of their own workspace or a public page", () => {
    for (const a of GUIDE_ARTICLES) for (const p of a.audience) {
      expect(goToFor(a, p) !== null || !!a.link, `${a.id} for ${p}`).toBe(true);
    }
  });

  it("links only to articles that exist, and public pages that start with a slash", () => {
    const ids = new Set(GUIDE_ARTICLES.map(a => a.id));
    for (const a of GUIDE_ARTICLES) {
      for (const r of a.related || []) expect(ids.has(r), `${a.id} -> ${r}`).toBe(true);
      expect(a.related).not.toContain(a.id);
      if (a.link) expect(a.link.path.startsWith("/")).toBe(true);
    }
  });

  it("shows each kind of reader only what applies to them", () => {
    const has = (p: Persona, id: string) => articlesFor(GUIDE_ARTICLES, p).some(a => a.id === id);
    expect(has("agencyAdmin", "team")).toBe(true);
    expect(has("independent", "team")).toBe(false);
    expect(has("independent", "boost")).toBe(true);
    expect(has("agencyAgent", "boost")).toBe(false); // an agency's agent never boosts by themselves
    expect(has("agencyAdmin", "campaigns")).toBe(true);
    expect(has("agencyAdmin", "add-listings")).toBe(false);
    expect(has("independent", "plan")).toBe(true);
    expect(has("agencyAgent", "plan")).toBe(false);
    expect(has("agencyAdmin", "billing")).toBe(true);
  });

  it("has a start path for each reader made only of articles they can see", () => {
    for (const p of PERSONAS) {
      const have = new Set(articlesFor(GUIDE_ARTICLES, p).map(a => a.id));
      expect(START_PATH[p].length).toBeGreaterThan(3);
      for (const id of START_PATH[p]) expect(have.has(id), `${p}: ${id}`).toBe(true);
    }
  });

  it("maps a persona to the workspace it opens in", () => {
    expect(kindOf("agencyAdmin")).toBe("agency");
    expect(kindOf("independent")).toBe("agent");
    expect(kindOf("agencyAgent")).toBe("agent");
  });
});

describe("searchGuide", () => {
  const all = articlesFor(GUIDE_ARTICLES, "independent");

  it("returns everything for an empty search", () => {
    expect(searchGuide(all, "")).toHaveLength(all.length);
    expect(searchGuide(all, "   ")).toHaveLength(all.length);
  });

  it("finds in English and in Arabic", () => {
    expect(searchGuide(all, "whatsapp").map(a => a.id)).toContain("paste-ad");
    expect(searchGuide(all, "boost").map(a => a.id)).toContain("boost");
    expect(searchGuide(all, "توثيق").map(a => a.id)).toContain("verify");
    expect(searchGuide(all, "الاشتراك").map(a => a.id)).toContain("plan");
  });

  it("does not care about diacritics or the spelling of alef, ya and ta marbuta", () => {
    const a = searchGuide(all, "اعلان").map(x => x.id);
    const b = searchGuide(all, "إِعْلَان").map(x => x.id);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
    expect(searchGuide(all, "مراجعه").length).toBeGreaterThan(0); // written with ha instead of ta marbuta
  });

  it("needs every word to be found", () => {
    expect(searchGuide(all, "boost bump").map(a => a.id)).toContain("boost");
    expect(searchGuide(all, "boost zzzqqq")).toHaveLength(0);
  });

  it("returns nothing for gibberish", () => {
    expect(searchGuide(all, "xqzvbn")).toHaveLength(0);
  });
});

describe("suggestArticles", () => {
  const facts = (o: Partial<AccountFacts> = {}): AccountFacts => ({ verified: true, listings: 3, waitingLeads: 0, profileFilled: true, ...o });
  const list = (p: Persona) => articlesFor(GUIDE_ARTICLES, p);

  it("starts with what the account is actually missing", () => {
    const s = suggestArticles("independent", facts({ verified: false, listings: 0, waitingLeads: 2, profileFilled: false }), new Set(), list("independent"), 4);
    expect(s).toEqual(["verify", "add-listings", "leads", "profile"]);
  });

  it("tells an agency without agents to invite them, and suggests its own leads page", () => {
    const s = suggestArticles("agencyAdmin", facts({ listings: 0, waitingLeads: 3, teamSize: 0 }), new Set(), list("agencyAdmin"), 5);
    expect(s.slice(0, 3)).toEqual(["team", "agency-listings", "agency-leads"]);
    expect(s).not.toContain("leads");
    expect(s).not.toContain("add-listings");
  });

  it("falls back to the first things not read yet, in the order for newcomers", () => {
    const s = suggestArticles("independent", facts(), new Set(["dashboard", "verify"]), list("independent"), 3);
    expect(s).toEqual(["profile", "add-listings", "leads"]);
  });

  it("keeps real problems on top even if the article was read before", () => {
    const s = suggestArticles("independent", facts({ verified: false }), new Set(["verify"]), list("independent"), 2);
    expect(s[0]).toBe("verify");
  });

  it("never suggests more than asked, nothing twice, and nothing the reader cannot open", () => {
    for (const p of PERSONAS) {
      const s = suggestArticles(p, facts({ verified: false, listings: 0, waitingLeads: 5, profileFilled: false, teamSize: 0 }), new Set(), list(p), 3);
      expect(s.length).toBeLessThanOrEqual(3);
      expect(new Set(s).size).toBe(s.length);
      const have = new Set(list(p).map(a => a.id));
      for (const id of s) expect(have.has(id)).toBe(true);
    }
  });

  it("has nothing to say once everything is read and the account is in order", () => {
    const all = new Set(GUIDE_ARTICLES.map(a => a.id));
    expect(suggestArticles("independent", facts(), all, list("independent"))).toEqual([]);
  });
});

describe("reading progress", () => {
  const list = articlesFor(GUIDE_ARTICLES, "independent");

  it("finds the next article in the start path, and none at the end or off the path", () => {
    const path = START_PATH.independent;
    expect(nextInPath("independent", path[0], list)).toBe(path[1]);
    expect(nextInPath("independent", path[path.length - 1], list)).toBeNull();
    expect(nextInPath("independent", "boost", list)).toBeNull();
  });

  it("counts how much of the start path has been read", () => {
    const path = START_PATH.independent;
    expect(pathProgress("independent", new Set(), list)).toEqual({ done: 0, total: path.length, percent: 0 });
    expect(pathProgress("independent", new Set(path), list).percent).toBe(100);
    // reading something outside the path does not count
    expect(pathProgress("independent", new Set(["boost"]), list).done).toBe(0);
  });

  it("stores what was read and ignores junk when reading it back", () => {
    const valid = new Set(list.map(a => a.id));
    const raw = serializeRead(new Set(["verify", "profile"]));
    expect([...parseRead(raw, valid)].sort()).toEqual(["profile", "verify"]);
    expect(parseRead("not json", valid).size).toBe(0);
    expect(parseRead(null, valid).size).toBe(0);
    expect(parseRead('{"a":1}', valid).size).toBe(0);
    expect([...parseRead('["verify","gone",5,null]', valid)]).toEqual(["verify"]); // an article that no longer exists is dropped
  });

  it("accepts only the two languages", () => {
    expect(parseGuideLang("ar")).toBe("ar");
    expect(parseGuideLang("en")).toBe("en");
    expect(parseGuideLang("fr")).toBeNull();
    expect(parseGuideLang(null)).toBeNull();
  });
});
