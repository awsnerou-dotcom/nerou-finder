import React, { useState } from "react";
import { Building2, CalendarDays, CheckCircle2, ChevronDown, Eye, Globe, Mail, MessageCircle, Phone, ShieldCheck, XCircle } from "lucide-react";
import type { SubscriptionPlan } from "../types.js";
import { ApplicationStatus, VerificationStatus } from "../types.js";
import type { ApplicantCardData, ApplicantDoc } from "../lib/applicants.js";
import { DOC_LABELS } from "./VerificationDocumentsPanel.js";

export interface SubscriptionForm {
  planId: string;
  expiryDate: string;
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  method: "MANUAL" | "BANK_TRANSFER" | "INVOICE" | "OTHER";
  notes: string;
}

interface Props {
  card: ApplicantCardData;
  plans: SubscriptionPlan[];
  isRtl: boolean;
  onViewDoc: (doc: ApplicantDoc, label: string) => void;
  onReviewDoc: (docId: string, status: "APPROVED" | "REJECTED", reason?: string) => void;
  onMoveToAwaitingPayment: (userId: string) => void;
  onSaveSubscription: (card: ApplicantCardData, form: SubscriptionForm) => Promise<boolean>;
  onVerifyOrg: (orgId: string, status: VerificationStatus) => void;
}

const pill = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold";
const field = "w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs";

const DOC_STATUS: Record<string, { cls: string; en: string; ar: string }> = {
  APPROVED: { cls: "bg-success-soft text-success", en: "Approved", ar: "معتمد" },
  PENDING: { cls: "bg-gold-soft text-gold-active", en: "Pending review", ar: "قيد المراجعة" },
  REJECTED: { cls: "bg-rose-500/15 text-rose-600", en: "Rejected", ar: "مرفوض" },
  EXPIRED: { cls: "bg-orange-500/15 text-orange-600", en: "Expired", ar: "منتهي" },
};

const APP_STATUS: Record<string, { en: string; ar: string }> = {
  PENDING_APPROVAL: { en: "Awaiting approval", ar: "بانتظار الموافقة" },
  AWAITING_PAYMENT: { en: "Awaiting payment", ar: "بانتظار الدفع" },
  AWAITING_DOCUMENTS: { en: "Awaiting documents", ar: "بانتظار المستندات" },
  UNDER_VERIFICATION: { en: "Under verification", ar: "قيد التوثيق" },
  ACTIVE: { en: "Active", ar: "نشط" },
};

const CONTEXT_TEXT: Record<string, { en: string; ar: string }> = {
  AGENT: { en: "Agent", ar: "وسيط" },
  AGENCY: { en: "Agency", ar: "مكتب عقاري" },
  DEVELOPER: { en: "Developer", ar: "مطور" },
};

function waLink(phone?: string) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <div className="text-xs text-ink mt-0.5 break-words">{children}</div>
    </div>
  );
}

// Everything about one applicant in a single card: who they are, their documents (view, approve,
// reject with a reason), and every admin action that applies to them.
export default function ApplicantCard({ card, plans, isRtl, onViewDoc, onReviewDoc, onMoveToAwaitingPayment, onSaveSubscription, onVerifyOrg }: Props) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const { user, org, docs } = card;
  const isOrg = card.context !== "AGENT";
  const sub = org ?? user; // an agent under an agency is covered by the agency's subscription
  const plan = plans.find(p => p.id === sub?.subscriptionPlanId);
  const phone = user?.phone || org?.phone;
  const whatsapp = user?.whatsapp || org?.whatsapp || phone;
  const email = card.email;
  const appStatus = user?.applicationStatus;

  const [rejectingId, setRejectingId] = useState("");
  const [reason, setReason] = useState("");
  const [subOpen, setSubOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SubscriptionForm>(() => ({
    planId: sub?.subscriptionPlanId || "",
    expiryDate: (sub?.subscriptionExpiry || "").slice(0, 10) || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    status: sub?.subscriptionStatus === "SUSPENDED" || sub?.subscriptionStatus === "CANCELLED" ? sub.subscriptionStatus : "ACTIVE",
    method: sub?.subscriptionActivationMethod || "MANUAL",
    notes: "",
  }));

  const approved = docs.filter(d => d.status === "APPROVED").length;
  const label = (type: string) => {
    const l = DOC_LABELS[type];
    return l ? (isRtl ? l.ar : l.en) : type.replace(/_/g, " ");
  };
  const fmt = (v?: string) => (v ? new Date(v).toLocaleDateString(isRtl ? "ar-QA" : "en-GB") : "—");

  const save = async () => {
    if (!form.planId || !form.expiryDate) return;
    setSaving(true);
    try {
      if (await onSaveSubscription(card, form)) setSubOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className={`rounded-xl border bg-surface shadow-sm overflow-hidden ${card.needsAction ? "border-gold/50" : "border-border"}`}
      data-testid="applicant-card"
    >
      {/* header */}
      <header className="p-4 flex items-start gap-3 flex-wrap bg-ink-inverse border-b border-border">
        <div className="w-10 h-10 rounded-full bg-gold-soft text-gold-active flex items-center justify-center font-bold text-sm shrink-0">
          {card.name.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="font-serif text-base font-bold text-ink">{card.name}</h5>
            <span className={`${pill} bg-surface-2 text-ink-muted`}>{isRtl ? CONTEXT_TEXT[card.context]?.ar : CONTEXT_TEXT[card.context]?.en}</span>
            {appStatus && (
              <span className={`${pill} bg-gold-soft text-gold-active`}>{isRtl ? APP_STATUS[appStatus]?.ar : APP_STATUS[appStatus]?.en}</span>
            )}
            {card.needsAction && <span className={`${pill} bg-rose-500/15 text-rose-600`}>{t("Needs your review", "يحتاج مراجعتك")}</span>}
          </div>
          <p className="text-[11px] text-ink-muted">
            {docs.length > 0
              ? t(`${approved} of ${docs.length} documents approved`, `${approved} من ${docs.length} مستندات معتمدة`)
              : t("No documents uploaded yet", "لم يرفع أي مستند بعد")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {email && (
            <a href={`mailto:${email}`} className="p-2 rounded-lg bg-surface border border-border text-ink hover:bg-surface-2" title={t("Email", "إيميل")} aria-label={t("Email", "إيميل")}><Mail size={14} /></a>
          )}
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="p-2 rounded-lg bg-surface border border-border text-ink hover:bg-surface-2" title={t("Call", "اتصال")} aria-label={t("Call", "اتصال")}><Phone size={14} /></a>
          )}
          {waLink(whatsapp) && (
            <a href={waLink(whatsapp)} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-success-soft text-success hover:bg-success/20" title="WhatsApp" aria-label="WhatsApp"><MessageCircle size={14} /></a>
          )}
        </div>
      </header>

      {/* details */}
      <section className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 border-b border-border">
        <Info label={t("Email", "البريد الإلكتروني")}><bdi dir="ltr">{email || "—"}</bdi></Info>
        <Info label={t("Mobile", "الجوال")}><bdi dir="ltr">{phone || "—"}</bdi></Info>
        <Info label="WhatsApp"><bdi dir="ltr">{user?.whatsapp || org?.whatsapp || "—"}</bdi></Info>
        <Info label={isOrg ? t("Company", "الشركة") : t("Works under", "يعمل لدى")}>
          <span className="inline-flex items-center gap-1"><Building2 size={12} className="text-ink-muted" />{org?.name || user?.affiliatedAgencyName || t("Independent", "مستقل")}</span>
        </Info>
        {org?.website && (
          <Info label={t("Website", "الموقع")}>
            <a href={/^https?:/.test(org.website) ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer" className="text-gold-active underline inline-flex items-center gap-1"><Globe size={12} />{org.website}</a>
          </Info>
        )}
        <Info label={t("Registered", "تاريخ التسجيل")}>
          <span className="inline-flex items-center gap-1"><CalendarDays size={12} className="text-ink-muted" />{fmt(user?.createdDate || org?.createdDate)}</span>
        </Info>
        {card.context === "AGENT" && user?.isExpat !== undefined && <Info label={t("Residency", "الإقامة")}>{user.isExpat ? t("Expat (passport required)", "وافد (جواز السفر مطلوب)") : t("Qatari", "قطري")}</Info>}
        <Info label={t("Account verification", "توثيق الحساب")}>
          <span className={`${pill} ${(isOrg ? org?.verificationStatus : user?.verificationStatus) === VerificationStatus.APPROVED ? "bg-success-soft text-success" : "bg-gold-soft text-gold-active"}`}>
            <ShieldCheck size={11} />{(isOrg ? org?.verificationStatus : user?.verificationStatus) || "—"}
          </span>
        </Info>
        <Info label={t("Subscription", "الاشتراك")}>
          {card.context === "AGENT" && org ? (
            t(`Covered by ${org.name}`, `يغطيه اشتراك ${org.name}`)
          ) : sub?.subscriptionStatus ? (
            <>
              <span className="font-semibold">{plan?.name || "—"}</span> · {sub.subscriptionStatus}
              <br /><span className="text-ink-muted">{t("Until", "حتى")} {fmt(sub.subscriptionExpiry)}</span>
            </>
          ) : t("Not activated", "غير مفعّل")}
        </Info>
      </section>

      {/* documents */}
      <section className="p-4 space-y-2 border-b border-border">
        <h6 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{t("Documents", "المستندات")}</h6>
        {docs.length === 0 ? (
          <p className="text-xs text-ink-muted">{t("Nothing uploaded yet.", "لم يتم رفع شيء بعد.")}</p>
        ) : docs.map(doc => {
          const st = DOC_STATUS[doc.status] || DOC_STATUS.PENDING;
          const canReview = doc.status === "PENDING" || doc.status === "EXPIRED";
          return (
            <div key={doc.id} className="p-3 rounded-lg bg-canvas border border-border space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">{label(doc.documentType)}</p>
                  <p className="text-[10px] text-ink-muted">
                    {t("Sent", "أُرسل")} {fmt(doc.submittedDate)}
                    {typeof doc.expiryDate === "string" && doc.expiryDate && <> · {t("Expires", "ينتهي")} {fmt(doc.expiryDate)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${pill} ${st.cls}`}>{isRtl ? st.ar : st.en}</span>
                  <button
                    type="button"
                    onClick={() => onViewDoc(doc, `${card.name} - ${label(doc.documentType)}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-ink text-[11px] font-bold hover:bg-surface-2 cursor-pointer"
                  >
                    <Eye size={13} />{t("View", "عرض")}
                  </button>
                </div>
              </div>
              {doc.status === "REJECTED" && typeof doc.rejectionReason === "string" && doc.rejectionReason && (
                <p className="text-[11px] text-rose-600"><strong>{t("Reason: ", "السبب: ")}</strong>{doc.rejectionReason}</p>
              )}
              {canReview && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => onReviewDoc(doc.id, "APPROVED")} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer">
                    <CheckCircle2 size={13} />{t("Approve", "اعتماد")}
                  </button>
                  {rejectingId === doc.id ? (
                    <>
                      <input
                        autoFocus
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder={t("Reason for rejection (required)", "سبب الرفض (مطلوب)")}
                        className="px-2 py-1.5 bg-surface border border-border rounded-lg text-[11px] flex-1 min-w-[160px]"
                      />
                      <button type="button" onClick={() => { onReviewDoc(doc.id, "REJECTED", reason); if (reason.trim()) { setRejectingId(""); setReason(""); } }} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer">
                        {t("Confirm reject", "تأكيد الرفض")}
                      </button>
                      <button type="button" onClick={() => { setRejectingId(""); setReason(""); }} className="px-2 py-1.5 text-[11px] text-ink-muted hover:text-ink cursor-pointer">{t("Cancel", "إلغاء")}</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setRejectingId(doc.id); setReason(""); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer">
                      <XCircle size={13} />{t("Reject", "رفض")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* admin actions */}
      <footer className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted me-1">{t("Admin actions", "إجراءات الإدارة")}</span>
          {user && appStatus === ApplicationStatus.PENDING_APPROVAL && (
            <button type="button" onClick={() => onMoveToAwaitingPayment(user.id)} className="px-3 py-1.5 rounded-lg bg-chrome hover:bg-gold hover:text-gold-ink text-white text-[11px] font-bold cursor-pointer">
              {t("Approve application → awaiting payment", "قبول الطلب ← بانتظار الدفع")}
            </button>
          )}
          {!(card.context === "AGENT" && org) && <button
            type="button"
            onClick={() => setSubOpen(o => !o)}
            aria-expanded={subOpen}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-ink text-[11px] font-bold hover:bg-surface-2 cursor-pointer"
          >
            {appStatus === ApplicationStatus.AWAITING_PAYMENT ? t("Confirm payment & activate", "تأكيد الدفع وتفعيل الاشتراك") : t("Manage subscription", "إدارة الاشتراك")}
            <ChevronDown size={13} className={subOpen ? "rotate-180" : ""} />
          </button>}
          {isOrg && org && org.verificationStatus !== VerificationStatus.APPROVED && (
            <button type="button" onClick={() => onVerifyOrg(org.id, VerificationStatus.APPROVED)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer">
              {t("Verify company", "توثيق الشركة")}
            </button>
          )}
          {isOrg && org && org.verificationStatus !== VerificationStatus.REJECTED && (
            <button type="button" onClick={() => onVerifyOrg(org.id, VerificationStatus.REJECTED)} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer">
              {t("Reject company", "رفض الشركة")}
            </button>
          )}
        </div>

        {card.context === "AGENT" && org && (
          <p className="text-[11px] text-ink-muted">{t("This agent's subscription is covered by their agency.", "اشتراك هذا الوسيط يغطيه مكتبه.")}</p>
        )}

        {subOpen && !(card.context === "AGENT" && org) && (
          <div className="bg-canvas border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-[10px] font-bold text-ink-muted space-y-1 block">
              {t("Plan", "الباقة")}
              <select value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })} className={field}>
                <option value="">-- {t("Select plan", "اختر باقة")} --</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.priceMonthly} QAR/mo)</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-ink-muted space-y-1 block">
              {t("Expiry date", "تاريخ الانتهاء")}
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className={`${field} font-mono`} />
            </label>
            <label className="text-[10px] font-bold text-ink-muted space-y-1 block">
              {t("Status", "الحالة")}
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as SubscriptionForm["status"] })} className={field}>
                <option value="ACTIVE">{t("Active", "نشط")}</option>
                <option value="SUSPENDED">{t("Suspended", "موقوف")}</option>
                <option value="CANCELLED">{t("Cancelled", "ملغى")}</option>
              </select>
            </label>
            <label className="text-[10px] font-bold text-ink-muted space-y-1 block">
              {t("Payment method", "طريقة الدفع")}
              <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value as SubscriptionForm["method"] })} className={field}>
                <option value="MANUAL">MANUAL</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                <option value="INVOICE">INVOICE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label className="text-[10px] font-bold text-ink-muted space-y-1 block md:col-span-2">
              {t("Notes", "ملاحظات")}
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={field} />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button type="button" disabled={saving || !form.planId || !form.expiryDate} onClick={save} className="px-4 py-2 rounded-lg bg-chrome hover:bg-gold hover:text-gold-ink disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer">
                {t("Save subscription", "حفظ الاشتراك")}
              </button>
            </div>
          </div>
        )}
      </footer>
    </article>
  );
}
