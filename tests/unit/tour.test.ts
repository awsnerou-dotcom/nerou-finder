import { describe, it, expect } from "vitest";
import { TOUR_VERSION, tourModeFor, requestDeskTab, takePendingDeskTab } from "../../src/lib/tour.js";

describe("which guided tour a person gets", () => {
  it("gives a brand-new account the full tour", () => {
    expect(tourModeFor({})).toBe("full");
    expect(tourModeFor({ hasSeenOnboardingTour: false })).toBe("full");
  });

  it("gives someone who finished the original tour (no version stored) only the what's-new tour", () => {
    expect(tourModeFor({ hasSeenOnboardingTour: true })).toBe("whatsnew");
    expect(tourModeFor({ hasSeenOnboardingTour: true, onboardingTourVersion: 1 })).toBe("whatsnew");
  });

  it("shows nothing to someone who has seen the current edition", () => {
    expect(tourModeFor({ hasSeenOnboardingTour: true, onboardingTourVersion: TOUR_VERSION })).toBe(null);
    expect(tourModeFor({ hasSeenOnboardingTour: true, onboardingTourVersion: TOUR_VERSION + 1 })).toBe(null);
  });

  it("shows nothing when nobody is signed in", () => {
    expect(tourModeFor(null)).toBe(null);
    expect(tourModeFor(undefined)).toBe(null);
  });
});

describe("asking the Sales Desk to open a tab", () => {
  it("is remembered until the desk picks it up, and only once", () => {
    requestDeskTab("deals");
    expect(takePendingDeskTab()).toBe("deals");
    expect(takePendingDeskTab()).toBe(null);
  });
});
