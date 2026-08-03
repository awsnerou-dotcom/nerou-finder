/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Sparkles, TrendingDown } from "lucide-react";
import { Property } from "../types.js";
import BoostButton from "./BoostButton.js";
import { RowSkeleton } from "./ui/Skeleton.js";

interface BoostRecommendation {
  propertyId: string;
  performanceScore: number;
  viewsPerDay: number;
  leadsCount: number;
  ageDays: number;
  daysSinceLastBoost: number;
  reasonEn: string;
  reasonAr: string;
}

interface BoostRecommendationsProps {
  // Already-fetched listings this workspace owns - used purely to look up display fields
  // (title, price, images, etc.) for the propertyIds the server recommends. Scope (agentId vs
  // orgId) determines which listings the server considers at all.
  properties: Property[];
  agentId?: string;
  orgId?: string;
  isRtl: boolean;
}

// "Recommended to Boost" panel (Smart Boost Recommendations): calls the server-side
// GET /api/boost-recommendations endpoint, which computes a simple Performance Score per
// listing (views/leads relative to age and time since last boost) and generates one real
// Gemini-authored sentence per recommended listing explaining why it's a good boost candidate.
export default function BoostRecommendations({ properties, agentId, orgId, isRtl }: BoostRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<BoostRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!agentId && !orgId) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    if (orgId) params.set("orgId", orgId);

    const token = localStorage.getItem("token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`/api/boost-recommendations?${params.toString()}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      })
      .catch(() => {
        if (!cancelled) setError(isRtl ? "تعذر تحميل توصيات الرفع." : "Could not load boost recommendations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, orgId]);

  if (!agentId && !orgId) return null;
  if (!loading && !error && recommendations.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#bf9b30]/30 overflow-hidden">
      <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex items-center gap-2">
        <Sparkles size={16} className="text-[#bf9b30] shrink-0" />
        <div>
          <h4 className="font-serif text-sm font-semibold text-[#1a1918]">
            {isRtl ? "موصى برفعها" : "Recommended to Boost"}
          </h4>
          <p className="text-[10px] text-[#6e6b66]">
            {isRtl
              ? "تحليل مدعوم بالذكاء الاصطناعي للإعلانات ذات الأداء المنخفض نسبياً لعمرها."
              : "AI-assisted analysis of listings underperforming relative to their age."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-4 divide-y divide-[#f2ede8]">
          <RowSkeleton columns={3} />
          <RowSkeleton columns={3} />
        </div>
      ) : error ? (
        <p className="p-4 text-[11px] text-red-600">{error}</p>
      ) : (
        <div className="divide-y divide-[#f2ede8]">
          {recommendations.map(rec => {
            const property = properties.find(p => p.id === rec.propertyId);
            if (!property) return null;
            return (
              <div key={rec.propertyId} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-[#1a1918] text-xs truncate">
                      {isRtl ? property.titleAr || property.title : property.title}
                    </p>
                    <p className="text-[10px] text-[#6e6b66]">
                      {property.district}, {property.city} • {property.price.toLocaleString()} {property.currency}
                    </p>
                    <p className="text-[9px] text-[#a9a49d]">
                      {isRtl
                        ? `${rec.viewsPerDay}/يوم مشاهدات • ${rec.leadsCount} عميل محتمل • ${rec.ageDays} يوم منذ الإدراج`
                        : `${rec.viewsPerDay}/day views • ${rec.leadsCount} leads • ${rec.ageDays}d since listed`}
                    </p>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 shrink-0">
                    <TrendingDown size={10} />
                    {isRtl ? "أداء منخفض" : "Low performance"}
                  </span>
                </div>
                <p className="text-[10px] text-[#6e6b66] italic leading-relaxed">
                  {isRtl ? rec.reasonAr : rec.reasonEn}
                </p>
                <BoostButton property={property} isRtl={isRtl} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
