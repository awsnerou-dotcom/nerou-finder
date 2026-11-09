import { describe, it, expect } from "vitest";
import {
  AUTO_NUDGE_MAX,
  columnForStatus,
  computeCommission,
  csvCell,
  isOpenLead,
  isQuietHourInQatar,
  leadsDueForReminder,
  monthlySummary,
  qatarDate,
  toCsv,
  viewingsDueForReminder
} from "../../src/lib/crm.js";
import { Deal, Lead, LeadStatus, ViewingRequest } from "../../src/types.js";

const H = 60 * 60 * 1000;
const D = 24 * H;

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "l1", visitorName: "Client", visitorPhone: "+974 5555 0000", message: "hi", contactMethod: "INQUIRY",
    status: LeadStatus.NEW, agentId: "a1", createdDate: "2026-11-01T08:00:00.000Z", updatedDate: "2026-11-01T08:00:00.000Z", ...over
  };
}

describe("commission", () => {
  it("is value x rate, to two decimals", () => {
    expect(computeCommission(1_000_000, 2)).toBe(20000);
    expect(computeCommission(8500, 5)).toBe(425);
    expect(computeCommission(333.33, 1.5)).toBe(5);
    expect(computeCommission(1000, 0)).toBe(0);
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("defuses spreadsheet formulas in visitor-supplied text (CSV injection)", () => {
    for (const evil of ["=HYPERLINK(\"http://evil\",\"x\")", "+SUM(A1:A9)", "-2+3", "@cmd", "=cmd|' /C calc'!A0", "\tTAB"]) {
      expect(csvCell(evil).replace(/^"/, "").startsWith("'"), evil).toBe(true);
    }
  });

  it("leaves real numbers, ordinary text and clean phone numbers alone", () => {
    expect(csvCell(-1500)).toBe("-1500");
    expect(csvCell(20000)).toBe("20000");
    expect(csvCell("Villa in West Bay")).toBe("Villa in West Bay");
    expect(csvCell("+974 5555 1234")).toBe("+974 5555 1234");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(null)).toBe("");
  });

  it("starts with a byte-order mark and ends rows with CRLF so Excel reads Arabic correctly", () => {
    const out = toCsv(["Client / العميل"], [["محمد"]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toBe("﻿Client / العميل\r\nمحمد\r\n");
  });
});

describe("monthly summary", () => {
  const deal = (over: Partial<Deal>): Deal => ({
    id: "d", agentId: "a1", propertyTitle: "P", clientName: "C", dealType: "SALE", dealValue: 1_000_000, currency: "QAR",
    commissionAmount: 20000, commissionStatus: "EXPECTED", status: "CLOSED", closedDate: "2026-10-15",
    createdDate: "x", updatedDate: "x", ...over
  });

  it("groups by closing month, newest first, splits received/expected and ignores cancelled deals", () => {
    const rows = monthlySummary([
      deal({ id: "1" }),
      deal({ id: "2", dealType: "RENT", dealValue: 120000, commissionAmount: 6000, commissionStatus: "RECEIVED" }),
      deal({ id: "3", closedDate: "2026-11-02", commissionAmount: 10000 }),
      deal({ id: "4", status: "CANCELLED", commissionAmount: 99999 })
    ]);
    expect(rows.map(r => r.month)).toEqual(["2026-11", "2026-10"]);
    const oct = rows[1];
    expect(oct).toMatchObject({ deals: 2, saleValue: 1_000_000, rentValue: 120000, commissionTotal: 26000, commissionReceived: 6000, commissionExpected: 20000 });
  });
});

describe("Qatar time", () => {
  it("uses UTC+3 for the date and for overnight quiet hours", () => {
    expect(qatarDate(Date.parse("2026-11-09T22:30:00Z"))).toBe("2026-11-10"); // 01:30 next day in Qatar
    expect(qatarDate(Date.parse("2026-11-10T08:00:00Z"))).toBe("2026-11-10");
    expect(isQuietHourInQatar(Date.parse("2026-11-09T23:00:00Z"))).toBe(true); // 02:00
    expect(isQuietHourInQatar(Date.parse("2026-11-10T03:59:00Z"))).toBe(true); // 06:59
    expect(isQuietHourInQatar(Date.parse("2026-11-10T04:00:00Z"))).toBe(false); // 07:00
    expect(isQuietHourInQatar(Date.parse("2026-11-10T17:59:00Z"))).toBe(false); // 20:59
    expect(isQuietHourInQatar(Date.parse("2026-11-10T18:00:00Z"))).toBe(true); // 21:00
  });
});

describe("pipeline helpers", () => {
  it("shows ASSIGNED under New and VIEWING_REQUESTED under Viewing; won/lost/archived are not open", () => {
    expect(columnForStatus(LeadStatus.ASSIGNED)).toBe(LeadStatus.NEW);
    expect(columnForStatus(LeadStatus.VIEWING_REQUESTED)).toBe(LeadStatus.VIEWING_SCHEDULED);
    expect(columnForStatus(LeadStatus.NEGOTIATION)).toBe(LeadStatus.NEGOTIATION);
    expect(isOpenLead(lead())).toBe(true);
    expect(isOpenLead(lead({ status: LeadStatus.CONVERTED }))).toBe(false);
    expect(isOpenLead(lead({ status: LeadStatus.LOST }))).toBe(false);
    expect(isOpenLead(lead({ isArchived: true }))).toBe(false);
  });
});

describe("who is due a reminder", () => {
  const now = Date.parse("2026-11-10T08:00:00Z");

  it("reminds once when the follow-up date arrives, not before and not twice", () => {
    const future = lead({ nextFollowUpDate: new Date(now + 2 * H).toISOString() });
    expect(leadsDueForReminder([future], now)).toEqual([]);
    const arrived = lead({ nextFollowUpDate: new Date(now - H).toISOString() });
    expect(leadsDueForReminder([arrived], now).map(d => d.reason)).toEqual(["follow_up_due"]);
    const reminded = { ...arrived, lastReminderAt: new Date(now - 30 * 60 * 1000).toISOString() };
    expect(leadsDueForReminder([reminded], now)).toEqual([]);
  });

  it("repeats an ignored overdue follow-up every 3 days, at most AUTO_NUDGE_MAX more times", () => {
    const base = lead({ nextFollowUpDate: new Date(now - 5 * D).toISOString(), lastReminderAt: new Date(now - 4 * D).toISOString() });
    expect(leadsDueForReminder([base], now).map(d => d.reason)).toEqual(["follow_up_overdue"]);
    expect(leadsDueForReminder([{ ...base, lastReminderAt: new Date(now - 2 * D).toISOString() }], now)).toEqual([]);
    expect(leadsDueForReminder([{ ...base, reminderCount: AUTO_NUDGE_MAX }], now)).toEqual([]);
  });

  it("flags a new lead nobody answered for a day, but not a fresh one", () => {
    const fresh = lead({ createdDate: new Date(now - 5 * H).toISOString(), updatedDate: new Date(now - 5 * H).toISOString() });
    expect(leadsDueForReminder([fresh], now)).toEqual([]);
    const stale = lead({ createdDate: new Date(now - 26 * H).toISOString(), updatedDate: new Date(now - 26 * H).toISOString() });
    expect(leadsDueForReminder([stale], now).map(d => d.reason)).toEqual(["unanswered"]);
  });

  it("nudges an in-progress lead after 3 idle days, then stops after the cap", () => {
    const idle = lead({ status: LeadStatus.NEGOTIATION, updatedDate: new Date(now - 4 * D).toISOString() });
    expect(leadsDueForReminder([idle], now).map(d => d.reason)).toEqual(["no_activity"]);
    expect(leadsDueForReminder([{ ...idle, updatedDate: new Date(now - 2 * D).toISOString() }], now)).toEqual([]);
    expect(leadsDueForReminder([{ ...idle, reminderCount: AUTO_NUDGE_MAX }], now)).toEqual([]);
    expect(leadsDueForReminder([{ ...idle, lastReminderAt: new Date(now - D).toISOString(), reminderCount: 1 }], now)).toEqual([]);
  });

  it("stays quiet while a future follow-up is planned, and for archived, won or lost leads", () => {
    const old = new Date(now - 10 * D).toISOString();
    const planned = lead({ status: LeadStatus.CONTACTED, updatedDate: old, nextFollowUpDate: new Date(now + 3 * D).toISOString() });
    expect(leadsDueForReminder([planned], now)).toEqual([]);
    for (const over of [{ isArchived: true }, { status: LeadStatus.CONVERTED }, { status: LeadStatus.LOST }]) {
      expect(leadsDueForReminder([lead({ updatedDate: old, createdDate: old, ...over })], now)).toEqual([]);
    }
  });
});

describe("viewing reminders", () => {
  const now = Date.parse("2026-11-10T08:00:00Z"); // 11:00 on 10 Nov in Qatar
  const viewing = (over: Partial<ViewingRequest>): ViewingRequest => ({
    id: "v", leadId: "l", propertyId: "p", agentId: "a", preferredDate: "2026-11-11", preferredTimeSlot: "10:00",
    status: "CONFIRMED", createdDate: "x", ...over
  });

  it("covers confirmed viewings today and tomorrow only, once per date/time", () => {
    expect(viewingsDueForReminder([viewing({ preferredDate: "2026-11-10" })], now)).toHaveLength(1);
    expect(viewingsDueForReminder([viewing({ preferredDate: "2026-11-11" })], now)).toHaveLength(1);
    expect(viewingsDueForReminder([viewing({ preferredDate: "2026-11-12" })], now)).toHaveLength(0); // too early
    expect(viewingsDueForReminder([viewing({ preferredDate: "2026-11-09" })], now)).toHaveLength(0); // past
    expect(viewingsDueForReminder([viewing({ status: "REQUESTED" })], now)).toHaveLength(0);
    expect(viewingsDueForReminder([viewing({ status: "CANCELLED" })], now)).toHaveLength(0);
    expect(viewingsDueForReminder([viewing({ reminderSentFor: "2026-11-11|10:00" })], now)).toHaveLength(0);
    // rescheduled to another slot -> the old "sent" marker no longer matches, so it re-arms
    expect(viewingsDueForReminder([viewing({ reminderSentFor: "2026-11-11|10:00", preferredTimeSlot: "16:00" })], now)).toHaveLength(1);
  });
});
