import { describe, it, expect } from "vitest";
import {
  validateProspectInput, findDuplicateProspect, prospectsDueForReminder, prospectStats, rowsToProspects, prospectsToCsv, isOpenProspect
} from "../../src/lib/prospects.js";
import { parseCsv } from "../../src/lib/crm.js";
import type { Prospect } from "../../src/types.js";

const NOW = Date.parse("2026-11-10T08:00:00Z"); // 10 Nov, 11:00 in Qatar

const prospect = (o: Partial<Prospect> = {}): Prospect => ({
  id: "p1", name: "Ali", kind: "AGENCY", source: "REFERRAL", stage: "NEW", ownerId: "admin-1", email: "ali@x.com",
  activity: [], createdAt: "2026-11-09T08:00:00Z", updatedAt: "2026-11-09T08:00:00Z", createdBy: "Admin", ...o
});

describe("validating a prospect", () => {
  it("needs a name and one way to reach them", () => {
    expect(validateProspectInput({ name: "", email: "a@b.com" })).toMatchObject({ ok: false });
    expect(validateProspectInput({ name: "Ali" })).toMatchObject({ ok: false });
    expect(validateProspectInput({ name: "Ali", phone: "+974 5555 1234" })).toMatchObject({ ok: true });
    expect(validateProspectInput({ name: "Ali", whatsapp: "55551234" })).toMatchObject({ ok: true });
  });

  it("rejects a bad email, a too-short number, a bad date and a negative value", () => {
    expect(validateProspectInput({ name: "A", email: "nope" })).toMatchObject({ ok: false });
    expect(validateProspectInput({ name: "A", phone: "123" })).toMatchObject({ ok: false });
    expect(validateProspectInput({ name: "A", email: "a@b.com", nextFollowUp: "12/31/2026" })).toMatchObject({ ok: false });
    expect(validateProspectInput({ name: "A", email: "a@b.com", expectedMonthly: -5 })).toMatchObject({ ok: false });
  });

  it("cleans the values and falls back to OTHER for unknown kinds and sources", () => {
    const r = validateProspectInput({ name: "  Ali  ", email: " ALI@X.COM ", kind: "weird", source: "??", expectedMonthly: "1800", nextFollowUp: "2026-12-01" });
    expect(r).toMatchObject({ ok: true, value: { name: "Ali", email: "ali@x.com", kind: "OTHER", source: "OTHER", expectedMonthly: 1800, nextFollowUp: "2026-12-01" } });
  });
});

describe("spotting the same prospect twice", () => {
  it("matches on email, or on the same number written differently", () => {
    const a = prospect({ id: "a", email: "ali@x.com", phone: "+974 5555 1234" });
    expect(findDuplicateProspect([a], { email: "ALI@x.com" })?.id).toBe("a");
    expect(findDuplicateProspect([a], { phone: "0097455551234" })?.id).toBe("a");
    expect(findDuplicateProspect([a], { whatsapp: "5555 1234" })?.id).toBe("a");
    expect(findDuplicateProspect([a], { email: "other@x.com", phone: "33334444" })).toBeUndefined();
    expect(findDuplicateProspect([a], { email: "ali@x.com" }, "a")).toBeUndefined(); // editing itself is fine
  });
});

describe("who is due a follow-up reminder", () => {
  it("includes follow-ups due today or overdue, not future ones, and never closed prospects", () => {
    const list = [
      prospect({ id: "today", nextFollowUp: "2026-11-10" }),
      prospect({ id: "late", nextFollowUp: "2026-11-07" }),
      prospect({ id: "future", nextFollowUp: "2026-11-20" }),
      prospect({ id: "won", stage: "WON", nextFollowUp: "2026-11-01" }),
      prospect({ id: "lost", stage: "LOST", nextFollowUp: "2026-11-01" })
    ];
    const due = prospectsDueForReminder(list, NOW);
    expect(due.map(d => d.prospect.id).sort()).toEqual(["late", "today"]);
    expect(due.find(d => d.prospect.id === "late")).toMatchObject({ reason: "overdue", daysOverdue: 3 });
    expect(due.find(d => d.prospect.id === "today")).toMatchObject({ reason: "due", daysOverdue: 0 });
  });

  it("reminds at most once a day", () => {
    const p = prospect({ nextFollowUp: "2026-11-09", lastReminderAt: "2026-11-10T05:00:00Z" });
    expect(prospectsDueForReminder([p], NOW)).toHaveLength(0);
    expect(prospectsDueForReminder([p], NOW + 24 * 3600 * 1000)).toHaveLength(1);
  });

  it("nudges a prospect nobody has touched for a week, at most 3 times", () => {
    const quiet = prospect({ updatedAt: "2026-11-01T08:00:00Z", createdAt: "2026-11-01T08:00:00Z" });
    expect(prospectsDueForReminder([quiet], NOW)[0]).toMatchObject({ reason: "stale" });
    expect(prospectsDueForReminder([{ ...quiet, reminderCount: 3 }], NOW)).toHaveLength(0);
    expect(prospectsDueForReminder([prospect({ updatedAt: "2026-11-08T08:00:00Z" })], NOW)).toHaveLength(0);
  });
});

describe("dashboard numbers", () => {
  it("counts open prospects, due follow-ups, pipeline value and conversion", () => {
    const stats = prospectStats([
      prospect({ id: "1", stage: "NEW", expectedMonthly: 500, nextFollowUp: "2026-11-09" }),
      prospect({ id: "2", stage: "TRIAL", expectedMonthly: 1800 }),
      prospect({ id: "3", stage: "WON", expectedMonthly: 1800, wonAt: "2026-11-03T08:00:00Z", source: "EVENT" }),
      prospect({ id: "4", stage: "WON", expectedMonthly: 500, wonAt: "2026-10-03T08:00:00Z" }),
      prospect({ id: "5", stage: "LOST", lostReason: "Too expensive" })
    ], NOW);
    expect(stats.open).toBe(2);
    expect(stats.dueNow).toBe(1);
    expect(stats.pipelineMonthly).toBe(2300);
    expect(stats.wonThisMonth).toBe(1);
    expect(stats.wonThisMonthMonthly).toBe(1800);
    expect(stats.conversionPercent).toBe(67); // 2 won, 1 lost
    expect(stats.byStage.WON).toBe(2);
    expect(stats.bySource.find(r => r.source === "EVENT")).toMatchObject({ total: 1, won: 1 });
  });

  it("has no conversion rate until something has closed", () => {
    expect(prospectStats([prospect()], NOW).conversionPercent).toBeNull();
  });
});

describe("CSV", () => {
  it("reads English and Arabic headers and guesses type and source", () => {
    const table = parseCsv("الاسم,الشركة,النوع,الجوال,المصدر\nأحمد,نيرو,مكتب عقاري,55551234,معرض\n");
    const r = rowsToProspects(table);
    expect(r.error).toBeUndefined();
    expect(r.prospects[0]).toMatchObject({ name: "أحمد", company: "نيرو", kind: "AGENCY", phone: "55551234", source: "EVENT" });
  });

  it("explains a file without a name column", () => {
    expect(rowsToProspects(parseCsv("Phone,Email\n123,a@b.com\n")).error).toMatch(/name column/i);
  });

  it("exports with a header row and protects against spreadsheet formulas", () => {
    const csv = prospectsToCsv([prospect({ name: "=HYPERLINK(\"x\")", company: "Gulf, Realty" })], () => "Admin");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("\"Gulf, Realty\"");
    expect(csv.split("\r\n")[0]).toContain("Next follow-up");
  });

  it("treats NEW to NEGOTIATION as open", () => {
    expect(isOpenProspect({ stage: "NEGOTIATION" })).toBe(true);
    expect(isOpenProspect({ stage: "WON" })).toBe(false);
    expect(isOpenProspect({ stage: "LOST" })).toBe(false);
  });
});
