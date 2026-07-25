import React, { useState, useEffect } from "react";
import { HelpCircle, Search, ChevronRight, BookOpen, User, Building2, ShieldAlert, FileText, Sparkles } from "lucide-react";

interface HelpCenterViewProps {
  isRtl: boolean;
}

export default function HelpCenterView({ isRtl }: HelpCenterViewProps) {
  const [articles, setArticles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHelpArticles();
  }, []);

  const fetchHelpArticles = async () => {
    try {
      const res = await fetch("/api/help");
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: "ALL", label: isRtl ? "الكل" : "All Articles", icon: BookOpen },
    { id: "VISITORS", label: isRtl ? "الباحثين عن عقار" : "Visitors & Seekers", icon: User },
    { id: "AGENTS", label: isRtl ? "الوسطاء والوكلاء" : "Brokers & Agents", icon: FileText },
    { id: "DEVELOPERS", label: isRtl ? "مؤسسات التطوير" : "Developers", icon: Building2 },
    { id: "SECURITY", label: isRtl ? "الحساب والأمن" : "Account & Law 13", icon: ShieldAlert }
  ];

  const filteredArticles = articles.filter(art => {
    const matchesCategory = selectedCategory === "ALL" || art.category === selectedCategory;
    const matchesSearch = searchQuery.trim() === "" ||
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (art.titleAr && art.titleAr.toLowerCase().includes(searchQuery.toLowerCase())) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (art.contentAr && art.contentAr.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return art.isPublished && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
      <div className="bg-[#1c1a17] text-white p-6 rounded-xl border border-[#33302a] relative overflow-hidden">
        <div className="relative z-10 max-w-xl space-y-3">
          <span className="text-[10px] text-[#bf9b30] font-semibold uppercase tracking-wider block">SUPPORT DESK</span>
          <h2 className="text-xl md:text-2xl font-serif font-medium">{isRtl ? "مركز المساعدة والدعم القانوني" : "Help Center & Regulatory Portal"}</h2>
          <p className="text-xs text-gray-400">
            {isRtl ? "ابحث عن إجابات لأسئلتك المتعلقة بقانون الخصوصية القطري رقم ١٣ والتعاملات العقارية الرقمية." : "Find quick support documentation, tutorials, and compliance guides under Qatar Personal Data Privacy Law No. 13 of 2016."}
          </p>
          <div className="relative mt-2">
            <input
              type="text"
              placeholder={isRtl ? "ابحث في المقالات والمواضيع الموثقة..." : "Search documentation and FAQs..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#2c2925] border border-[#44403a] rounded-lg text-xs focus:outline-none focus:border-[#bf9b30]"
            />
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                selectedCategory === cat.id
                  ? "bg-[#bf9b30] text-black border border-[#bf9b30]"
                  : "bg-white text-[#6e6b66] border border-[#e6e2de] hover:border-[#bf9b30]"
              }`}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-[#6e6b66]">{isRtl ? "جاري تحميل المقالات..." : "Loading resources..."}</div>
      ) : filteredArticles.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#6e6b66] border border-dashed border-[#e6e2de] rounded-xl">
          {isRtl ? "لا توجد مقالات تطابق معايير البحث." : "No articles found matching your query."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map((art) => (
            <div key={art.id} className="p-5 bg-white border border-[#e6e2de] rounded-xl hover:shadow-xs transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 bg-[#fdfcfb] border border-[#f2ede8] text-[#bf9b30] text-[9px] font-bold rounded uppercase">
                    {art.category}
                  </span>
                  <span className="text-[9px] text-[#6e6b66] flex items-center gap-1">
                    <Sparkles size={11} className="text-[#bf9b30]" />
                    <span>{isRtl ? "مستند رسمي" : "Official Guide"}</span>
                  </span>
                </div>
                <h3 className="font-serif font-bold text-sm text-[#1a1918]">{isRtl && art.titleAr ? art.titleAr : art.title}</h3>
                <p className="text-xs text-[#6e6b66] leading-relaxed whitespace-pre-wrap">
                  {isRtl && art.contentAr ? art.contentAr : art.content}
                </p>
              </div>
              <div className="pt-4 border-t border-[#f2ede8] mt-4 flex justify-between items-center text-[10px] text-[#6e6b66]">
                <span>⚖️ Law 13 Compliant Article</span>
                <span>👀 {art.viewCount || 0} views</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
