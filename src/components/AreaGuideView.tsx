/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MapPin, CheckCircle2, Building2, TrendingUp } from "lucide-react";
import StatCard from "./StatCard.js";
import { useCurrency } from "../currencyContext.js";

interface MarketStat {
  district: string;
  city: string;
  transactionType: "RENT" | "SALE";
  listingCount: number;
  avgPricePerSqm: number | null;
  medianPrice: number | null;
  lowConfidence: boolean;
}

interface AreaGuideDetail {
  id: string;
  slug: string;
  district: string;
  cityLabel: string;
  cityLabelAr: string;
  title: string;
  titleAr: string;
  overview: string;
  overviewAr: string;
  highlights: string[];
  highlightsAr: string[];
  liveListingCount: number;
  marketStats: MarketStat[];
}

interface AreaGuideViewProps {
  isRtl: boolean;
  slug: string;
  onClose: () => void;
  // Navigates back into the marketplace search, pre-filtered to this guide's district - see
  // VisitorExperience.tsx's handleViewListingsInDistrict, which reuses the exact same
  // Municipality/Area select-driven filter mechanism a manual user selection would produce.
  onViewListings: (district: string) => void;
}

// Renders one curated Doha area guide (see src/data/areaGuides.ts / GET /api/areas/:slug):
// static editorial content plus live market stats pulled from the same market-index
// aggregation GET /api/market-index uses. Reachable both from AreaGuidesView's directory grid
// and directly via the /areas/:slug deep link (see VisitorExperience.tsx).
export default function AreaGuideView({ isRtl, slug, onClose, onViewListings }: AreaGuideViewProps) {
  const { formatPrice } = useCurrency();
  const [guide, setGuide] = useState<AreaGuideDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/areas/${encodeURIComponent(slug)}`)
      .then(res => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then(data => {
        if (!cancelled && data) setGuide(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-gold transition-colors cursor-pointer"
        >
          <BackIcon size={14} />
          <span>{isRtl ? "العودة إلى أدلة الأحياء" : "Back to Area Guides"}</span>
        </button>

        {loading ? (
          <div className="py-20 text-center text-xs text-ink-muted">
            {isRtl ? "جاري تحميل الدليل..." : "Loading area guide..."}
          </div>
        ) : notFound || !guide ? (
          <div className="py-20 text-center text-xs text-ink-muted border border-dashed border-border rounded-xl bg-surface p-8">
            <p className="font-semibold text-sm mb-1">{isRtl ? "لم يتم العثور على هذا الدليل" : "Area guide not found"}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-gold uppercase tracking-wider">
                <MapPin size={12} />
                {isRtl ? guide.cityLabelAr : guide.cityLabel}
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-medium text-ink">
                {isRtl ? guide.titleAr : guide.title}
              </h1>
            </div>

            {/* Live market stats - reuses the market-index aggregation, never fabricated. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                icon={Building2}
                label={isRtl ? "الإعلانات النشطة" : "Live Listings"}
                value={guide.liveListingCount.toLocaleString()}
              />
              {guide.marketStats.map(stat => (
                <StatCard
                  key={stat.transactionType}
                  icon={TrendingUp}
                  label={
                    stat.transactionType === "RENT"
                      ? isRtl
                        ? "متوسط سعر المتر (إيجار)"
                        : "Avg QAR/sqm (Rent)"
                      : isRtl
                      ? "متوسط سعر المتر (بيع)"
                      : "Avg QAR/sqm (Sale)"
                  }
                  value={stat.avgPricePerSqm != null ? formatPrice(stat.avgPricePerSqm, isRtl) : isRtl ? "بيانات غير كافية" : "Not enough data yet"}
                  subtitle={
                    stat.lowConfidence
                      ? isRtl
                        ? `عيّنة صغيرة (${stat.listingCount})`
                        : `Small sample (${stat.listingCount})`
                      : isRtl
                      ? `${stat.listingCount} إعلان`
                      : `${stat.listingCount} listings`
                  }
                />
              ))}
            </div>

            <div className="bg-surface p-5 rounded-xl border border-border">
              <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                {isRtl ? guide.overviewAr : guide.overview}
              </p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
              <h3 className="font-serif text-sm font-semibold text-ink">
                {isRtl ? "أبرز ما يميز المنطقة" : "Area Highlights"}
              </h3>
              <ul className="space-y-2">
                {(isRtl ? guide.highlightsAr : guide.highlights).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-ink-muted">
                    <CheckCircle2 size={14} className="text-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onViewListings(guide.district)}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-gold to-gold-active hover:opacity-95 text-white rounded-lg text-sm font-bold transition-opacity cursor-pointer"
            >
              {isRtl
                ? `عرض ${guide.liveListingCount} إعلان في ${guide.district}`
                : `View ${guide.liveListingCount} listing${guide.liveListingCount === 1 ? "" : "s"} in ${guide.district}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
