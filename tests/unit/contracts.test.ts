import { describe, it, expect } from "vitest";
import { validateContractInput, contractState, currentContract, needsContract, contractStats, contractNeedsRenewal, formatFileSize } from "../../src/lib/contracts.js";
import type { Prospect, ProspectContract } from "../../src/types.js";

const NOW = Date.parse("2026-11-10T08:00:00Z"); // 10 Nov 2026 in Qatar

const contract = (over: Partial<ProspectContract> = {}): ProspectContract => ({
  id: "c1", title: "Annual agreement", kind: "SUBSCRIPTION", fileName: "a.pdf", mimeType: "application/pdf", size: 1000,
  uploadedBy: "Admin", uploadedAt: "2026-11-01T00:00:00Z", ...over
});
const prospect = (over: Partial<Prospect> = {}): Prospect => ({
  id: "p1", name: "Gulf Realty", kind: "AGENCY", source: "EVENT", stage: "WON", ownerId: "a", activity: [],
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", createdBy: "Admin", ...over
});

describe("validateContractInput", () => {
  it("needs a title and defaults the kind", () => {
    expect(validateContractInput({ title: "  " })).toEqual({ ok: false, error: "Give the contract a title." });
    const ok = validateContractInput({ title: " Annual deal ", kind: "nonsense" });
    expect(ok).toMatchObject({ ok: true, value: { title: "Annual deal", kind: "SUBSCRIPTION" } });
  });

  it("checks dates are real and in order", () => {
    expect(validateContractInput({ title: "x", signedDate: "10/11/2026" })).toMatchObject({ ok: false });
    expect(validateContractInput({ title: "x", endDate: "2026-02-31" })).toMatchObject({ ok: false });
    expect(validateContractInput({ title: "x", startDate: "2026-12-01", endDate: "2026-11-01" })).toEqual({ ok: false, error: "The end date is before the start date." });
    expect(validateContractInput({ title: "x", signedDate: "2026-11-01", startDate: "2026-11-01", endDate: "2027-10-31" })).toMatchObject({ ok: true });
  });

  it("accepts blanks for the optional parts and rejects a bad monthly value", () => {
    const ok = validateContractInput({ title: "x", startDate: "", endDate: null, monthlyValue: "" });
    expect(ok).toMatchObject({ ok: true });
    if (ok.ok) expect(ok.value.endDate).toBeUndefined();
    expect(validateContractInput({ title: "x", monthlyValue: -5 })).toMatchObject({ ok: false });
    expect(validateContractInput({ title: "x", monthlyValue: "abc" })).toMatchObject({ ok: false });
    expect(validateContractInput({ title: "x", monthlyValue: "1800" })).toMatchObject({ ok: true, value: { monthlyValue: 1800 } });
  });
});

describe("contractState", () => {
  it("is running, ending soon, expired, or open ended", () => {
    expect(contractState({}, NOW)).toEqual({ state: "NO_END", daysLeft: null });
    expect(contractState({ endDate: "2027-06-01" }, NOW).state).toBe("ACTIVE");
    expect(contractState({ endDate: "2026-12-10" }, NOW)).toEqual({ state: "ENDING_SOON", daysLeft: 30 });
    expect(contractState({ endDate: "2026-12-11" }, NOW).state).toBe("ACTIVE");
    expect(contractState({ endDate: "2026-11-10" }, NOW)).toEqual({ state: "ENDING_SOON", daysLeft: 0 });
    expect(contractState({ endDate: "2026-11-09" }, NOW)).toEqual({ state: "EXPIRED", daysLeft: -1 });
  });
});

describe("currentContract", () => {
  it("prefers the one that runs longest, ignoring expired ones while any is live", () => {
    const old = contract({ id: "old", endDate: "2026-01-01" });
    const live = contract({ id: "live", endDate: "2027-05-01" });
    const later = contract({ id: "later", endDate: "2028-05-01" });
    expect(currentContract([old, live, later], NOW)?.id).toBe("later");
    expect(currentContract([old, live], NOW)?.id).toBe("live");
    expect(currentContract([old], NOW)?.id).toBe("old");
    expect(currentContract([], NOW)).toBeUndefined();
    expect(currentContract(undefined, NOW)).toBeUndefined();
  });
});

describe("needsContract and contractStats", () => {
  it("flags only subscribed clients with nothing on file", () => {
    expect(needsContract(prospect({ stage: "WON" }))).toBe(true);
    expect(needsContract(prospect({ stage: "WON", contracts: [] }))).toBe(true);
    expect(needsContract(prospect({ stage: "WON", contracts: [contract()] }))).toBe(false);
    expect(needsContract(prospect({ stage: "NEGOTIATION" }))).toBe(false);
    expect(needsContract(prospect({ stage: "LOST" }))).toBe(false);
  });

  it("counts subscribed clients by contract position", () => {
    const rows = [
      prospect({ id: "1", contracts: [contract({ endDate: "2027-09-01" })] }),
      prospect({ id: "2", contracts: [contract({ endDate: "2026-11-25" })] }),
      prospect({ id: "3", contracts: [contract({ endDate: "2026-09-01" })] }),
      prospect({ id: "4" }),
      prospect({ id: "5", stage: "NEW", contracts: [contract()] })
    ];
    expect(contractStats(rows, NOW)).toEqual({ subscribed: 4, withContract: 3, missing: 1, endingSoon: 1, expired: 1 });
  });
});

describe("contractNeedsRenewal", () => {
  it("is true only for subscribed clients whose current contract is ending or over", () => {
    expect(contractNeedsRenewal(prospect({ contracts: [contract({ endDate: "2026-11-20" })] }), NOW)).toBe(true);
    expect(contractNeedsRenewal(prospect({ contracts: [contract({ endDate: "2026-01-01" })] }), NOW)).toBe(true);
    expect(contractNeedsRenewal(prospect({ contracts: [contract({ endDate: "2027-09-01" })] }), NOW)).toBe(false);
    expect(contractNeedsRenewal(prospect({ contracts: [contract()] }), NOW)).toBe(false); // no end date
    expect(contractNeedsRenewal(prospect({ contracts: [contract({ id: "old", endDate: "2026-01-01" }), contract({ id: "new", endDate: "2028-01-01" })] }), NOW)).toBe(false); // renewed
    expect(contractNeedsRenewal(prospect({}), NOW)).toBe(false);
    expect(contractNeedsRenewal(prospect({ stage: "LOST", contracts: [contract({ endDate: "2026-11-20" })] }), NOW)).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("is readable", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(20 * 1024)).toBe("20 KB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(formatFileSize(-1)).toBe("");
  });
});
