/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import StatCard from "./StatCard.js";
import { useCurrency } from "../currencyContext.js";

// Shape returned by GET /api/market-index's `groups` array (see server.ts's
// computeMarketIndexGroups()) - duplicated here rather than imported since server.ts isn't
// part of the client bundle.
interface MarketIndexGroup {
  district: string;
  city: string;
  transactionType: "RENT" | "SALE";
  listingCount: number;
  avgPricePerSqm: number | null;
  medianPrice: number | null;
  lowConfidence: boolean;
}

interface MarketPriceIndexProps {
  isRtl: boolean;
  // Resolved district display name (must match Property.district exactly, e.g. from
  // locations.find(l => l.id === selectedArea)?.name) - undefined/empty shows the top-5
  // most-active-districts overview instead of one district's own breakdown.
  selectedDistrict?: string;
}

// Compact market-context strip shown on the public search page (VisitorExperience.tsx) -
// derived entirely from GET /api/market-index, which is itself a pure computation over
// currently published listings (no separate persisted stats table to keep in sync).
export default function MarketPriceIndex({ isRtl, selectedDistrict }: MarketPriceIndexProps) {
  const { formatPrice } = useCurrency();
  const [groups, setGroups] = useState<MarketIndexGroup[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedDistrict) params.append("district", selectedDistrict);
    fetch(`/api/market-index?${params.toString()}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled) setGroups(data?.groups || []);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDistrict]);

  if (loading) {
    return <div className="bg-surface p-4 rounded-xl border border-border h-28 animate-pulse" />;
  }

  // Silently stay out of the way rather than showing an empty chart/card when there simply
  // isn't enough live listing data yet to compute anything meaningful.
  if (!groups || groups.length === 0) return null;

  if (selectedDistrict) {
    return (
      <div className="bg-surface p-4 rounded-xl border border-border space-y-3">
        <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp size={13} className="text-gold" />
          <span>{isRtl ? `مؤشر أسعار ${selectedDistrict}` : `Market Price Index — ${selectedDistrict}`}</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map(g => (
            <StatCard
              key={g.transactionType}
              icon={TrendingUp}
              label={
                g.transactionType === "RENT"
                  ? isRtl
                    ? "متوسط سعر المتر المربع (إيجار)"
                    : "Avg QAR/sqm (Rent)"
                  : isRtl
                  ? "متوسط سعر المتر المربع (بيع)"
                  : "Avg QAR/sqm (Sale)"
              }
              value={g.avgPricePerSqm != null ? formatPrice(g.avgPricePerSqm, isRtl) : isRtl ? "بيانات غير كافية" : "Not enough data yet"}
              subtitle={
                g.lowConfidence
                  ? isRtl
                    ? `عيّنة صغيرة (${g.listingCount} إعلان)`
                    : `Small sample (${g.listingCount} listing${g.listingCount === 1 ? "" : "s"})`
                  : isRtl
                  ? `${g.listingCount} إعلان نشط`
                  : `${g.listingCount} active listings`
              }
            />
          ))}
        </div>
      </div>
    );
  }

  // Overview mode: blend each district's RENT+SALE groups into one weighted average QAR/sqm
  // (weighted by listing count, ignoring groups with no computable average), then chart the
  // top 5 districts by total listing count.
  // "Alwaab" and "Al waab" are one district: group by the name without spaces or case.
  const byDistrict = new Map<string, { name: string; listingCount: number; weightedSum: number; weightedCount: number }>();
  for (const g of groups) {
    const key = g.district.toLowerCase().replace(/[\s'’-]+/g, "");
    const entry = byDistrict.get(key) || { name: g.district, listingCount: 0, weightedSum: 0, weightedCount: 0 };
    entry.listingCount += g.listingCount;
    if (g.avgPricePerSqm != null) {
      entry.weightedSum += g.avgPricePerSqm * g.listingCount;
      entry.weightedCount += g.listingCount;
    }
    byDistrict.set(key, entry);
  }

  const top5 = Array.from(byDistrict.values())
    .map((v) => ({
      district: v.name,
      listingCount: v.listingCount,
      avgPricePerSqm: v.weightedCount > 0 ? v.weightedSum / v.weightedCount : null
    }))
    .filter((d): d is { district: string; listingCount: number; avgPricePerSqm: number } => d.avgPricePerSqm != null)
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 5);

  if (top5.length === 0) return null;

  // A ranked list with the figure written out beats an axis-only bar chart: every number is
  // readable at a glance, in either language, with no hidden tooltip.
  const maxValue = Math.max(...top5.map(d => d.avgPricePerSqm));

  return (
    <div className="bg-surface p-4 sm:p-5 rounded-xl border border-border space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-ink flex items-center gap-1.5">
          <BarChart3 size={14} className="text-gold" />
          <span>{isRtl ? "متوسط سعر المتر المربع في الأحياء الأكثر نشاطاً" : "Average price per sqm in the busiest areas"}</span>
        </h4>
        <p className="text-xs text-ink-muted mt-0.5">
          {isRtl ? "من الإعلانات المعروضة حالياً على المنصة" : "From the listings live on the platform now"}
        </p>
      </div>
      <ul className="space-y-2.5">
        {top5.map(d => (
          <li key={d.district}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink truncate">{d.district}</span>
              <span className="tabular-nums text-ink shrink-0">
                {formatPrice(Math.round(d.avgPricePerSqm), isRtl)}
                <span className="text-xs text-ink-muted"> {isRtl ? "/ م²" : "/ sqm"}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(6, Math.round((d.avgPricePerSqm / maxValue) * 100))}%` }} />
            </div>
            <p className="text-[11px] text-ink-faint mt-0.5">
              {isRtl ? `${d.listingCount} إعلان` : `${d.listingCount} ${d.listingCount === 1 ? "listing" : "listings"}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
