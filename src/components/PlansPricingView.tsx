import React, { useState } from "react";
import { motion } from "motion/react";
import { Check, X, ShieldCheck, Zap, Award, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";
import { SubscriptionPlan } from "../types.js";

interface PlansPricingViewProps {
  isRtl: boolean;
  onSelectPlan: (planId: string) => void;
}

export default function PlansPricingView({ isRtl, onSelectPlan }: PlansPricingViewProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);

  // Static fallback or standard subscription plans to display if the server fetch is pending or fails
  const localPlans = [
    {
      id: "plan-basic",
      name: isRtl ? "الوسيط المعياري" : "Standard Broker",
      subtitle: isRtl ? "مثالي للمسوقين العقاريين المستقلين" : "Ideal for independent brokers & starting agents",
      priceMonthly: 500,
      priceYearly: 4800,
      properties: 15,
      agents: 1,
      aiQuota: 50,
      analytics: false,
      featuredListings: 2,
      popular: false,
      color: "border-border",
      badge: null
    },
    {
      id: "plan-premium",
      name: isRtl ? "المكتب المتكامل" : "Enterprise Agency",
      subtitle: isRtl ? "مثالي للمكاتب العقارية المتوسطة والكبيرة" : "Perfect for growing agencies & real estate offices",
      priceMonthly: 1800,
      priceYearly: 18000,
      properties: 100,
      agents: 10,
      aiQuota: 500,
      analytics: true,
      featuredListings: 15,
      popular: true,
      color: "border-gold",
      badge: isRtl ? "الأكثر مبيعاً" : "Most Popular"
    },
    {
      id: "plan-developer",
      name: isRtl ? "المطور العقاري" : "Master Developer",
      subtitle: isRtl ? "للشركات الكبرى ومطوري المشاريع" : "For master builders & enterprise property developers",
      priceMonthly: 4500,
      priceYearly: 45000,
      properties: 500,
      agents: 50,
      aiQuota: 2000,
      analytics: true,
      featuredListings: 50,
      popular: false,
      color: "border-ink",
      badge: isRtl ? "شريك استراتيجي" : "Enterprise Elite"
    }
  ];

  const t = {
    title: isRtl ? "خطط الاشتراك والأسعار" : "Flexible Partner Licensing",
    description: isRtl
      ? "اختر الباقة المناسبة لتوزيع وإدارة أصولك العقارية، وافتح لوحة تحكم ذكية مدعومة بالكامل بالذكاء الاصطناعي."
      : "Acquire high-performance real estate infrastructure. Power your listings, brokers, and lead pipeline with state-of-the-art AI.",
    monthly: isRtl ? "فاتورة شهرية" : "Bill Monthly",
    yearly: isRtl ? "فاتورة سنوية (خصم حصرى)" : "Bill Yearly (Save 20%)",
    qar: isRtl ? "رق" : "QAR",
    perMonth: isRtl ? "/ شهرياً" : "/ month",
    requestPlan: isRtl ? "تقديم طلب اشتراك" : "Request This Plan",
    featuresTitle: isRtl ? "مقارنة المزايا والخصائص بالتفصيل" : "Granular Tier Comparisons & SLA",
    activeProperties: isRtl ? "الحد الأقصى للعقارات النشطة" : "Active Listing Limit",
    agentSeats: isRtl ? "حسابات الوكلاء والوسطاء" : "Agent/Broker Seats",
    aiQuotaLabel: isRtl ? "البحث الذكي بالذكاء الاصطناعي / شهرياً" : "AI Search Quota / Month",
    analyticsAccessLabel: isRtl ? "تحليلات وإحصائيات السوق المتقدمة" : "Advanced Market Analytics",
    featuredSlots: isRtl ? "حملات الترويج للمميز" : "Featured Listing Slots",
    certifiedSupport: isRtl ? "دعم فني متكامل ومعتمد على مدار الساعة" : "24/7 Dedicated Partner SLA",
    unlimitedSearches: isRtl ? "غير محدود" : "Unlimited",
    included: isRtl ? "مشمول" : "Included",
    notIncluded: isRtl ? "غير مشمول" : "Not Included",
    guaranteeTitle: isRtl ? "سداد آمن ومحمي بالكامل" : "Guaranteed Idempotent Payments",
    guaranteeDesc: isRtl
      ? "نحن نستخدم نظام الفوترة والتحصيل اليدوي المباشر عبر الحوالات البنكية المعتمدة لضمان أمان تام وتجنب تكرار المعاملات."
      : "We rely on direct invoice processing and secure bank transfers to activate SaaS licenses, bypass unstable payment gateway downtime, and prevent double charges.",
    faqTitle: isRtl ? "الأسئلة الشائعة حول الاشتراكات" : "Subscription FAQ & Licensing Rules",
    faqQ1: isRtl ? "كيف يتم تفعيل اشتراكي بعد تقديم الطلب؟" : "How is my SaaS subscription activated?",
    faqA1: isRtl
      ? "بمجرد تقديم طلبك، ستتلقى بريدًا إلكترونيًا يحتوي على الفاتورة المعتمدة ورقم المعاملة الفريد. بعد مراجعة الإدارة (خلال أقل من ٢٤ ساعة)، يتم تفعيل حسابك بالكامل."
      : "Upon request, your custom partner portal is provisioned. An administrative invoice is generated with direct payment details. Once verified by our team, your workspace properties are fully unlocked.",
    faqQ2: isRtl ? "هل يمكنني ترقية أو تخفيض باقتي لاحقاً؟" : "Can I upgrade or downgrade my plan later?",
    faqA2: isRtl
      ? "نعم، يمكنك طلب ترقية باقتك في أي وقت من خلال لوحة تحكم مكتبك العقاري، وسيتم ترحيل ميزانيتك المتبقية بشكل متناسب ودقيق تلقائيًا."
      : "Yes. You can request changes directly from your active portal workspace. Upgrade calculations are dynamic and credit your remaining billing cycle toward the new plan.",
  };

  return (
    <div className="space-y-16 py-4 animate-in fade-in duration-500" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* 1. Header Display */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold/10 text-gold text-xs font-bold uppercase tracking-widest rounded-full">
          <Award size={13} />
          <span>SaaS PARTNER NETWORK</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-ink leading-tight">
          {t.title}
        </h1>
        <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
          {t.description}
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center pt-6">
          <div className="bg-canvas border border-border rounded-xl p-1.5 flex items-center gap-1.5 shadow-xs">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-ink text-white shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.monthly}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === "yearly"
                  ? "bg-gold text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <span>{t.yearly}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Three Column Tier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {localPlans.map((tier) => {
          const displayPrice = billingCycle === "monthly" ? tier.priceMonthly : Math.round(tier.priceYearly / 12);
          const totalYearlyPrice = tier.priceYearly;

          return (
            <div
              key={tier.id}
              onMouseEnter={() => setHoveredTier(tier.id)}
              onMouseLeave={() => setHoveredTier(null)}
              className={`relative bg-white rounded-xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                tier.popular
                  ? "ring-2 ring-gold shadow-xl md:-translate-y-2 bg-gold/2"
                  : "hover:border-gold shadow-xs"
              }`}
            >
              {/* Popular Badge Overlay */}
              {tier.badge && (
                <div className={`absolute -top-3.5 ${isRtl ? "left-4" : "right-4"} bg-gold text-black text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white shadow-xs`}>
                  {tier.badge}
                </div>
              )}

              {/* Top Details */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="font-serif text-xl font-bold text-ink">{tier.name}</h3>
                  <p className="text-xs text-ink-muted leading-relaxed min-h-[32px]">{tier.subtitle}</p>
                </div>

                {/* Price */}
                <div className="py-4 border-y border-surface-2 space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-mono font-bold text-ink">
                      {displayPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-ink-muted font-medium">{t.qar} {t.perMonth}</span>
                  </div>
                  {billingCycle === "yearly" ? (
                    <p className="text-[10px] text-emerald-600 font-bold uppercase">
                      {isRtl ? `فوترة سنوية بقيمة ${totalYearlyPrice.toLocaleString()} رق` : `Billed ${totalYearlyPrice.toLocaleString()} QAR annually`}
                    </p>
                  ) : (
                    <p className="text-[10px] text-ink-faint">
                      {isRtl ? "تجديد شهري مرن" : "Flexible monthly licensing"}
                    </p>
                  )}
                </div>

                {/* Key Features Bullet List */}
                <ul className="space-y-3.5 text-xs text-ink-muted">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-gold shrink-0" />
                    <span>
                      {isRtl ? `حتى ${tier.properties} عقار نشط` : `Up to ${tier.properties} active properties`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-gold shrink-0" />
                    <span>
                      {isRtl ? `${tier.agents} حساب وكيل مستقل` : `${tier.agents} dedicated agent seat${tier.agents > 1 ? "s" : ""}`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-gold shrink-0" />
                    <span>
                      {isRtl ? `${tier.aiQuota} استعلام ذكاء اصطناعي` : `${tier.aiQuota} AI search inquiries / mo`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-gold shrink-0" />
                    <span>
                      {isRtl ? `${tier.featuredListings} فتحات ترويج مميزة` : `${tier.featuredListings} featured slot campaigns`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    {tier.analytics ? (
                      <CheckCircle2 size={15} className="text-gold shrink-0" />
                    ) : (
                      <X size={15} className="text-gray-300 shrink-0" />
                    )}
                    <span className={tier.analytics ? "text-ink" : "text-gray-400 line-through"}>
                      {t.analyticsAccessLabel}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Request CTA Button */}
              <div className="pt-8">
                <button
                  onClick={() => onSelectPlan(tier.id)}
                  className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                    tier.popular
                      ? "bg-ink hover:bg-gold hover:text-ink text-white shadow-md hover:shadow-lg"
                      : "bg-white border border-ink hover:bg-ink hover:text-white text-ink"
                  }`}
                >
                  <span>{t.requestPlan}</span>
                  <ChevronRight size={14} className={isRtl ? "rotate-180" : ""} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Deep-Dive Detailed Features Comparison Table */}
      <div className="max-w-5xl mx-auto bg-white rounded-xl border border-border overflow-hidden shadow-xs">
        <div className="p-5 bg-ink-inverse border-b border-border">
          <h3 className="font-serif text-base font-semibold text-ink flex items-center gap-2">
            <ShieldCheck className="text-gold" size={18} />
            <span>{t.featuresTitle}</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-border text-ink">
                <th className={`p-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{isRtl ? "الميزة / السعة" : "Operational Capability"}</th>
                <th className="p-4 text-center font-bold">{isRtl ? "الوسيط المعياري" : "Standard Broker"}</th>
                <th className="p-4 text-center font-bold text-gold">{isRtl ? "المكتب المتكامل" : "Enterprise Agency"}</th>
                <th className="p-4 text-center font-bold">{isRtl ? "المطور العقاري" : "Master Developer"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-2 text-ink-muted">
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{t.activeProperties}</td>
                <td className="p-4 text-center font-semibold">15</td>
                <td className="p-4 text-center font-bold text-gold">100</td>
                <td className="p-4 text-center font-semibold">500</td>
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{t.agentSeats}</td>
                <td className="p-4 text-center font-semibold">1</td>
                <td className="p-4 text-center font-bold text-gold">10</td>
                <td className="p-4 text-center font-semibold">50</td>
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{t.aiQuotaLabel}</td>
                <td className="p-4 text-center">50</td>
                <td className="p-4 text-center font-bold text-gold">500</td>
                <td className="p-4 text-center">2,000</td>
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{t.featuredSlots}</td>
                <td className="p-4 text-center">2</td>
                <td className="p-4 text-center font-bold text-gold">15</td>
                <td className="p-4 text-center">50</td>
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{t.analyticsAccessLabel}</td>
                <td className="p-4 text-center">
                  <X size={14} className="mx-auto text-gray-300" />
                </td>
                <td className="p-4 text-center text-emerald-600 font-bold">
                  <Check size={16} className="mx-auto" />
                </td>
                <td className="p-4 text-center text-emerald-600">
                  <Check size={16} className="mx-auto" />
                </td>
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{t.certifiedSupport}</td>
                <td className="p-4 text-center">Standard Support</td>
                <td className="p-4 text-center text-gold font-bold">Priority SLA (12h)</td>
                <td className="p-4 text-center font-semibold">Dedicated AM & Elite SLA (2h)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Payment Assurance Guarantee */}
      <div className="max-w-4xl mx-auto bg-ink-inverse rounded-xl border border-dashed border-border p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="p-4 bg-white border border-border rounded-full text-gold shadow-xs">
          <Zap size={32} />
        </div>
        <div className="space-y-1.5 text-center md:text-left">
          <h4 className="font-serif text-base font-bold text-ink">{t.guaranteeTitle}</h4>
          <p className="text-xs text-ink-muted leading-relaxed">
            {t.guaranteeDesc}
          </p>
        </div>
      </div>

      {/* 5. FAQs Section */}
      <div className="max-w-4xl mx-auto space-y-6">
        <h3 className="font-serif text-lg font-bold text-ink text-center">{t.faqTitle}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-border space-y-2">
            <h4 className="font-semibold text-xs text-ink flex items-center gap-1.5">
              <HelpCircle size={14} className="text-gold" />
              <span>{t.faqQ1}</span>
            </h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              {t.faqA1}
            </p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-border space-y-2">
            <h4 className="font-semibold text-xs text-ink flex items-center gap-1.5">
              <HelpCircle size={14} className="text-gold" />
              <span>{t.faqQ2}</span>
            </h4>
            <p className="text-xs text-ink-muted leading-relaxed">
              {t.faqA2}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}