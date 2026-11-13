import { describe, it, expect } from "vitest";
import { loanBreakdown, rentalReturn } from "../../src/lib/investment.js";
import { buildSpecRows, propertyTypeLabel } from "../../src/lib/propertySpecs.js";
import type { Property } from "../../src/types.js";

describe("the loan estimate", () => {
  it("matches the standard instalment formula", () => {
    // 1,000,000 with 20% down, 4.25% for 25 years: a loan of 800,000
    const r = loanBreakdown({ price: 1_000_000, downPaymentPercent: 20, annualRatePercent: 4.25, years: 25 });
    expect(r.downPayment).toBe(200_000);
    expect(r.loanAmount).toBe(800_000);
    expect(r.monthlyPayment).toBeCloseTo(4333.9, 1);
    // independent check: paying that instalment every month for 25 years brings the balance to exactly zero
    const monthlyRate = 0.0425 / 12;
    let balance = 800_000;
    for (let m = 0; m < 300; m++) balance = balance * (1 + monthlyRate) - r.monthlyPayment;
    expect(Math.abs(balance)).toBeLessThan(0.01);
    expect(r.totalPayments).toBeCloseTo(r.monthlyPayment * 300, 6);
    expect(r.totalInterest).toBeCloseTo(r.totalPayments - 800_000, 6);
    expect(r.totalCost).toBeCloseTo(200_000 + r.totalPayments, 6);
    expect(r.principalShare).toBeCloseTo(800_000 / r.totalPayments, 9);
  });

  it("splits an interest-free plan evenly (no division by zero)", () => {
    const r = loanBreakdown({ price: 1_200_000, downPaymentPercent: 50, annualRatePercent: 0, years: 10 });
    expect(r.loanAmount).toBe(600_000);
    expect(r.monthlyPayment).toBe(5000);
    expect(r.totalInterest).toBeCloseTo(0, 6);
    expect(r.principalShare).toBeCloseTo(1, 9);
  });

  it("has nothing to pay when everything is paid upfront or there is no term", () => {
    const upfront = loanBreakdown({ price: 500_000, downPaymentPercent: 100, annualRatePercent: 5, years: 20 });
    expect(upfront).toMatchObject({ loanAmount: 0, monthlyPayment: 0, totalInterest: 0, totalCost: 500_000 });
    const noTerm = loanBreakdown({ price: 500_000, downPaymentPercent: 20, annualRatePercent: 5, years: 0 });
    expect(noTerm.monthlyPayment).toBe(0);
  });

  it("clamps nonsense and survives bad numbers", () => {
    const r = loanBreakdown({ price: -5, downPaymentPercent: 250, annualRatePercent: -3, years: NaN });
    expect(Number.isFinite(r.monthlyPayment)).toBe(true);
    expect(r.monthlyPayment).toBe(0);
    const over = loanBreakdown({ price: 1_000_000, downPaymentPercent: 250, annualRatePercent: 4, years: 10 });
    expect(over.downPayment).toBe(1_000_000);
  });

  it("a longer term lowers the instalment but raises the total interest", () => {
    const short = loanBreakdown({ price: 1_000_000, downPaymentPercent: 20, annualRatePercent: 5, years: 10 });
    const long = loanBreakdown({ price: 1_000_000, downPaymentPercent: 20, annualRatePercent: 5, years: 25 });
    expect(long.monthlyPayment).toBeLessThan(short.monthlyPayment);
    expect(long.totalInterest).toBeGreaterThan(short.totalInterest);
  });
});

describe("the rental return", () => {
  it("works out gross and net yield and the payback time from the rent and the costs", () => {
    const r = rentalReturn(1_200_000, 6000, 12_000);
    expect(r.annualRent).toBe(72_000);
    expect(r.grossYieldPercent).toBeCloseTo(6, 9);
    expect(r.netYieldPercent).toBeCloseTo(5, 9);
    expect(r.paybackYears).toBeCloseTo(20, 9);
  });
  it("gives no payback when the costs eat the rent, and copes with zeros", () => {
    expect(rentalReturn(1_000_000, 1000, 20_000).paybackYears).toBeNull();
    expect(rentalReturn(0, 5000).grossYieldPercent).toBe(0);
    expect(rentalReturn(1_000_000, 0).paybackYears).toBeNull();
  });
});

const prop = (over: Record<string, unknown> = {}): Property => ({
  id: "prop-12345", listingId: "N-12345", title: "x", propertyType: "APARTMENT", transactionType: "FOR_SALE", price: 1, area: 100, ...over
} as unknown as Property);
const fmt = { area: (n: number) => `${n} sqm`, money: (n: number) => `QAR ${n}` };
const labels = (rows: { label: string }[]) => rows.map(r => r.label);

describe("the specifications list", () => {
  it("lists only the reference and the type for a listing with nothing else entered (no invented defaults)", () => {
    const rows = buildSpecRows(prop(), false, fmt);
    expect(rows).toEqual([{ label: "Reference", value: "N-12345" }, { label: "Property type", value: "Apartment" }]);
    const text = JSON.stringify(rows);
    for (const invented of ["Sea", "Skyline", "Grade A", "Cheques", "Freehold", "Leasehold", "High Floor", "Fully Covered"]) expect(text).not.toContain(invented);
  });

  it("shows exactly the facts the agent entered, in English and Arabic", () => {
    const p = prop({ tenureType: "FREEHOLD", completionYear: 2022, furnishingStatus: "SEMI_FURNISHED", floorNumber: 14, viewType: "Marina", metroStation: "Lusail QNB", metroWalkingMinutes: 6, parkingType: "COVERED", parkingSpaces: 2, serviceCharges: 9000 });
    const en = buildSpecRows(p, false, fmt);
    expect(en).toContainEqual({ label: "Ownership", value: "Freehold" });
    expect(en).toContainEqual({ label: "Completion year", value: "2022" });
    expect(en).toContainEqual({ label: "Furnishing", value: "Semi furnished" });
    expect(en).toContainEqual({ label: "Floor", value: "14" });
    expect(en).toContainEqual({ label: "View", value: "Marina" });
    expect(en).toContainEqual({ label: "Nearest metro", value: "Lusail QNB (6 min walk)" });
    expect(en).toContainEqual({ label: "Parking", value: "Covered (2)" });
    expect(en).toContainEqual({ label: "Service charges", value: "QAR 9000 / year" });
    const ar = buildSpecRows(p, true, fmt);
    expect(ar).toContainEqual({ label: "الملكية", value: "تملك حر" });
    expect(ar).toContainEqual({ label: "نوع العقار", value: "شقة سكنية" });
  });

  it("shows rent terms only for a rental and only when entered", () => {
    expect(labels(buildSpecRows(prop({ transactionType: "FOR_RENT" }), false, fmt))).toEqual(["Reference", "Property type"]);
    const rent = buildSpecRows(prop({ transactionType: "FOR_RENT", deposit: 5000, commissions: 2500, cheques: 4, kahramaa: true, cooling: false, contractLength: "1 year" }), false, fmt);
    expect(rent).toContainEqual({ label: "Security deposit", value: "QAR 5000" });
    expect(rent).toContainEqual({ label: "Agency fee", value: "QAR 2500" });
    expect(rent).toContainEqual({ label: "Cheques", value: "4" });
    expect(rent).toContainEqual({ label: "Electricity & water", value: "Included", tone: "good" });
    expect(rent).toContainEqual({ label: "Cooling", value: "Paid by tenant" });
    // a sale never shows rent terms even if the data has them
    expect(labels(buildSpecRows(prop({ deposit: 5000, cheques: 4 }), false, fmt))).not.toContain("Cheques");
  });

  it("shows off-plan delivery facts only when entered", () => {
    expect(labels(buildSpecRows(prop({ transactionType: "OFF_PLAN" }), false, fmt))).toEqual(["Reference", "Property type"]);
    const rows = buildSpecRows(prop({ transactionType: "OFF_PLAN", developer: "Acme Developments", completionDate: "Q2 2028" }), false, fmt);
    expect(rows).toContainEqual({ label: "Developer", value: "Acme Developments" });
    expect(rows).toContainEqual({ label: "Expected delivery", value: "Q2 2028" });
  });

  it("treats an explicit 'no' as a fact but a missing value as nothing", () => {
    expect(buildSpecRows(prop({ propertyType: "VILLA", majlis: false }), false, fmt)).toContainEqual({ label: "Majlis", value: "No" });
    expect(labels(buildSpecRows(prop({ propertyType: "VILLA" }), false, fmt))).not.toContain("Majlis");
  });

  it("labels property types and falls back sensibly", () => {
    expect(propertyTypeLabel("HOTEL_APARTMENT", false)).toBe("Hotel apartment");
    expect(propertyTypeLabel("VILLA", true)).toBe("فيلا مستقلة");
    expect(propertyTypeLabel("SOME_NEW_TYPE", false)).toBe("Some new type");
  });
});
