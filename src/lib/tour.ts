// Rules for the guided tour that don't depend on React, so they can be unit-tested.

// Bump this whenever the tour gains something worth showing again. Accounts that finished an older
// edition then get a short "what's new" tour once; brand-new accounts get the full tour.
//   1 = original tour (dashboard, leads, listings, ...)
//   2 = adds the Sales Desk (clients, pipeline, reminders, viewings, tasks, deals, reports)
export const TOUR_VERSION = 2;

export type TourMode = "full" | "whatsnew" | null;

export function tourModeFor(user: { hasSeenOnboardingTour?: boolean; onboardingTourVersion?: number } | null | undefined): TourMode {
  if (!user) return null;
  if (!user.hasSeenOnboardingTour) return "full";
  // Accounts that finished the tour before versions existed saw edition 1.
  const seen = Number.isFinite(user.onboardingTourVersion) ? Number(user.onboardingTourVersion) : 1;
  return seen < TOUR_VERSION ? "whatsnew" : null;
}

// ---- Sales Desk tab hand-off -------------------------------------------------------------------
// The tour opens the Sales Desk and then asks it to show a particular inner tab. The desk may not
// be mounted yet at that moment, so the request is remembered until the desk picks it up.
export type DeskTabId = "pipeline" | "followups" | "viewings" | "tasks" | "deals" | "reports";
export const DESK_TAB_EVENT = "nerou:desk-tab";
const DESK_TABS: DeskTabId[] = ["pipeline", "followups", "viewings", "tasks", "deals", "reports"];

let pendingDeskTab: DeskTabId | null = null;

export function requestDeskTab(tab: DeskTabId): void {
  pendingDeskTab = tab;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DESK_TAB_EVENT, { detail: tab }));
}

export function takePendingDeskTab(): DeskTabId | null {
  const tab = pendingDeskTab;
  pendingDeskTab = null;
  return tab && DESK_TABS.includes(tab) ? tab : null;
}
