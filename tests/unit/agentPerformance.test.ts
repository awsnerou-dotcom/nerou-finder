import { describe, it, expect } from "vitest";
import {
  firstResponseAt, responseMinutes, agentResponseStats, responseBadge, isTopAgent, publicAgentPerformance, formatReplyTime,
  MIN_RESPONSES, TOP_AGENT_MIN_LISTINGS, RESPONSE_WINDOW_DAYS
} from "../../src/lib/agentPerformance.js";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60000).toISOString();

// a lead that arrived `arrivedAgo` minutes ago and was first answered `after` minutes later
const answered = (agentId: string, arrivedAgo: number, after: number, status = "CONTACTED") => ({
  agentId, createdDate: at(arrivedAgo),
  stageHistory: [{ status: "NEW", date: at(arrivedAgo), byName: "x" }, { status, date: at(arrivedAgo - after), byName: "Agent" }]
} as never);

describe("measuring a reply", () => {
  it("is the first action that is more than 'new' or 'assigned'", () => {
    const lead = { agentId: "a", createdDate: at(300), stageHistory: [
      { status: "NEW", date: at(300), byName: "x" }, { status: "ASSIGNED", date: at(290), byName: "Admin" },
      { status: "CONTACTED", date: at(250), byName: "Agent" }, { status: "NEGOTIATION", date: at(100), byName: "Agent" }] } as never;
    expect(responseMinutes(lead)).toBeCloseTo(50, 6);
  });

  it("does not count being assigned, or an enquiry nobody has touched", () => {
    expect(responseMinutes({ agentId: "a", createdDate: at(300), stageHistory: [{ status: "NEW", date: at(300), byName: "x" }, { status: "ASSIGNED", date: at(200), byName: "x" }] } as never)).toBeNull();
    expect(responseMinutes({ agentId: "a", createdDate: at(300) } as never)).toBeNull();
  });

  it("counts a note by the lead's own agent as a reply, but not a note by someone else", () => {
    const note = (authorId: string, minutesAgo: number) => ({ id: "n", text: "x", authorId, authorName: "n", createdDate: at(minutesAgo) });
    expect(responseMinutes({ agentId: "a", createdDate: at(120), notes: [note("a", 100)] } as never)).toBeCloseTo(20, 6);
    expect(responseMinutes({ agentId: "a", createdDate: at(120), notes: [note("admin", 100)] } as never)).toBeNull();
    // whichever came first wins
    expect(responseMinutes({ agentId: "a", createdDate: at(120), notes: [note("a", 90)], stageHistory: [{ status: "CONTACTED", date: at(110), byName: "A" }] } as never)).toBeCloseTo(10, 6);
  });

  it("ignores impossible or unreadable dates", () => {
    expect(responseMinutes({ agentId: "a", createdDate: at(100), stageHistory: [{ status: "CONTACTED", date: at(200), byName: "x" }] } as never)).toBeNull(); // before it arrived
    expect(responseMinutes({ agentId: "a", createdDate: "garbage", stageHistory: [{ status: "CONTACTED", date: at(10), byName: "x" }] } as never)).toBeNull();
    expect(firstResponseAt({ agentId: "a", createdDate: at(100), stageHistory: [{ status: "CONTACTED", date: "nope", byName: "x" }] } as never)).toBeNull();
  });
});

describe("an agent's reply statistics", () => {
  it("takes the median over this agent's enquiries from the last 90 days only", () => {
    const leads = [
      answered("a", 600, 10), answered("a", 500, 30), answered("a", 400, 50),                // median 30
      answered("a", 400, 5000, "CONTACTED"),                                                // a slow one: median of four = 40
      answered("b", 600, 999),                                                              // someone else's
      { agentId: "a", createdDate: at(RESPONSE_WINDOW_DAYS * 1440 + 100), stageHistory: [{ status: "CONTACTED", date: at(RESPONSE_WINDOW_DAYS * 1440 + 90), byName: "A" }] } as never, // too old
      { agentId: "a", createdDate: at(200) } as never                                       // received, never answered
    ];
    expect(agentResponseStats(leads, "a", NOW)).toEqual({ received: 5, responded: 4, medianMinutes: 40 });
    expect(agentResponseStats(leads, "nobody", NOW)).toEqual({ received: 0, responded: 0, medianMinutes: null });
  });
});

describe("the reply-speed badge", () => {
  const stats = (responded: number, medianMinutes: number | null) => ({ received: responded + 2, responded, medianMinutes });
  it("is earned by median reply time, and only with enough answered enquiries", () => {
    expect(responseBadge(stats(MIN_RESPONSES, 45))).toBe("WITHIN_HOUR");
    expect(responseBadge(stats(MIN_RESPONSES, 60))).toBe("WITHIN_HOUR");
    expect(responseBadge(stats(MIN_RESPONSES, 61))).toBe("WITHIN_FEW_HOURS");
    expect(responseBadge(stats(MIN_RESPONSES, 240))).toBe("WITHIN_FEW_HOURS");
    expect(responseBadge(stats(MIN_RESPONSES, 600))).toBe("WITHIN_DAY");
    expect(responseBadge(stats(MIN_RESPONSES, 1441))).toBeNull();
    expect(responseBadge(stats(MIN_RESPONSES - 1, 5))).toBeNull(); // one lucky reply is not enough
    expect(responseBadge(stats(10, null))).toBeNull();
  });

  it("makes a Top agent of a verified, quick agent with a real portfolio", () => {
    const quick = stats(8, 30);
    expect(isTopAgent({ verified: true, liveListings: TOP_AGENT_MIN_LISTINGS, stats: quick })).toBe(true);
    expect(isTopAgent({ verified: false, liveListings: 20, stats: quick })).toBe(false);
    expect(isTopAgent({ verified: true, liveListings: TOP_AGENT_MIN_LISTINGS - 1, stats: quick })).toBe(false);
    expect(isTopAgent({ verified: true, liveListings: 20, stats: stats(8, 600) })).toBe(false); // slow: replies within a day, not a top agent
    expect(isTopAgent({ verified: true, liveListings: 20, stats: stats(2, 5) })).toBe(false);
  });

  it("lists publicly only the agents who earned something", () => {
    const leads = [
      ...[10, 20, 30, 40, 50].map((m, i) => answered("fast", 1000 + i, m)),
      ...[2000, 3000, 4000, 5000, 6000].map((m, i) => answered("slowish", 9000 + i, m)),
      answered("few", 800, 5)
    ];
    const out = publicAgentPerformance(leads, [
      { id: "fast", verified: true, liveListings: 9 }, { id: "slowish", verified: true, liveListings: 9 }, { id: "few", verified: true, liveListings: 9 }, { id: "none", verified: true, liveListings: 9 }
    ], NOW);
    expect(Object.keys(out)).toEqual(["fast"]);
    expect(out.fast).toEqual({ badge: "WITHIN_HOUR", top: true, medianMinutes: 30, responded: 5 });
  });
});

describe("saying a reply time", () => {
  it("uses minutes, hours or days in both languages", () => {
    expect(formatReplyTime(0.2, false)).toBe("1 min");
    expect(formatReplyTime(12, false)).toBe("12 min");
    expect(formatReplyTime(90, false)).toBe("1.5 h");
    expect(formatReplyTime(3000, false)).toBe("2.1 d");
    expect(formatReplyTime(12, true)).toBe("12 دقيقة");
    expect(formatReplyTime(180, true)).toBe("3 ساعة");
  });
});
