/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Calculator, ChevronDown, Info, Landmark, PiggyBank, Scale, Search, TrendingUp } from "lucide-react";
import { affordability, mortgage, parseNum, rentalYield } from "../lib/calculators.js";
import { CALC_TOOLS, calcByKey, pick } from "../lib/calculatorsContent.js";
import type { CalcKey } from "../lib/calculatorsContent.js";

// The free calculators: mortgage payment, rental yield, how much you can afford. Plain arithmetic on what the
// person types; no rule, rate or fee is built in, so nothing here goes out of date (the pages say to confirm
// terms with the bank). Results update as you type. The same text is served to search engines (see
// lib/calculatorsHtml.ts), so the page people read is the page that is indexed.

const ICONS: Record<CalcKey, typeof Calculator> = { mortgage: Landmark, yield: TrendingUp, afford: PiggyBank };
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (n: number) => `${n.toFixed(2)}%`;

function Field({ label, value, onChange, suffix, hint, id }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink-muted mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full px-3 py-2.5 bg-canvas border border-border rounded-xl text-base md:text-sm focus:outline-none focus:border-gold text-ink ${suffix ? "pe-14" : ""}`}
        />
        {suffix && <span className="absolute inset-y-0 end-3 flex items-center text-xs text-ink-faint pointer-events-none">{suffix}</span>}
      </div>
      {hint && <p className="text-[11px] text-ink-faint mt-1">{hint}</p>}
    </div>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "bg-chrome text-white border-chrome" : "bg-canvas border-border"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${strong ? "text-white/70" : "text-ink-faint"}`}>{label}</p>
      <p className={`mt-1 font-serif font-medium leading-tight ${strong ? "text-3xl" : "text-xl text-ink"}`} dir="ltr" style={{ textAlign: "start" }}>{value}</p>
    </div>
  );
}

export default function CalculatorView({ isRtl, tool, onSelectTool, onOpenPriceCheck, onSearch }: {
  isRtl: boolean;
  tool: CalcKey;
  onSelectTool: (key: CalcKey) => void;
  onOpenPriceCheck: () => void;
  onSearch: () => void;
}) {
  const lang = isRtl ? "ar" : "en";
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const info = calcByKey(tool);
  const Icon = ICONS[tool];
  const qar = t("QAR", "ر.ق");

  // example numbers, to be replaced; each tool keeps what was typed while switching between them
  const [m, setM] = useState({ price: "1,500,000", down: "20", rate: "5.5", years: "25" });
  const [y, setY] = useState({ price: "1,500,000", rent: "7,500", costs: "6,000", vacant: "1" });
  const [a, setA] = useState({ income: "25,000", share: "30", debts: "0", down: "200,000", rate: "5.5", years: "25" });

  const mortgageResult = useMemo(() => mortgage({ price: parseNum(m.price), downPct: parseNum(m.down), ratePct: parseNum(m.rate), years: parseNum(m.years) }), [m]);
  const yieldResult = useMemo(() => rentalYield({ price: parseNum(y.price), monthlyRent: parseNum(y.rent), annualCosts: parseNum(y.costs) || 0, vacantMonths: parseNum(y.vacant) || 0 }), [y]);
  const affordResult = useMemo(() => affordability({
    monthlyIncome: parseNum(a.income), sharePct: parseNum(a.share), otherDebts: parseNum(a.debts) || 0, downPayment: parseNum(a.down) || 0, ratePct: parseNum(a.rate), years: parseNum(a.years)
  }), [a]);

  const empty = (
    <p className="text-sm text-ink-muted flex items-start gap-2"><Info size={16} className="text-gold shrink-0 mt-0.5" />{t("Enter the numbers on the left to see the result.", "أدخل الأرقام لترى النتيجة.")}</p>
  );

  const note = t(
    "An estimate from the numbers you enter. Your bank or advisor sets the real terms, so confirm them before you decide.",
    "تقدير مبني على الأرقام التي تدخلها. الشروط الفعلية يحددها بنكك أو مستشارك، فتأكد منها قبل أن تقرر."
  );

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-8 animate-in fade-in duration-500" dir={isRtl ? "rtl" : "ltr"}>
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gold-soft text-gold-active text-xs font-semibold uppercase tracking-[0.14em] rounded-full">
          <Calculator size={13} />{t("Free calculators", "حاسبات مجانية")}
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-medium text-ink leading-tight">{pick(info.h1, lang)}</h1>
        <p className="text-sm sm:text-base text-ink-muted leading-relaxed">{pick(info.intro, lang)}</p>
      </div>

      <div role="tablist" aria-label={t("Calculators", "الحاسبات")} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-surface-2/70 border border-border/60">
        {CALC_TOOLS.map(c => {
          const I = ICONS[c.key];
          const on = c.key === tool;
          return (
            <button key={c.key} type="button" role="tab" aria-selected={on} onClick={() => onSelectTool(c.key)}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${on ? "bg-chrome text-white shadow-card" : "text-ink-muted hover:text-ink hover:bg-surface"}`}>
              <I size={16} />{pick(c.label, lang)}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <section className="lg:col-span-2 bg-surface rounded-2xl border border-border p-5 sm:p-6 space-y-4">
          <p className="text-[12px] text-ink-faint flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" />{t("These are example numbers: replace them with yours.", "هذه أرقام للمثال: استبدلها بأرقامك.")}</p>

          {tool === "mortgage" && (
            <>
              <Field id="m-price" label={t("Property price", "سعر العقار")} suffix={qar} value={m.price} onChange={v => setM({ ...m, price: v })} />
              <Field id="m-down" label={t("Down payment", "الدفعة الأولى")} suffix="%" value={m.down} onChange={v => setM({ ...m, down: v })} hint={t("The share of the price you pay yourself.", "نسبة السعر التي تدفعها من مالك.")} />
              <Field id="m-rate" label={t("Interest rate per year", "الفائدة السنوية")} suffix="%" value={m.rate} onChange={v => setM({ ...m, rate: v })} hint={t("Use the rate your bank quotes you.", "استخدم الفائدة التي يعرضها عليك البنك.")} />
              <Field id="m-years" label={t("Repayment period", "مدة السداد")} suffix={t("years", "سنة")} value={m.years} onChange={v => setM({ ...m, years: v })} />
            </>
          )}
          {tool === "yield" && (
            <>
              <Field id="y-price" label={t("Purchase price", "سعر الشراء")} suffix={qar} value={y.price} onChange={v => setY({ ...y, price: v })} />
              <Field id="y-rent" label={t("Monthly rent", "الإيجار الشهري")} suffix={qar} value={y.rent} onChange={v => setY({ ...y, rent: v })} />
              <Field id="y-costs" label={t("Your costs per year", "تكاليفك السنوية")} suffix={qar} value={y.costs} onChange={v => setY({ ...y, costs: v })} hint={t("Service charges, maintenance, management fees.", "رسوم الخدمة والصيانة والإدارة.")} />
              <Field id="y-vacant" label={t("Months empty per year", "أشهر الشغور في السنة")} suffix={t("months", "شهر")} value={y.vacant} onChange={v => setY({ ...y, vacant: v })} hint={t("Months you expect it to stand without a tenant.", "الأشهر التي تتوقع أن يبقى فيها بلا مستأجر.")} />
            </>
          )}
          {tool === "afford" && (
            <>
              <Field id="a-income" label={t("Monthly income", "الدخل الشهري")} suffix={qar} value={a.income} onChange={v => setA({ ...a, income: v })} />
              <Field id="a-share" label={t("Share of income for repayments", "نسبة الدخل المخصصة للأقساط")} suffix="%" value={a.share} onChange={v => setA({ ...a, share: v })} hint={t("Your choice. Your bank has its own limit: ask it.", "قرارك أنت. وللبنك حدّه الخاص: اسأله.")} />
              <Field id="a-debts" label={t("Other monthly debts", "التزامات شهرية أخرى")} suffix={qar} value={a.debts} onChange={v => setA({ ...a, debts: v })} />
              <Field id="a-down" label={t("Cash for the down payment", "المبلغ المتاح للدفعة الأولى")} suffix={qar} value={a.down} onChange={v => setA({ ...a, down: v })} />
              <Field id="a-rate" label={t("Interest rate per year", "الفائدة السنوية")} suffix="%" value={a.rate} onChange={v => setA({ ...a, rate: v })} />
              <Field id="a-years" label={t("Repayment period", "مدة السداد")} suffix={t("years", "سنة")} value={a.years} onChange={v => setA({ ...a, years: v })} />
            </>
          )}
        </section>

        <section className="lg:col-span-3 bg-surface rounded-2xl border border-border shadow-card p-5 sm:p-6 space-y-5" aria-live="polite">
          <h2 className="font-serif text-lg font-medium text-ink flex items-center gap-2"><Icon size={18} className="text-gold" />{t("Your result", "نتيجتك")}</h2>

          {tool === "mortgage" && (mortgageResult ? (
            <>
              <Tile strong label={t("Monthly payment", "القسط الشهري")} value={`${qar} ${fmt(mortgageResult.monthly)}`} />
              <div className="grid grid-cols-2 gap-3">
                <Tile label={t("Loan amount", "مبلغ القرض")} value={`${qar} ${fmt(mortgageResult.loan)}`} />
                <Tile label={t("Down payment", "الدفعة الأولى")} value={`${qar} ${fmt(mortgageResult.down)}`} />
                <Tile label={t("Total you repay", "إجمالي ما ستسدده")} value={`${qar} ${fmt(mortgageResult.totalPaid)}`} />
                <Tile label={t("Total interest", "إجمالي الفوائد")} value={`${qar} ${fmt(mortgageResult.interest)}`} />
              </div>
              {mortgageResult.totalPaid > 0 && (
                <div>
                  <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden flex" role="img" aria-label={t("Share of the repayment that is interest", "حصة الفوائد من السداد")}>
                    <span className="bg-chrome" style={{ width: `${(mortgageResult.loan / mortgageResult.totalPaid) * 100}%` }} />
                    <span className="bg-gold" style={{ width: `${(mortgageResult.interest / mortgageResult.totalPaid) * 100}%` }} />
                  </div>
                  <p className="text-[12px] text-ink-muted mt-2">{t(`${Math.round((mortgageResult.interest / mortgageResult.totalPaid) * 100)}% of what you repay is interest.`, `${Math.round((mortgageResult.interest / mortgageResult.totalPaid) * 100)}% مما ستسدده فوائد.`)}</p>
                </div>
              )}
            </>
          ) : empty)}

          {tool === "yield" && (yieldResult ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Tile strong label={t("Gross yield", "العائد الإجمالي")} value={pct(yieldResult.grossPct)} />
                <Tile strong label={t("Net yield", "العائد الصافي")} value={pct(yieldResult.netPct)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Tile label={t("Rent for a full year", "إيجار سنة كاملة")} value={`${qar} ${fmt(yieldResult.annualRent)}`} />
                <Tile label={t("Net income per year", "صافي الدخل السنوي")} value={`${qar} ${fmt(yieldResult.netIncome)}`} />
              </div>
              <p className="text-sm text-ink-muted">
                {yieldResult.paybackYears
                  ? t(`At this net income the price is earned back in about ${yieldResult.paybackYears.toFixed(1)} years.`, `بهذا الدخل الصافي يُسترد الثمن خلال نحو ${yieldResult.paybackYears.toFixed(1)} سنة.`)
                  : t("With these costs the property earns nothing after expenses.", "بهذه التكاليف لا يحقق العقار ربحاً بعد المصاريف.")}
              </p>
              <button type="button" onClick={onOpenPriceCheck} className="inline-flex items-center gap-2 text-sm font-semibold text-gold-active hover:underline cursor-pointer">
                <Scale size={15} />{t("Is the rent you expect realistic? Check it against live listings", "هل الإيجار الذي تتوقعه واقعي؟ قارنه بالعقارات المعروضة")}
              </button>
            </>
          ) : empty)}

          {tool === "afford" && (affordResult ? (
            affordResult.budget > 0 ? (
              <>
                <Tile strong label={t("Property price you can afford", "سعر العقار الذي تستطيع تحمّله")} value={`${qar} ${fmt(affordResult.maxPrice)}`} />
                <div className="grid grid-cols-2 gap-3">
                  <Tile label={t("Monthly repayment budget", "ميزانية القسط الشهري")} value={`${qar} ${fmt(affordResult.budget)}`} />
                  <Tile label={t("Largest loan that fits", "أكبر قرض يناسبك")} value={`${qar} ${fmt(affordResult.maxLoan)}`} />
                </div>
                <button type="button" onClick={onSearch} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-chrome text-white text-sm font-semibold hover:bg-chrome-hover cursor-pointer">
                  <Search size={15} />{t("Search properties on Nerou Finder", "ابحث عن عقارات في نيرو فايندر")}
                </button>
              </>
            ) : (
              <p className="text-sm text-ink-muted flex items-start gap-2"><Info size={16} className="text-gold shrink-0 mt-0.5" />{t("With these numbers nothing is left for repayments after your other debts. Raise the share or lower the debts.", "بهذه الأرقام لا يتبقى شيء للأقساط بعد التزاماتك الأخرى. ارفع النسبة أو خفّض الالتزامات.")}</p>
            )
          ) : empty)}

          <p className="text-[12px] text-ink-faint border-t border-border pt-3">{note}</p>
        </section>
      </div>

      <section className="bg-surface rounded-2xl border border-border p-5 sm:p-6 space-y-3">
        <h2 className="font-serif text-lg font-medium text-ink">{t("How to use it", "كيف تستعملها")}</h2>
        <ol className="list-decimal ps-5 space-y-1.5 text-sm text-ink-muted">{info.steps.map((s, i) => <li key={i}>{pick(s, lang)}</li>)}</ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-medium text-ink">{t("Frequently asked questions", "أسئلة شائعة")}</h2>
        {info.faq.map((f, i) => (
          <details key={i} className="group bg-surface rounded-xl border border-border px-4 py-3">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-semibold text-ink">
              {pick(f.q, lang)}<ChevronDown size={16} className="shrink-0 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">{pick(f.a, lang)}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
