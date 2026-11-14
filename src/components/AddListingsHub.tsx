/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardPaste, Download, FileSpreadsheet, Link2, Loader2, PenLine, PlugZap, RefreshCw, Rocket, Unplug, UploadCloud } from "lucide-react";
import PasteAdPanel from "./PasteAdPanel.js";
import type { ParsedListing, PlaceRef } from "../lib/listingFromText.js";
import { importTemplateCsv, IMPORT_MAX_BYTES } from "../lib/listingImport.js";
import { propertyTypeLabel } from "../lib/propertySpecs.js";

// One place to add listings, with every way there is: paste an ad, upload a file, connect a feed link, or fill the form by hand. The
// agent picks the one that suits how they already work. A file or a feed is read, shown for checking (what will be created, updated,
// skipped and why), and saved as drafts to review, or published straight away when allowed.

interface PreviewItem { externalId: string; title: string; transactionType: string; propertyType: string; price: number; area: number; bedrooms?: number; district: string; city: string; complete: boolean; notes: string[]; photos: number; action: "create" | "update" }
interface Preview {
  format: "csv" | "json" | "xml"; total: number; truncated: boolean; skipped: { row: number; reason: string }[];
  counts: { create: number; update: number; complete: number; incomplete: number; photos: number };
  items: PreviewItem[]; publishBlock: string | null;
}
interface ImportResult { created: number; updated: number; drafts: number; published: number; skipped: { row: number; reason: string }[]; photosQueued: number; publishBlocked: string | null }
interface FeedState { url: string; active: boolean; autoPublish: boolean; connectedDate: string; lastSyncDate?: string; lastSyncStats?: { created: number; updated: number; drafts: number; skipped: number }; lastError?: string }

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

async function readError(res: Response, fallback: string): Promise<string> {
  try { const d = await res.json(); return d.error || fallback; } catch { return fallback; }
}

type Method = "paste" | "file" | "feed";

export default function AddListingsHub({
  isRtl, locations, onApplyPaste, onManual, onImported, draftsReady, onPublishDrafts
}: {
  isRtl: boolean;
  locations: PlaceRef[];
  onApplyPaste: (p: ParsedListing) => void;
  onManual: () => void;
  /** a file or feed was imported: reload the agent's listings */
  onImported: () => void;
  /** imported drafts that have everything needed to publish */
  draftsReady: number;
  onPublishDrafts: () => Promise<string>;
}) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [method, setMethod] = useState<Method | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState("");

  const CARDS: { id: Method | "manual"; icon: typeof ClipboardPaste; tile: string; title: string; hint: string }[] = [
    { id: "paste", icon: ClipboardPaste, tile: "bg-amber-100 text-amber-700", title: t("Paste an ad", "الصق إعلاناً"), hint: t("One listing, from a WhatsApp message or a post", "عقار واحد، من رسالة واتساب أو منشور") },
    { id: "file", icon: FileSpreadsheet, tile: "bg-emerald-100 text-emerald-700", title: t("Upload a file", "ارفع ملفاً"), hint: t("Many listings at once, from Excel (CSV), JSON or XML", "عقارات كثيرة معاً، من إكسل (CSV) أو JSON أو XML") },
    { id: "feed", icon: Link2, tile: "bg-violet-100 text-violet-700", title: t("Connect your feed link", "اربط رابط خلاصتك"), hint: t("Your listings update on their own, from the system you already use", "تتحدّث عقاراتك وحدها، من النظام الذي تستخدمه") },
    { id: "manual", icon: PenLine, tile: "bg-sky-100 text-sky-700", title: t("Fill the form", "املأ النموذج"), hint: t("One listing, step by step, with photos and map pin", "عقار واحد خطوة بخطوة مع الصور والموقع") }
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card p-5 space-y-4" aria-label={t("Add your listings", "أضف عقاراتك")}>
      <div>
        <h3 className="font-serif text-xl font-semibold text-ink leading-tight">{t("Add your listings", "أضف عقاراتك")}</h3>
        <p className="text-[13px] text-ink-muted mt-0.5">{t("Choose the way that suits how you already work.", "اختر الطريقة التي تناسب طريقة عملك.")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map(c => {
          const Icon = c.icon;
          const on = method === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => (c.id === "manual" ? onManual() : setMethod(on ? null : (c.id as Method)))}
              className={`text-start rounded-2xl border p-4 transition cursor-pointer ${on ? "border-gold bg-gold-soft/40 shadow-popover" : "border-border bg-surface hover:border-gold"}`}
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.tile}`}><Icon size={22} strokeWidth={2.25} /></span>
              <span className="block text-sm font-semibold text-ink mt-3 leading-snug">{c.title}</span>
              <span className="block text-[12px] text-ink-muted mt-1 leading-snug">{c.hint}</span>
            </button>
          );
        })}
      </div>

      {draftsReady > 0 && (
        <div className="flex items-center gap-3 flex-wrap rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0"><Rocket size={20} strokeWidth={2.25} /></span>
          <p className="flex-1 min-w-[12rem] text-[13px] text-ink">
            {t(`${draftsReady} imported draft${draftsReady === 1 ? " is" : "s are"} complete and ready to publish.`, `${draftsReady} من المسودات المستوردة مكتملة وجاهزة للنشر.`)}
            {publishNote && <span className="block font-semibold mt-0.5">{publishNote}</span>}
          </p>
          <button
            type="button"
            disabled={publishing}
            onClick={async () => { setPublishing(true); try { setPublishNote(await onPublishDrafts()); } finally { setPublishing(false); } }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer transition-colors"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}{t("Publish them all", "انشرها كلها")}
          </button>
        </div>
      )}

      {method === "paste" && <PasteAdPanel isRtl={isRtl} locations={locations} onApply={onApplyPaste} embedded />}
      {method === "file" && <ImportFilePanel isRtl={isRtl} onImported={onImported} />}
      {method === "feed" && <FeedLinkPanel isRtl={isRtl} onImported={onImported} />}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// The preview shared by the file and the feed
// ---------------------------------------------------------------------------------------------

function ImportPreviewCard({ isRtl, preview, busy, confirmLabel, onConfirm, result, allowPublishChoice = true }: {
  isRtl: boolean; preview: Preview; busy: boolean; confirmLabel: string; onConfirm: (publish: boolean) => void; result: ImportResult | null; allowPublishChoice?: boolean;
}) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [publish, setPublish] = useState(false);
  const c = preview.counts;
  const tile = "rounded-xl border border-border bg-surface p-3";

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3" role="status">
        <p className="font-serif text-lg font-semibold text-ink flex items-center gap-2"><Check size={20} className="text-emerald-600" strokeWidth={3} />{t("Done", "تم")}</p>
        <ul className="text-[14px] text-ink space-y-1">
          {result.created > 0 && <li>{t(`${result.created} listing${result.created === 1 ? "" : "s"} added`, `أُضيف ${result.created} عقاراً`)}{result.published > 0 ? t(` (${result.published} published, ${result.drafts} saved as drafts)`, ` (${result.published} منشور و${result.drafts} مسودة)`) : result.drafts > 0 ? t(`, saved as drafts for you to review`, `، محفوظة كمسودات لتراجعها`) : ""}</li>}
          {result.updated > 0 && <li>{t(`${result.updated} existing listing${result.updated === 1 ? "" : "s"} updated`, `حُدّث ${result.updated} عقاراً موجوداً`)}</li>}
          {result.skipped.length > 0 && <li>{t(`${result.skipped.length} row${result.skipped.length === 1 ? "" : "s"} could not be used`, `تعذّر استخدام ${result.skipped.length} صفاً`)}</li>}
          {result.photosQueued > 0 && <li>{t("Photos are being downloaded and added in the background; they appear within a few minutes.", "تُحمَّل الصور وتُضاف في الخلفية، وتظهر خلال دقائق.")}</li>}
        </ul>
        {result.publishBlocked && <p className="text-[13px] text-ink bg-warning-soft border border-warning/30 rounded-xl px-4 py-3">{result.publishBlocked}</p>}
        <p className="text-[13px] text-ink-muted">{t("Open any draft to add photos and the map pin, then publish. Or publish all the complete ones from the green bar above.", "افتح أي مسودة لتضيف الصور وموقع الخريطة ثم انشر. أو انشر كل المكتملة من الشريط الأخضر في الأعلى.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={tile}><p className="font-serif text-xl font-semibold text-ink tabular-nums">{c.create}</p><p className="text-[12px] text-ink-muted">{t("will be added", "ستُضاف")}</p></div>
        <div className={tile}><p className="font-serif text-xl font-semibold text-ink tabular-nums">{c.update}</p><p className="text-[12px] text-ink-muted">{t("already here, will be updated", "موجودة وستُحدَّث")}</p></div>
        <div className={tile}><p className="font-serif text-xl font-semibold text-emerald-700 tabular-nums">{c.complete}</p><p className="text-[12px] text-ink-muted">{t("ready to publish", "جاهزة للنشر")}</p></div>
        <div className={tile}><p className="font-serif text-xl font-semibold text-amber-700 tabular-nums">{c.incomplete}</p><p className="text-[12px] text-ink-muted">{t("need details first", "تحتاج تفاصيل أولاً")}</p></div>
      </div>

      {preview.truncated && <p className="text-[13px] text-ink bg-warning-soft border border-warning/30 rounded-xl px-4 py-3">{t(`The file has ${preview.total} rows. Only the first 200 are used each time; import again with the rest.`, `الملف فيه ${preview.total} صفاً. يُستخدم أول 200 فقط في كل مرة؛ استورد الباقي في مرة أخرى.`)}</p>}

      {preview.skipped.length > 0 && (
        <details className="rounded-xl border border-border bg-surface px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink flex items-center gap-2"><AlertTriangle size={15} className="text-warning" />{t(`${preview.skipped.length} row${preview.skipped.length === 1 ? "" : "s"} cannot be used`, `${preview.skipped.length} صفاً لا يمكن استخدامه`)}</summary>
          <ul className="mt-2 space-y-1 text-[12px] text-ink-muted max-h-40 overflow-y-auto">
            {preview.skipped.slice(0, 50).map(s => <li key={s.row}>{t("Row", "الصف")} {s.row}: {s.reason}</li>)}
          </ul>
        </details>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-[12px] min-w-[640px]">
          <thead className="bg-surface-2 text-ink-muted"><tr className="text-start">{[t("Listing", "العقار"), t("Deal", "الصفقة"), t("Price", "السعر"), t("Size", "المساحة"), t("Area", "المنطقة"), t("Status", "الحالة")].map(h => <th key={h} className="px-3 py-2 font-bold text-start">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/70">
            {preview.items.slice(0, 12).map(i => (
              <tr key={i.externalId} title={i.notes.join(" ")}>
                <td className="px-3 py-2"><span className="block font-semibold text-ink truncate max-w-[220px]">{i.title}</span><span className="block text-ink-faint">{propertyTypeLabel(i.propertyType, isRtl)}{i.bedrooms !== undefined ? ` · ${i.bedrooms === 0 ? t("Studio", "استوديو") : i.bedrooms}` : ""}</span></td>
                <td className="px-3 py-2">{i.transactionType === "FOR_RENT" ? t("Rent", "إيجار") : t("Sale", "بيع")}</td>
                <td className="px-3 py-2 tabular-nums">{i.price.toLocaleString("en-US")}</td>
                <td className="px-3 py-2 tabular-nums">{i.area > 0 ? i.area : "—"}</td>
                <td className="px-3 py-2">{i.district}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${i.complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{i.complete ? t("Ready", "جاهز") : t("Needs details", "يحتاج تفاصيل")}</span>
                  {i.action === "update" && <span className="ms-1 inline-block px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-700">{t("Update", "تحديث")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.items.length > 12 && <p className="text-[12px] text-ink-faint">{t(`And ${preview.items.length - 12} more.`, `و${preview.items.length - 12} غيرها.`)}</p>}

      {allowPublishChoice && c.complete > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold text-ink mb-1">{t("What should happen to them?", "ماذا نفعل بها؟")}</legend>
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer has-[:checked]:border-gold has-[:checked]:bg-gold-soft/30">
            <input type="radio" name="import-publish" checked={!publish} onChange={() => setPublish(false)} className="mt-1 accent-gold" />
            <span><span className="block text-[13px] font-semibold text-ink">{t("Save as drafts, I will review them first", "احفظها كمسودات لأراجعها أولاً")}</span><span className="block text-[12px] text-ink-muted">{t("Recommended. You add photos and the map pin, then publish.", "الأفضل. تضيف الصور وموقع الخريطة ثم تنشر.")}</span></span>
          </label>
          <label className={`flex items-start gap-3 rounded-xl border border-border p-3 has-[:checked]:border-gold has-[:checked]:bg-gold-soft/30 ${preview.publishBlock ? "opacity-60" : "cursor-pointer"}`}>
            <input type="radio" name="import-publish" checked={publish} disabled={!!preview.publishBlock} onChange={() => setPublish(true)} className="mt-1 accent-gold" />
            <span><span className="block text-[13px] font-semibold text-ink">{t(`Publish the ${c.complete} ready ones now`, `انشر الـ ${c.complete} الجاهزة الآن`)}</span><span className="block text-[12px] text-ink-muted">{preview.publishBlock || t("The others stay as drafts.", "والباقي يبقى مسودات.")}</span></span>
          </label>
        </fieldset>
      )}

      <button type="button" disabled={busy || (c.create + c.update) === 0} onClick={() => onConfirm(publish && !preview.publishBlock)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-gold-ink text-sm font-bold disabled:opacity-50 cursor-pointer hover:brightness-95 transition">
        {busy ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}{confirmLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Upload a file
// ---------------------------------------------------------------------------------------------

function ImportFilePanel({ isRtl, onImported }: { isRtl: boolean; onImported: () => void }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const readFile = async (file: File | undefined) => {
    setError(""); setPreview(null); setResult(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > IMPORT_MAX_BYTES) { setError(t("The file is too large (2 MB at most).", "الملف كبير جداً (2 ميجابايت كحد أقصى).")); return; }
    if (/\.xlsx?$/i.test(file.name)) { setError(t("This is an Excel file. In Excel choose Save As, then CSV UTF-8, and upload that.", "هذا ملف إكسل. في إكسل اختر «حفظ باسم» ثم CSV UTF-8 وارفع الناتج.")); return; }
    const text = await file.text();
    if (text.includes("�")) { setError(t("The file is not saved as UTF-8, so Arabic letters would break. Save it as CSV UTF-8 and try again.", "الملف ليس بترميز UTF-8 فستتشوّه الحروف العربية. احفظه CSV UTF-8 وأعد المحاولة.")); return; }
    setContent(text);
    setBusy(true);
    try {
      const res = await fetch("/api/listings/import/preview", { method: "POST", headers: { ...auth(), "Content-Type": "text/plain; charset=utf-8" }, body: text });
      if (!res.ok) { setError(await readError(res, t("We could not read that file.", "تعذّرت قراءة هذا الملف."))); return; }
      setPreview(await res.json());
    } catch { setError(t("We could not reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى.")); } finally { setBusy(false); }
  };

  const confirm = async (publish: boolean) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/listings/import/commit${publish ? "?publish=1" : ""}`, { method: "POST", headers: { ...auth(), "Content-Type": "text/plain; charset=utf-8" }, body: content });
      if (!res.ok) { setError(await readError(res, t("The import failed.", "فشل الاستيراد."))); return; }
      setResult(await res.json());
      onImported();
    } catch { setError(t("We could not reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى.")); } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([importTemplateCsv()], { type: "text/csv;charset=utf-8" }));
    a.download = "nerou-listings-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div className="rounded-2xl border border-gold/50 bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="font-serif text-lg font-semibold text-ink">{t("Upload a file of listings", "ارفع ملف عقارات")}</h4>
          <p className="text-[13px] text-ink-muted mt-0.5">{t("Use your own export from Excel (saved as CSV), or a JSON or XML file. We read the common column names, in English or Arabic.", "استعمل ملفك الذي صدّرته من إكسل (محفوظاً CSV) أو ملف JSON أو XML. نقرأ أسماء الأعمدة الشائعة بالعربية والإنجليزية.")}</p>
        </div>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface text-[13px] font-semibold text-ink hover:bg-surface-2 cursor-pointer transition-colors"><Download size={15} />{t("Download the template", "حمّل النموذج")}</button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
        onClick={() => input.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${drag ? "border-gold bg-gold-soft/40" : "border-border hover:border-gold"}`}
      >
        {busy && !preview ? <Loader2 size={28} className="animate-spin text-gold" /> : <UploadCloud size={28} className="text-gold-active" />}
        <p className="text-[14px] font-semibold text-ink">{fileName || t("Drop your file here, or press to choose it", "أفلت ملفك هنا، أو اضغط لاختياره")}</p>
        <p className="text-[12px] text-ink-faint">CSV · JSON · XML</p>
        <input ref={input} type="file" accept=".csv,.json,.xml,.txt,text/csv,application/json,text/xml,application/xml" className="hidden" onChange={e => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      {error && <p role="alert" className="text-[13px] text-danger bg-danger-soft border border-danger/30 rounded-xl px-4 py-3">{error}</p>}
      {preview && <ImportPreviewCard isRtl={isRtl} preview={preview} busy={busy} result={result} onConfirm={confirm} confirmLabel={t(`Import ${preview.counts.create + preview.counts.update} listing${preview.counts.create + preview.counts.update === 1 ? "" : "s"}`, `استورد ${preview.counts.create + preview.counts.update} عقاراً`)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Connect a feed link
// ---------------------------------------------------------------------------------------------

function FeedLinkPanel({ isRtl, onImported }: { isRtl: boolean; onImported: () => void }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [feed, setFeed] = useState<FeedState | null | undefined>(undefined);
  const [publishBlock, setPublishBlock] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/me/listing-feed", { headers: auth() });
      if (res.ok) { const d = await res.json(); setFeed(d.feed); setPublishBlock(d.publishBlock); } else setFeed(null);
    } catch { setFeed(null); }
  };
  useEffect(() => { load(); }, []);

  const check = async () => {
    setBusy(true); setError(""); setPreview(null); setNote("");
    try {
      const res = await fetch("/api/listings/import/feed-preview", { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      if (!res.ok) { setError(await readError(res, t("We could not read that feed.", "تعذّرت قراءة هذه الخلاصة."))); return; }
      setPreview(await res.json());
    } catch { setError(t("We could not reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى.")); } finally { setBusy(false); }
  };

  const connect = async (publish: boolean) => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/me/listing-feed", { method: "PUT", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify({ url, autoPublish: publish }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || t("We could not connect that feed.", "تعذّر ربط هذه الخلاصة.")); return; }
      setFeed(d.feed); setPreview(null); setUrl("");
      setNote(t(`Connected. ${d.result.created} added, ${d.result.updated} updated. We will read it again every few hours.`, `تم الربط. أُضيف ${d.result.created} وحُدّث ${d.result.updated}. سنقرأها مجدداً كل بضع ساعات.`));
      onImported();
    } catch { setError(t("We could not reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى.")); } finally { setBusy(false); }
  };

  const syncNow = async () => {
    setBusy(true); setError(""); setNote("");
    try {
      const res = await fetch("/api/me/listing-feed/sync", { method: "POST", headers: auth() });
      const d = await res.json().catch(() => ({}));
      if (d.feed) setFeed(d.feed);
      if (!res.ok) { setError(d.error || t("The sync failed.", "فشلت المزامنة.")); return; }
      setNote(t(`Done. ${d.result.created} added, ${d.result.updated} updated.`, `تم. أُضيف ${d.result.created} وحُدّث ${d.result.updated}.`));
      onImported();
    } catch { setError(t("We could not reach the server. Please try again.", "تعذّر الاتصال بالخادم. حاول مرة أخرى.")); } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await fetch("/api/me/listing-feed", { method: "DELETE", headers: auth() }); setFeed(null); setNote(t("Disconnected. Your listings stay where they are.", "تم الفصل. تبقى عقاراتك كما هي.")); } finally { setBusy(false); }
  };

  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(isRtl ? "ar" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className="rounded-2xl border border-gold/50 bg-surface p-5 space-y-4">
      <div>
        <h4 className="font-serif text-lg font-semibold text-ink">{t("Connect your feed link", "اربط رابط خلاصتك")}</h4>
        <p className="text-[13px] text-ink-muted mt-0.5">{t("If your listings are managed in a system (a CRM) that sends them to other portals, it can give you a feed link (CSV, JSON or XML). Paste it once and we keep your listings up to date.", "إن كانت عقاراتك تُدار في نظام (CRM) يرسلها إلى مواقع أخرى، فيمكنه أن يعطيك رابط خلاصة (CSV أو JSON أو XML). الصقه مرة واحدة ونُبقي عقاراتك محدَّثة.")}</p>
      </div>

      {feed === undefined && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gold" size={22} /></div>}

      {feed && (
        <div className="rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0"><PlugZap size={20} strokeWidth={2.25} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink truncate" dir="ltr">{feed.url}</p>
              <p className="text-[12px] text-ink-muted">{t("Last read", "آخر قراءة")}: {when(feed.lastSyncDate)}{feed.lastSyncStats ? ` · ${t(`${feed.lastSyncStats.created} added, ${feed.lastSyncStats.updated} updated`, `أُضيف ${feed.lastSyncStats.created} وحُدّث ${feed.lastSyncStats.updated}`)}` : ""} · {feed.autoPublish ? t("publishes complete listings", "تنشر المكتمل") : t("saves drafts", "تحفظ مسودات")}</p>
            </div>
          </div>
          {feed.lastError && <p className="text-[13px] text-ink bg-warning-soft border border-warning/30 rounded-xl px-4 py-3 flex items-start gap-2"><AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />{feed.lastError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={syncNow} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-chrome hover:bg-chrome-hover text-white text-sm font-semibold disabled:opacity-60 cursor-pointer transition-colors">{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{t("Read it now", "اقرأها الآن")}</button>
            <button type="button" onClick={disconnect} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm font-semibold text-ink-muted hover:text-danger hover:bg-surface-2 disabled:opacity-60 cursor-pointer transition-colors"><Unplug size={16} />{t("Disconnect", "افصل")}</button>
          </div>
        </div>
      )}

      {feed === null && !preview && (
        <div className="space-y-3">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/my-listings.xml" dir="ltr" aria-label={t("Feed link", "رابط الخلاصة")} className="w-full px-4 py-3 bg-canvas border border-border rounded-xl text-[14px]" />
          <button type="button" onClick={check} disabled={busy || !/^https:\/\//i.test(url.trim())} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-chrome hover:bg-chrome-hover text-white text-sm font-semibold disabled:opacity-40 cursor-pointer transition-colors">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} className="text-gold" />}{t("Check my feed", "افحص خلاصتي")}
          </button>
          <p className="text-[12px] text-ink-faint">{t("The link must start with https. We only read it, and only your own listings are added to your account.", "يجب أن يبدأ الرابط بـ https. نقرؤه فقط، ولا يُضاف إلى حسابك إلا عقاراتك.")}</p>
        </div>
      )}

      {error && <p role="alert" className="text-[13px] text-danger bg-danger-soft border border-danger/30 rounded-xl px-4 py-3">{error}</p>}
      {note && <p role="status" className="text-[13px] font-semibold text-ink bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">{note}</p>}

      {feed === null && preview && (
        <div className="space-y-3">
          <ImportPreviewCard isRtl={isRtl} preview={{ ...preview, publishBlock }} busy={busy} result={null} onConfirm={p => void connect(p)} confirmLabel={t("Connect and import", "اربط واستورد")} />
          <button type="button" onClick={() => setPreview(null)} className="text-[13px] font-semibold text-ink-muted hover:text-ink underline cursor-pointer">{t("Use a different link", "استخدم رابطاً آخر")}</button>
        </div>
      )}
    </div>
  );
}
