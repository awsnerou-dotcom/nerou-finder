/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The signed contracts of a client in the sales pipeline (platform admin only): attach the signed PDF or a scan,
// say what it covers and until when, open it inside the app, fix the details, remove it. A client who subscribed
// with no contract on file gets a clear "paper missing" notice, and a contract that is about to end says so.

import React, { useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Eye, FileText, Pencil, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import type { ContractKind, ProspectContract, Prospect } from "../types.js";
import {
  CONTRACT_FILE_ACCEPT, CONTRACT_KINDS, CONTRACT_KIND_TEXT, CONTRACT_MAX_BYTES, contractState, formatFileSize, needsContract
} from "../lib/contracts.js";
import { Button } from "./ui/Button.js";
import { Modal } from "./ui/Modal.js";
import { Input } from "./ui/FormField.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import DocumentViewer from "./DocumentViewer.js";

type T = (en: string, ar: string) => string;
interface Plan { id: string; name: string; priceMonthly: number }

const selectCls = "w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm";
const authHeader = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const money = (n: number, isRtl: boolean) => `${Math.round(n).toLocaleString(isRtl ? "ar-QA" : "en-US")} ${isRtl ? "ر.ق" : "QAR"}`;

async function call(path: string, init: RequestInit): Promise<void> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Something went wrong.");
}

function stateChip(c: ProspectContract, t: T) {
  const { state, daysLeft } = contractState(c, Date.now());
  if (state === "EXPIRED") return <span className="px-1.5 py-0.5 rounded bg-danger-soft text-danger text-[10px] font-bold">{t("Ended", "انتهى")}</span>;
  if (state === "ENDING_SOON") {
    return <span className="px-1.5 py-0.5 rounded bg-warning-soft text-warning text-[10px] font-bold inline-flex items-center gap-1"><CalendarClock size={10} />{daysLeft === 0 ? t("Ends today", "ينتهي اليوم") : t(`Ends in ${daysLeft} days`, `ينتهي بعد ${daysLeft} يومًا`)}</span>;
  }
  if (state === "ACTIVE") return <span className="px-1.5 py-0.5 rounded bg-success-soft text-success text-[10px] font-bold">{t("Running", "ساري")}</span>;
  return <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted text-[10px] font-bold">{t("No end date", "بدون تاريخ انتهاء")}</span>;
}

export default function ContractsSection({ p, plans, isRtl, t, onChanged, say }: {
  p: Pick<Prospect, "id" | "stage" | "contracts" | "expectedMonthly" | "interestedPlanId" | "name">;
  plans: Plan[];
  isRtl: boolean;
  t: T;
  onChanged: () => Promise<void> | void;
  say: (text: string, bad?: boolean) => void;
}) {
  const [form, setForm] = useState<{ contract: ProspectContract | null } | null>(null);
  const [viewing, setViewing] = useState<ProspectContract | null>(null);
  const [removing, setRemoving] = useState<ProspectContract | null>(null);
  const contracts = [...(p.contracts || [])].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const missing = needsContract(p);
  const base = `/api/admin/prospects/${encodeURIComponent(p.id)}/contracts`;

  const remove = async (c: ProspectContract) => {
    setRemoving(null);
    try {
      await call(`${base}/${encodeURIComponent(c.id)}`, { method: "DELETE", headers: authHeader() });
      await onChanged();
      say(t("Contract removed.", "تم حذف العقد."));
    } catch (e: any) { say(e.message, true); }
  };

  return (
    <section className="space-y-2.5" data-testid="prospect-contracts" aria-label={t("Contracts", "العقود")}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-ink flex items-center gap-1.5"><ShieldCheck size={14} className="text-gold" />{t("Signed contracts", "العقود الموقّعة")}
          {contracts.length > 0 && <span className="text-[10px] font-bold text-ink-muted bg-surface-2 rounded-full px-2 py-0.5">{contracts.length}</span>}
        </p>
        <Button size="sm" variant={missing ? "primary" : "outline"} leftIcon={<Plus size={12} />} onClick={() => setForm({ contract: null })}>{t("Attach contract", "إرفاق عقد")}</Button>
      </div>

      {missing && (
        <p role="status" className="p-2.5 rounded-lg bg-warning-soft text-warning flex items-start gap-2" data-testid="contract-missing">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{t("This client has subscribed but no signed contract is on file. Attach the signed copy so it is kept with their record.", "هذا العميل اشترك لكن لا يوجد عقد موقّع محفوظ. أرفق النسخة الموقّعة لتبقى مع سجله.")}</span>
        </p>
      )}

      {contracts.length === 0 && !missing && (
        <p className="text-ink-muted">{t("No contract attached yet. Attach the signed agreement once the client subscribes.", "لم يُرفق عقد بعد. أرفق العقد الموقّع عند اشتراك العميل.")}</p>
      )}

      <ul className="space-y-2">
        {contracts.map(c => {
          const plan = plans.find(x => x.id === c.planId);
          return (
            <li key={c.id} className="p-2.5 rounded-lg border border-border bg-canvas space-y-1.5" data-testid="contract-item">
              <div className="flex items-start gap-2">
                <FileText size={16} className="text-gold shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink break-words">{c.title}</p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted text-[10px] font-bold">{isRtl ? CONTRACT_KIND_TEXT[c.kind].ar : CONTRACT_KIND_TEXT[c.kind].en}</span>
                    {stateChip(c, t)}
                    {plan && <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted text-[10px]">{plan.name}</span>}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {c.signedDate && <div><dt className="text-ink-muted inline">{t("Signed", "التوقيع")}: </dt><dd className="inline text-ink" dir="ltr">{c.signedDate}</dd></div>}
                {c.startDate && <div><dt className="text-ink-muted inline">{t("From", "من")}: </dt><dd className="inline text-ink" dir="ltr">{c.startDate}</dd></div>}
                {c.endDate && <div><dt className="text-ink-muted inline">{t("Until", "حتى")}: </dt><dd className="inline text-ink" dir="ltr">{c.endDate}</dd></div>}
                {c.monthlyValue !== undefined && <div><dt className="text-ink-muted inline">{t("Value", "القيمة")}: </dt><dd className="inline text-ink">{money(c.monthlyValue, isRtl)}{t(" / month", " / شهر")}</dd></div>}
              </dl>
              {c.notes && <p className="text-[11px] text-ink-muted whitespace-pre-wrap break-words">{c.notes}</p>}
              <p className="text-[10px] text-ink-muted break-all"><bdi>{c.fileName}</bdi> · {formatFileSize(c.size)} · {t("added by", "أضافه")} {c.uploadedBy} · {c.uploadedAt.slice(0, 10)}</p>
              <div className="flex gap-1.5 flex-wrap pt-0.5">
                <Button size="sm" variant="outline" leftIcon={<Eye size={12} />} onClick={() => setViewing(c)}>{t("Open", "فتح")}</Button>
                <Button size="sm" variant="ghost" leftIcon={<Pencil size={12} />} onClick={() => setForm({ contract: c })}>{t("Edit", "تعديل")}</Button>
                <Button size="sm" variant="ghost" leftIcon={<Trash2 size={12} />} onClick={() => setRemoving(c)}>{t("Delete", "حذف")}</Button>
              </div>
            </li>
          );
        })}
      </ul>

      {form && (
        <ContractForm
          key={form.contract?.id || "new"} p={p} plans={plans} initial={form.contract} isRtl={isRtl} t={t} base={base}
          onClose={() => setForm(null)}
          onSaved={async () => { setForm(null); await onChanged(); say(form.contract ? t("Contract updated.", "تم تحديث العقد.") : t("Contract attached.", "تم إرفاق العقد.")); }}
        />
      )}
      {viewing && <DocumentViewer fileUrl={`${base}/${encodeURIComponent(viewing.id)}/file`} title={`${p.name} · ${viewing.title}`} isRtl={isRtl} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={!!removing} isRtl={isRtl} tone="danger"
        title={t(`Delete the contract “${removing?.title}”? The file is deleted too and cannot be recovered.`, `حذف العقد «${removing?.title}»؟ سيُحذف الملف أيضًا ولا يمكن استرجاعه.`)}
        confirmLabel={t("Delete", "حذف")}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove(removing!)}
      />
    </section>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="block text-xs font-semibold text-ink-muted">{text}</span>{children}</label>;
}

function ContractForm({ p, plans, initial, isRtl, t, base, onClose, onSaved }: {
  p: Pick<Prospect, "expectedMonthly" | "interestedPlanId">; plans: Plan[]; initial: ProspectContract | null; isRtl: boolean; t: T; base: string;
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [f, setF] = useState({
    title: initial?.title || "", kind: (initial?.kind || "SUBSCRIPTION") as ContractKind,
    planId: initial?.planId || p.interestedPlanId || "",
    signedDate: initial?.signedDate || "", startDate: initial?.startDate || "", endDate: initial?.endDate || "",
    monthlyValue: initial?.monthlyValue !== undefined ? String(initial.monthlyValue) : p.expectedMonthly !== undefined && !initial ? String(p.expectedMonthly) : "",
    notes: initial?.notes || ""
  });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    setErr("");
    if (!picked) { setFile(null); return; }
    if (picked.size > CONTRACT_MAX_BYTES) { setErr(t("The file is larger than 10 MB.", "حجم الملف أكبر من 10 ميغابايت.")); e.target.value = ""; setFile(null); return; }
    if (!CONTRACT_FILE_ACCEPT.split(",").includes(picked.type)) { setErr(t("Use a PDF or a photo (JPG, PNG, WEBP) of the signed contract.", "استخدم ملف PDF أو صورة (JPG أو PNG أو WEBP) للعقد الموقّع.")); e.target.value = ""; setFile(null); return; }
    setFile(picked);
    if (!f.title.trim()) setF({ ...f, title: picked.name.replace(/\.[^.]+$/, "").slice(0, 120) });
  };

  const submit = async () => {
    setErr("");
    if (!f.title.trim()) { setErr(t("Give the contract a title.", "اكتب عنوانًا للعقد.")); return; }
    if (!initial && !file) { setErr(t("Choose the signed contract file.", "اختر ملف العقد الموقّع.")); return; }
    setBusy(true);
    try {
      if (initial) {
        await call(`${base}/${encodeURIComponent(initial.id)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({ ...f, monthlyValue: f.monthlyValue === "" ? "" : Number(f.monthlyValue) })
        });
      } else {
        const body = new FormData();
        for (const [k, v] of Object.entries(f)) body.append(k, v);
        body.append("file", file!);
        await call(base, { method: "POST", headers: authHeader(), body });
      }
      await onSaved();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="lg" title={initial ? t("Edit contract details", "تعديل بيانات العقد") : t("Attach a signed contract", "إرفاق عقد موقّع")}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>{t("Cancel", "إلغاء")}</Button><Button loading={busy} onClick={submit}>{initial ? t("Save", "حفظ") : t("Attach", "إرفاق")}</Button></div>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {!initial && (
          <div className="sm:col-span-2">
            <span className="block text-xs font-semibold text-ink-muted mb-1.5">{t("Signed file (PDF or photo, up to 10 MB) *", "الملف الموقّع (PDF أو صورة، حتى 10 ميغابايت) *")}</span>
            <button type="button" onClick={() => fileInput.current?.click()}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-dashed border-border bg-canvas hover:border-gold cursor-pointer text-start" data-testid="contract-file-button">
              <Upload size={18} className="text-gold shrink-0" />
              <span className="min-w-0 flex-1">
                {file ? <><span className="block font-semibold text-ink truncate"><bdi>{file.name}</bdi></span><span className="block text-xs text-ink-muted">{formatFileSize(file.size)}</span></>
                  : <span className="text-ink-muted">{t("Choose the file", "اختر الملف")}</span>}
              </span>
            </button>
            <input ref={fileInput} type="file" accept={CONTRACT_FILE_ACCEPT} onChange={choose} className="hidden" data-testid="contract-file-input" />
            <p className="text-[11px] text-ink-muted mt-1">{t("Kept privately. Only platform admins can open it.", "يُحفظ بشكل خاص. يستطيع مدراء المنصة فقط فتحه.")}</p>
          </div>
        )}
        <div className="sm:col-span-2"><Label text={t("Title *", "العنوان *")}><Input value={f.title} onChange={set("title")} placeholder={t("e.g. Gold plan, annual agreement", "مثال: عقد اشتراك الباقة الذهبية السنوي")} /></Label></div>
        <Label text={t("Type", "النوع")}><select value={f.kind} onChange={set("kind")} className={selectCls}>{CONTRACT_KINDS.map(k => <option key={k} value={k}>{isRtl ? CONTRACT_KIND_TEXT[k].ar : CONTRACT_KIND_TEXT[k].en}</option>)}</select></Label>
        <Label text={t("Plan", "الباقة")}><select value={f.planId} onChange={set("planId")} className={selectCls}><option value="">—</option>{plans.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}</select></Label>
        <Label text={t("Date signed", "تاريخ التوقيع")}><Input type="date" dir="ltr" value={f.signedDate} onChange={set("signedDate")} /></Label>
        <Label text={t("Value per month (QAR)", "القيمة شهريًا (ر.ق)")}><Input type="number" min={0} dir="ltr" value={f.monthlyValue} onChange={set("monthlyValue")} /></Label>
        <Label text={t("Starts", "يبدأ")}><Input type="date" dir="ltr" value={f.startDate} onChange={set("startDate")} /></Label>
        <Label text={t("Ends", "ينتهي")}><Input type="date" dir="ltr" value={f.endDate} onChange={set("endDate")} /></Label>
        <div className="sm:col-span-2"><Label text={t("Notes", "ملاحظات")}><textarea value={f.notes} onChange={set("notes")} rows={2} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm" /></Label></div>
      </div>
      {err && <p role="alert" className="mt-3 text-xs text-danger">{err}</p>}
    </Modal>
  );
}
