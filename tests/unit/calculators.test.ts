import { describe, it, expect } from "vitest";
import { parseNum, monthlyPayment, mortgage, rentalYield, affordability } from "../../src/lib/calculators.js";
import { CALC_TOOLS, calcByPath } from "../../src/lib/calculatorsContent.js";
import { calcBodyHtml, calcJsonLd } from "../../src/lib/calculatorsHtml.js";
import { STATIC_TAB_PATHS, SPA_PATHS } from "../../src/routes.js";

describe("reading a number someone typed", () => {
  it("accepts commas, spaces, Arabic digits and the Arabic decimal mark", () => {
    expect(parseNum("1,500,000")).toBe(1500000);
    expect(parseNum(" 7 000 ")).toBe(7000);
    expect(parseNum("٥٫٥")).toBe(5.5);
    expect(parseNum("٢٥")).toBe(25);
    expect(parseNum("5.")).toBe(5);
    expect(parseNum(".5")).toBe(0.5);
  });
  it("gives NaN for anything that is not a plain number", () => {
    for (const bad of ["", "abc", "1e5", "-3", "5%", "1.2.3", null, undefined]) expect(Number.isNaN(parseNum(bad as never))).toBe(true);
  });
});

describe("the monthly payment on a loan", () => {
  it("matches the standard equal-instalment figure", () => {
    expect(monthlyPayment(800000, 5, 25)).toBeCloseTo(4676.72, 1);
  });
  it("is the loan divided by the months when there is no interest", () => {
    expect(monthlyPayment(120000, 0, 10)).toBe(1000);
  });
  it("refuses numbers that cannot be a loan", () => {
    expect(monthlyPayment(-1, 5, 10)).toBeNull();
    expect(monthlyPayment(1000, -1, 10)).toBeNull();
    expect(monthlyPayment(1000, 5, 0)).toBeNull();
    expect(monthlyPayment(NaN, 5, 10)).toBeNull();
  });
});

describe("a mortgage", () => {
  it("splits the price into down payment and loan, and totals the interest", () => {
    const r = mortgage({ price: 1000000, downPct: 20, ratePct: 5, years: 25 })!;
    expect(r.down).toBe(200000);
    expect(r.loan).toBe(800000);
    expect(r.months).toBe(300);
    expect(r.monthly).toBeCloseTo(4676.72, 1);
    expect(r.totalPaid).toBeCloseTo(4676.72 * 300, -1);
    expect(r.interest).toBeCloseTo(r.totalPaid - 800000, 5);
  });
  it("has no interest at a zero rate, and refuses a loan of nothing (a 100% down payment)", () => {
    expect(mortgage({ price: 600000, downPct: 0, ratePct: 0, years: 10 })!.interest).toBeCloseTo(0, 5);
    expect(mortgage({ price: 600000, downPct: 100, ratePct: 5, years: 10 })).toBeNull();
  });
  it("refuses a price, rate or period that makes no sense", () => {
    expect(mortgage({ price: 0, downPct: 20, ratePct: 5, years: 25 })).toBeNull();
    expect(mortgage({ price: 1e6, downPct: -5, ratePct: 5, years: 25 })).toBeNull();
    expect(mortgage({ price: 1e6, downPct: 20, ratePct: 5, years: 0 })).toBeNull();
    expect(mortgage({ price: 1e6, downPct: 20, ratePct: 99, years: 25 })).toBeNull();
    expect(mortgage({ price: 1e6, downPct: 20, ratePct: 5, years: 200 })).toBeNull();
  });
});

describe("rental yield", () => {
  it("gives gross from a full year's rent and net after costs and empty months", () => {
    const r = rentalYield({ price: 1000000, monthlyRent: 5000, annualCosts: 6000, vacantMonths: 1 })!;
    expect(r.grossPct).toBeCloseTo(6, 5);
    expect(r.netIncome).toBe(49000);
    expect(r.netPct).toBeCloseTo(4.9, 5);
    expect(r.paybackYears).toBeCloseTo(1000000 / 49000, 5);
  });
  it("has no payback time when the costs eat the rent", () => {
    const r = rentalYield({ price: 1000000, monthlyRent: 1000, annualCosts: 20000, vacantMonths: 0 })!;
    expect(r.netIncome).toBeLessThan(0);
    expect(r.paybackYears).toBeNull();
  });
  it("treats blank costs and vacancy as zero and caps vacancy at a year", () => {
    expect(rentalYield({ price: 100, monthlyRent: 10, annualCosts: NaN, vacantMonths: NaN })!.netPct).toBeCloseTo(120, 5);
    expect(rentalYield({ price: 1000, monthlyRent: 10, annualCosts: 0, vacantMonths: 99 })!.netIncome).toBe(0);
  });
  it("refuses a price that is not positive", () => {
    expect(rentalYield({ price: 0, monthlyRent: 10, annualCosts: 0, vacantMonths: 0 })).toBeNull();
    expect(rentalYield({ price: 100, monthlyRent: -1, annualCosts: 0, vacantMonths: 0 })).toBeNull();
  });
});

describe("how much a person can afford", () => {
  it("turns a repayment budget into a loan and a price", () => {
    const r = affordability({ monthlyIncome: 20000, sharePct: 30, otherDebts: 1000, downPayment: 100000, ratePct: 0, years: 10 })!;
    expect(r.budget).toBe(5000);
    expect(r.maxLoan).toBe(600000);
    expect(r.maxPrice).toBe(700000);
  });
  it("agrees with the mortgage maths: the largest loan costs exactly the budget a month", () => {
    const r = affordability({ monthlyIncome: 30000, sharePct: 30, otherDebts: 0, downPayment: 0, ratePct: 5.5, years: 25 })!;
    expect(monthlyPayment(r.maxLoan, 5.5, 25)).toBeCloseTo(r.budget, 4);
  });
  it("says nothing is affordable when the debts use up the budget, and keeps the cash down payment", () => {
    const r = affordability({ monthlyIncome: 10000, sharePct: 30, otherDebts: 5000, downPayment: 50000, ratePct: 5, years: 20 })!;
    expect(r).toEqual({ budget: 0, maxLoan: 0, maxPrice: 50000 });
  });
  it("refuses an income or share that makes no sense", () => {
    expect(affordability({ monthlyIncome: 0, sharePct: 30, otherDebts: 0, downPayment: 0, ratePct: 5, years: 20 })).toBeNull();
    expect(affordability({ monthlyIncome: 1000, sharePct: 150, otherDebts: 0, downPayment: 0, ratePct: 5, years: 20 })).toBeNull();
  });
});

describe("the calculator pages", () => {
  it("each has its own address, in the app's route table, and complete text in both languages", () => {
    expect(new Set(CALC_TOOLS.map(t => t.path)).size).toBe(CALC_TOOLS.length);
    for (const t of CALC_TOOLS) {
      expect(STATIC_TAB_PATHS[t.tab]).toBe(t.path);
      expect(SPA_PATHS.has(t.path)).toBe(true);
      expect(calcByPath(t.path)).toBe(t);
      expect(t.steps.length).toBeGreaterThanOrEqual(3);
      expect(t.faq.length).toBeGreaterThanOrEqual(3);
      for (const l of [t.title, t.description, t.h1, t.intro, t.label, ...t.steps, ...t.faq.flatMap(f => [f.q, f.a])]) {
        expect(l.en.trim().length).toBeGreaterThan(5);
        expect(/[؀-ۿ]/.test(l.ar)).toBe(true);
        expect(/[؀-ۿ]/.test(l.en)).toBe(false);
      }
      expect(t.description.en.length).toBeLessThanOrEqual(300);
    }
  });

  it("never states a rate, fee or limit that an authority or bank could change", () => {
    // the only numbers allowed in the text are the formula's own ("× 12", "× 100")
    for (const t of CALC_TOOLS) {
      const text = [t.intro, ...t.steps, ...t.faq.flatMap(f => [f.q, f.a])].map(l => `${l.en} ${l.ar}`).join(" ");
      const numbers = (text.match(/\d+(?:\.\d+)?%?/g) || []).filter(n => n !== "12" && n !== "100");
      expect(numbers).toEqual([]);
    }
  });

  it("is written out for search engines: heading, steps, questions, links in the page's language, and structured data", () => {
    const t = CALC_TOOLS[0];
    const en = calcBodyHtml(t, "en", [{ path: "/price-check", label: "Price check" }]);
    expect(en).toContain(`<h1>${t.h1.en}</h1>`);
    expect(en).toContain("<ol>");
    expect(en).toContain(t.faq[0].q.en);
    expect(en).toContain('href="/price-check"');
    expect(en).toContain(`href="${CALC_TOOLS[1].path}"`);
    const ar = calcBodyHtml(t, "ar", [{ path: "/price-check", label: "فحص" }]);
    expect(ar).toContain('dir="rtl"');
    expect(ar).toContain('href="/ar/price-check"');
    expect(ar).toContain(`href="/ar${CALC_TOOLS[1].path}"`);
    const ld = calcJsonLd(t, "ar", "https://x") as any[];
    expect(ld.map(x => x["@type"])).toEqual(["WebApplication", "FAQPage", "BreadcrumbList"]);
    expect(ld[0].url).toBe(`https://x/ar${t.path}`);
    expect(ld[0].isAccessibleForFree).toBe(true);
    expect(ld[1].mainEntity).toHaveLength(t.faq.length);
  });
});
