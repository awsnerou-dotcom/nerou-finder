// Shared route table for the client's full-page tabs.
//
// Lives here rather than inside VisitorExperience.tsx because server.ts needs the same list:
// it decides which unmatched paths get the SPA shell with a 200 and which are genuine 404s.
// Two copies would drift, and a drifted copy means either a real page 404s or a typo keeps
// answering 200 - the exact soft-404 problem this table exists to fix.

export type VisitorTab =
  | "MARKETPLACE"
  | "PROJECTS"
  | "HELP_CENTER"
  | "CAREERS"
  | "PRESS"
  | "PARTNERSHIPS"
  | "SUPPORT_TICKETS"
  | "LEGAL"
  | "PLANS"
  | "AREA_GUIDES"
  | "VALUATION";

// Real URLs for the full-page tabs. Until these existed, robots.txt and sitemap.xml
// advertised /plans-pricing, /help-center, /careers and /press while visiting any of them
// landed on the marketplace: the views were component state only, and the URL-sync effect in
// VisitorExperience saw no open overlay and pushed "/" back over the requested path.
// /plans-pricing is the one page the agent-facing funnel can point at, so it has to survive
// a direct hit, a refresh and being shared.
//
// SUPPORT_TICKETS is deliberately absent: it is gated behind a signed-in user, so a public
// URL for it would only ever render an empty state.
export const STATIC_TAB_PATHS: Partial<Record<VisitorTab, string>> = {
  PLANS: "/plans-pricing",
  HELP_CENTER: "/help-center",
  CAREERS: "/careers",
  PRESS: "/press",
  PARTNERSHIPS: "/partnerships",
  LEGAL: "/legal",
  PROJECTS: "/projects",
  AREA_GUIDES: "/area-guides",
  VALUATION: "/property-valuation"
};

const PATH_TO_STATIC_TAB: Record<string, VisitorTab> = Object.fromEntries(
  Object.entries(STATIC_TAB_PATHS).map(([tab, path]) => [path, tab as VisitorTab])
);

// Trailing slashes are tolerated so /plans-pricing/ behaves like /plans-pricing instead of
// falling through to the marketplace.
export function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function staticTabForPath(pathname: string): VisitorTab | null {
  return PATH_TO_STATIC_TAB[normalizePath(pathname)] ?? null;
}

// Paths the SPA shell legitimately answers for. Consumed by the catch-all in server.ts:
// anything outside this set (and not already handled by /properties/:id or /areas/:slug) is
// a real 404, not a 200 with the marketplace behind it.
export const SPA_PATHS: ReadonlySet<string> = new Set<string>([
  "/",
  ...Object.values(STATIC_TAB_PATHS)
]);
