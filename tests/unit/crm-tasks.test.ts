import { describe, it, expect } from "vitest";
import {
  AUTO_NUDGE_MAX,
  daysBetween,
  qatarDueAt,
  qatarTime,
  renewalsDueForReminder,
  snoozeTarget,
  taskReminderTime,
  tasksDueForReminder
} from "../../src/lib/crm.js";
import { Deal, Task } from "../../src/types.js";

const H = 60 * 60 * 1000;
const D = 24 * H;

describe("Qatar date + time", () => {
  it("turns a Qatar date and time into the right moment and back", () => {
    expect(qatarDueAt("2026-11-10", "09:00")).toBe("2026-11-10T06:00:00.000Z"); // UTC+3
    expect(qatarDueAt("2026-11-10", "01:30")).toBe("2026-11-09T22:30:00.000Z");
    expect(qatarTime(Date.parse("2026-11-10T06:00:00Z"))).toBe("09:00");
    expect(qatarTime(Date.parse("2026-11-09T22:30:00Z"))).toBe("01:30");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-10", "2026-11-10")).toBe(0);
    expect(daysBetween("2026-11-10", "2026-12-10")).toBe(30);
    expect(daysBetween("2026-11-10", "2026-11-01")).toBe(-9);
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
  });
});

describe("snooze", () => {
  const now = Date.parse("2026-11-10T08:00:00Z"); // 11:00 on 10 Nov in Qatar
  it("moves a reminder an hour, or to 08:00 Qatar time on a later day", () => {
    expect(snoozeTarget("1h", now)).toBe("2026-11-10T09:00:00.000Z");
    expect(snoozeTarget("tomorrow", now)).toBe("2026-11-11T05:00:00.000Z"); // 08:00 Qatar
    expect(snoozeTarget("3d", now)).toBe("2026-11-13T05:00:00.000Z");
    expect(snoozeTarget("week", now)).toBe("2026-11-17T05:00:00.000Z");
  });
  it("counts 'tomorrow' by the Qatar day even just after midnight there", () => {
    const lateEvening = Date.parse("2026-11-09T22:30:00Z"); // 01:30 on 10 Nov in Qatar
    expect(snoozeTarget("tomorrow", lateEvening)).toBe("2026-11-11T05:00:00.000Z");
  });
});

describe("which tasks are due a reminder", () => {
  const now = Date.parse("2026-11-10T08:00:00Z");
  const task = (over: Partial<Task> = {}): Task => ({
    id: "t", agentId: "a", title: "Call the owner", dueAt: new Date(now - H).toISOString(), status: "OPEN",
    createdDate: "x", updatedDate: "x", ...over
  });

  it("reminds once when the time arrives, not before and not twice", () => {
    expect(tasksDueForReminder([task({ dueAt: new Date(now + H).toISOString() })], now)).toEqual([]);
    expect(tasksDueForReminder([task()], now).map(d => d.reason)).toEqual(["due"]);
    expect(tasksDueForReminder([task({ lastReminderAt: new Date(now - 30 * 60 * 1000).toISOString() })], now)).toEqual([]);
  });

  it("repeats an ignored task every 24 hours, 3 reminders in all", () => {
    const base = task({ dueAt: new Date(now - 3 * D).toISOString(), lastReminderAt: new Date(now - 25 * H).toISOString(), reminderCount: 1 });
    expect(tasksDueForReminder([base], now).map(d => d.reason)).toEqual(["overdue"]);
    expect(tasksDueForReminder([{ ...base, lastReminderAt: new Date(now - 10 * H).toISOString() }], now)).toEqual([]);
    expect(tasksDueForReminder([{ ...base, reminderCount: AUTO_NUDGE_MAX }], now)).toEqual([]);
  });

  it("ignores finished tasks", () => {
    expect(tasksDueForReminder([task({ status: "DONE" })], now)).toEqual([]);
  });

  it("follows a snooze: waits for the snoozed time, then reminds again as a fresh cycle", () => {
    const reminded = task({ lastReminderAt: new Date(now - 30 * 60 * 1000).toISOString(), reminderCount: 1 });
    const snoozed = { ...reminded, snoozedUntil: new Date(now + 3 * H).toISOString() };
    expect(taskReminderTime(snoozed)).toBe(now + 3 * H);
    expect(tasksDueForReminder([snoozed], now)).toEqual([]); // still waiting
    expect(tasksDueForReminder([snoozed], now + 3 * H + 1000).map(d => d.reason)).toEqual(["due"]); // snooze elapsed
  });
});

describe("lease renewal reminders", () => {
  const deal = (over: Partial<Deal> = {}): Deal => ({
    id: "d", agentId: "a", propertyTitle: "Apartment", clientName: "Tenant", dealType: "RENT", dealValue: 120000, currency: "QAR",
    commissionAmount: 6000, commissionStatus: "EXPECTED", status: "CLOSED", closedDate: "2025-12-01",
    contractEndDate: "2026-12-01", createdDate: "x", updatedDate: "x", ...over
  });
  const today = "2026-11-10"; // 21 days before 2026-12-01

  it("fires at 90, 60 and 30 days, each once", () => {
    expect(renewalsDueForReminder([deal({ contractEndDate: "2027-02-20" })], today)).toEqual([]); // 102 days
    const at90 = renewalsDueForReminder([deal({ contractEndDate: "2027-02-05" })], today); // 87 days
    expect(at90[0]).toMatchObject({ daysLeft: 87, thresholds: [90] });
    expect(renewalsDueForReminder([deal({ contractEndDate: "2027-02-05", renewalRemindersSent: [90] })], today)).toEqual([]);
    const at60 = renewalsDueForReminder([deal({ contractEndDate: "2027-01-05", renewalRemindersSent: [90] })], today); // 56 days
    expect(at60[0].thresholds).toEqual([60]);
  });

  it("a contract added late produces ONE reminder covering every threshold already passed", () => {
    const r = renewalsDueForReminder([deal()], today); // 21 days left, nothing sent
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ daysLeft: 21, thresholds: [90, 60, 30] });
  });

  it("still reminds shortly after the contract ended, but not long after", () => {
    expect(renewalsDueForReminder([deal({ contractEndDate: "2026-11-05" })], today)).toHaveLength(1); // 5 days ago
    expect(renewalsDueForReminder([deal({ contractEndDate: "2026-10-01" })], today)).toEqual([]); // 40 days ago
  });

  it("skips sales, cancelled deals, deals without an end date, and ones already renewed or not renewing", () => {
    expect(renewalsDueForReminder([deal({ dealType: "SALE" })], today)).toEqual([]);
    expect(renewalsDueForReminder([deal({ status: "CANCELLED" })], today)).toEqual([]);
    expect(renewalsDueForReminder([deal({ contractEndDate: undefined })], today)).toEqual([]);
    expect(renewalsDueForReminder([deal({ renewalStatus: "RENEWED" })], today)).toEqual([]);
    expect(renewalsDueForReminder([deal({ renewalStatus: "NOT_RENEWING" })], today)).toEqual([]);
    expect(renewalsDueForReminder([deal({ renewalStatus: "PENDING" })], today)).toHaveLength(1);
  });
});
