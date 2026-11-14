// "Your reach": how many people opened an agent's or agency's public page and how many arrived through a link they
// shared, for the last 30 days, with a daily series for a small chart and the listings that bring the most visitors.
// Pure functions over the per-day counters the server keeps, unit tested.

import { sumLastDays } from "./profiles.js";

export interface ShareStats {
  profileViews: number;
  shareVisits: number;
  series: { date: string; profile: number; share: number }[];
  top: { id: string; title: string; shareVisits: number; views: number }[];
}

type DayRecord = Record<string, number> | undefined;

function lastDays(days: number, now: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(new Date(now - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

export function buildShareStats(input: {
  profileViewsByDay: DayRecord;
  listings: { id: string; title: string; viewsByDay?: DayRecord; shareVisitsByDay?: DayRecord }[];
  now: number;
  days?: number;
}): ShareStats {
  const days = input.days ?? 30;
  const dates = lastDays(days, input.now);
  const shareByDay: Record<string, number> = {};
  for (const l of input.listings) {
    for (const [d, n] of Object.entries(l.shareVisitsByDay || {})) shareByDay[d] = (shareByDay[d] || 0) + (Number(n) || 0);
  }
  const series = dates.map(date => ({ date, profile: Number(input.profileViewsByDay?.[date]) || 0, share: shareByDay[date] || 0 }));
  const top = input.listings
    .map(l => ({ id: l.id, title: l.title, shareVisits: sumLastDays(l.shareVisitsByDay, days, input.now), views: sumLastDays(l.viewsByDay, days, input.now) }))
    .filter(l => l.shareVisits > 0)
    .sort((a, b) => b.shareVisits - a.shareVisits || b.views - a.views)
    .slice(0, 5);
  return {
    profileViews: series.reduce((s, x) => s + x.profile, 0),
    shareVisits: series.reduce((s, x) => s + x.share, 0),
    series,
    top
  };
}
