/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The platform's own sales pipeline (admin only): the agents, agencies and developers the Nerou
// team is trying to sign up. Board of stages, follow-ups with email reminders, a record of every
// contact, add by hand or import a list, and numbers on where prospects come from and what
// converts. Not related to the agents' Sales Desk.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing, Download, Mail, MessageCircle, Phone, Plus, RefreshCw, Search, Trash2, TrendingUp, Upload, UserCheck, Users, Banknote, CalendarClock, Pencil
} from "lucide-react";
import type { Prospect, ProspectActivity, ProspectKind, ProspectSource, ProspectStage } from "../types.js";
import {
  KIND_TEXT, PROSPECT_KINDS, PROSPECT_SOURCES, PROSPECT_STAGES, SOURCE_TEXT, STAGE_TEXT, isOpenProspect, parseProspectsCsv, prospectsToCsv
} from "../lib/prospects.js";
import type { ProspectStats } from "../lib/prospects.js";
import { addDaysToDate, qatarDate } from "../lib/crm.js";
import { Button } from "./ui/Button.js";
import { Modal } from "./ui/Modal.js";
import { Input } from "./ui/FormField.js";
import { Spinner } from "./ui/Spinner.js";
import { EmptyState } from "./ui/EmptyState.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";

interface SignedUp {
  userId: string; name: string; role: string; applicationStatus: string; verificationStatus: string;
  subscriptionStatus: string | null; planName: string | null; registeredAt: string;
}
type ProspectRow = Prospect & { ownerName: string; signedUp: SignedUp | null };
interface Overview {
  prospects: ProspectRow[];
  owners: { id: string; fullName: string }[];
  plans: { id: string; name: string; priceMonthly: number }[];
  stats: ProspectStats;
}
type View = "board" | "followups" | "insights";

const STAGE_ACCENT: Record<ProspectStage, string> = {
  NEW: "border-t-sky-500", CONTACTED: "border-t-indigo-500", DEMO: "border-t-violet-500", TRIAL: "border-t-amber-500",
  NEGOTIATION: "border-t-orange-500", WON: "border-t-emerald-500", LOST: "border-t-rose-500"
};

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || "Something went wrong."), { status: res.status, body });
  return body as T;
}

const money = (n: number, isRtl: boolean) => `${Math.round(n).toLocaleString(isRtl ? "ar-QA" : "en-US")} ${isRtl ? "ر.ق" : "QAR"}`;

export default function ProspectPipeline({ isRtl, currentUserId }: { isRtl: boolean; currentUserId: string }) {
  const t = useCallback((en: string, ar: string) => (isRtl ? ar : en), [isRtl]);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("board");
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [formCtx, setFormCtx] = useState<{ prospect: ProspectRow | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lostCtx, setLostCtx] = useState<ProspectRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteCtx, setDeleteCtx] = useState<ProspectRow | null>(null);

  const say = (text: string, bad = false) => { setToast({ text, bad }); setTimeout(() => setToast(null), 4000); };

  const reload = useCallback(async () => {
    try {
      setData(await api<Overview>("/api/admin/prospects"));
      setError("");
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const act = async <R,>(fn: () => Promise<R>, okText?: string): Promise<R | undefined> => {
    try {
      const r = await fn();
      await reload();
      if (okText) say(okText);
      return r;
    } catch (e: any) { say(e.message, true); return undefined; }
  };

  const today = qatarDate(Date.now());
  const all = useMemo(() => data?.prospects ?? [], [data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(p =>
      (ownerFilter === "all" || p.ownerId === ownerFilter) &&
      (sourceFilter === "all" || p.source === sourceFilter) &&
      (!q || [p.name, p.company, p.email, p.phone, p.whatsapp].some(v => !!v && v.toLowerCase().includes(q))));
  }, [all, search, ownerFilter, sourceFilter]);
  const detail = detailId ? all.find(p => p.id === detailId) || null : null;

  const moveStage = (p: ProspectRow, stage: ProspectStage) => {
    if (stage === p.stage) return;
    if (stage === "LOST") { setLostCtx(p); return; }
    act(() => api(`/api/admin/prospects/${p.id}`, { method: "PATCH", body: JSON.stringify({ stage }) }),
      t(`Moved to “${STAGE_TEXT[stage].en}”.`, `نُقل إلى «${STAGE_TEXT[stage].ar}».`));
  };
  const setFollowUp = (p: ProspectRow, date: string) =>
    act(() => api(`/api/admin/prospects/${p.id}`, { method: "PATCH", body: JSON.stringify({ nextFollowUp: date }) }),
      t("Follow-up updated.", "تم تحديث موعد المتابعة."));

  const exportCsv = () => {
    const csv = prospectsToCsv(visible, id => data?.owners.find(o => o.id === id)?.fullName || "");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `sales-pipeline-${today}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!data) {
    return error
      ? <div className="p-6 text-sm text-danger" role="alert">{error}</div>
      : <div className="p-10 flex justify-center"><Spinner /></div>;
  }
  const s = data.stats;

  return (
    <div className="space-y-4 text-xs" data-testid="prospect-pipeline">
      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <TrendingUp size={18} className="text-gold" />{t("Sales pipeline", "خط المبيعات")}
          </h3>
          <p className="text-ink-muted mt-0.5 max-w-xl">
            {t("The agents, agencies and developers we want to sign up. Follow-up reminders are emailed to the person who owns each prospect.",
              "الوسطاء والمكاتب والمطورون الذين نريد اشتراكهم. تصل تذكيرات المتابعة بالإيميل لمسؤول كل عميل محتمل.")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} />} onClick={reload}>{t("Refresh", "تحديث")}</Button>
          <Button variant="outline" size="sm" leftIcon={<BellRing size={13} />}
            onClick={() => act(async () => {
              const r = await api<{ prospects: number; emails: number }>("/api/admin/prospects/send-reminders", { method: "POST", body: "{}" });
              say(r.prospects > 0 ? t(`Emailed you ${r.prospects} reminder(s).`, `أُرسل لك إيميل بـ ${r.prospects} تذكير.`) : t("Nothing is due right now.", "لا توجد متابعات مستحقة الآن."));
            })}>{t("Email me my reminders", "أرسل لي تذكيراتي")}</Button>
          <Button variant="outline" size="sm" leftIcon={<Download size={13} />} onClick={exportCsv} disabled={visible.length === 0}>{t("Export", "تصدير")}</Button>
          <Button variant="outline" size="sm" leftIcon={<Upload size={13} />} onClick={() => setImportOpen(true)}>{t("Import list", "استيراد قائمة")}</Button>
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setFormCtx({ prospect: null })}>{t("Add prospect", "إضافة عميل محتمل")}</Button>
        </div>
      </div>

      {/* numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={<Users size={15} />} label={t("Open prospects", "عملاء محتملون مفتوحون")} value={String(s.open)} />
        <Kpi icon={<BellRing size={15} />} label={t("Follow-ups due", "متابعات مستحقة")} value={String(s.dueNow)} warn={s.dueNow > 0} onClick={() => setView("followups")} />
        <Kpi icon={<Banknote size={15} />} label={t("Pipeline value / month", "قيمة الخط شهريًا")} value={money(s.pipelineMonthly, isRtl)} />
        <Kpi icon={<UserCheck size={15} />} label={t("Subscribed this month", "اشتركوا هذا الشهر")} value={`${s.wonThisMonth} · ${money(s.wonThisMonthMonthly, isRtl)}`} />
        <Kpi icon={<TrendingUp size={15} />} label={t("Win rate", "نسبة النجاح")} value={s.conversionPercent === null ? "—" : `${s.conversionPercent}%`} />
      </div>

      {/* tabs + filters */}
      <div className="flex items-center gap-3 flex-wrap border-b border-border">
        <div className="flex gap-1" role="tablist">
          {([["board", t("Pipeline board", "لوحة المسار")], ["followups", t("Follow-ups", "المتابعات")], ["insights", t("Prospect data", "بيانات العملاء المحتملين")]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 -mb-px cursor-pointer ${view === id ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
              {label}{id === "followups" && s.dueNow > 0 && <span className="ms-1.5 min-w-[18px] h-[18px] px-1 inline-block rounded-full bg-danger text-white text-[10px] leading-[18px] text-center">{s.dueNow}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap ms-auto pb-2">
          <div className="relative">
            <Search size={13} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-ink-muted" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search name, company, phone, email", "ابحث بالاسم أو الشركة أو الجوال أو الإيميل")} className="!py-1.5 !text-xs ps-8 w-64" />
          </div>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="px-2 py-1.5 bg-surface border border-border rounded-lg text-xs" aria-label={t("Owner", "المسؤول")}>
            <option value="all">{t("Everyone", "الكل")}</option>
            {data.owners.map(o => <option key={o.id} value={o.id}>{o.id === currentUserId ? t("Mine", "عملائي") : o.fullName}</option>)}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-2 py-1.5 bg-surface border border-border rounded-lg text-xs" aria-label={t("Source", "المصدر")}>
            <option value="all">{t("All sources", "كل المصادر")}</option>
            {PROSPECT_SOURCES.map(x => <option key={x} value={x}>{isRtl ? SOURCE_TEXT[x].ar : SOURCE_TEXT[x].en}</option>)}
          </select>
        </div>
      </div>

      {all.length === 0 && (
        <EmptyState icon={<Users size={20} />} title={t("No prospects yet", "لا يوجد عملاء محتملون بعد")}
          description={t("Add the first agent, agency or developer you want to sign up, or import a list from Excel.", "أضف أول وسيط أو مكتب أو مطور تريد اشتراكه، أو استورد قائمة من إكسل.")}
          action={<Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setFormCtx({ prospect: null })}>{t("Add prospect", "إضافة عميل محتمل")}</Button>} />
      )}

      {all.length > 0 && view === "board" && (
        <div className="flex gap-3 overflow-x-auto pb-3 items-start">
          {PROSPECT_STAGES.map(stage => {
            const col = visible.filter(p => p.stage === stage);
            return (
              <section key={stage} className={`shrink-0 w-64 bg-canvas border border-border border-t-4 ${STAGE_ACCENT[stage]} rounded-xl`} data-stage={stage}>
                <header className="px-3 py-2.5 flex items-center justify-between">
                  <h4 className="font-bold text-ink">{isRtl ? STAGE_TEXT[stage].ar : STAGE_TEXT[stage].en}</h4>
                  <span className="text-[10px] font-bold text-ink-muted bg-surface-2 rounded-full px-2 py-0.5">{col.length}</span>
                </header>
                <div className="px-2 pb-2 space-y-2 max-h-[560px] overflow-y-auto">
                  {col.length === 0 && <p className="text-[11px] text-ink-muted text-center py-4">{t("Nobody here", "لا أحد هنا")}</p>}
                  {col.map(p => <ProspectCard key={p.id} p={p} isRtl={isRtl} t={t} today={today} onOpen={() => setDetailId(p.id)} onMove={moveStage} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {all.length > 0 && view === "followups" && (
        <FollowUps rows={visible} isRtl={isRtl} t={t} today={today} onOpen={id => setDetailId(id)} onSnooze={(p, date) => setFollowUp(p, date)} />
      )}

      {all.length > 0 && view === "insights" && <Insights rows={visible} stats={s} isRtl={isRtl} t={t} today={today} onOpen={id => setDetailId(id)} />}

      {/* modals */}
      {formCtx && (
        <ProspectForm
          isRtl={isRtl} t={t} data={data} initial={formCtx.prospect} currentUserId={currentUserId}
          onClose={() => setFormCtx(null)}
          onSave={async (payload, allowDuplicate) => {
            const body = JSON.stringify({ ...payload, ...(allowDuplicate ? { allowDuplicate: true } : {}) });
            const res = formCtx.prospect
              ? await api(`/api/admin/prospects/${formCtx.prospect.id}`, { method: "PATCH", body })
              : await api(`/api/admin/prospects`, { method: "POST", body });
            await reload();
            say(formCtx.prospect ? t("Saved.", "تم الحفظ.") : t("Added to the pipeline.", "أُضيف إلى خط المبيعات."));
            setFormCtx(null);
            if (!formCtx.prospect) setDetailId(res.prospect.id);
          }}
        />
      )}
      {detail && (
        <ProspectDetail
          p={detail} isRtl={isRtl} t={t} data={data} today={today}
          onClose={() => setDetailId(null)}
          onEdit={() => setFormCtx({ prospect: detail })}
          onDelete={() => setDeleteCtx(detail)}
          onMove={moveStage}
          onSetFollowUp={setFollowUp}
          onOwner={(ownerId) => act(() => api(`/api/admin/prospects/${detail.id}`, { method: "PATCH", body: JSON.stringify({ ownerId }) }), t("Owner changed.", "تم تغيير المسؤول."))}
          onLog={async (payload) => { const r = await act(() => api(`/api/admin/prospects/${detail.id}/activity`, { method: "POST", body: JSON.stringify(payload) }), t("Saved to the history.", "تم الحفظ في السجل.")); return !!r; }}
        />
      )}
      {lostCtx && <LostModal p={lostCtx} t={t} isRtl={isRtl} onClose={() => setLostCtx(null)}
        onConfirm={async (reason) => { const r = await act(() => api(`/api/admin/prospects/${lostCtx.id}`, { method: "PATCH", body: JSON.stringify({ stage: "LOST", lostReason: reason }) }), t("Marked as lost.", "تم تسجيله كخسارة.")); if (r) setLostCtx(null); }} />}
      {importOpen && <ImportModal t={t} isRtl={isRtl} onClose={() => setImportOpen(false)}
        onImport={async (rows) => { const r = await api<{ added: number; skipped: { row: number; name: string; reason: string }[] }>("/api/admin/prospects/import", { method: "POST", body: JSON.stringify({ prospects: rows }) }); await reload(); return r; }} />}
      <ConfirmDialog
        open={!!deleteCtx} isRtl={isRtl} tone="danger"
        title={t(`Delete ${deleteCtx?.name}? Their whole history is deleted too.`, `حذف ${deleteCtx?.name}؟ سيُحذف سجله بالكامل أيضًا.`)}
        confirmLabel={t("Delete", "حذف")}
        onCancel={() => setDeleteCtx(null)}
        onConfirm={async () => { const p = deleteCtx!; setDeleteCtx(null); const r = await act(() => api(`/api/admin/prospects/${p.id}`, { method: "DELETE" }), t("Deleted.", "تم الحذف.")); if (r) setDetailId(null); }}
      />

      {toast && (
        <div role="status" className={`fixed bottom-5 ${isRtl ? "left-5" : "right-5"} z-[250] max-w-sm px-4 py-3 rounded-xl shadow-2xl text-xs font-medium text-white ${toast.bad ? "bg-danger" : "bg-chrome border border-gold"}`}>{toast.text}</div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------

type T = (en: string, ar: string) => string;

function Kpi({ label, value, icon, warn, onClick }: { label: string; value: string; icon: React.ReactNode; warn?: boolean; onClick?: () => void }) {
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={`text-start bg-surface border rounded-xl p-3.5 ${warn ? "border-danger/40" : "border-border"} ${onClick ? "cursor-pointer hover:border-gold transition-colors" : ""}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${warn ? "text-danger" : "text-ink-muted"}`}>{icon}{label}</div>
      <div className="mt-1 font-serif text-lg font-semibold text-ink truncate"><bdi>{value}</bdi></div>
    </Tag>
  );
}

function followUpChip(p: Prospect, today: string, t: T) {
  if (!p.nextFollowUp || !isOpenProspect(p)) return null;
  const late = p.nextFollowUp < today;
  const now = p.nextFollowUp === today;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${late ? "bg-danger-soft text-danger" : now ? "bg-gold-soft text-gold-active" : "bg-surface-2 text-ink-muted"}`}>
      <CalendarClock size={10} />{late ? t("Overdue ", "متأخر ") : now ? t("Today ", "اليوم ") : ""}{p.nextFollowUp}
    </span>
  );
}

function ProspectCard({ p, isRtl, t, today, onOpen, onMove }: { p: ProspectRow; isRtl: boolean; t: T; today: string; onOpen: () => void; onMove: (p: ProspectRow, s: ProspectStage) => void }) {
  return (
    <article className="bg-surface border border-border rounded-lg p-2.5 space-y-1.5 hover:border-gold transition-colors" data-testid="prospect-card">
      <button type="button" onClick={onOpen} className="text-start w-full cursor-pointer">
        <p className="font-bold text-ink truncate">{p.name}</p>
        {p.company && <p className="text-[11px] text-ink-muted truncate">{p.company}</p>}
      </button>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted text-[10px] font-bold">{isRtl ? KIND_TEXT[p.kind].ar : KIND_TEXT[p.kind].en}</span>
        <span className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-muted text-[10px]">{isRtl ? SOURCE_TEXT[p.source].ar : SOURCE_TEXT[p.source].en}</span>
        {p.signedUp && <span className="px-1.5 py-0.5 rounded bg-success-soft text-success text-[10px] font-bold">{t("Has an account", "لديه حساب")}</span>}
      </div>
      {followUpChip(p, today, t)}
      {p.followUpNote && isOpenProspect(p) && <p className="text-[11px] text-ink-muted line-clamp-2">{p.followUpNote}</p>}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[10px] text-ink-muted truncate">{p.ownerName}{p.expectedMonthly ? ` · ${Math.round(p.expectedMonthly).toLocaleString()}` : ""}</span>
        <select value={p.stage} onChange={e => onMove(p, e.target.value as ProspectStage)} aria-label={t("Move to stage", "نقل إلى مرحلة")}
          className="px-1 py-0.5 bg-surface border border-border rounded text-[10px] max-w-[110px]">
          {PROSPECT_STAGES.map(s => <option key={s} value={s}>{isRtl ? STAGE_TEXT[s].ar : STAGE_TEXT[s].en}</option>)}
        </select>
      </div>
    </article>
  );
}

function ContactLinks({ p }: { p: Prospect }) {
  const wa = (p.whatsapp || p.phone || "").replace(/\D/g, "");
  const cls = "p-2 rounded-lg bg-surface border border-border text-ink hover:bg-surface-2";
  return (
    <div className="flex items-center gap-1.5">
      {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`} className={cls} aria-label="Call"><Phone size={13} /></a>}
      {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-success-soft text-success hover:bg-success/20" aria-label="WhatsApp"><MessageCircle size={13} /></a>}
      {p.email && <a href={`mailto:${p.email}`} className={cls} aria-label="Email"><Mail size={13} /></a>}
    </div>
  );
}

function FollowUps({ rows, isRtl, t, today, onOpen, onSnooze }: { rows: ProspectRow[]; isRtl: boolean; t: T; today: string; onOpen: (id: string) => void; onSnooze: (p: ProspectRow, date: string) => void }) {
  const open = rows.filter(isOpenProspect);
  const week = addDaysToDate(today, 7);
  const groups: { title: string; tone?: string; items: ProspectRow[] }[] = [
    { title: t("Overdue", "متأخرة"), tone: "text-danger", items: open.filter(p => p.nextFollowUp && p.nextFollowUp < today).sort((a, b) => a.nextFollowUp!.localeCompare(b.nextFollowUp!)) },
    { title: t("Today", "اليوم"), tone: "text-gold-active", items: open.filter(p => p.nextFollowUp === today) },
    { title: t("Next 7 days", "الأيام السبعة القادمة"), items: open.filter(p => p.nextFollowUp && p.nextFollowUp > today && p.nextFollowUp <= week).sort((a, b) => a.nextFollowUp!.localeCompare(b.nextFollowUp!)) },
    { title: t("No follow-up booked", "بدون موعد متابعة"), tone: "text-ink-muted", items: open.filter(p => !p.nextFollowUp) }
  ];
  return (
    <div className="space-y-5">
      {groups.map(g => g.items.length > 0 && (
        <section key={g.title}>
          <h4 className={`font-bold mb-2 ${g.tone || "text-ink"}`}>{g.title} <span className="text-ink-muted font-normal">({g.items.length})</span></h4>
          <div className="space-y-2">
            {g.items.map(p => (
              <div key={p.id} className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3 flex-wrap" data-testid="followup-row">
                <button type="button" onClick={() => onOpen(p.id)} className="flex-1 min-w-[180px] text-start cursor-pointer">
                  <p className="font-bold text-ink">{p.name}{p.company ? <span className="font-normal text-ink-muted"> · {p.company}</span> : null}</p>
                  <p className="text-[11px] text-ink-muted">{isRtl ? STAGE_TEXT[p.stage].ar : STAGE_TEXT[p.stage].en}{p.followUpNote ? ` · ${p.followUpNote}` : ""}</p>
                </button>
                {followUpChip(p, today, t)}
                <ContactLinks p={p} />
                <div className="flex items-center gap-1">
                  {([[1, t("+1 day", "+ يوم")], [3, t("+3 days", "+ 3 أيام")], [7, t("+1 week", "+ أسبوع")]] as const).map(([d, label]) => (
                    <button key={d} type="button" onClick={() => onSnooze(p, addDaysToDate(today, d))} className="px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-[10px] font-bold hover:bg-border cursor-pointer">{label}</button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => onOpen(p.id)}>{t("Log contact", "تسجيل تواصل")}</Button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {open.length === 0 && <EmptyState icon={<BellRing size={20} />} title={t("Nothing open", "لا توجد متابعات مفتوحة")} />}
    </div>
  );
}

function Insights({ rows, stats, isRtl, t, today, onOpen }: { rows: ProspectRow[]; stats: ProspectStats; isRtl: boolean; t: T; today: string; onOpen: (id: string) => void }) {
  const kinds = PROSPECT_KINDS.map(k => ({ k, n: rows.filter(p => p.kind === k).length })).filter(x => x.n > 0);
  const lost = rows.filter(p => p.stage === "LOST");
  const reasons = Object.entries(lost.reduce<Record<string, number>>((m, p) => { const r = (p.lostReason || "—").trim(); m[r] = (m[r] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const quiet = rows.filter(p => isOpenProspect(p) && (qatarDate(new Date(p.lastContactAt || p.createdAt)) <= addDaysToDate(today, -7)));
  const th = "text-start p-2.5 text-[10px] uppercase text-ink-muted font-bold";
  const card = "bg-surface border border-border rounded-xl overflow-hidden";
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className={card}>
        <h4 className="p-3 font-bold text-ink border-b border-border">{t("Where prospects come from", "من أين يأتي العملاء المحتملون")}</h4>
        <table className="w-full"><thead className="bg-canvas"><tr><th className={th}>{t("Source", "المصدر")}</th><th className={th}>{t("Total", "الكل")}</th><th className={th}>{t("Open", "مفتوح")}</th><th className={th}>{t("Subscribed", "اشترك")}</th><th className={th}>{t("Lost", "خسارة")}</th><th className={th}>{t("Win rate", "النجاح")}</th></tr></thead>
          <tbody className="divide-y divide-surface-2">
            {stats.bySource.map(r => (
              <tr key={r.source}><td className="p-2.5 font-semibold text-ink">{isRtl ? SOURCE_TEXT[r.source].ar : SOURCE_TEXT[r.source].en}</td><td className="p-2.5">{r.total}</td><td className="p-2.5">{r.open}</td><td className="p-2.5 text-success font-bold">{r.won}</td><td className="p-2.5">{r.lost}</td><td className="p-2.5">{r.won + r.lost > 0 ? `${Math.round((r.won / (r.won + r.lost)) * 100)}%` : "—"}</td></tr>
            ))}
          </tbody></table>
      </section>
      <section className={card}>
        <h4 className="p-3 font-bold text-ink border-b border-border">{t("By stage", "حسب المرحلة")}</h4>
        <div className="p-3 space-y-2">
          {PROSPECT_STAGES.map(s => {
            const n = stats.byStage[s]; const max = Math.max(1, ...Object.values(stats.byStage));
            return (
              <div key={s} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-ink-muted">{isRtl ? STAGE_TEXT[s].ar : STAGE_TEXT[s].en}</span>
                <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden"><div className="h-full bg-gold" style={{ width: `${(n / max) * 100}%` }} /></div>
                <span className="w-8 text-end font-bold text-ink">{n}</span>
              </div>
            );
          })}
          {kinds.length > 0 && <p className="pt-2 text-ink-muted">{kinds.map(x => `${isRtl ? KIND_TEXT[x.k].ar : KIND_TEXT[x.k].en}: ${x.n}`).join(" · ")}</p>}
        </div>
      </section>
      <section className={card}>
        <h4 className="p-3 font-bold text-ink border-b border-border">{t("Why we lost them", "لماذا خسرناهم")}</h4>
        {reasons.length === 0 ? <p className="p-4 text-ink-muted">{t("No lost prospects yet.", "لا توجد خسائر بعد.")}</p> : (
          <ul className="divide-y divide-surface-2">{reasons.map(([r, n]) => <li key={r} className="p-2.5 flex justify-between gap-3"><span className="text-ink">{r}</span><span className="font-bold">{n}</span></li>)}</ul>
        )}
      </section>
      <section className={card}>
        <h4 className="p-3 font-bold text-ink border-b border-border">{t("Gone quiet (no contact for 7+ days)", "ساكتون (بدون تواصل منذ 7 أيام أو أكثر)")}</h4>
        {quiet.length === 0 ? <p className="p-4 text-ink-muted">{t("Everyone has been contacted recently.", "تم التواصل مع الجميع مؤخرًا.")}</p> : (
          <ul className="divide-y divide-surface-2 max-h-64 overflow-y-auto">{quiet.map(p => <li key={p.id}><button type="button" onClick={() => onOpen(p.id)} className="w-full text-start p-2.5 flex justify-between gap-3 hover:bg-surface-2 cursor-pointer"><span className="font-semibold text-ink">{p.name}</span><span className="text-ink-muted">{(p.lastContactAt || p.createdAt).slice(0, 10)}</span></button></li>)}</ul>
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------------------------------------------------

const select = "w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm";
function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="block text-xs font-semibold text-ink-muted">{text}</span>{children}</label>;
}

function ProspectForm({ isRtl, t, data, initial, currentUserId, onClose, onSave }: {
  isRtl: boolean; t: T; data: Overview; initial: ProspectRow | null; currentUserId: string;
  onClose: () => void; onSave: (payload: Record<string, unknown>, allowDuplicate: boolean) => Promise<void>;
}) {
  const [f, setF] = useState({
    name: initial?.name || "", company: initial?.company || "", kind: (initial?.kind || "AGENCY") as ProspectKind,
    email: initial?.email || "", phone: initial?.phone || "", whatsapp: initial?.whatsapp || "",
    source: (initial?.source || "COLD_OUTREACH") as ProspectSource, interestedPlanId: initial?.interestedPlanId || "",
    expectedMonthly: initial?.expectedMonthly !== undefined ? String(initial.expectedMonthly) : "",
    nextFollowUp: initial?.nextFollowUp || "", followUpNote: initial?.followUpNote || "", notes: initial?.notes || "",
    ownerId: initial?.ownerId || currentUserId
  });
  const [err, setErr] = useState("");
  const [dup, setDup] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  // choosing a plan fills the monthly value if it is still empty
  const pickPlan = (id: string) => {
    const plan = data.plans.find(p => p.id === id);
    setF({ ...f, interestedPlanId: id, expectedMonthly: f.expectedMonthly === "" && plan ? String(plan.priceMonthly) : f.expectedMonthly });
  };
  const submit = async (allowDup = false) => {
    setBusy(true); setErr("");
    try {
      await onSave({ ...f, expectedMonthly: f.expectedMonthly === "" ? undefined : Number(f.expectedMonthly), ...(initial ? {} : { ownerId: f.ownerId }) }, allowDup);
    } catch (e: any) {
      if (e.status === 409) { setDup(true); setErr(e.message); } else setErr(e.message);
    } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="lg" title={initial ? t("Edit prospect", "تعديل العميل المحتمل") : t("Add prospect", "إضافة عميل محتمل")}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>{t("Cancel", "إلغاء")}</Button><Button loading={busy} onClick={() => submit(dup)}>{dup ? t("Add anyway", "أضف رغم ذلك") : t("Save", "حفظ")}</Button></div>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Label text={t("Name *", "الاسم *")}><Input value={f.name} onChange={set("name")} autoFocus /></Label>
        <Label text={t("Company / agency", "الشركة / المكتب")}><Input value={f.company} onChange={set("company")} /></Label>
        <Label text={t("Type", "النوع")}><select value={f.kind} onChange={set("kind")} className={select}>{PROSPECT_KINDS.map(k => <option key={k} value={k}>{isRtl ? KIND_TEXT[k].ar : KIND_TEXT[k].en}</option>)}</select></Label>
        <Label text={t("Where did they come from?", "من أين جاء؟")}><select value={f.source} onChange={set("source")} className={select}>{PROSPECT_SOURCES.map(k => <option key={k} value={k}>{isRtl ? SOURCE_TEXT[k].ar : SOURCE_TEXT[k].en}</option>)}</select></Label>
        <Label text={t("Email", "الإيميل")}><Input type="email" dir="ltr" value={f.email} onChange={set("email")} /></Label>
        <Label text={t("Phone", "الجوال")}><Input dir="ltr" value={f.phone} onChange={set("phone")} /></Label>
        <Label text="WhatsApp"><Input dir="ltr" value={f.whatsapp} onChange={set("whatsapp")} /></Label>
        <Label text={t("Plan they are interested in", "الباقة المهتم بها")}><select value={f.interestedPlanId} onChange={e => pickPlan(e.target.value)} className={select}><option value="">—</option>{data.plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.priceMonthly} QAR/mo)</option>)}</select></Label>
        <Label text={t("Expected QAR per month", "المتوقع بالريال شهريًا")}><Input type="number" min={0} dir="ltr" value={f.expectedMonthly} onChange={set("expectedMonthly")} /></Label>
        <Label text={t("Owner (gets the reminders)", "المسؤول (تصله التذكيرات)")}><select value={f.ownerId} onChange={set("ownerId")} className={select} disabled={!!initial}>{data.owners.map(o => <option key={o.id} value={o.id}>{o.fullName}</option>)}</select></Label>
        <Label text={t("Next follow-up", "موعد المتابعة القادم")}><Input type="date" dir="ltr" value={f.nextFollowUp} onChange={set("nextFollowUp")} /></Label>
        <Label text={t("What to do at the follow-up", "ما المطلوب في المتابعة")}><Input value={f.followUpNote} onChange={set("followUpNote")} placeholder={t("e.g. send the offer", "مثال: إرسال العرض")} /></Label>
        <div className="sm:col-span-2"><Label text={t("Notes", "ملاحظات")}><textarea value={f.notes} onChange={set("notes")} rows={3} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm" /></Label></div>
      </div>
      {err && <p role="alert" className="mt-3 text-xs text-danger">{err}</p>}
    </Modal>
  );
}

const ACTIVITY_ICON: Record<string, string> = { created: "＋", note: "✎", call: "☎", whatsapp: "💬", email: "✉", meeting: "👥", stage: "➜", followup: "⏰", edit: "✎" };

function ProspectDetail({ p, isRtl, t, data, today, onClose, onEdit, onDelete, onMove, onSetFollowUp, onOwner, onLog }: {
  p: ProspectRow; isRtl: boolean; t: T; data: Overview; today: string; onClose: () => void; onEdit: () => void; onDelete: () => void;
  onMove: (p: ProspectRow, s: ProspectStage) => void; onSetFollowUp: (p: ProspectRow, date: string) => void;
  onOwner: (id: string) => void; onLog: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [type, setType] = useState("call");
  const [text, setText] = useState("");
  const [next, setNext] = useState("");
  const [nextNote, setNextNote] = useState("");
  const [busy, setBusy] = useState(false);
  const plan = data.plans.find(x => x.id === p.interestedPlanId);
  const typeLabels: Record<string, [string, string]> = { call: ["Call", "اتصال"], whatsapp: ["WhatsApp", "واتساب"], email: ["Email", "إيميل"], meeting: ["Meeting", "اجتماع"], note: ["Note", "ملاحظة"] };
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await onLog({ type, text, ...(next ? { nextFollowUp: next, followUpNote: nextNote } : {}) });
    setBusy(false);
    if (ok) { setText(""); setNext(""); setNextNote(""); }
  };
  const activity: ProspectActivity[] = [...(p.activity || [])].reverse();
  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="xl" title={<span className="flex items-center gap-2 flex-wrap">{p.name}<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-soft text-gold-active">{isRtl ? STAGE_TEXT[p.stage].ar : STAGE_TEXT[p.stage].en}</span></span>}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 text-xs" data-testid="prospect-detail">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <ContactLinks p={p} />
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" leftIcon={<Pencil size={12} />} onClick={onEdit}>{t("Edit", "تعديل")}</Button>
              <Button size="sm" variant="ghost" leftIcon={<Trash2 size={12} />} onClick={onDelete}>{t("Delete", "حذف")}</Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <Fact label={t("Company", "الشركة")} value={p.company} />
            <Fact label={t("Type", "النوع")} value={isRtl ? KIND_TEXT[p.kind].ar : KIND_TEXT[p.kind].en} />
            <Fact label={t("Email", "الإيميل")} value={p.email} ltr />
            <Fact label={t("Phone", "الجوال")} value={p.phone} ltr />
            <Fact label="WhatsApp" value={p.whatsapp} ltr />
            <Fact label={t("Source", "المصدر")} value={isRtl ? SOURCE_TEXT[p.source].ar : SOURCE_TEXT[p.source].en} />
            <Fact label={t("Plan interest", "الباقة")} value={plan?.name} />
            <Fact label={t("Expected / month", "المتوقع شهريًا")} value={p.expectedMonthly ? money(p.expectedMonthly, isRtl) : undefined} />
            <Fact label={t("Added", "أُضيف")} value={`${p.createdAt.slice(0, 10)} · ${p.createdBy}`} />
            <Fact label={t("Last contact", "آخر تواصل")} value={p.lastContactAt?.slice(0, 10)} />
          </dl>
          {p.stage === "LOST" && p.lostReason && <p className="p-2.5 rounded-lg bg-danger-soft text-danger"><strong>{t("Lost: ", "السبب: ")}</strong>{p.lostReason}</p>}
          {p.notes && <p className="p-2.5 rounded-lg bg-canvas border border-border whitespace-pre-wrap text-ink">{p.notes}</p>}
          {p.signedUp && (
            <div className="p-3 rounded-lg bg-success-soft text-success space-y-0.5">
              <p className="font-bold flex items-center gap-1.5"><UserCheck size={13} />{t("Already has an account on the site", "لديه حساب في الموقع")}</p>
              <p className="text-ink">{p.signedUp.name} · {p.signedUp.role} · {t("registered", "سجّل في")} {p.signedUp.registeredAt.slice(0, 10)}</p>
              <p className="text-ink">{t("Application", "الطلب")}: {p.signedUp.applicationStatus} · {t("Verification", "التوثيق")}: {p.signedUp.verificationStatus} · {t("Subscription", "الاشتراك")}: {p.signedUp.subscriptionStatus ? `${p.signedUp.planName || ""} ${p.signedUp.subscriptionStatus}` : t("none yet", "لا يوجد بعد")}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Label text={t("Stage", "المرحلة")}>
              <select value={p.stage} onChange={e => onMove(p, e.target.value as ProspectStage)} className={select}>{PROSPECT_STAGES.map(s => <option key={s} value={s}>{isRtl ? STAGE_TEXT[s].ar : STAGE_TEXT[s].en}</option>)}</select>
            </Label>
            <Label text={t("Owner", "المسؤول")}>
              <select value={p.ownerId} onChange={e => onOwner(e.target.value)} className={select}>{data.owners.map(o => <option key={o.id} value={o.id}>{o.fullName}</option>)}</select>
            </Label>
          </div>
          {isOpenProspect(p) && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-ink-muted">{t("Next follow-up (reminded by email)", "المتابعة القادمة (تذكير بالإيميل)")}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Input type="date" dir="ltr" value={p.nextFollowUp || ""} onChange={e => onSetFollowUp(p, e.target.value)} className="!w-auto" />
                {[[1, t("Tomorrow", "غدًا")], [3, t("In 3 days", "بعد 3 أيام")], [7, t("In a week", "بعد أسبوع")]].map(([d, label]) => (
                  <button key={String(d)} type="button" onClick={() => onSetFollowUp(p, addDaysToDate(today, d as number))} className="px-2 py-2 rounded-lg bg-surface-2 border border-border text-[10px] font-bold hover:bg-border cursor-pointer">{label}</button>
                ))}
              </div>
              {p.followUpNote && <p className="text-ink-muted">{p.followUpNote}</p>}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="p-3 rounded-xl border border-border bg-canvas space-y-2.5">
            <p className="font-bold text-ink">{t("Log what happened", "سجّل ما حدث")}</p>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(typeLabels).map(([k, [en, ar]]) => (
                <button key={k} type="button" onClick={() => setType(k)} aria-pressed={type === k}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${type === k ? "bg-chrome text-white border-chrome" : "bg-surface text-ink border-border hover:bg-surface-2"}`}>{isRtl ? ar : en}</button>
              ))}
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder={t("What was said or agreed?", "ماذا قيل أو اتُّفق عليه؟")} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Label text={t("Next follow-up (optional)", "المتابعة القادمة (اختياري)")}><Input type="date" dir="ltr" value={next} onChange={e => setNext(e.target.value)} /></Label>
              <Label text={t("What to do then", "ما المطلوب حينها")}><Input value={nextNote} onChange={e => setNextNote(e.target.value)} disabled={!next} /></Label>
            </div>
            <div className="flex justify-end"><Button size="sm" loading={busy} disabled={!text.trim()} onClick={submit}>{t("Save to history", "حفظ في السجل")}</Button></div>
          </div>
          <div>
            <p className="font-bold text-ink mb-2">{t("History", "السجل")}</p>
            <ol className="space-y-2 max-h-80 overflow-y-auto pe-1" data-testid="prospect-history">
              {activity.map(a => (
                <li key={a.id} className="flex gap-2.5">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-surface-2 flex items-center justify-center text-[11px]" aria-hidden>{ACTIVITY_ICON[a.type] || "•"}</span>
                  <div className="min-w-0"><p className="text-ink whitespace-pre-wrap break-words">{a.text}</p><p className="text-[10px] text-ink-muted">{a.by} · {a.at.slice(0, 16).replace("T", " ")}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Fact({ label, value, ltr }: { label: string; value?: string; ltr?: boolean }) {
  return <div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</dt><dd className="text-ink break-words">{value ? (ltr ? <bdi dir="ltr">{value}</bdi> : value) : "—"}</dd></div>;
}

function LostModal({ p, t, isRtl, onClose, onConfirm }: { p: ProspectRow; t: T; isRtl: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const presets = [t("Too expensive", "السعر مرتفع"), t("Using a competitor", "يستخدم منافسًا"), t("Not interested", "غير مهتم"), t("No reply", "لا يرد"), t("Closed their business", "أغلق عمله")];
  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="sm" title={t(`Why did we lose ${p.name}?`, `لماذا خسرنا ${p.name}؟`)}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>{t("Cancel", "إلغاء")}</Button><Button disabled={!reason.trim()} onClick={() => onConfirm(reason)}>{t("Mark as lost", "تسجيل كخسارة")}</Button></div>}>
      <div className="space-y-3 text-xs">
        <div className="flex gap-1.5 flex-wrap">{presets.map(x => <button key={x} type="button" onClick={() => setReason(x)} className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border font-bold hover:bg-border cursor-pointer">{x}</button>)}</div>
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t("Reason (required)", "السبب (مطلوب)")} autoFocus />
      </div>
    </Modal>
  );
}

function ImportModal({ t, isRtl, onClose, onImport }: {
  t: T; isRtl: boolean; onClose: () => void;
  onImport: (rows: Record<string, unknown>[]) => Promise<{ added: number; skipped: { row: number; name: string; reason: string }[] }>;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [recognised, setRecognised] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: { row: number; name: string; reason: string }[] } | null>(null);
  const onFile = async (file?: File) => {
    if (!file) return;
    setErr(""); setRows(null); setResult(null);
    const parsed = parseProspectsCsv(await file.text());
    if (parsed.error) { setErr(parsed.error); return; }
    setRows(parsed.prospects); setRecognised(parsed.recognised);
  };
  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="md" title={t("Import a list", "استيراد قائمة")}
      footer={<div className="flex gap-2 justify-end"><Button variant="ghost" onClick={onClose}>{result ? t("Close", "إغلاق") : t("Cancel", "إلغاء")}</Button>
        {!result && <Button loading={busy} disabled={!rows || rows.length === 0} onClick={async () => { setBusy(true); try { setResult(await onImport(rows!)); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}>{t("Import", "استيراد")}</Button>}</div>}>
      <div className="space-y-3 text-xs">
        <p className="text-ink-muted">{t("Upload a CSV file (save your Excel sheet as CSV). The first row must have headers such as Name, Company, Phone, Email, Source, Notes. Arabic headers work too.", "ارفع ملف CSV (احفظ ملف إكسل بصيغة CSV). يجب أن يحتوي الصف الأول على عناوين مثل: الاسم، الشركة، الجوال، الإيميل، المصدر، ملاحظات. العناوين العربية مقبولة أيضًا.")}</p>
        <input type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} className="block w-full text-xs" aria-label={t("CSV file", "ملف CSV")} />
        {err && <p role="alert" className="text-danger">{err}</p>}
        {rows && !result && <p className="p-2.5 rounded-lg bg-canvas border border-border">{t(`${rows.length} row(s) found. Understood columns: ${recognised.join(", ")}.`, `تم العثور على ${rows.length} صف. الأعمدة المفهومة: ${recognised.join("، ")}.`)}</p>}
        {result && (
          <div className="space-y-2">
            <p className="p-2.5 rounded-lg bg-success-soft text-success font-bold">{t(`${result.added} added.`, `تمت إضافة ${result.added}.`)}</p>
            {result.skipped.length > 0 && (
              <div className="p-2.5 rounded-lg bg-canvas border border-border max-h-40 overflow-y-auto space-y-1">
                <p className="font-bold text-ink">{t(`${result.skipped.length} skipped:`, `تم تخطي ${result.skipped.length}:`)}</p>
                {result.skipped.map((s, i) => <p key={i} className="text-ink-muted">{t("Row", "الصف")} {s.row}{s.name ? ` (${s.name})` : ""}: {s.reason}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

