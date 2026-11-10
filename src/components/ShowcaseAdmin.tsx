/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Admin: the companies shown in the public "subscribers" section. Add a company with its logo, a group
// photo taken with them and a short description; publish it when it is ready, reorder, edit, remove.

import React, { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Building2, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { ShowcaseEntry, ShowcaseKind } from "../types.js";
import { KIND_LABEL, MAX_DESCRIPTION, SHOWCASE_KINDS, formatSince } from "../lib/showcase.js";
import { compressImage } from "../lib/image.js";
import { Button } from "./ui/Button.js";
import { Modal } from "./ui/Modal.js";
import { Input } from "./ui/FormField.js";
import { Spinner } from "./ui/Spinner.js";
import { EmptyState } from "./ui/EmptyState.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";

interface OrgOption { id: string; name: string; type: string; verificationStatus: string }

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Something went wrong.");
  return body as T;
}

async function uploadImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const form = new FormData();
  form.append("files", compressed);
  const token = localStorage.getItem("token");
  // ?type=avatar: no property-photo watermark on a company's logo or group photo
  const res = await fetch("/api/media/upload?type=avatar", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  const url = (data.fileUrls || data.urls || [])[0];
  if (!url) throw new Error("Upload failed.");
  return url;
}

const select = "w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm";
const Label = ({ text, children }: { text: string; children: React.ReactNode }) =>
  <label className="block space-y-1.5"><span className="block text-xs font-semibold text-ink-muted">{text}</span>{children}</label>;

export default function ShowcaseAdmin({ isRtl }: { isRtl: boolean }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [entries, setEntries] = useState<ShowcaseEntry[] | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ entry: ShowcaseEntry | null } | null>(null);
  const [del, setDel] = useState<ShowcaseEntry | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const say = (text: string, bad = false) => { setToast({ text, bad }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    try {
      const d = await api<{ entries: ShowcaseEntry[]; organizations: OrgOption[] }>("/api/admin/showcase");
      setEntries(d.entries); setOrgs(d.organizations); setError("");
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await load(); if (ok) say(ok); } catch (e: any) { say(e.message, true); }
  };

  if (!entries) return error ? <p role="alert" className="p-6 text-sm text-danger">{error}</p> : <div className="p-10 flex justify-center"><Spinner /></div>;
  const published = entries.filter(e => e.published).length;

  return (
    <div className="space-y-4 text-xs" data-testid="showcase-admin">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2"><Users size={18} className="text-gold" />{t("Subscribers showcase", "عرض المشتركين")}</h3>
          <p className="text-ink-muted mt-0.5 max-w-2xl">
            {t("The companies shown to visitors on the home page and the plans page to build trust: logo, a group photo with them and a short description. Only add a company that agreed to appear. Nothing shows until you publish it.",
              "الشركات التي تظهر للزوار في الصفحة الرئيسية وصفحة الباقات لبناء الثقة: الشعار وصورة جماعية معهم ووصف قصير. أضف فقط شركة وافقت على الظهور. لا يظهر شيء حتى تنشره.")}
          </p>
        </div>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setForm({ entry: null })}>{t("Add a company", "إضافة شركة")}</Button>
      </div>

      <p className="text-ink-muted">{t(`${entries.length} added, ${published} published.`, `${entries.length} مضافة، ${published} منشورة.`)}</p>

      {entries.length === 0 ? (
        <EmptyState icon={<Building2 size={20} />} title={t("No companies yet", "لا توجد شركات بعد")}
          description={t("Add the first company that subscribed. After you publish it, the \"subscribers\" section appears on the site.", "أضف أول شركة اشتركت. بعد نشرها يظهر قسم المشتركين في الموقع.")}
          action={<Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setForm({ entry: null })}>{t("Add a company", "إضافة شركة")}</Button>} />
      ) : (
        <ul className="space-y-3">
          {entries.map((e, i) => (
            <li key={e.id} className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap" data-testid="showcase-row">
              <div className="w-24 h-16 rounded-lg bg-surface-2 overflow-hidden shrink-0 flex items-center justify-center">
                {e.photoUrl ? <img src={e.photoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 size={20} className="text-ink-muted" />}
              </div>
              {e.logoUrl && <img src={e.logoUrl} alt="" className="w-10 h-10 rounded-lg bg-white border border-border object-contain p-0.5 shrink-0" />}
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-ink">{e.name}{e.nameAr ? <span className="font-normal text-ink-muted"> · {e.nameAr}</span> : null}</p>
                <p className="text-ink-muted">{KIND_LABEL[e.kind][isRtl ? "ar" : "en"]}{e.since ? ` · ${formatSince(e.since, isRtl ? "ar" : "en")}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.published ? "bg-success-soft text-success" : "bg-surface-2 text-ink-muted"}`}>{e.published ? t("Published", "منشور") : t("Hidden", "مخفي")}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={i === 0} onClick={() => act(() => api(`/api/admin/showcase/${e.id}/move`, { method: "POST", body: JSON.stringify({ direction: "up" }) }))} aria-label={t("Move up", "تحريك لأعلى")} className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-2 disabled:opacity-30 cursor-pointer"><ArrowUp size={13} /></button>
                <button type="button" disabled={i === entries.length - 1} onClick={() => act(() => api(`/api/admin/showcase/${e.id}/move`, { method: "POST", body: JSON.stringify({ direction: "down" }) }))} aria-label={t("Move down", "تحريك لأسفل")} className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-2 disabled:opacity-30 cursor-pointer"><ArrowDown size={13} /></button>
                <Button size="sm" variant="outline" leftIcon={e.published ? <EyeOff size={13} /> : <Eye size={13} />}
                  onClick={() => act(() => api(`/api/admin/showcase/${e.id}`, { method: "PATCH", body: JSON.stringify({ published: !e.published }) }), e.published ? t("Hidden from the site.", "أُخفيت من الموقع.") : t("Published.", "تم النشر."))}>
                  {e.published ? t("Hide", "إخفاء") : t("Publish", "نشر")}
                </Button>
                <Button size="sm" variant="outline" leftIcon={<Pencil size={13} />} onClick={() => setForm({ entry: e })}>{t("Edit", "تعديل")}</Button>
                <button type="button" onClick={() => setDel(e)} aria-label={t("Delete", "حذف")} className="p-2 rounded-lg bg-surface border border-border text-danger hover:bg-surface-2 cursor-pointer"><Trash2 size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <ShowcaseForm
          isRtl={isRtl} t={t} initial={form.entry} orgs={orgs}
          onClose={() => setForm(null)}
          onSave={async (payload) => {
            if (form.entry) await api(`/api/admin/showcase/${form.entry.id}`, { method: "PATCH", body: JSON.stringify(payload) });
            else await api("/api/admin/showcase", { method: "POST", body: JSON.stringify(payload) });
            await load(); say(t("Saved.", "تم الحفظ.")); setForm(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!del} isRtl={isRtl} tone="danger"
        title={t(`Remove ${del?.name} from the showcase?`, `إزالة ${del?.name} من العرض؟`)}
        confirmLabel={t("Remove", "إزالة")}
        onCancel={() => setDel(null)}
        onConfirm={() => { const d = del!; setDel(null); act(() => api(`/api/admin/showcase/${d.id}`, { method: "DELETE" }), t("Removed.", "تمت الإزالة.")); }}
      />
      {toast && <div role="status" className={`fixed bottom-5 ${isRtl ? "left-5" : "right-5"} z-[250] max-w-sm px-4 py-3 rounded-xl shadow-2xl text-xs font-medium text-white ${toast.bad ? "bg-danger" : "bg-chrome border border-gold"}`}>{toast.text}</div>}
    </div>
  );
}

function ShowcaseForm({ isRtl, t, initial, orgs, onClose, onSave }: {
  isRtl: boolean; t: (en: string, ar: string) => string; initial: ShowcaseEntry | null; orgs: OrgOption[];
  onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = useState({
    name: initial?.name || "", nameAr: initial?.nameAr || "", kind: (initial?.kind || "AGENCY") as ShowcaseKind,
    description: initial?.description || "", descriptionAr: initial?.descriptionAr || "",
    logoUrl: initial?.logoUrl || "", photoUrl: initial?.photoUrl || "", website: initial?.website || "",
    orgId: initial?.orgId || "", since: initial?.since || "", published: initial?.published ?? false
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"" | "logo" | "photo">("");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const pick = async (which: "logo" | "photo", file?: File) => {
    if (!file) return;
    setUploading(which); setErr("");
    try {
      const url = await uploadImage(file);
      setF(prev => ({ ...prev, [which === "logo" ? "logoUrl" : "photoUrl"]: url }));
    } catch (e: any) { setErr(e.message); } finally { setUploading(""); }
  };

  const submit = async () => {
    setBusy(true); setErr("");
    try { await onSave({ ...f }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  // a plain function (not a component defined inside this one) so the file input is not rebuilt on every keystroke
  const imageField = (which: "logo" | "photo", label: string, value: string) => (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold text-ink-muted">{label}</span>
      <div className="flex items-center gap-3">
        <div className={`${which === "logo" ? "w-16 h-16" : "w-32 h-20"} rounded-lg bg-surface-2 border border-border overflow-hidden flex items-center justify-center shrink-0`}>
          {value ? <img src={value} alt="" className={`w-full h-full ${which === "logo" ? "object-contain p-1 bg-white" : "object-cover"}`} /> : <ImagePlus size={20} className="text-ink-muted" />}
        </div>
        <div className="space-y-1">
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading !== ""} aria-label={label}
            onChange={e => { pick(which, e.target.files?.[0]); e.target.value = ""; }} className="block text-xs" />
          {uploading === which && <p className="text-ink-muted">{t("Uploading...", "جارٍ الرفع...")}</p>}
          {value && <button type="button" onClick={() => setF({ ...f, [which === "logo" ? "logoUrl" : "photoUrl"]: "" })} className="text-danger underline cursor-pointer">{t("Remove", "إزالة")}</button>}
        </div>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="lg" title={initial ? t("Edit company", "تعديل الشركة") : t("Add a company", "إضافة شركة")}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>{t("Cancel", "إلغاء")}</Button><Button loading={busy} disabled={uploading !== ""} onClick={submit}>{t("Save", "حفظ")}</Button></div>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Label text={t("Company name *", "اسم الشركة *")}><Input value={f.name} onChange={set("name")} autoFocus /></Label>
        <Label text={t("Name in Arabic", "الاسم بالعربية")}><Input value={f.nameAr} onChange={set("nameAr")} dir="rtl" /></Label>
        <Label text={t("Type", "النوع")}>
          <select value={f.kind} onChange={set("kind")} className={select}>{SHOWCASE_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k][isRtl ? "ar" : "en"]}</option>)}</select>
        </Label>
        <Label text={t("Subscribed since", "مشترك منذ")}><Input type="month" dir="ltr" value={f.since} onChange={set("since")} /></Label>
        <div className="sm:col-span-2">
          <Label text={t(`Description * (${f.description.length}/${MAX_DESCRIPTION})`, `الوصف * (${f.description.length}/${MAX_DESCRIPTION})`)}>
            <textarea value={f.description} onChange={set("description")} rows={3} maxLength={MAX_DESCRIPTION} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm" placeholder={t("What the company does, how long, in which areas...", "ماذا تعمل الشركة، ومنذ متى، وفي أي مناطق...")} />
          </Label>
        </div>
        <div className="sm:col-span-2">
          <Label text={t("Description in Arabic", "الوصف بالعربية")}>
            <textarea value={f.descriptionAr} onChange={set("descriptionAr")} rows={3} maxLength={MAX_DESCRIPTION} dir="rtl" className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm" />
          </Label>
        </div>
        {imageField("photo", t("Group photo with the company", "الصورة الجماعية مع الشركة"), f.photoUrl)}
        {imageField("logo", t("Company logo", "شعار الشركة"), f.logoUrl)}
        <Label text={t("Website", "الموقع")}><Input dir="ltr" value={f.website} onChange={set("website")} placeholder="example.qa" /></Label>
        <Label text={t("Their account on the platform (optional)", "حسابهم في المنصة (اختياري)")}>
          <select value={f.orgId} onChange={set("orgId")} className={select}>
            <option value="">—</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.verificationStatus === "APPROVED" ? "" : ` (${t("not verified", "غير موثّق")})`}</option>)}
          </select>
        </Label>
        <p className="sm:col-span-2 text-xs text-ink-muted -mt-1">{t("Linking their account adds a “Verified account” badge, their number of live listings and a link to their profile (only while the account is verified).", "ربط حسابهم يضيف شارة «حساب موثّق» وعدد عقاراتهم المنشورة ورابطًا لصفحتهم (فقط ما دام الحساب موثّقًا).")}</p>
        <label className="sm:col-span-2 flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={f.published} onChange={e => setF({ ...f, published: e.target.checked })} className="w-4 h-4 accent-gold" />
          <span className="text-sm font-semibold text-ink">{t("Show this company on the website now", "إظهار هذه الشركة في الموقع الآن")}</span>
        </label>
      </div>
      {err && <p role="alert" className="mt-3 text-xs text-danger">{err}</p>}
    </Modal>
  );
}
