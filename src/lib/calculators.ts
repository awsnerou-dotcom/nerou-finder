// The maths behind the free calculators (/mortgage-calculator, /rental-yield-calculator,
// /home-affordability-calculator). Plain functions with no page, no network and no stored rules:
// every rate, share and period is something the person types, so nothing here can go out of date
// when a bank or an authority changes its terms. Each returns null when the input cannot be
// worked out, and the page then shows nothing instead of a wrong number.

/** A number typed by a person: "1,500,000", "٥٫٥", " 7 000 " -> 1500000, 5.5, 7000. Empty or unreadable -> NaN. */
export function parseNum(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return raw;
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const s = String(raw ?? "")
    .replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/[٬,\s]/g, "")
    .trim();
  if (s === "" || !/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
  return Number(s);
}

const finite = (n: number) => Number.isFinite(n);

/** The repayment each month on a loan paid off in equal instalments (annuity), `ratePct` a yearly percentage. */
export function monthlyPayment(loan: number, ratePct: number, years: number): number | null {
  if (!finite(loan) || !finite(ratePct) || !finite(years) || loan < 0 || ratePct < 0 || years <= 0) return null;
  const n = Math.round(years * 12);
  if (n < 1) return null;
  const r = ratePct / 100 / 12;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}

export interface MortgageInput { price: number; downPct: number; ratePct: number; years: number }
export interface MortgageResult { loan: number; down: number; monthly: number; totalPaid: number; interest: number; months: number }

export function mortgage(i: MortgageInput): MortgageResult | null {
  if (!finite(i.price) || i.price <= 0 || !finite(i.downPct) || i.downPct < 0 || i.downPct >= 100 || i.years > 50) return null;
  const down = (i.price * i.downPct) / 100;
  const loan = i.price - down;
  const monthly = monthlyPayment(loan, i.ratePct, i.years);
  if (monthly === null || i.ratePct > 60) return null;
  const months = Math.round(i.years * 12);
  const totalPaid = monthly * months;
  return { loan, down, monthly, totalPaid, interest: totalPaid - loan, months };
}

export interface YieldInput { price: number; monthlyRent: number; annualCosts: number; vacantMonths: number }
export interface YieldResult { annualRent: number; grossPct: number; netPct: number; netIncome: number; paybackYears: number | null }

/**
 * Gross yield = a full year's rent / price. Net yield = (rent actually received, after months it
 * stood empty, minus the owner's yearly costs) / price. Both are shown because adverts quote the
 * first and an owner lives on the second.
 */
export function rentalYield(i: YieldInput): YieldResult | null {
  if (!finite(i.price) || i.price <= 0 || !finite(i.monthlyRent) || i.monthlyRent < 0) return null;
  const costs = finite(i.annualCosts) && i.annualCosts > 0 ? i.annualCosts : 0;
  const vacant = finite(i.vacantMonths) ? Math.min(12, Math.max(0, i.vacantMonths)) : 0;
  const annualRent = i.monthlyRent * 12;
  const netIncome = i.monthlyRent * (12 - vacant) - costs;
  return {
    annualRent,
    grossPct: (annualRent / i.price) * 100,
    netPct: (netIncome / i.price) * 100,
    netIncome,
    paybackYears: netIncome > 0 ? i.price / netIncome : null
  };
}

export interface AffordInput { monthlyIncome: number; sharePct: number; otherDebts: number; downPayment: number; ratePct: number; years: number }
export interface AffordResult { budget: number; maxLoan: number; maxPrice: number }

/** What a monthly repayment budget buys: the largest loan whose instalment fits, plus the cash put down. */
export function affordability(i: AffordInput): AffordResult | null {
  if (!finite(i.monthlyIncome) || i.monthlyIncome <= 0 || !finite(i.sharePct) || i.sharePct <= 0 || i.sharePct > 100) return null;
  const debts = finite(i.otherDebts) && i.otherDebts > 0 ? i.otherDebts : 0;
  const down = finite(i.downPayment) && i.downPayment > 0 ? i.downPayment : 0;
  if (!finite(i.ratePct) || i.ratePct < 0 || i.ratePct > 60 || !finite(i.years) || i.years <= 0 || i.years > 50) return null;
  const budget = (i.monthlyIncome * i.sharePct) / 100 - debts;
  if (budget <= 0) return { budget: 0, maxLoan: 0, maxPrice: down };
  const n = Math.round(i.years * 12);
  const r = i.ratePct / 100 / 12;
  const maxLoan = r === 0 ? budget * n : (budget * (1 - Math.pow(1 + r, -n))) / r;
  return { budget, maxLoan, maxPrice: maxLoan + down };
}
