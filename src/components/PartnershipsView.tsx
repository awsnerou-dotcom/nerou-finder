import React, { useState } from "react";
import { Award, ShieldCheck, ArrowRight, CheckCircle2, User, Building, Mail, Phone, MessageSquare } from "lucide-react";

interface PartnershipsViewProps {
  isRtl: boolean;
}

export default function PartnershipsView({ isRtl }: PartnershipsViewProps) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"DEVELOPER" | "AGENCY" | "TECHNOLOGY" | "MEDIA" | "OTHER">("DEVELOPER");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !contactName || !email || !phone) return;
    setLoading(true);
    try {
      const res = await fetch("/api/partnerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactName,
          email,
          phone,
          type,
          message,
        })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setCompanyName("");
          setContactName("");
          setEmail("");
          setPhone("");
          setMessage("");
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-xs" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-2xl font-serif text-[#1a1918] font-medium flex items-center gap-2">
          <Award className="text-[#bf9b30]" size={24} />
          <span>{isRtl ? "الشراكات والخدمات المؤسسية" : "Enterprise Partnerships Portal"}</span>
        </h2>
        <p className="text-xs text-[#6e6b66] mt-1">
          {isRtl
            ? "انضم كشريك تطوير أو وكالة عقارية معتمدة، واستفد من البنية التحتية البرمجية والحلول السحابية لمنصة نيرو فايندر في قطر."
            : "Connect as a developer tenant, property agency, or API integration partner with the Nerou Finder platform."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-5 space-y-4">
          <div className="bg-[#1c1a17] text-white p-6 rounded-xl border border-[#33302a] space-y-4">
            <h3 className="font-serif font-bold text-sm text-[#bf9b30] uppercase tracking-wider">
              {isRtl ? "شريك مرخص في قطر" : "Licensed Collaboration"}
            </h3>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {isRtl
                ? "نحن نوفر كفاءة تشغيلية كاملة لشركات التطوير العقاري الكبرى والوسطاء القانونيين مع الامتثال التام للقوانين المحلية والرقابية."
                : "We provide complete infrastructure, live telemetry, and regulatory reporting for Qatar's leading developers and legal brokerages."}
            </p>

            <div className="space-y-2 pt-2 border-t border-white/10 text-[10px] text-gray-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" size={14} />
                <span>{isRtl ? "متوافق مع قانون حماية البيانات رقم ١٣ لعام ٢٠١٦" : "100% Compliant with Law No. 13 of 2016"}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" size={14} />
                <span>{isRtl ? "ربط فوري للمخططات الرئيسية والمشاريع السكنية" : "Instant pre-construction and masterplan integration"}</span>
              </div>
            </div>
          </div>

          <div className="border border-[#e6e2de] rounded-xl p-5 space-y-2 bg-[#fdfcfb]">
            <span className="font-serif font-bold text-sm text-[#1a1918] block">{isRtl ? "عناوين التواصل الرسمية" : "Corporate Desk"}</span>
            <p className="text-gray-600">🏢 Lusail Marina Twins, West Bay, Doha, Qatar</p>
            <p className="text-gray-600">✉️ partners@nerou.qa</p>
            <p className="text-gray-600">📞 +974 4444 8888</p>
          </div>
        </div>

        <div className="md:col-span-7 bg-white border border-[#e6e2de] rounded-xl p-6">
          <h3 className="font-serif font-bold text-sm text-[#1a1918] border-b border-[#f2ede8] pb-2 mb-4">
            {isRtl ? "طلب شراكة أو تسجيل مؤسسة جديدة" : "Submit Partnership Application"}
          </h3>

          {success ? (
            <div className="p-8 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
              <p className="font-bold text-sm">{isRtl ? "تم تقديم طلب الشراكة بنجاح!" : "Application Transmitted!"}</p>
              <p className="text-[11px] text-gray-500">
                {isRtl
                  ? "سيقوم فريق العمليات والشؤون القانونية لدينا بمراجعة طلبك والتواصل معك عبر البريد الإلكتروني."
                  : "The administration and platform operations desk will audit your profile and reach out within 2 business days."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "اسم الشركة / الكيان" : "Company / Enterprise Name"}</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                    />
                    <Building size={12} className="absolute left-2.5 top-3 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "اسم الشخص المسؤول" : "Contact Person"}</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                    />
                    <User size={12} className="absolute left-2.5 top-3 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "البريد الإلكتروني" : "Business Email"}</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                    />
                    <Mail size={12} className="absolute left-2.5 top-3 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "رقم الجوال" : "Mobile Phone"}</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+974"
                      className="w-full pl-8 pr-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                    />
                    <Phone size={12} className="absolute left-2.5 top-3 text-gray-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "نوع الشراكة" : "Collaboration Type"}</label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                >
                  <option value="DEVELOPER">{isRtl ? "مطور عقاري (مشاريع ومخططات)" : "Property Developer (Pre-construction / Masterplans)"}</option>
                  <option value="AGENCY">{isRtl ? "وكالة عقارية مرخصة" : "Licensed Real Estate Brokerage"}</option>
                  <option value="TECHNOLOGY">{isRtl ? "شريك تكنولوجي / مزود حلول" : "Technology Integration Vendor"}</option>
                  <option value="MEDIA">{isRtl ? "شريك إعلامي / تسويقي" : "Media or Advertising Partner"}</option>
                  <option value="OTHER">{isRtl ? "أخرى" : "Other"}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "تفاصيل الطلب أو الاقتراح" : "Brief Pitch / Application Message"}</label>
                <div className="relative">
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isRtl ? "اكتب نبذة عن مؤسستكم وأهداف الشراكة مع نيرو..." : "Detail your business operations, portfolio size, and licensing credentials..."}
                    className="w-full pl-8 pr-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                  ></textarea>
                  <MessageSquare size={12} className="absolute left-2.5 top-3 text-gray-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-[#bf9b30] hover:bg-[#a68628] disabled:bg-gray-400 text-black font-bold text-xs rounded-lg uppercase tracking-wider cursor-pointer"
              >
                {loading ? (isRtl ? "جاري الإرسال..." : "Transmitting...") : (isRtl ? "إرسال طلب الشراكة" : "Transmit Partnership Pitch")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
