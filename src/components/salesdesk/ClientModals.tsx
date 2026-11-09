import React, { useEffect, useMemo, useState } from "react";
import { Calendar, FileDown, Mail, MessageCircle, Phone, Trash2, Upload } from "lucide-react";
import { Modal } from "../ui/Modal.js";
import { Button } from "../ui/Button.js";
import { FormField, Input, Select, Textarea } from "../ui/FormField.js";
import { LEAD_SOURCES, LEAD_SOURCE_TEXT, parseCsv, qatarDate, rowsToClients, westernDigits } from "../../lib/crm.js";
import { LeadSource, LeadStatus } from "../../types.js";
import { BOARD_COLUMNS, columnForStatus } from "../../lib/crm.js";
import { DeskLead, DeskViewing, STAGE_TEXT, T, ago, fmtDay, fmtMoney, followUpDay, leadPhone, sourceLabel, waLink } from "./shared.js";

const today = () => qatarDate(Date.now());

// ---------------------------------------------------------------------------------------------
// Add / edit a client
// ---------------------------------------------------------------------------------------------
export interface ClientForm {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  source: LeadSource;
  interest: string;
  budget: string;
  propertyId: string;
  // only when adding
  status: LeadStatus;
  nextFollowUpDate: string;
  notes: string;
  agentId: string;
}

const EMPTY: ClientForm = {
  name: "", phone: "", whatsapp: "", email: "", source: "PHONE_CALL", interest: "", budget: "", propertyId: "",
  status: LeadStatus.NEW, nextFollowUpDate: "", notes: "", agentId: ""
};

export function ClientModal({ open, client, team, isOrgAdmin, properties, isRtl, t, onClose, onSave }: {
  open: boolean; client: DeskLead | null; team: { id: string; fullName: string }[]; isOrgAdmin: boolean;
  properties: { id: string; title: string }[]; isRtl: boolean; t: T; onClose: () => void;
  /** Throw to keep the dialog open; the message is shown inside it. */
  onSave: (form: ClientForm, existing: DeskLead | null) => Promise<void>;
}) {
  const [f, setF] = useState<ClientForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof ClientForm>(k: K, v: ClientForm[K]) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setError("");
    setF(client
      ? {
          ...EMPTY, name: client.visitorName, phone: client.visitorPhone || "", whatsapp: client.visitorWhatsapp && client.visitorWhatsapp !== client.visitorPhone ? client.visitorWhatsapp : "",
          email: client.visitorEmail || "", source: client.source || "OTHER", interest: client.interest || "",
          budget: client.budget ? String(client.budget) : "", propertyId: client.propertyId || ""
        }
      : EMPTY);
  }, [open, client]);
  if (!open) return null;

  const submit = async () => {
    setError("");
    if (!f.name.trim()) return setError(t("Enter the client's name.", "أدخل اسم العميل."));
    if (!f.phone.trim() && !f.whatsapp.trim() && !f.email.trim()) return setError(t("Add a phone number, WhatsApp or email so you can reach this client.", "أضف رقم هاتف أو واتساب أو بريداً للتواصل مع العميل."));
    setBusy(true);
    try { await onSave(f, client); } catch (e: any) { setError(e?.message || t("Could not save the client.", "تعذر حفظ العميل.")); } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="lg"
      title={client ? t("Edit client", "تعديل العميل") : t("Add a client", "إضافة عميل")}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
          <Button size="sm" loading={busy} onClick={submit}>{client ? t("Save changes", "حفظ التعديلات") : t("Add client", "إضافة العميل")}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!client && (
          <p className="text-xs text-ink-muted bg-surface-2 rounded-lg px-3 py-2">
            {t(
              "For any client - a call, a walk-in, a referral, a chat on Instagram or WhatsApp. They stay private to you (and your agency admin), and we never contact them.",
              "لأي عميل - اتصال، زيارة، توصية، محادثة على إنستغرام أو واتساب. تبقى بياناته خاصة بك (وبمدير وكالتك)، ولن نتواصل معه أبداً."
            )}
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label={t("Name", "الاسم")} htmlFor="cl-name" required>
            <Input id="cl-name" dir="auto" value={f.name} maxLength={120} autoFocus onChange={e => set("name", e.target.value)} />
          </FormField>
          <FormField label={t("How did they reach you?", "كيف وصل إليك؟")} htmlFor="cl-source">
            <Select id="cl-source" value={f.source} onChange={e => set("source", e.target.value as LeadSource)}>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{isRtl ? LEAD_SOURCE_TEXT[s].ar : LEAD_SOURCE_TEXT[s].en}</option>)}
            </Select>
          </FormField>
          <FormField label={t("Phone", "الهاتف")} htmlFor="cl-phone">
            <Input id="cl-phone" dir="ltr" inputMode="tel" placeholder="+974 5555 1234" value={f.phone} onChange={e => set("phone", e.target.value)} />
          </FormField>
          <FormField label={t("WhatsApp (if different)", "واتساب (إن اختلف)")} htmlFor="cl-wa">
            <Input id="cl-wa" dir="ltr" inputMode="tel" value={f.whatsapp} onChange={e => set("whatsapp", e.target.value)} />
          </FormField>
          <FormField label={t("Email (optional)", "البريد (اختياري)")} htmlFor="cl-email">
            <Input id="cl-email" dir="ltr" type="email" value={f.email} onChange={e => set("email", e.target.value)} />
          </FormField>
          <FormField label={t("Budget (QAR, optional)", "الميزانية (ر.ق، اختياري)")} htmlFor="cl-budget">
            <Input id="cl-budget" type="number" min="0" step="any" inputMode="decimal" value={f.budget} onChange={e => set("budget", e.target.value)} />
          </FormField>
        </div>
        <FormField label={t("What are they looking for?", "ماذا يبحث عنه؟")} htmlFor="cl-interest">
          <Input id="cl-interest" dir="auto" maxLength={300} placeholder={t("e.g. 2-bedroom for rent in Lusail, sea view", "مثلاً: شقة غرفتين للإيجار في لوسيل بإطلالة بحرية")} value={f.interest} onChange={e => set("interest", e.target.value)} />
        </FormField>
        {properties.length > 0 && (
          <FormField label={t("Linked listing (optional)", "عقار مرتبط (اختياري)")} htmlFor="cl-prop">
            <Select id="cl-prop" value={f.propertyId} onChange={e => set("propertyId", e.target.value)}>
              <option value="">{t("None", "بلا")}</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </FormField>
        )}
        {!client && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <FormField label={t("Stage", "المرحلة")} htmlFor="cl-stage">
                <Select id="cl-stage" value={f.status} onChange={e => set("status", e.target.value as LeadStatus)}>
                  {[LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.VIEWING_SCHEDULED, LeadStatus.NEGOTIATION].map(s => (
                    <option key={s} value={s}>{isRtl ? STAGE_TEXT[s].ar : STAGE_TEXT[s].en}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("Follow up on", "المتابعة في")} htmlFor="cl-fu" hint={t("We email you that morning.", "نرسل لك تذكيراً صباح ذلك اليوم.")}>
                <Input id="cl-fu" type="date" min={today()} value={f.nextFollowUpDate} onChange={e => set("nextFollowUpDate", e.target.value)} />
              </FormField>
              {isOrgAdmin && (
                <FormField label={t("Agent", "الوكيل")} htmlFor="cl-agent">
                  <Select id="cl-agent" value={f.agentId} onChange={e => set("agentId", e.target.value)}>
                    <option value="">{t("Me", "أنا")}</option>
                    {team.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                  </Select>
                </FormField>
              )}
            </div>
            <FormField label={t("First note (optional)", "ملاحظة أولى (اختياري)")} htmlFor="cl-notes">
              <Textarea id="cl-notes" dir="auto" rows={2} maxLength={1000} value={f.notes} onChange={e => set("notes", e.target.value)}
                placeholder={t("What was said, what they want next...", "ما دار في الحديث، ما يريده لاحقاً...")} />
            </FormField>
          </>
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Import a client list (CSV from Excel / Google Sheets)
// ---------------------------------------------------------------------------------------------
const TEMPLATE_CSV =
  "﻿Name,Phone,WhatsApp,Email,Source,Interest,Budget,Notes\r\n" +
  "Khalid Al-Marri,+974 5555 1234,,khalid@example.com,Referral,2-bedroom in Lusail,1500000,Met at a friend's house\r\n" +
  "Sara Ahmed,+974 6666 7890,+974 6666 7890,,Instagram,Villa in Al Waab,4500000,\r\n";

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "nerou-clients-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const FIELD_TEXT: Record<string, { en: string; ar: string }> = {
  name: { en: "Name", ar: "الاسم" }, phone: { en: "Phone", ar: "الهاتف" }, whatsapp: { en: "WhatsApp", ar: "واتساب" },
  email: { en: "Email", ar: "البريد" }, source: { en: "Source", ar: "المصدر" }, interest: { en: "Interest", ar: "الاهتمام" },
  budget: { en: "Budget", ar: "الميزانية" }, notes: { en: "Notes", ar: "ملاحظات" }
};

export function ImportModal({ open, team, isOrgAdmin, isRtl, t, onClose, onImport }: {
  open: boolean; team: { id: string; fullName: string }[]; isOrgAdmin: boolean; isRtl: boolean; t: T; onClose: () => void;
  onImport: (clients: Record<string, unknown>[], agentId: string) => Promise<{ created: number; skipped: { row: number; name: string; reason: string }[] }>;
}) {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof rowsToClients> | null>(null);
  const [garbled, setGarbled] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: { row: number; name: string; reason: string }[] } | null>(null);

  useEffect(() => {
    if (open) { setFileName(""); setParsed(null); setGarbled(false); setAgentId(""); setError(""); setResult(null); }
  }, [open]);
  if (!open) return null;

  const onFile = async (file: File | undefined) => {
    setError(""); setResult(null); setParsed(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) return setError(t("The file is too large (2 MB maximum).", "الملف كبير جداً (الحد الأقصى 2 ميجابايت)."));
    const text = await file.text();
    setGarbled(text.includes("�")); // not UTF-8: Arabic would come out as question marks
    const r = rowsToClients(parseCsv(text));
    if (r.error) setError(r.error);
    setParsed(r);
  };

  const run = async () => {
    if (!parsed || parsed.clients.length === 0) return;
    setBusy(true); setError("");
    try { setResult(await onImport(parsed.clients, agentId)); } catch (e: any) { setError(e?.message || t("Import failed.", "فشل الاستيراد.")); } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="lg"
      title={t("Import your client list", "استيراد قائمة عملائك")}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>{result ? t("Close", "إغلاق") : t("Cancel", "إلغاء")}</Button>
          {!result && (
            <Button size="sm" loading={busy} disabled={!parsed || parsed.clients.length === 0 || !!parsed.error} leftIcon={<Upload size={14} />} onClick={run}>
              {parsed && parsed.clients.length > 0 ? t(`Import ${parsed.clients.length} clients`, `استيراد ${parsed.clients.length} عميل`) : t("Import", "استيراد")}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {result ? (
          <div className="space-y-3">
            <p className="text-sm font-bold text-ink">{t(`${result.created} clients added.`, `تمت إضافة ${result.created} عميل.`)}</p>
            {result.skipped.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-muted mb-1.5">{t(`${result.skipped.length} rows were skipped:`, `تم تخطي ${result.skipped.length} صفاً:`)}</p>
                <ul className="max-h-48 overflow-y-auto text-xs border border-border rounded-lg divide-y divide-surface-2">
                  {result.skipped.map(s => (
                    <li key={s.row} className="px-3 py-1.5 flex gap-2"><span className="text-ink-muted shrink-0">{t("Row", "صف")} {s.row}</span><span dir="auto" className="font-semibold truncate">{s.name || "-"}</span><span className="text-ink-muted">{s.reason}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <ol className="text-xs text-ink-muted space-y-1 list-decimal ps-5">
              <li>{t("Put your clients in a spreadsheet: a Name column and at least a Phone, WhatsApp or Email.", "ضع عملاءك في جدول: عمود للاسم وعمود واحد على الأقل للهاتف أو واتساب أو البريد.")}</li>
              <li>{t("In Excel choose File > Save As > CSV UTF-8 (so Arabic names stay correct).", "في Excel اختر ملف > حفظ باسم > CSV UTF-8 (حتى تبقى الأسماء العربية سليمة).")}</li>
              <li>{t("Choose the file below. Clients you already have (same phone) are skipped.", "اختر الملف أدناه. العملاء الموجودون لديك (نفس الهاتف) يُتخطّون.")}</li>
            </ol>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border-strong text-sm font-semibold text-ink hover:bg-surface-2 cursor-pointer">
                <Upload size={14} />{t("Choose CSV file", "اختر ملف CSV")}
                <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-active underline cursor-pointer"><FileDown size={13} />{t("Download a template", "تنزيل نموذج جاهز")}</button>
              {fileName && <span dir="ltr" className="text-xs text-ink-muted truncate max-w-[14rem]">{fileName}</span>}
            </div>
            {garbled && <p className="text-xs text-warning bg-warning-soft rounded-lg px-3 py-2">{t("This file does not look like UTF-8, so Arabic text may be garbled. Re-save it as CSV UTF-8.", "لا يبدو أن الملف بترميز UTF-8، فقد تظهر الحروف العربية مشوّهة. أعد حفظه بصيغة CSV UTF-8.")}</p>}
            {parsed && !parsed.error && (
              <div className="space-y-2">
                <p className="text-xs text-ink">
                  {t(`${parsed.clients.length} rows found. Columns understood: `, `وُجد ${parsed.clients.length} صفاً. الأعمدة المفهومة: `)}
                  <strong>{parsed.recognised.map(c => (isRtl ? FIELD_TEXT[c].ar : FIELD_TEXT[c].en)).join(isRtl ? "، " : ", ")}</strong>
                </p>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-surface-2">
                      {parsed.clients.slice(0, 5).map((c, i) => (
                        <tr key={i}>
                          <td dir="auto" className="px-3 py-1.5 font-semibold">{String(c.name || "-")}</td>
                          <td dir="ltr" className="px-3 py-1.5 text-ink-muted">{westernDigits(String(c.phone || c.whatsapp || c.email || "-"))}</td>
                          <td className="px-3 py-1.5 text-ink-muted">{c.source ? (isRtl ? LEAD_SOURCE_TEXT[c.source as LeadSource].ar : LEAD_SOURCE_TEXT[c.source as LeadSource].en) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.clients.length > 5 && <p className="text-[11px] text-ink-muted">{t(`...and ${parsed.clients.length - 5} more`, `...و${parsed.clients.length - 5} آخرين`)}</p>}
              </div>
            )}
            {isOrgAdmin && (
              <FormField label={t("Assign them to", "إسنادهم إلى")} htmlFor="im-agent">
                <Select id="im-agent" value={agentId} onChange={e => setAgentId(e.target.value)}>
                  <option value="">{t("Me", "أنا")}</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </Select>
              </FormField>
            )}
          </>
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Client detail: contact, notes, timeline, actions
// ---------------------------------------------------------------------------------------------
export function ClientDetailModal({ lead, viewings, showAgent, isRtl, t, onClose, onMove, onAddNote, onFollowUp, onSchedule, onEdit, onArchive, onDelete }: {
  lead: DeskLead | null; viewings: DeskViewing[]; showAgent: boolean; isRtl: boolean; t: T; onClose: () => void;
  onMove: (l: DeskLead, s: LeadStatus) => void;
  onAddNote: (l: DeskLead, text: string) => Promise<void>;
  onFollowUp: (l: DeskLead) => void;
  onSchedule: (l: DeskLead) => void;
  onEdit: (l: DeskLead) => void;
  onArchive: (l: DeskLead) => void;
  onDelete: (l: DeskLead) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(""); }, [lead?.id]);
  const myViewings = useMemo(() => (lead ? viewings.filter(v => v.leadId === lead.id && v.status !== "CANCELLED") : []), [lead, viewings]);
  if (!lead) return null;

  const wa = waLink(leadPhone(lead), isRtl ? `مرحباً ${lead.visitorName}،` : `Hello ${lead.visitorName},`);
  const fu = followUpDay(lead);
  const history = [...(lead.stageHistory || [])].reverse();
  const notes = lead.notes || [];

  const submitNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try { await onAddNote(lead, note.trim()); setNote(""); } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="lg"
      title={<span dir="auto">{lead.visitorName}</span>}
      footer={
        <div className="flex items-center justify-between gap-2 w-full flex-wrap">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => onArchive(lead)}>{t("Archive", "أرشفة")}</Button>
            {lead.addedManually && (
              <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} onClick={() => onDelete(lead)} className="!text-danger">{t("Delete client", "حذف العميل")}</Button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {lead.addedManually && <Button variant="secondary" size="sm" onClick={() => onEdit(lead)}>{t("Edit details", "تعديل البيانات")}</Button>}
            <Button size="sm" onClick={onClose}>{t("Done", "تم")}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${lead.addedManually ? "bg-gold-soft text-gold-active" : "bg-surface-2 text-ink-muted"}`}>
            {lead.addedManually ? `${t("Added by you", "أضفتَه أنت")} · ${sourceLabel(lead, isRtl)}` : t("From the platform", "من المنصة")}
          </span>
          <select aria-label={t("Stage", "المرحلة")} value={columnForStatus(lead.status)} onChange={e => onMove(lead, e.target.value as LeadStatus)}
            className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs font-semibold text-ink cursor-pointer">
            {BOARD_COLUMNS.map(s => <option key={s} value={s}>{isRtl ? STAGE_TEXT[s].ar : STAGE_TEXT[s].en}</option>)}
          </select>
          <button type="button" onClick={() => onFollowUp(lead)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink hover:border-gold cursor-pointer">
            <Calendar size={12} />{fu ? t("Follow-up ", "المتابعة ") + fmtDay(fu, isRtl) : t("Set follow-up", "حدّد متابعة")}
          </button>
          <button type="button" onClick={() => onSchedule(lead)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink hover:border-gold cursor-pointer">
            <Calendar size={12} />{t("Schedule viewing", "جدولة معاينة")}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-3 flex-wrap sm:col-span-2">
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:text-emerald-900"><MessageCircle size={14} /><bdi dir="ltr">{lead.visitorWhatsapp || lead.visitorPhone}</bdi></a>}
            {lead.visitorPhone && <a href={`tel:${lead.visitorPhone}`} className="inline-flex items-center gap-1.5 text-ink font-semibold hover:text-gold"><Phone size={14} /><bdi dir="ltr">{lead.visitorPhone}</bdi></a>}
            {lead.visitorEmail && <a href={`mailto:${lead.visitorEmail}`} className="inline-flex items-center gap-1.5 text-ink font-semibold hover:text-gold"><Mail size={14} /><bdi dir="ltr">{lead.visitorEmail}</bdi></a>}
          </div>
          {lead.interest && <p dir="auto" className="sm:col-span-2 text-ink"><span className="text-ink-muted">{t("Looking for: ", "يبحث عن: ")}</span>{lead.interest}</p>}
          {lead.message && !lead.addedManually && <p dir="auto" className="sm:col-span-2 text-ink italic">"{lead.message}"</p>}
          {!!lead.budget && <p className="text-ink"><span className="text-ink-muted">{t("Budget: ", "الميزانية: ")}</span>{fmtMoney(lead.budget, isRtl)}</p>}
          {lead.propertyTitle && <p dir="auto" className="text-ink"><span className="text-ink-muted">{t("Listing: ", "العقار: ")}</span>{lead.propertyTitle}</p>}
          <p className="text-ink-muted text-xs">{t("Added ", "أُضيف ")}{ago(lead.createdDate, isRtl)} · {t("last activity ", "آخر نشاط ")}{ago(lead.updatedDate, isRtl)}</p>
          {showAgent && lead.agentName && <p className="text-ink-muted text-xs">{t("Agent: ", "الوكيل: ")}{lead.agentName}</p>}
          {lead.status === LeadStatus.LOST && lead.lostReason && <p className="sm:col-span-2 text-ink-muted text-xs">{t("Lost because: ", "سبب الخسارة: ")}{lead.lostReason}</p>}
        </div>

        {myViewings.length > 0 && (
          <section>
            <h4 className="text-xs font-bold text-ink mb-1.5">{t("Viewings", "المعاينات")}</h4>
            <ul className="text-xs space-y-1">
              {myViewings.map(v => <li key={v.id} className="text-ink-muted"><strong className="text-ink">{fmtDay(v.preferredDate, isRtl)}</strong> · {v.preferredTimeSlot}</li>)}
            </ul>
          </section>
        )}

        <section>
          <h4 className="text-xs font-bold text-ink mb-1.5">{t("Notes", "الملاحظات")}</h4>
          <div className="flex gap-2 items-start">
            <Textarea dir="auto" rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)}
              placeholder={t("Log a call, a promise, what they asked for...", "سجّل مكالمة أو وعداً أو ما طلبه العميل...")} />
            <Button size="sm" loading={busy} disabled={!note.trim()} onClick={submitNote}>{t("Add", "إضافة")}</Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-xs text-ink-muted mt-2">{t("No notes yet.", "لا توجد ملاحظات بعد.")}</p>
          ) : (
            <ul className="mt-2 space-y-2 max-h-52 overflow-y-auto">
              {notes.map(n => (
                <li key={n.id} className="bg-surface-2 rounded-lg px-3 py-2">
                  <p dir="auto" className="text-sm text-ink whitespace-pre-wrap">{n.text}</p>
                  <p className="text-[10px] text-ink-muted mt-1">{n.authorName} · {ago(n.createdDate, isRtl)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {history.length > 0 && (
          <section>
            <h4 className="text-xs font-bold text-ink mb-1.5">{t("Timeline", "السجل الزمني")}</h4>
            <ul className="text-xs space-y-1">
              {history.slice(0, 8).map((h, i) => (
                <li key={i} className="text-ink-muted"><strong className="text-ink">{isRtl ? STAGE_TEXT[h.status]?.ar : STAGE_TEXT[h.status]?.en}</strong> · {h.byName} · {ago(h.date, isRtl)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}

