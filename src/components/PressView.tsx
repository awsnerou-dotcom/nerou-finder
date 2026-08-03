import React, { useState, useEffect } from "react";
import { Newspaper, Calendar, Globe, Tag, ChevronRight, Award } from "lucide-react";

interface PressViewProps {
  isRtl: boolean;
}

export default function PressView({ isRtl }: PressViewProps) {
  const [press, setPress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPress();
  }, []);

  const fetchPress = async () => {
    try {
      const res = await fetch("/api/press");
      if (res.ok) {
        const data = await res.json();
        setPress(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-2xl font-serif text-ink font-medium flex items-center gap-2">
          <Newspaper className="text-gold" size={24} />
          <span>{isRtl ? "الأخبار والبيانات الصحفية" : "Press Room & Media Publications"}</span>
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {isRtl
            ? "تابع آخر أخبار نيرو فايندر، وتحديثات التكنولوجيا العقارية السحابية، وإطلاق الخدمات والتحسينات في قطر."
            : "Follow the latest corporate news, technology updates, and marketplace announcements from Nerou Finder."}
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-ink-muted">{isRtl ? "جاري تحميل البيانات الصحفية..." : "Loading publications..."}</div>
      ) : press.length === 0 ? (
        <div className="py-12 text-center text-xs text-ink-muted border border-dashed border-border rounded-xl bg-surface p-8">
          <p className="font-semibold text-sm mb-1">{isRtl ? "لا توجد بيانات صحفية منشورة حاليًا" : "No press releases available"}</p>
          <p className="text-[11px] text-gray-400">{isRtl ? "يرجى التحقق لاحقًا لمعرفة المزيد من التحديثات الإعلامية." : "We'll announce new technological breakthroughs shortly."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {press.map((release) => (
            <div key={release.id} className="p-6 bg-surface border border-border rounded-xl hover:shadow-xs transition-shadow flex flex-col md:flex-row gap-6">
              <div className="md:w-1/4 space-y-1 text-xs">
                <span className="px-2 py-0.5 bg-canvas border border-surface-2 text-gold text-[9px] font-bold rounded uppercase">
                  {isRtl ? "بيان صحفي" : "Press Release"}
                </span>
                <span className="flex items-center gap-1 text-gray-400 font-mono mt-1">
                  <Calendar size={11} className="shrink-0" />
                  {release.date ? release.date.split("T")[0] : "2026-07-20"}
                </span>
                <span className="block text-[10px] text-ink-muted">Doha, Qatar</span>
              </div>
              
              <div className="md:w-3/4 space-y-2">
                <h3 className="font-serif font-bold text-base text-ink">
                  {isRtl && release.titleAr ? release.titleAr : release.title}
                </h3>
                <p className="text-xs font-semibold text-gold leading-relaxed">
                  {isRtl && release.summaryAr ? release.summaryAr : release.summary}
                </p>
                <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
                  {isRtl && release.contentAr ? release.contentAr : release.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
