import React, { useState } from "react";
import { Check, ShieldCheck, Zap, Award, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";
import SalesDeskShowcase from "./SalesDeskShowcase.js";
import SubscribersShowcase from "./SubscribersShowcase.js";
import PlanRequestModal from "./PlanRequestModal.js";

interface PlansPricingViewProps {
  isRtl: boolean;
  onSelectPlan: (planId: string) => void;
}

// The public Plans page. It shows what every plan includes and never what it costs: a visitor sends a request
// (the form behind "Request this plan") and our team replies with the plan and price that suits them. Prices
// live only inside the platform (for subscribers and admins). The 60-day free trial is still a normal signup.
export default function PlansPricingView({ isRtl, onSelectPlan }: PlansPricingViewProps) {
  const [requestFor, setRequestFor] = useState<string | null>(null); // plan id, "" = not sure, null = form closed
  const t = (en: string, ar: string) => (isRtl ? ar : en);

  const plans = [
    {
      id: "plan-basic",
      name: t("Independent Agent", "الوسيط المستقل"),
      subtitle: t("For one independent agent selling or renting property on their own", "لوسيط عقاري مستقل يعمل بمفرده"),
      seats: t("1 agent account", "حساب وسيط واحد"),
      featured: 2,
      popular: false,
      badge: null as string | null
    },
    {
      id: "plan-premium",
      name: t("Real-Estate Company", "الشركة العقارية"),
      subtitle: t("For real-estate companies and offices with a team of agents", "للشركات والمكاتب العقارية التي لديها فريق وسطاء"),
      seats: t("Up to 10 agent accounts", "حتى 10 حسابات وسطاء"),
      featured: 15,
      popular: true,
      badge: t("Most Popular", "الأكثر طلباً")
    },
    {
      id: "plan-developer",
      name: t("Developer", "المطور العقاري"),
      subtitle: t("For property developers and large project sales teams", "لمطوري المشاريع العقارية وفرق مبيعات المشاريع الكبرى"),
      seats: t("Up to 50 agent accounts", "حتى 50 حساب وسيط"),
      featured: 50,
      popular: false,
      badge: t("Large projects", "للمشاريع الكبرى")
    }
  ];
  const requestable = plans.map(p => ({ id: p.id, name: p.name }));

  const text = {
    title: t("Plans for every kind of real-estate business", "باقات لكل نوع من الأعمال العقارية"),
    description: t(
      "Every paid plan includes unlimited listings and every feature of the platform. Choose the one that fits you and send a request: we will reply with the plan and the price that suit you.",
      "كل باقة مدفوعة تشمل عقارات غير محدودة وجميع مزايا المنصة. اختر ما يناسبك وأرسل طلبك، وسنرد عليك بالباقة والسعر المناسبين لك."
    ),
    requestPlan: t("Request this plan", "اطلب هذه الباقة"),
    featuresTitle: t("What every plan includes", "ما تشمله كل باقة"),
    activeProperties: t("Property listings", "العقارات المعروضة"),
    agentSeats: t("Agent accounts", "حسابات الوسطاء"),
    aiQuotaLabel: t("AI search", "البحث الذكي بالذكاء الاصطناعي"),
    analyticsAccessLabel: t("Advanced market analytics", "تحليلات وإحصائيات السوق المتقدمة"),
    featuredSlots: t("Featured listing promotion slots", "فتحات الترويج للعقارات المميزة"),
    unlimited: t("Unlimited", "غير محدود"),
    guaranteeTitle: t("Simple, direct activation", "تفعيل مباشر وبسيط"),
    guaranteeDesc: t(
      "No online checkout and no surprise charges. Our team confirms your plan and price with you directly, and activates your workspace once the subscription is agreed.",
      "لا دفع إلكتروني ولا رسوم مفاجئة. يؤكد فريقنا معك الباقة والسعر مباشرة، ويفعّل مساحة عملك بعد الاتفاق على الاشتراك."
    ),
    faqTitle: t("Frequently asked questions", "الأسئلة الشائعة"),
    faqQ1: t("How do I subscribe?", "كيف أشترك؟"),
    faqA1: t(
      "Press \"Request this plan\" and fill in the short form. Our team contacts you, confirms the plan and the price that suit you, and activates your account.",
      "اضغط «اطلب هذه الباقة» واملأ النموذج القصير. يتواصل معك فريقنا لتأكيد الباقة والسعر المناسبين لك ثم يفعّل حسابك."
    ),
    faqQ2: t("Can I try it first?", "هل يمكنني التجربة أولاً؟"),
    faqA2: t(
      "Yes. The 60-day free trial gives you full access with no commitment. You can also send a plan request at any time, and change your plan later by contacting us.",
      "نعم. التجربة المجانية لمدة 60 يوماً تمنحك وصولاً كاملاً دون أي التزام. ويمكنك إرسال طلب باقة في أي وقت، وتغيير باقتك لاحقاً بالتواصل معنا."
    )
  };

  const all = (key: string) => (
    <tr key={key}>
      <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{key}</td>
      {[0, 1, 2, 3].map(i => (
        <td key={i} className="p-4 text-center text-emerald-600"><Check size={16} className="mx-auto" /></td>
      ))}
    </tr>
  );

  return (
    <div className="space-y-16 py-4 animate-in fade-in duration-500" dir={isRtl ? "rtl" : "ltr"}>

      {/* 1. Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold/10 text-gold text-xs font-bold uppercase tracking-widest rounded-full">
          <Award size={13} />
          <span>{t("PLANS", "الباقات")}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-ink leading-tight">{text.title}</h1>
        <p className="text-sm sm:text-base text-ink-muted leading-relaxed">{text.description}</p>
      </div>

      {/* 2. The three paid plans + the free trial */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {plans.map(tier => (
          <div
            key={tier.id}
            className={`relative bg-surface rounded-xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
              tier.popular ? "ring-2 ring-gold shadow-xl md:-translate-y-2" : "hover:border-gold shadow-xs"
            }`}
          >
            {tier.badge && (
              <div className={`absolute -top-3.5 ${isRtl ? "left-4" : "right-4"} bg-gold text-black text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white shadow-xs`}>
                {tier.badge}
              </div>
            )}
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-serif text-xl font-bold text-ink">{tier.name}</h3>
                <p className="text-xs text-ink-muted leading-relaxed min-h-[32px]">{tier.subtitle}</p>
              </div>
              <ul className="space-y-3.5 text-xs text-ink-muted pt-4 border-t border-surface-2">
                {[
                  t("Unlimited property listings", "عقارات غير محدودة"),
                  t("Every platform feature included", "جميع مزايا المنصة مشمولة"),
                  tier.seats,
                  t("Unlimited AI search", "بحث ذكي غير محدود"),
                  t("Sales Desk and market analytics", "مكتب المبيعات وتحليلات السوق"),
                  t(`${tier.featured} featured promotion slots`, `${tier.featured} فتحة ترويج مميزة`)
                ].map(line => (
                  <li key={line} className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-gold shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-8 space-y-2">
              <button
                onClick={() => setRequestFor(tier.id)}
                className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                  tier.popular
                    ? "bg-chrome hover:bg-gold hover:text-ink text-white shadow-md hover:shadow-lg"
                    : "bg-surface border border-ink hover:bg-chrome hover:text-white text-ink"
                }`}
              >
                <span>{text.requestPlan}</span>
                <ChevronRight size={14} className={isRtl ? "rotate-180" : ""} />
              </button>
              <p className="text-[10px] text-ink-muted text-center">{t("Price confirmed by our team", "السعر يؤكده فريقنا")}</p>
            </div>
          </div>
        ))}

        {/* Free trial: a normal signup, no request needed */}
        <div className="relative bg-surface rounded-xl border border-emerald-500/50 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
          <div className={`absolute -top-3.5 ${isRtl ? "left-4" : "right-4"} bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white shadow-xs`}>
            {t("Try It Free", "جرّبها مجاناً")}
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-serif text-xl font-bold text-ink">{t("60-Day Free Trial", "تجربة مجانية 60 يوماً")}</h3>
              <p className="text-xs text-ink-muted leading-relaxed min-h-[32px]">
                {t("Full unlimited access to try the platform before you commit", "وصول كامل غير محدود لتجربة المنصة قبل الاشتراك")}
              </p>
            </div>
            <div className="pt-4 border-t border-surface-2">
              <span className="text-3xl font-mono font-bold text-emerald-600">{t("Free", "مجاني")}</span>
              <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">{t("for 60 days", "لمدة 60 يوماً")}</p>
            </div>
            <ul className="space-y-3.5 text-xs text-ink-muted">
              {[
                t("Unlimited property listings", "عقارات غير محدودة"),
                t("Every platform feature included", "جميع مزايا المنصة مشمولة"),
                t("Unlimited agent accounts", "حسابات وسطاء غير محدودة"),
                t("Unlimited AI search", "بحث ذكي غير محدود"),
                t("No commitment", "دون أي التزام")
              ].map(line => (
                <li key={line} className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-8">
            <button
              onClick={() => onSelectPlan("plan-trial")}
              className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
            >
              <span>{t("Start free trial", "ابدأ التجربة المجانية")}</span>
              <ChevronRight size={14} className={isRtl ? "rotate-180" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Not sure which plan? */}
      <div className="max-w-3xl mx-auto text-center space-y-2">
        <p className="text-sm text-ink-muted">
          {t("Not sure which plan fits you?", "لست متأكداً أي باقة تناسبك؟")}{" "}
          <button onClick={() => setRequestFor("")} className="text-gold font-semibold underline underline-offset-2 cursor-pointer">
            {t("Send us a request and we will advise you", "أرسل لنا طلباً وسنرشدك")}
          </button>
        </p>
      </div>

      {/* 2b. Sales Desk - included in every plan */}
      <div className="max-w-7xl mx-auto">
        <SalesDeskShowcase isRtl={isRtl} onStart={() => onSelectPlan("plan-trial")} />
      </div>

      {/* 2c. Who has already subscribed (shown only when a platform admin has added companies) */}
      <div className="max-w-7xl mx-auto">
        <SubscribersShowcase isRtl={isRtl} />
      </div>

      {/* 3. What every plan includes */}
      <div className="max-w-5xl mx-auto bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        <div className="p-5 bg-ink-inverse border-b border-border">
          <h3 className="font-serif text-base font-semibold text-ink flex items-center gap-2">
            <ShieldCheck className="text-gold" size={18} />
            <span>{text.featuresTitle}</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-border text-ink">
                <th className={`p-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t("Capability", "الميزة")}</th>
                <th className="p-4 text-center font-bold">{plans[0].name}</th>
                <th className="p-4 text-center font-bold text-gold">{plans[1].name}</th>
                <th className="p-4 text-center font-bold">{plans[2].name}</th>
                <th className="p-4 text-center font-bold text-emerald-600">{t("Free Trial", "التجربة المجانية")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-2 text-ink-muted">
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{text.activeProperties}</td>
                {[0, 1, 2, 3].map(i => <td key={i} className="p-4 text-center font-semibold">{text.unlimited}</td>)}
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{text.agentSeats}</td>
                <td className="p-4 text-center font-semibold">1</td>
                <td className="p-4 text-center font-bold text-gold">10</td>
                <td className="p-4 text-center font-semibold">50</td>
                <td className="p-4 text-center font-semibold">{text.unlimited}</td>
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{text.aiQuotaLabel}</td>
                {[0, 1, 2, 3].map(i => <td key={i} className="p-4 text-center font-semibold">{text.unlimited}</td>)}
              </tr>
              <tr>
                <td className={`p-4 font-medium text-ink ${isRtl ? "text-right" : "text-left"}`}>{text.featuredSlots}</td>
                <td className="p-4 text-center">2</td>
                <td className="p-4 text-center font-bold text-gold">15</td>
                <td className="p-4 text-center">50</td>
                <td className="p-4 text-center font-semibold">{text.unlimited}</td>
              </tr>
              {[
                text.analyticsAccessLabel,
                t("Sales Desk: pipeline, follow-ups, viewings", "مكتب المبيعات: المسار والمتابعات والمعاينات"),
                t("Deals, commission and Excel reports", "الصفقات والعمولات وتقارير إكسل"),
                t("Import your own client list", "استيراد عملائك من إكسل")
              ].map(all)}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. How activation works */}
      <div className="max-w-4xl mx-auto bg-ink-inverse rounded-xl border border-dashed border-border p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="p-4 bg-surface border border-border rounded-full text-gold shadow-xs">
          <Zap size={32} />
        </div>
        <div className={`space-y-1.5 text-center ${isRtl ? "md:text-right" : "md:text-left"}`}>
          <h4 className="font-serif text-base font-bold text-ink">{text.guaranteeTitle}</h4>
          <p className="text-xs text-ink-muted leading-relaxed">{text.guaranteeDesc}</p>
        </div>
      </div>

      {/* 5. FAQs */}
      <div className="max-w-4xl mx-auto space-y-6">
        <h3 className="font-serif text-lg font-bold text-ink text-center">{text.faqTitle}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[[text.faqQ1, text.faqA1], [text.faqQ2, text.faqA2]].map(([q, a]) => (
            <div key={q} className="bg-surface p-5 rounded-xl border border-border space-y-2">
              <h4 className="font-semibold text-xs text-ink flex items-center gap-1.5">
                <HelpCircle size={14} className="text-gold" />
                <span>{q}</span>
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {requestFor !== null && (
        <PlanRequestModal
          isRtl={isRtl}
          plans={requestable}
          initialPlanId={requestFor}
          onClose={() => setRequestFor(null)}
          onStartTrial={() => { setRequestFor(null); onSelectPlan("plan-trial"); }}
        />
      )}
    </div>
  );
}
