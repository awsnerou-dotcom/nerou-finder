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
        <h2 className="text-2xl font-serif text-[#1a1918] font-medium flex items-center gap-2">
          <Newspaper className="text-[#bf9b30]" size={24} />
          <span>{isRtl ? "الأخبار والبيانات الصحفية" : "Press Room & Media Publications"}</span>
        </h2>
        <p className="text-xs text-[#6e6b66] mt-1">
          {isRtl
            ? "تابع آخر أخبار نيرو فايندر، وتحديثات التكنولوجيا العقارية السحابية، وإطلاق الخدمات والتحسينات في قطر."
            : "Follow the latest corporate news, technology updates, and marketplace announcements from Nerou Finder."}
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e6b66]">{isRtl ? "جاري تحميل البيانات الصحفية..." : "Loading publications..."}</div>
      ) : press.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#6e6b66] border border-dashed border-[#e6e2de] rounded-xl bg-white p-8">
          <p className="font-semibold text-sm mb-1">{isRtl ? "لا توجد بيانات صحفية منشورة حاليًا" : "No press releases available"}</p>
          <p className="text-[11px] text-gray-400">{isRtl ? "يرجى التحقق لاحقًا لمعرفة المزيد من التحديثات الإعلامية." : "We'll announce new technological breakthroughs shortly."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {press.map((release) => (
            <div key={release.id} className="p-6 bg-white border border-[#e6e2de] rounded-xl hover:shadow-xs transition-shadow flex flex-col md:flex-row gap-6">
              <div className="md:w-1/4 space-y-1 text-xs">
                <span className="px-2 py-0.5 bg-[#fcfbfa] border border-[#f2ede8] text-[#bf9b30] text-[9px] font-bold rounded uppercase">
                  {isRtl ? "بيان صحفي" : "Press Release"}
                </span>
                <span className="block text-gray-400 font-mono mt-1">🗓 {release.date ? release.date.split("T")[0] : "2026-07-20"}</span>
                <span className="block text-[10px] text-[#6e6b66]">Doha, Qatar</span>
              </div>
              
              <div className="md:w-3/4 space-y-2">
                <h3 className="font-serif font-bold text-base text-[#1a1918]">
                  {isRtl && release.titleAr ? release.titleAr : release.title}
                </h3>
                <p className="text-xs font-semibold text-[#bf9b30] leading-relaxed">
                  {isRtl && release.summaryAr ? release.summaryAr : release.summary}
                </p>
                <p className="text-xs text-[#6e6b66] leading-relaxed whitespace-pre-wrap">
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
