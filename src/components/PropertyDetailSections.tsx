/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Calculator, CalendarDays, ChevronDown, Eye, Landmark, MapPin, School, ShoppingBag, ShoppingCart, Stethoscope,
  TrainFront, Trees, Utensils, Waves, BadgeCheck, Wallet, Info
} from "lucide-react";
import type { NearbyPlace, Property } from "../types.js";
import { formatNearbyDistance, nearbyTypeLabel } from "../lib/propertyNearby.js";
import { loanBreakdown, rentalReturn } from "../lib/investment.js";
import type { SpecRow } from "../lib/propertySpecs.js";

// The content sections of a listing page: about, specifications, payment plan, nearby places, the listing's record
// and the investment planner. Every one of them shows only real data - what the agent entered or what the platform
// recorded - and a section with nothing real to show is not drawn.

type Fmt = (qar: number, isRtl: boolean) => string;
const card = "bg-surface rounded-2xl border border-border p-6 sm:p-8";

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      {icon ?? <span className="h-px w-8 bg-gold shrink-0" aria-hidden="true" />}
      <h3 className="font-serif text-xl font-medium text-ink">{children}</h3>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ about
export function AboutCard({ text, isRtl }: { text: string; isRtl: boolean }) {
  const [open, setOpen] = useState(false);
  const paras = (text || "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  // a short opening paragraph is set larger, like the standfirst of an article; a long block stays body text
  const leadIsShort = paras[0].length <= 320;
  const lead = leadIsShort ? paras[0] : null;
  const body = leadIsShort ? paras.slice(1) : paras;
  const long = text.length > 700;
  const collapsed = long && !open;
  return (
    <section className={card}>
      <SectionTitle>{isRtl ? "عن هذا العقار" : "About this property"}</SectionTitle>
      {lead && <p className="font-serif text-[1.2rem] leading-9 text-ink whitespace-pre-line">{lead}</p>}
      {body.length > 0 && (
        <div className={`relative ${lead ? "mt-5" : ""} space-y-4 text-[15px] leading-8 text-ink-muted ${collapsed ? "max-h-44 overflow-hidden" : ""}`}>
          {body.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          {collapsed && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent" />}
        </div>
      )}
      {long && (
        <button onClick={() => setOpen(o => !o)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-active hover:text-gold cursor-pointer">
          {open ? (isRtl ? "عرض أقل" : "Show less") : (isRtl ? "عرض المزيد" : "Read more")}
          <ChevronDown size={15} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------------------ specifications
export function SpecsCard({ rows, isRtl }: { rows: SpecRow[]; isRtl: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section className={card}>
      <SectionTitle>{isRtl ? "المواصفات" : "Specifications"}</SectionTitle>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-6 py-3 border-b border-border/70">
            <dt className="text-[13px] text-ink-muted">{r.label}</dt>
            <dd className={`text-[13px] font-semibold text-end tabular-nums ${r.tone === "good" ? "text-success" : r.tone === "warn" ? "text-warning" : "text-ink"}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------------------------------------ payment plan (off-plan)
export function PaymentPlanCard({ plan, isRtl }: { plan: NonNullable<Property["paymentPlan"]>; isRtl: boolean }) {
  const hasAny = plan && (plan.reservation || plan.installments || plan.details);
  if (!hasAny) return null;
  return (
    <section className={card}>
      <SectionTitle icon={<span className="w-9 h-9 rounded-xl bg-gold-soft text-gold-active flex items-center justify-center shrink-0"><Wallet size={17} /></span>}>
        {isRtl ? "خطة الدفع" : "Payment plan"}
      </SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {plan.reservation ? (
          <div className="rounded-xl bg-canvas border border-border p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">{isRtl ? "عند الحجز" : "On reservation"}</p>
            <p className="font-serif text-2xl font-medium text-ink">{plan.reservation}%</p>
          </div>
        ) : null}
        {plan.installments ? (
          <div className="rounded-xl bg-canvas border border-border p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">{isRtl ? "الأقساط" : "Instalments"}</p>
            <p className="text-sm font-semibold text-ink">{plan.installments}</p>
          </div>
        ) : null}
      </div>
      {plan.details && <p className="mt-4 text-[15px] leading-7 text-ink-muted whitespace-pre-line">{plan.details}</p>}
    </section>
  );
}

// ------------------------------------------------------------------------------------------ nearby places
const NEARBY_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  SCHOOL: School, HOSPITAL: Stethoscope, MALL: ShoppingBag, SUPERMARKET: ShoppingCart, MOSQUE: Landmark,
  PARK: Trees, BEACH: Waves, METRO: TrainFront, RESTAURANT: Utensils, OTHER: MapPin
};

/** The places the agent listed. Draws nothing when there are none: no places is better than made-up ones. */
export function NearbyList({ places, isRtl }: { places: NearbyPlace[] | undefined; isRtl: boolean }) {
  if (!places || places.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {isRtl ? "أماكن قريبة" : "Nearby"}
      </h4>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {places.map((p, i) => {
          const Icon = NEARBY_ICON[p.type] || MapPin;
          return (
            <li key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-canvas border border-border">
              <span className="w-9 h-9 rounded-xl bg-gold-soft text-gold-active flex items-center justify-center shrink-0"><Icon size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink truncate">{isRtl && p.nameAr ? p.nameAr : p.name}</span>
                <span className="block text-[11px] text-ink-faint">{nearbyTypeLabel(p.type, isRtl)}</span>
              </span>
              <span className="text-xs font-semibold text-ink-muted tabular-nums whitespace-nowrap">{formatNearbyDistance(p, isRtl)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ the listing's record
const dateOnly = (iso?: string) => (iso ? iso.split("T")[0] : "");

/** What the platform actually recorded about this listing: dates, views and every price it has had. */
export function ListingRecordCard({ property, isRtl, formatPrice }: { property: Property; isRtl: boolean; formatPrice: Fmt }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const facts: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (property.createdDate) facts.push({ icon: <CalendarDays size={15} />, label: t("First published", "تاريخ النشر"), value: dateOnly(property.createdDate) });
  if (property.updatedDate) facts.push({ icon: <CalendarDays size={15} />, label: t("Last updated", "آخر تحديث"), value: dateOnly(property.updatedDate) });
  if (typeof property.views === "number") facts.push({ icon: <Eye size={15} />, label: t("Views", "المشاهدات"), value: property.views.toLocaleString() });
  if (typeof property.qualityScore === "number") facts.push({ icon: <BadgeCheck size={15} />, label: t("Listing completeness", "اكتمال الإعلان"), value: `${property.qualityScore}%` });
  const history = [...(property.priceHistory || [])].reverse();
  if (facts.length === 0 && history.length === 0) return null;
  return (
    <section className={card}>
      <SectionTitle>{t("Listing record", "سجل الإعلان")}</SectionTitle>
      {facts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {facts.map((f, i) => (
            <div key={i} className="rounded-xl bg-canvas border border-border p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-1.5">{f.icon}{f.label}</p>
              <p className="text-sm font-semibold text-ink tabular-nums">{f.value}</p>
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-6">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted mb-3">{t("Price history", "سجل الأسعار")}</h4>
          <ol className="relative border-s border-border ms-1.5 space-y-4">
            {history.map((h, i) => (
              <li key={i} className="ps-5 relative">
                <span className={`absolute -start-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-gold" : "bg-border-strong"}`} />
                <p className="text-[11px] text-ink-faint tabular-nums">{h.date}</p>
                <p className={`text-sm tabular-nums ${i === 0 ? "font-semibold text-ink" : "text-ink-muted line-through"}`}>
                  {formatPrice(h.price, isRtl)}
                  {i === 0 && <span className="ms-2 text-[11px] font-medium text-success no-underline">{t("Current price", "السعر الحالي")}</span>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------------------ investment planner
function Slider({ label, value, shown, min, max, step = 1, onChange }: { label: string; value: number; shown: string; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[13px] text-ink-muted">{label}</span>
        <span className="text-sm font-semibold text-ink tabular-nums">{shown}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label} className="w-full accent-gold h-1.5 cursor-pointer" />
    </div>
  );
}

/**
 * For a property for sale: what the financing would cost each month and in total, and (once the visitor adds an
 * expected rent) what renting it out would return. Amounts are in QAR and shown in the visitor's chosen currency.
 * An estimate for planning, not a bank offer or advice - the screen says so.
 */
export function InvestmentPlanner({ property, isRtl, formatPrice }: { property: Property; isRtl: boolean; formatPrice: Fmt }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(4.25);
  const [years, setYears] = useState(25);
  const [rent, setRent] = useState("");
  const [costs, setCosts] = useState(property.serviceCharges ? String(property.serviceCharges) : "");

  const loan = loanBreakdown({ price: property.price, downPaymentPercent: down, annualRatePercent: rate, years });
  const monthlyRent = Number(rent);
  const showReturn = Number.isFinite(monthlyRent) && monthlyRent > 0;
  const ret = rentalReturn(property.price, monthlyRent, Number(costs) || 0);
  const cashFlow = monthlyRent - loan.monthlyPayment;
  const principalPct = Math.round(loan.principalShare * 100);
  const money = (n: number) => formatPrice(Math.round(n), isRtl);
  const num = "w-full px-3 py-2.5 rounded-xl bg-canvas border border-border focus:outline-none focus:border-gold text-sm tabular-nums";

  return (
    <section className={card}>
      <SectionTitle icon={<span className="w-9 h-9 rounded-xl bg-gold-soft text-gold-active flex items-center justify-center shrink-0"><Calculator size={17} /></span>}>
        {t("Investment planner", "مخطط الاستثمار")}
      </SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* inputs */}
        <div className="lg:col-span-3 space-y-6">
          <Slider label={t("Down payment", "الدفعة الأولى")} value={down} min={10} max={80}
            shown={`${down}% · ${money(loan.downPayment)}`} onChange={setDown} />
          <Slider label={t("Interest rate (per year)", "معدل الفائدة السنوي")} value={rate} min={1.5} max={10} step={0.25}
            shown={`${rate.toFixed(2)}%`} onChange={setRate} />
          <Slider label={t("Loan term", "مدة التمويل")} value={years} min={5} max={30}
            shown={`${years} ${t("years", "سنة")}`} onChange={setYears} />
        </div>

        {/* result */}
        <div className="lg:col-span-2 rounded-2xl bg-chrome text-white p-6 flex flex-col justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/55 mb-2">{t("Estimated monthly instalment", "القسط الشهري المقدّر")}</p>
            <p className="font-serif text-4xl font-medium text-[#e6cf93] tabular-nums leading-none">{money(loan.monthlyPayment)}</p>
          </div>
          <dl className="space-y-2.5 text-[13px]">
            <div className="flex justify-between gap-4"><dt className="text-white/60">{t("Loan amount", "مبلغ التمويل")}</dt><dd className="font-semibold tabular-nums">{money(loan.loanAmount)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-white/60">{t("Total interest", "إجمالي الفوائد")}</dt><dd className="font-semibold tabular-nums">{money(loan.totalInterest)}</dd></div>
            <div className="flex justify-between gap-4 pt-2.5 border-t border-white/15"><dt className="text-white/60">{t("Total cost incl. down payment", "التكلفة الكلية مع الدفعة الأولى")}</dt><dd className="font-semibold tabular-nums">{money(loan.totalCost)}</dd></div>
          </dl>
          <div aria-hidden="true">
            <div className="flex h-2 rounded-full overflow-hidden bg-white/10">
              <span className="bg-[#e6cf93]" style={{ width: `${principalPct}%` }} />
              <span className="bg-white/35" style={{ width: `${100 - principalPct}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-white/55">
              <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#e6cf93] inline-block" />{t("Repays the loan", "يسدد التمويل")} {principalPct}%</span>
              <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-white/35 inline-block" />{t("Interest", "فوائد")} {100 - principalPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* rental return: needs the visitor's own expected rent */}
      <div className="mt-8 pt-6 border-t border-border">
        <h4 className="font-serif text-lg font-medium text-ink mb-1">{t("If you rent it out", "إذا أجّرته")}</h4>
        <p className="text-[13px] text-ink-muted mb-4">{t("Enter the monthly rent you expect, to see the return.", "أدخل الإيجار الشهري الذي تتوقعه لتعرف العائد.")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <label className="block">
            <span className="block text-[12px] text-ink-muted mb-1.5">{t("Expected monthly rent (QAR)", "الإيجار الشهري المتوقع (ر.ق)")}</span>
            <input type="number" inputMode="decimal" min="0" value={rent} onChange={e => setRent(e.target.value)} placeholder="e.g. 8000" className={num} />
          </label>
          <label className="block">
            <span className="block text-[12px] text-ink-muted mb-1.5">{t("Yearly running costs (QAR)", "التكاليف السنوية (ر.ق)")}</span>
            <input type="number" inputMode="decimal" min="0" value={costs} onChange={e => setCosts(e.target.value)} placeholder="0" className={num} />
          </label>
        </div>
        {showReturn && (
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              [t("Gross yield", "العائد الإجمالي"), `${ret.grossYieldPercent.toFixed(1)}%`, ""],
              [t("Net yield", "العائد الصافي"), `${ret.netYieldPercent.toFixed(1)}%`, ""],
              [t("Payback", "فترة الاسترداد"), ret.paybackYears === null ? "—" : `${ret.paybackYears.toFixed(1)} ${t("years", "سنة")}`, ""],
              [t("Monthly cash flow", "التدفق النقدي الشهري"), `${cashFlow < 0 ? "−" : "+"}${money(Math.abs(cashFlow))}`, cashFlow < 0 ? "text-warning" : "text-success"]
            ].map(([label, value, tone], i) => (
              <div key={i} className="rounded-xl bg-canvas border border-border p-3.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-1.5">{label}</p>
                <p className={`font-serif text-xl font-medium tabular-nums ${tone || "text-ink"}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
        {showReturn && <p className="mt-2 text-[11px] text-ink-faint">{t("Cash flow = monthly rent minus the estimated instalment above.", "التدفق النقدي = الإيجار الشهري ناقص القسط المقدّر أعلاه.")}</p>}
      </div>

      <p className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-ink-faint">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>{t(
          "An estimate for planning only. It is not a bank offer or financial advice; real terms depend on the lender, your profile and current rates.",
          "تقدير للتخطيط فقط. ليس عرضاً من بنك ولا نصيحة مالية؛ الشروط الفعلية تعتمد على الجهة المموّلة وملفك الشخصي والأسعار الحالية."
        )}</span>
      </p>
    </section>
  );
}
