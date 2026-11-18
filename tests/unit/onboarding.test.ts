import { describe, it, expect } from "vitest";
import { TRIAL_DAYS, TRIAL_PLAN_ID, addDaysIso, daysUntil, defaultExpiryFor, dueSubscriptionReminder, isTrialPlan } from "../../src/lib/onboarding.js";
import {
  accountVerifiedEmail, adminDocumentsReadyEmail, adminNewApplicationEmail, applicationStatusEmail,
  subscriptionActivatedEmail, subscriptionReminderEmail, verificationChangedEmail, welcomeEmail, type EmailParts
} from "../../src/lib/onboardingEmails.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-18T10:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();

describe("the free trial", () => {
  it("is two months: 60 days, matching what the Plans page promises", () => {
    expect(TRIAL_DAYS).toBe(60);
    expect(isTrialPlan(TRIAL_PLAN_ID)).toBe(true);
    expect(isTrialPlan("plan-basic")).toBe(false);
    expect(isTrialPlan(undefined)).toBe(false);
  });

  it("gives the trial 60 days and any other plan a year by default", () => {
    expect(defaultExpiryFor("plan-trial", NOW)).toBe("2027-01-17");
    expect(defaultExpiryFor("plan-basic", NOW)).toBe("2027-11-18");
    expect(defaultExpiryFor(undefined, NOW)).toBe("2027-11-18");
    expect(addDaysIso(NOW, 0)).toBe("2026-11-18");
  });

  it("counts days rounded up", () => {
    expect(daysUntil(inDays(5), NOW)).toBe(5);
    expect(daysUntil(inDays(0.2), NOW)).toBe(1);
    expect(daysUntil(inDays(-1), NOW)).toBe(-1);
  });
});

describe("when a subscription's owner is reminded", () => {
  const active = (expiry: string) => ({ status: "ACTIVE", expiry });

  it("is silent far from the end", () => {
    expect(dueSubscriptionReminder(active(inDays(30)), undefined, NOW)).toBeNull();
    expect(dueSubscriptionReminder(active(inDays(8)), undefined, NOW)).toBeNull();
  });

  it("sends the week notice, then the last-day notice, then the end notice", () => {
    expect(dueSubscriptionReminder(active(inDays(7)), undefined, NOW)).toBe("d7");
    expect(dueSubscriptionReminder(active(inDays(2)), undefined, NOW)).toBe("d7");
    expect(dueSubscriptionReminder(active(inDays(1)), undefined, NOW)).toBe("d1");
    expect(dueSubscriptionReminder(active(inDays(0.4)), undefined, NOW)).toBe("d1");
    expect(dueSubscriptionReminder(active(inDays(-1)), undefined, NOW)).toBe("expired");
  });

  it("sends each once per expiry date, and starts over on a new date", () => {
    const e = inDays(5);
    expect(dueSubscriptionReminder(active(e), { d7: e }, NOW)).toBeNull();
    expect(dueSubscriptionReminder(active(inDays(6)), { d7: e }, NOW)).toBe("d7"); // renewed to another date
    const e1 = inDays(0.5);
    expect(dueSubscriptionReminder(active(e1), { d1: e1 }, NOW)).toBeNull();
    expect(dueSubscriptionReminder(active(e1), { d7: e1 }, NOW)).toBe("d1");
    // the week notice is not sent after the last-day one
    expect(dueSubscriptionReminder(active(e1), { d1: e1 }, NOW)).toBeNull();
    const gone = inDays(-1);
    expect(dueSubscriptionReminder(active(gone), { expired: gone }, NOW)).toBeNull();
  });

  it("never flags an application that was not activated, a missing date, or an old expiry", () => {
    expect(dueSubscriptionReminder({ status: "PENDING_APPROVAL", expiry: inDays(2) }, undefined, NOW)).toBeNull();
    expect(dueSubscriptionReminder({ status: "SUSPENDED", expiry: inDays(2) }, undefined, NOW)).toBeNull();
    expect(dueSubscriptionReminder({ status: "ACTIVE" }, undefined, NOW)).toBeNull();
    expect(dueSubscriptionReminder({ status: "ACTIVE", expiry: "not a date" }, undefined, NOW)).toBeNull();
    expect(dueSubscriptionReminder(active(inDays(-40)), undefined, NOW)).toBeNull();
    expect(dueSubscriptionReminder(active(inDays(-3)), undefined, NOW)).toBe("expired");
  });
});

const ARABIC = /[؀-ۿ]/;
function check(parts: EmailParts | null): EmailParts {
  expect(parts).not.toBeNull();
  const p = parts!;
  expect(p.subject.length).toBeGreaterThan(8);
  expect(p.title.length).toBeGreaterThan(8);
  // English and Arabic in the same message, both in the subject and in the body
  expect(ARABIC.test(p.subject)).toBe(true);
  expect(/[A-Za-z]{3}/.test(p.subject)).toBe(true);
  expect(ARABIC.test(p.body)).toBe(true);
  expect(/[A-Za-z]{3}/.test(p.body.replace(/<[^>]*>/g, ""))).toBe(true);
  expect(p.body).toContain('dir="rtl"');
  return p;
}

describe("the emails an applicant receives", () => {
  it("welcomes a professional with the steps ahead, and a buyer plainly", () => {
    const gated = check(welcomeEmail({ gated: true, trial: true }));
    expect(gated.body).toContain("60-day free trial");
    expect(gated.body).toContain("verified badge");
    expect(check(welcomeEmail({ gated: true, trial: false })).body).not.toContain("free trial");
    const plain = check(welcomeEmail({ gated: false }));
    expect(plain.body).toContain("created successfully");
    expect(plain.body).not.toContain("verified badge");
  });

  it("has a message for every step of the application, and none for an unknown one", () => {
    for (const s of ["PENDING_APPROVAL", "AWAITING_PAYMENT", "AWAITING_DOCUMENTS", "UNDER_VERIFICATION", "ACTIVE"]) {
      check(applicationStatusEmail(s, { kind: "AGENCY" }));
    }
    expect(applicationStatusEmail("SOMETHING_ELSE", { kind: "AGENCY" })).toBeNull();
    expect(applicationStatusEmail("AWAITING_PAYMENT", { kind: "AGENT", trial: true })!.body).toContain("free trial");
    expect(applicationStatusEmail("AWAITING_PAYMENT", { kind: "AGENT", trial: false })!.body).not.toContain("free trial");
  });

  it("says the plan is active without claiming the account is verified", () => {
    const trial = check(subscriptionActivatedEmail({ planName: "60-Day Free Trial", expiry: "2027-01-17T00:00:00.000Z", trial: true, needsDocuments: true }));
    expect(trial.subject).toContain("free trial has started");
    expect(trial.body).toContain("2027-01-17");
    expect(trial.body).toContain("upload your documents");
    expect(trial.body).not.toMatch(/(is|are) now (verified|approved)|has been verified/i);
    expect(trial.body).toContain("Your account is verified once they are approved"); // the honest, conditional wording
    const paid = check(subscriptionActivatedEmail({ planName: "Pro", expiry: "2027-11-18", trial: false, needsDocuments: false }));
    expect(paid.subject).toContain("subscription is active");
    expect(paid.body).not.toContain("upload your documents");
    expect(paid.body).not.toContain("free trial");
  });

  it("announces verification, to a company and to an agent", () => {
    expect(check(accountVerifiedEmail({ kind: "AGENCY" })).body).toContain("your company is now verified");
    expect(check(accountVerifiedEmail({ kind: "AGENCY" })).body).toContain("agents in your team");
    expect(check(accountVerifiedEmail({ kind: "AGENT" })).body).toContain("your account is now verified");
  });

  it("explains a manual decision, and says nothing for 'pending'", () => {
    expect(check(verificationChangedEmail("APPROVED", { kind: "AGENT" })).subject).toContain("verified");
    expect(check(verificationChangedEmail("REJECTED", { kind: "AGENT" })).subject).toContain("could not verify");
    expect(check(verificationChangedEmail("SUSPENDED", { kind: "AGENCY" })).subject).toContain("suspended");
    expect(verificationChangedEmail("PENDING", { kind: "AGENT" })).toBeNull();
  });

  it("warns about the end of a trial or a subscription, in words that fit each", () => {
    const d7 = check(subscriptionReminderEmail("d7", { planName: "60-Day Free Trial", expiry: "2027-01-17", trial: true }));
    expect(d7.subject).toContain("free trial ends in 7 days");
    expect(d7.body).toContain("2027-01-17");
    expect(d7.body).not.toContain("free trial free trial"); // no repeated words
    expect(d7.body).not.toContain("60-Day Free Trial"); // the trial is not called by its plan name
    const paid = check(subscriptionReminderEmail("d7", { planName: "Pro", expiry: "2027-01-17", trial: false }));
    expect(paid.body).toContain("<strong>Pro</strong> subscription");
    expect(paid.subject).toContain("ينتهي"); // masculine noun, masculine verb
    expect(d7.subject).toContain("تنتهي"); // feminine noun, feminine verb
    expect(check(subscriptionReminderEmail("d1", { planName: "Pro", expiry: "2027-01-17", trial: false })).subject).toContain("subscription ends tomorrow");
    expect(check(subscriptionReminderEmail("expired", { planName: "Pro", expiry: "2027-01-17", trial: false })).subject).toContain("subscription has ended");
  });

  it("escapes anything an applicant typed", () => {
    const a = subscriptionActivatedEmail({ planName: "<script>alert(1)</script>", expiry: "2027-01-17", needsDocuments: false });
    expect(a.body).not.toContain("<script>");
    expect(a.body).toContain("&lt;script&gt;");
    const n = adminNewApplicationEmail({ name: "<b>Evil</b>", kind: "AGENT", email: "a@b.c", phone: "<i>1</i>", planName: "<u>x</u>" });
    expect(n.body).not.toMatch(/<b>Evil|<i>1|<u>x/);
  });
});

describe("the emails the team receives", () => {
  it("says who applied and where to act", () => {
    const n = adminNewApplicationEmail({ name: "Walid", kind: "AGENT", email: "w@x.test", phone: "+974 1", planName: "Trial" });
    expect(n.subject).toBe("New independent agent application: Walid");
    expect(n.body).toContain("w@x.test");
    expect(n.body).toContain("Verifications");
    const d = adminDocumentsReadyEmail({ name: "MBA", kind: "AGENCY", count: 3 });
    expect(d.subject).toBe("Documents ready for review: MBA");
    expect(d.body).toContain("all 3 required");
  });
});
