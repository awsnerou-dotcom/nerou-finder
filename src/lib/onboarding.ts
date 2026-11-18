// The rules of the sign-up pipeline that must be the same on the server and in the admin screens: how long the free trial is, what
// expiry date a plan gets by default, and when a subscription's owner should be reminded that it is ending.

export const TRIAL_PLAN_ID = "plan-trial";
/** The free trial is advertised as 60 days (two months) on the Plans page, so this is what an admin must see too. */
export const TRIAL_DAYS = 60;
/** What a paid plan gets by default when an admin confirms it. */
export const PAID_DEFAULT_DAYS = 365;

export const isTrialPlan = (planId?: string | null) => planId === TRIAL_PLAN_ID;

const DAY = 24 * 60 * 60 * 1000;

/** `from` plus N whole days, as YYYY-MM-DD (UTC, like the date inputs it fills). */
export function addDaysIso(from: Date, days: number): string {
  return new Date(from.getTime() + days * DAY).toISOString().slice(0, 10);
}

/** The expiry date an admin form should offer for a plan: 60 days for the trial, a year for anything else. */
export function defaultExpiryFor(planId: string | undefined | null, from: Date = new Date()): string {
  return addDaysIso(from, isTrialPlan(planId) ? TRIAL_DAYS : PAID_DEFAULT_DAYS);
}

/** Whole days from `from` to `to` (rounded up), so "ends later today" is 1 and "ended yesterday" is 0 or less. */
export function daysUntil(to: string | Date, from: Date = new Date()): number {
  const end = typeof to === "string" ? Date.parse(to) : to.getTime();
  return Math.ceil((end - from.getTime()) / DAY);
}

export type SubscriptionReminder = "d7" | "d1" | "expired";
export interface SentReminders { d7?: string; d1?: string; expired?: string }

/** How long after an expiry we still tell the owner it has ended: older ones are silent, so old data never triggers a flood of emails. */
export const EXPIRED_NOTICE_WINDOW_DAYS = 3;

/**
 * Which reminder, if any, a subscription is due. Each is sent once per expiry date (the date it was sent for is remembered, so
 * renewing to a new date starts over). Only an ACTIVE subscription is reminded: an application that was never activated is not "ending".
 */
export function dueSubscriptionReminder(sub: { status?: string; expiry?: string }, sent: SentReminders | undefined, now: Date = new Date()): SubscriptionReminder | null {
  if (sub.status !== "ACTIVE" || !sub.expiry) return null;
  const expiry = sub.expiry;
  if (Number.isNaN(Date.parse(expiry))) return null;
  const left = daysUntil(expiry, now);
  const done = sent || {};
  if (left <= 0) {
    if (left < -EXPIRED_NOTICE_WINDOW_DAYS) return null;
    return done.expired === expiry ? null : "expired";
  }
  if (left <= 1) return done.d1 === expiry ? null : "d1";
  if (left <= 7) return done.d7 === expiry || done.d1 === expiry ? null : "d7";
  return null;
}
