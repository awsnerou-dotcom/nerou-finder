import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal.js";
import { Button } from "../ui/Button.js";
import { FormField, Input, Select, Textarea } from "../ui/FormField.js";
import { addDaysToDate, computeCommission, qatarDate } from "../../lib/crm.js";
import { DeskDeal, DeskLead, DeskViewing, T, followUpDay } from "./shared.js";

const today = () => qatarDate(Date.now());

// ---------------------------------------------------------------------------------------------
// Follow-up date
// ---------------------------------------------------------------------------------------------
export function FollowUpModal({ lead, isRtl, t, onClose, onSave }: {
  lead: DeskLead | null; isRtl: boolean; t: T; onClose: () => void; onSave: (date: string | null) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (lead) setDate(followUpDay(lead) || addDaysToDate(today(), 1)); }, [lead]);
  if (!lead) return null;
  const save = async (value: string | null) => { setBusy(true); try { await onSave(value); } finally { setBusy(false); } };
  const quick = (days: number) => setDate(addDaysToDate(today(), days));

  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="sm"
      title={t("Next follow-up", "موعد المتابعة القادمة")}
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          {lead.nextFollowUpDate ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => save(null)}>{t("Clear date", "إزالة الموعد")}</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
            <Button size="sm" loading={busy} disabled={!date} onClick={() => save(date)}>{t("Save", "حفظ")}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          {t("When should you contact", "متى تريد التواصل مع")} <strong className="text-ink">{lead.visitorName}</strong>{t("? We'll email you that morning.", "؟ سنرسل لك تذكيراً بالإيميل صباح ذلك اليوم.")}
        </p>
        <div className="flex flex-wrap gap-2">
          {[[1, t("Tomorrow", "غداً")], [3, t("In 3 days", "بعد 3 أيام")], [7, t("In a week", "بعد أسبوع")], [30, t("In a month", "بعد شهر")]].map(([d, label]) => (
            <button key={String(d)} type="button" onClick={() => quick(d as number)}
              className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-ink hover:border-gold hover:text-gold cursor-pointer">
              {label as string}
            </button>
          ))}
        </div>
        <FormField label={t("Date", "التاريخ")} htmlFor="fu-date">
          <Input id="fu-date" type="date" value={date} min={today()} onChange={e => setDate(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Schedule / reschedule a viewing
// ---------------------------------------------------------------------------------------------
export function ViewingModal({ open, leads, viewing, presetLeadId, isRtl, t, onClose, onSave }: {
  open: boolean; leads: DeskLead[]; viewing: DeskViewing | null; presetLeadId?: string; isRtl: boolean; t: T;
  onClose: () => void;
  onSave: (v: { leadId: string; preferredDate: string; preferredTimeSlot: string; notes: string }) => Promise<void>;
}) {
  const [leadId, setLeadId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLeadId(viewing?.leadId || presetLeadId || "");
    setDate(viewing?.preferredDate || addDaysToDate(today(), 1));
    setTime(viewing?.preferredTimeSlot || "10:00");
    setNotes(viewing?.notes || "");
  }, [open, viewing, presetLeadId]);
  if (!open) return null;
  const resched = !!viewing;
  const submit = async () => {
    setBusy(true);
    try { await onSave({ leadId, preferredDate: date, preferredTimeSlot: time, notes }); } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="md"
      title={resched ? t("Reschedule viewing", "إعادة جدولة المعاينة") : t("Schedule a viewing", "جدولة معاينة")}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
          <Button size="sm" loading={busy} disabled={!leadId || !date || !time.trim()} onClick={submit}>
            {resched ? t("Save new time", "حفظ الموعد الجديد") : t("Schedule", "جدولة")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {resched ? (
          <p className="text-sm text-ink-muted">
            {viewing!.visitorName} - {viewing!.propertyTitle || t("Property", "عقار")}. {t("The client is emailed the new time.", "سيصل العميلَ إيميل بالموعد الجديد.")}
          </p>
        ) : (
          <FormField label={t("Client", "العميل")} htmlFor="vw-lead" required>
            <Select id="vw-lead" value={leadId} onChange={e => setLeadId(e.target.value)}>
              <option value="">{t("Choose a client...", "اختر العميل...")}</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.visitorName}{l.propertyTitle ? ` - ${l.propertyTitle}` : ""}</option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("Date", "التاريخ")} htmlFor="vw-date" required>
            <Input id="vw-date" type="date" value={date} min={today()} onChange={e => setDate(e.target.value)} />
          </FormField>
          <FormField label={t("Time", "الوقت")} htmlFor="vw-time" required>
            <Input id="vw-time" type="time" value={/^\d{2}:\d{2}$/.test(time) ? time : ""} onChange={e => setTime(e.target.value)} />
          </FormField>
        </div>
        <FormField label={t("Notes (optional)", "ملاحظات (اختياري)")} htmlFor="vw-notes">
          <Textarea id="vw-notes" rows={2} value={notes} maxLength={500} onChange={e => setNotes(e.target.value)}
            placeholder={t("Gate code, meeting point...", "رمز البوابة، نقطة اللقاء...")} />
        </FormField>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Why was it lost
// ---------------------------------------------------------------------------------------------
export function LostModal({ lead, isRtl, t, onClose, onSave }: {
  lead: DeskLead | null; isRtl: boolean; t: T; onClose: () => void; onSave: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReason(""); }, [lead]);
  if (!lead) return null;
  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="sm"
      title={t("Mark as lost", "تسجيل كخسارة")}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
          <Button variant="danger" size="sm" loading={busy} onClick={async () => { setBusy(true); try { await onSave(reason); } finally { setBusy(false); } }}>
            {t("Mark lost", "تسجيل الخسارة")}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">{lead.visitorName}</p>
        <FormField label={t("Reason (optional)", "السبب (اختياري)")} htmlFor="lost-reason" hint={t("Helps you see why deals slip away.", "يساعدك على فهم أسباب فقدان الصفقات.")}>
          <Textarea id="lost-reason" rows={3} maxLength={300} value={reason} onChange={e => setReason(e.target.value)}
            placeholder={t("e.g. Bought elsewhere, price too high", "مثلاً: اشترى من مكان آخر، السعر مرتفع")} />
        </FormField>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Record / edit a deal
// ---------------------------------------------------------------------------------------------
export interface DealForm {
  leadId?: string;
  agentId?: string;
  propertyTitle: string;
  clientName: string;
  dealType: "SALE" | "RENT";
  dealValue: number;
  commissionRate?: number;
  commissionAmount?: number;
  closedDate: string;
  commissionStatus: "EXPECTED" | "RECEIVED";
  notes: string;
  /** Rentals: when the contract ends (reminders count from it). */
  contractEndDate?: string;
  /** Set when this deal renews an earlier contract. */
  renewsDealId?: string;
}

export function DealModal({ open, lead, deal, renewing, team, isOrgAdmin, isRtl, t, onClose, onSave, onWonOnly }: {
  open: boolean; lead: DeskLead | null; deal: DeskDeal | null; /** the rental being renewed (prefills a new rental) */ renewing?: DeskDeal | null; team: { id: string; fullName: string }[]; isOrgAdmin: boolean;
  isRtl: boolean; t: T; onClose: () => void; onSave: (form: DealForm, existing: DeskDeal | null) => Promise<void>;
  /** Shown when the modal was opened by moving a lead to "Won": record the win without a deal. */
  onWonOnly?: () => Promise<void>;
}) {
  const [propertyTitle, setPropertyTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [dealType, setDealType] = useState<"SALE" | "RENT">("SALE");
  const [value, setValue] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [closedDate, setClosedDate] = useState(today());
  const [contractEnd, setContractEnd] = useState("");
  const [received, setReceived] = useState(false);
  const [notes, setNotes] = useState("");
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (deal) {
      setPropertyTitle(deal.propertyTitle); setClientName(deal.clientName); setDealType(deal.dealType);
      setValue(String(deal.dealValue)); setRate(deal.commissionRate !== undefined ? String(deal.commissionRate) : "");
      setAmount(String(deal.commissionAmount)); setClosedDate(deal.closedDate);
      setReceived(deal.commissionStatus === "RECEIVED"); setNotes(deal.notes || ""); setAgentId(deal.agentId);
      setContractEnd(deal.contractEndDate || "");
    } else if (renewing) {
      // a renewal starts from the old contract: same tenant, flat, price and rate, a year further on
      setPropertyTitle(renewing.propertyTitle); setClientName(renewing.clientName); setDealType("RENT");
      setValue(String(renewing.dealValue)); setRate(renewing.commissionRate !== undefined ? String(renewing.commissionRate) : "");
      setAmount(String(renewing.commissionAmount)); setClosedDate(today()); setReceived(false); setNotes("");
      setAgentId(renewing.agentId);
      setContractEnd(addDaysToDate(renewing.contractEndDate && renewing.contractEndDate > today() ? renewing.contractEndDate : today(), 365));
    } else {
      setPropertyTitle(lead?.propertyTitle || ""); setClientName(lead?.visitorName || ""); setDealType("SALE");
      setValue(""); setRate("2"); setAmount(""); setClosedDate(today()); setReceived(false); setNotes("");
      setAgentId(lead?.agentId || ""); setContractEnd("");
    }
  }, [open, deal, lead, renewing]);
  if (!open) return null;

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const valueNum = num(value);
  // typing the rate (or the value) recalculates the amount; typing the amount directly wins
  const onRate = (r: string) => {
    setRate(r);
    const rn = num(r);
    if (valueNum && rn !== undefined && Number.isFinite(rn)) setAmount(String(computeCommission(valueNum, rn)));
  };
  const onValue = (v: string) => {
    setValue(v);
    const vn = num(v), rn = num(rate);
    if (vn && rn !== undefined && Number.isFinite(rn)) setAmount(String(computeCommission(vn, rn)));
  };
  const onAmount = (a: string) => { setAmount(a); setRate(""); };

  const submit = async () => {
    setError("");
    if (!propertyTitle.trim() || !clientName.trim()) return setError(t("Enter the property and the client.", "أدخل العقار والعميل."));
    if (!valueNum || valueNum <= 0) return setError(t("Enter the deal value.", "أدخل قيمة الصفقة."));
    const rn = num(rate), an = num(amount);
    if (rn !== undefined && (rn < 0 || rn > 100)) return setError(t("The commission rate must be between 0 and 100.", "نسبة العمولة يجب أن تكون بين 0 و100."));
    if (an !== undefined && (an < 0 || an > valueNum)) return setError(t("The commission cannot be more than the deal value.", "العمولة لا يمكن أن تتجاوز قيمة الصفقة."));
    if (dealType === "RENT" && contractEnd && contractEnd <= closedDate) return setError(t("The contract must end after the closing date.", "يجب أن ينتهي العقد بعد تاريخ الإغلاق."));
    setBusy(true);
    try {
      await onSave({
        leadId: lead?.id || deal?.leadId, agentId: isOrgAdmin ? agentId || undefined : undefined,
        propertyTitle: propertyTitle.trim(), clientName: clientName.trim(), dealType, dealValue: valueNum,
        commissionRate: rn, commissionAmount: an, closedDate, commissionStatus: received ? "RECEIVED" : "EXPECTED", notes,
        contractEndDate: dealType === "RENT" && contractEnd ? contractEnd : undefined,
        renewsDealId: renewing?.id
      }, deal);
    } catch (e: any) {
      setError(e?.message || t("Could not save the deal.", "تعذر حفظ الصفقة."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="lg"
      title={deal ? t("Edit deal", "تعديل الصفقة") : renewing ? t("Record the renewal", "تسجيل التجديد") : t("Record a deal", "تسجيل صفقة")}
      footer={
        <div className="flex items-center justify-between gap-2 w-full flex-wrap">
          {onWonOnly && !deal ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={async () => { setBusy(true); try { await onWonOnly(); } finally { setBusy(false); } }}>
              {t("Mark won without a deal", "تسجيل كتمت الصفقة دون تفاصيل")}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
            <Button size="sm" loading={busy} onClick={submit}>{deal ? t("Save changes", "حفظ التعديلات") : t("Save deal", "حفظ الصفقة")}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-muted bg-surface-2 rounded-lg px-3 py-2">
          {t(
            "This is your own record of the deal and your commission. Nerou Finder does not broker deals or collect commissions.",
            "هذا سجلّك الخاص بالصفقة وعمولتك. نيرو فايندر لا تتوسط في الصفقات ولا تحصّل عمولات."
          )}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label={t("Property", "العقار")} htmlFor="dl-prop" required>
            <Input id="dl-prop" value={propertyTitle} maxLength={200} onChange={e => setPropertyTitle(e.target.value)} />
          </FormField>
          <FormField label={t("Client", "العميل")} htmlFor="dl-client" required>
            <Input id="dl-client" value={clientName} maxLength={200} onChange={e => setClientName(e.target.value)} />
          </FormField>
          <FormField label={t("Type", "النوع")} htmlFor="dl-type">
            <Select id="dl-type" value={dealType} onChange={e => setDealType(e.target.value as "SALE" | "RENT")}>
              <option value="SALE">{t("Sale", "بيع")}</option>
              <option value="RENT">{t("Rent", "إيجار")}</option>
            </Select>
          </FormField>
          <FormField label={dealType === "SALE" ? t("Sale price (QAR)", "سعر البيع (ر.ق)") : t("Total rent (QAR)", "إجمالي الإيجار (ر.ق)")} htmlFor="dl-value" required>
            <Input id="dl-value" type="number" min="0" step="any" inputMode="decimal" value={value} onChange={e => onValue(e.target.value)} />
          </FormField>
          <FormField label={t("Commission rate (%)", "نسبة العمولة (%)")} htmlFor="dl-rate">
            <Input id="dl-rate" type="number" min="0" max="100" step="any" inputMode="decimal" value={rate} onChange={e => onRate(e.target.value)} />
          </FormField>
          <FormField label={t("Your commission (QAR)", "عمولتك (ر.ق)")} htmlFor="dl-amount" hint={t("Calculated from the rate - or type a fixed amount.", "تُحسب من النسبة - أو اكتب مبلغاً ثابتاً.")}>
            <Input id="dl-amount" type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={e => onAmount(e.target.value)} />
          </FormField>
          <FormField label={t("Closing date", "تاريخ الإغلاق")} htmlFor="dl-date">
            <Input id="dl-date" type="date" value={closedDate} onChange={e => setClosedDate(e.target.value)} />
          </FormField>
          {dealType === "RENT" && (
            <FormField label={t("Contract ends", "ينتهي العقد في")} htmlFor="dl-end" hint={t("We remind you 90, 60 and 30 days before, so you can renew it.", "نذكّرك قبل 90 و60 و30 يوماً لتجدده.")}>
              <Input id="dl-end" type="date" value={contractEnd} min={closedDate} onChange={e => setContractEnd(e.target.value)} />
            </FormField>
          )}
          {isOrgAdmin && (
            <FormField label={t("Agent", "الوكيل")} htmlFor="dl-agent">
              <Select id="dl-agent" value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">{t("Me", "أنا")}</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </Select>
            </FormField>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)} className="accent-gold w-4 h-4" />
          {t("I have already received the commission", "استلمتُ العمولة بالفعل")}
        </label>
        <FormField label={t("Notes (optional)", "ملاحظات (اختياري)")} htmlFor="dl-notes">
          <Textarea id="dl-notes" rows={2} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} />
        </FormField>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

