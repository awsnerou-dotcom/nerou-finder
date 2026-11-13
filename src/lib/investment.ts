// The arithmetic behind the investment planner on a for-sale listing. Pure functions (unit tested). Everything is an
// estimate for planning: the screen says so, and none of it is a bank offer or financial advice.

export interface LoanInput {
  price: number;
  downPaymentPercent: number; // 0..100
  annualRatePercent: number; // 0 is allowed (an interest-free plan)
  years: number;
}

export interface LoanBreakdown {
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  totalPayments: number; // everything paid to the lender over the term
  totalInterest: number;
  totalCost: number; // down payment + everything paid to the lender
  /** share of the lender payments that repays the loan itself (the rest is interest), 0..1 */
  principalShare: number;
}

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** The standard amortising-loan instalment: M = P * i * (1+i)^n / ((1+i)^n - 1), or P / n when there is no interest. */
export function loanBreakdown(i: LoanInput): LoanBreakdown {
  const price = Math.max(0, finite(i.price));
  const down = Math.min(100, Math.max(0, finite(i.downPaymentPercent)));
  const downPayment = (price * down) / 100;
  const loanAmount = price - downPayment;
  const n = Math.round(Math.max(0, finite(i.years)) * 12);
  const r = Math.max(0, finite(i.annualRatePercent)) / 100 / 12;
  if (loanAmount <= 0 || n <= 0) {
    return { downPayment, loanAmount: Math.max(0, loanAmount), monthlyPayment: 0, totalPayments: 0, totalInterest: 0, totalCost: downPayment, principalShare: 1 };
  }
  const monthlyPayment = r === 0 ? loanAmount / n : (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayments = monthlyPayment * n;
  return {
    downPayment,
    loanAmount,
    monthlyPayment,
    totalPayments,
    totalInterest: totalPayments - loanAmount,
    totalCost: downPayment + totalPayments,
    principalShare: totalPayments > 0 ? loanAmount / totalPayments : 1
  };
}

export interface RentalReturn {
  annualRent: number;
  grossYieldPercent: number;
  netYieldPercent: number;
  /** years of net rent to earn back the price; null when the net rent is not positive */
  paybackYears: number | null;
}

/** What renting the property out would return, from the rent and the yearly running costs the visitor enters. */
export function rentalReturn(price: number, monthlyRent: number, annualCosts = 0): RentalReturn {
  const p = Math.max(0, finite(price));
  const annualRent = Math.max(0, finite(monthlyRent)) * 12;
  const costs = Math.max(0, finite(annualCosts));
  const net = annualRent - costs;
  return {
    annualRent,
    grossYieldPercent: p > 0 ? (annualRent / p) * 100 : 0,
    netYieldPercent: p > 0 ? (net / p) * 100 : 0,
    paybackYears: net > 0 && p > 0 ? p / net : null
  };
}
