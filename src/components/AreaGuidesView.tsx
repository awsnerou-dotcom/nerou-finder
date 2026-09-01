/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { MapPin, ChevronRight, BookOpen } from "lucide-react";

interface AreaGuideSummary {
  id: string;
  slug: string;
  title: string;
  titleAr: string;
  cityLabel: string;
  cityLabelAr: string;
}

interface AreaGuidesViewProps {
  isRtl: boolean;
  onSelectGuide: (slug: string) => void;
}

// Directory page listing every curated Doha area guide (see src/data/areaGuides.ts and
// GET /api/areas) - the SEO content-page counterpart to CareersView/PressView, following the
// same fetch-on-mount + card-grid layout convention as this file's neighbors.
export default function AreaGuidesView({ isRtl, onSelectGuide }: AreaGuidesViewProps) {
  const [guides, setGuides] = useState<AreaGuideSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/areas")
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (!cancelled) setGuides(data || []);
      })
      .catch(() => {
        if (!cancelled) setGuides([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-2xl font-serif text-ink font-medium flex items-center gap-2">
          <BookOpen className="text-gold" size={24} />
          <span>{isRtl ? "أدلة الأحياء في الدوحة" : "Doha Area Guides"}</span>
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {isRtl
            ? "تعرّف على أبرز أحياء الدوحة ولوسيل - طابعها ومعالمها وأنواع العقارات الشائعة فيها - مدعومة بإحصاءات أسعار حية."
            : "Explore Doha and Lusail's best-known neighborhoods - their character, landmarks, and typical property types - backed by live market pricing data."}
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-ink-muted">
          {isRtl ? "جاري تحميل الأدلة..." : "Loading area guides..."}
        </div>
      ) : guides.length === 0 ? (
        <div className="py-12 text-center text-xs text-ink-muted border border-dashed border-border rounded-xl bg-surface p-8">
          <p className="font-semibold text-sm mb-1">{isRtl ? "لا توجد أدلة منشورة حالياً" : "No area guides available"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map(guide => (
            <button
              key={guide.id}
              type="button"
              onClick={() => onSelectGuide(guide.slug)}
              className="text-left rtl:text-right p-5 bg-surface border border-border rounded-xl hover:border-gold hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gold uppercase tracking-wider">
                    <MapPin size={11} />
                    {isRtl ? guide.cityLabelAr : guide.cityLabel}
                  </span>
                  <h3 className="font-serif text-base font-semibold text-ink group-hover:text-gold transition-colors">
                    {isRtl ? guide.titleAr : guide.title}
                  </h3>
                </div>
                <ChevronRight
                  size={16}
                  className={`shrink-0 text-ink-faint group-hover:text-gold transition-colors mt-1 ${isRtl ? "rotate-180" : ""}`}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
