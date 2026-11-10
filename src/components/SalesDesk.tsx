/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The Sales Desk: where an agent (or an agency/developer admin, for the whole team) works their
// clients day to day - a pipeline board, follow-ups with email reminders, a viewing agenda, a
// ledger of closed deals with their commission, and CSV reports. All data comes from one
// endpoint (GET /api/crm/overview), which is already limited to what the signed-in person may
// see; every action calls the server, which re-checks ownership.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing, Banknote, CalendarClock, CalendarPlus, Check, Clock, Download, FileDown, LayoutGrid, ListChecks, MessageCircle,
  Pencil, Phone, Plus, RefreshCw, Search, Trash2, TrendingUp, Upload, UserPlus, Users, X
} from "lucide-react";
import { LeadStatus } from "../types.js";
import { BOARD_COLUMNS, LEAD_SOURCES, LEAD_SOURCE_TEXT, addDaysToDate, columnForStatus, isClosedStatus, isOpenLead, monthlySummary, phoneKey, qatarDate, taskReminderTime } from "../lib/crm.js";
import type { SnoozeKind } from "../lib/crm.js";
import { DESK_TAB_EVENT, takePendingDeskTab } from "../lib/tour.js";
import { Button } from "./ui/Button.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Spinner } from "./ui/Spinner.js";
import { Input } from "./ui/FormField.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import {
  DeskDeal, DeskLead, DeskOverview, DeskTask, DeskViewing, STAGE_ACCENT, STAGE_TEXT, T, VIEWING_STATUS_TEXT,
  ago, deskApi, downloadCsv, fmtDate, fmtDay, fmtFullDay, fmtMoney, followUpDay, leadPhone, sourceLabel, waLink
} from "./salesdesk/shared.js";
import { DealForm, DealModal, FollowUpModal, LostModal, ViewingModal } from "./salesdesk/Modals.js";
import { ClientDetailModal, ClientForm, ClientModal, ImportModal } from "./salesdesk/ClientModals.js";
import { TaskForm, TaskModal } from "./salesdesk/TaskModal.js";
import { TasksView, pendingRenewals } from "./salesdesk/TasksView.js";

type DeskTab = "pipeline" | "followups" | "viewings" | "tasks" | "deals" | "reports";

export default function SalesDesk({ isRtl }: { isRtl: boolean }) {
  const t: T = useCallback((en, ar) => (isRtl ? ar : en), [isRtl]);
  const [data, setData] = useState<DeskOverview | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<DeskTab>("pipeline");
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const [followUpLead, setFollowUpLead] = useState<DeskLead | null>(null);
  const [lostLead, setLostLead] = useState<DeskLead | null>(null);
  const [dealCtx, setDealCtx] = useState<{ lead: DeskLead | null; deal: DeskDeal | null; fromWon: boolean; renewing?: DeskDeal | null } | null>(null);
  const [viewingCtx, setViewingCtx] = useState<{ viewing: DeskViewing | null; presetLeadId?: string } | null>(null);
  const [deleteDeal, setDeleteDeal] = useState<DeskDeal | null>(null);
  const [clientCtx, setClientCtx] = useState<{ client: DeskLead | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteClient, setDeleteClient] = useState<DeskLead | null>(null);
  const [taskCtx, setTaskCtx] = useState<{ task: DeskTask | null; presetLeadId?: string } | null>(null);
  const [deleteTask, setDeleteTask] = useState<DeskTask | null>(null);
  const [dupWarning, setDupWarning] = useState<{ form: ClientForm; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const say = (text: string, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), 4000);
  };

  const reload = useCallback(async () => {
    try {
      setData(await deskApi<DeskOverview>("/api/crm/overview"));
      setError("");
    } catch (e: any) {
      setError(e?.message || "Could not load the Sales Desk.");
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // The guided tour can ask the desk to open a specific tab so it can point at it.
  useEffect(() => {
    const first = takePendingDeskTab(); // asked for before this screen finished mounting
    if (first) setTab(first);
    const open = (e: Event) => {
      const wanted = takePendingDeskTab() ?? (e as CustomEvent<DeskTab>).detail;
      if (wanted) setTab(wanted);
    };
    window.addEventListener(DESK_TAB_EVENT, open);
    return () => window.removeEventListener(DESK_TAB_EVENT, open);
  }, []);

  // Run an action, then refresh; show a message either way.
  const act = async (fn: () => Promise<unknown>, okText: string) => {
    try {
      await fn();
      await reload();
      say(okText);
    } catch (e: any) {
      say(e?.message || t("Something went wrong.", "حدث خطأ ما."), true);
      throw e;
    }
  };

  const today = qatarDate(Date.now());
  const openLeads = useMemo(() => (data?.leads || []).filter(isOpenLead), [data]);

  // ---- actions --------------------------------------------------------------------------------
  const moveLead = (lead: DeskLead, status: LeadStatus) => {
    if (columnForStatus(lead.status) === status) return;
    if (status === LeadStatus.CONVERTED) return setDealCtx({ lead, deal: null, fromWon: true });
    if (status === LeadStatus.LOST) return setLostLead(lead);
    act(() => deskApi("/api/leads/status", { method: "POST", body: JSON.stringify({ leadId: lead.id, status }) }),
      t("Moved to ", "تم النقل إلى ") + (isRtl ? STAGE_TEXT[status].ar : STAGE_TEXT[status].en)).catch(() => {});
  };

  const saveDeal = async (form: DealForm, existing: DeskDeal | null) => {
    if (existing) {
      await deskApi(`/api/deals/${existing.id}`, { method: "PATCH", body: JSON.stringify({
        propertyTitle: form.propertyTitle, clientName: form.clientName, dealType: form.dealType, dealValue: form.dealValue,
        commissionRate: form.commissionRate, commissionAmount: form.commissionAmount, closedDate: form.closedDate,
        commissionStatus: form.commissionStatus, notes: form.notes, contractEndDate: form.contractEndDate ?? null
      }) });
    } else {
      await deskApi("/api/deals", { method: "POST", body: JSON.stringify(form) });
    }
    setDealCtx(null);
    await reload();
    say(existing ? t("Deal updated.", "تم تحديث الصفقة.") : t("Deal recorded - congratulations!", "تم تسجيل الصفقة - مبروك!"));
  };

  const saveTask = async (form: TaskForm, existing: DeskTask | null) => {
    if (existing) {
      await deskApi(`/api/tasks/${existing.id}`, { method: "PATCH", body: JSON.stringify({
        title: form.title, dueDate: form.dueDate, dueTime: form.dueTime, notes: form.notes
      }) });
    } else {
      await deskApi("/api/tasks", { method: "POST", body: JSON.stringify({
        title: form.title, dueDate: form.dueDate, dueTime: form.dueTime, notes: form.notes,
        leadId: form.leadId || undefined, agentId: form.agentId || undefined
      }) });
    }
    setTaskCtx(null);
    await reload();
    say(existing ? t("Task updated.", "تم تحديث المهمة.") : t("Task added - we'll email you when it's time.", "تمت إضافة المهمة - سنرسل لك إيميلاً في موعدها."));
  };

  const sendClient = async (form: ClientForm, existing: DeskLead | null, allowDuplicate = false) => {
    const body = {
      name: form.name, phone: form.phone, whatsapp: form.whatsapp, email: form.email, source: form.source,
      interest: form.interest, budget: form.budget === "" ? undefined : Number(form.budget), propertyId: form.propertyId || undefined
    };
    if (existing) {
      await deskApi(`/api/crm/clients/${existing.id}`, { method: "PATCH", body: JSON.stringify({ ...body, propertyId: form.propertyId || null, budget: form.budget === "" ? null : Number(form.budget) }) });
    } else {
      await deskApi("/api/crm/clients", { method: "POST", body: JSON.stringify({
        ...body, status: form.status, nextFollowUpDate: form.nextFollowUpDate || undefined, notes: form.notes,
        agentId: form.agentId || undefined, allowDuplicate
      }) });
    }
    setClientCtx(null);
    setDupWarning(null);
    await reload();
    say(existing ? t("Client updated.", "تم تحديث العميل.") : t("Client added.", "تمت إضافة العميل."));
  };

  // The server refuses a number the agent already has; ask before adding a second copy.
  const saveClient = async (form: ClientForm, existing: DeskLead | null) => {
    try {
      await sendClient(form, existing);
    } catch (e: any) {
      if (e?.status === 409 && e.body?.duplicate) {
        setDupWarning({ form, name: e.body.duplicate.name });
        return;
      }
      throw e;
    }
  };

  const importClients = async (clients: Record<string, unknown>[], agentId: string) => {
    const r = await deskApi<{ created: number; skipped: { row: number; name: string; reason: string }[] }>("/api/crm/clients/import", {
      method: "POST", body: JSON.stringify({ clients, agentId: agentId || undefined })
    });
    await reload();
    return r;
  };

  if (!data) {
    return error
      ? <EmptyState title={t("Could not load the Sales Desk", "تعذر تحميل مكتب المبيعات")} description={error}
          action={<Button size="sm" onClick={reload}>{t("Try again", "حاول مجدداً")}</Button>} />
      : <div className="py-20 flex justify-center"><Spinner /></div>;
  }

  // ---- numbers for the strip ------------------------------------------------------------------
  const dueCount = openLeads.filter(l => { const d = followUpDay(l); return d && d <= today; }).length;
  const tasksDueCount = data.tasks.filter(x => x.status === "OPEN" && qatarDate(taskReminderTime(x)) <= today).length;
  const renewalsSoonCount = pendingRenewals(data.deals, today).filter(r => r.daysLeft <= 30).length;
  const week = addDaysToDate(today, 7);
  const viewingsThisWeek = data.viewings.filter(v => v.status === "CONFIRMED" && v.preferredDate >= today && v.preferredDate <= week).length;
  const liveDeals = data.deals.filter(d => d.status !== "CANCELLED");
  const expected = liveDeals.filter(d => d.commissionStatus === "EXPECTED").reduce((s, d) => s + d.commissionAmount, 0);

  const TABS: { id: DeskTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "pipeline", label: t("Pipeline", "مسار البيع"), icon: <LayoutGrid size={14} /> },
    { id: "followups", label: t("Follow-ups", "المتابعات"), icon: <BellRing size={14} />, badge: dueCount },
    { id: "viewings", label: t("Viewings", "المعاينات"), icon: <CalendarClock size={14} /> },
    { id: "tasks", label: t("Tasks & renewals", "المهام والتجديدات"), icon: <ListChecks size={14} />, badge: tasksDueCount + renewalsSoonCount },
    { id: "deals", label: t("Deals & commission", "الصفقات والعمولات"), icon: <Banknote size={14} /> },
    { id: "reports", label: t("Reports", "التقارير"), icon: <FileDown size={14} /> }
  ];

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <TrendingUp size={18} className="text-gold" />
            {t("Sales Desk", "مكتب المبيعات")}
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {data.isOrgAdmin
              ? t("Your whole team's clients, viewings and deals in one place.", "عملاء فريقك ومعايناته وصفقاته في مكان واحد.")
              : t("Your clients, viewings and deals in one place.", "عملاؤك ومعايناتك وصفقاتك في مكان واحد.")}
          </p>
          {data.reminderEmail && (
            <p className="text-[11px] text-ink-muted mt-0.5">
              {t("Reminders are emailed to ", "تُرسل التذكيرات بالإيميل إلى ")}<bdi dir="ltr" className="font-semibold text-ink">{data.reminderEmail}</bdi>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label data-tour="desk-reminders" className="flex items-center gap-2 text-xs font-semibold text-ink-muted cursor-pointer select-none" title={t("Daily follow-up and viewing reminder emails", "إيميلات تذكير بالمتابعة والمعاينات")}>
            <BellRing size={14} className={data.settings.followUpRemindersEnabled ? "text-gold" : ""} />
            {t("Reminder emails", "إيميلات التذكير")}
            <input
              type="checkbox"
              role="switch"
              checked={data.settings.followUpRemindersEnabled}
              onChange={e => act(
                () => deskApi("/api/crm/settings", { method: "PATCH", body: JSON.stringify({ followUpRemindersEnabled: e.target.checked }) }),
                e.target.checked ? t("Reminder emails are on.", "إيميلات التذكير مفعّلة.") : t("Reminder emails are off.", "تم إيقاف إيميلات التذكير.")
              ).catch(() => {})}
              className="accent-gold w-4 h-4"
            />
          </label>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} />} onClick={reload}>{t("Refresh", "تحديث")}</Button>
          <span data-tour="desk-clients" className="inline-flex items-center gap-2">
            <Button variant="outline" size="sm" leftIcon={<Upload size={13} />} onClick={() => setImportOpen(true)}>{t("Import list", "استيراد قائمة")}</Button>
            <Button size="sm" leftIcon={<UserPlus size={14} />} onClick={() => setClientCtx({ client: null })}>{t("Add client", "إضافة عميل")}</Button>
          </span>
        </div>
      </div>

      {/* strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t("Open clients", "عملاء مفتوحون")} value={String(openLeads.length)} icon={<Users size={15} />} />
        <Kpi label={t("Follow-ups due", "متابعات مستحقة")} value={String(dueCount)} icon={<BellRing size={15} />} warn={dueCount > 0} onClick={() => setTab("followups")} />
        <Kpi label={t("Viewings this week", "معاينات هذا الأسبوع")} value={String(viewingsThisWeek)} icon={<CalendarClock size={15} />} onClick={() => setTab("viewings")} />
        <Kpi label={t("Commission expected", "عمولات متوقعة")} value={fmtMoney(expected, isRtl)} icon={<Banknote size={15} />} onClick={() => setTab("deals")} />
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-border" role="tablist">
        {TABS.map(x => (
          <button
            key={x.id}
            role="tab"
            data-tour={`desk-tab-${x.id}`}
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 -mb-px cursor-pointer transition-colors ${
              tab === x.id ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {x.icon}{x.label}
            {!!x.badge && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] leading-[18px] text-center">{x.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "pipeline" && (
        <PipelineBoard leads={data.leads.filter(l => !l.isArchived)} isRtl={isRtl} t={t} showAgent={data.isOrgAdmin} today={today}
          search={search} onSearch={setSearch} sourceFilter={sourceFilter} onSourceFilter={setSourceFilter}
          onAdd={() => setClientCtx({ client: null })} onImport={() => setImportOpen(true)} onOpen={l => setDetailId(l.id)}
          onMove={moveLead} onFollowUp={setFollowUpLead} onSchedule={l => setViewingCtx({ viewing: null, presetLeadId: l.id })} />
      )}
      {tab === "followups" && (
        <FollowUps leads={openLeads} isRtl={isRtl} t={t} today={today} showAgent={data.isOrgAdmin}
          onSet={setFollowUpLead}
          onQuick={(l, days) => act(() => deskApi(`/api/leads/${l.id}/follow-up`, { method: "PATCH", body: JSON.stringify({ nextFollowUpDate: addDaysToDate(today, days) }) }),
            t("Follow-up rescheduled.", "تمت إعادة جدولة المتابعة.")).catch(() => {})}
          onMove={moveLead} />
      )}
      {tab === "viewings" && (
        <Viewings viewings={data.viewings} isRtl={isRtl} t={t} today={today} showAgent={data.isOrgAdmin}
          onNew={() => setViewingCtx({ viewing: null })} onReschedule={v => setViewingCtx({ viewing: v })}
          onStatus={(v, status) => act(() => deskApi("/api/viewings/status", { method: "POST", body: JSON.stringify({ viewingId: v.id, status }) }),
            t("Viewing updated.", "تم تحديث المعاينة.")).catch(() => {})} />
      )}
      {tab === "tasks" && (
        <TasksView tasks={data.tasks} deals={data.deals} leads={data.leads} isRtl={isRtl} t={t} today={today} showAgent={data.isOrgAdmin} canEdit={data.canEditDeals}
          onAdd={() => setTaskCtx({ task: null })} onEdit={x => setTaskCtx({ task: x })}
          onToggleDone={x => act(() => deskApi(`/api/tasks/${x.id}`, { method: "PATCH", body: JSON.stringify({ status: x.status === "DONE" ? "OPEN" : "DONE" }) }),
            x.status === "DONE" ? t("Task reopened.", "أُعيد فتح المهمة.") : t("Done - nice work.", "تم - عمل رائع.")).catch(() => {})}
          onSnooze={(x: DeskTask, kind: SnoozeKind) => act(() => deskApi(`/api/tasks/${x.id}`, { method: "PATCH", body: JSON.stringify({ snooze: kind }) }),
            t("Snoozed - we'll remind you then.", "تم التأجيل - سنذكّرك في الموعد الجديد.")).catch(() => {})}
          onDelete={setDeleteTask} onOpenLead={setDetailId}
          onRenewed={d => setDealCtx({ lead: null, deal: null, fromWon: false, renewing: d })}
          onNotRenewing={d => act(() => deskApi(`/api/deals/${d.id}`, { method: "PATCH", body: JSON.stringify({ renewalStatus: "NOT_RENEWING" }) }),
            t("Noted - no more reminders for this lease.", "تم - لن نذكّرك بهذا العقد بعد الآن.")).catch(() => {})}
          onEditDeal={d => setDealCtx({ lead: null, deal: d, fromWon: false })} />
      )}
      {tab === "deals" && (
        <Deals deals={data.deals} isRtl={isRtl} t={t} canEdit={data.canEditDeals} showAgent={data.isOrgAdmin}
          onNew={() => setDealCtx({ lead: null, deal: null, fromWon: false })} onEdit={d => setDealCtx({ lead: null, deal: d, fromWon: false })}
          onReceived={d => act(() => deskApi(`/api/deals/${d.id}`, { method: "PATCH", body: JSON.stringify({ commissionStatus: "RECEIVED" }) }), t("Commission marked as received.", "تم تسجيل العمولة كمستلمة.")).catch(() => {})}
          onCancel={d => act(() => deskApi(`/api/deals/${d.id}`, { method: "PATCH", body: JSON.stringify({ status: d.status === "CANCELLED" ? "CLOSED" : "CANCELLED" }) }), t("Deal updated.", "تم تحديث الصفقة.")).catch(() => {})}
          onDelete={setDeleteDeal} />
      )}
      {tab === "reports" && <Reports deals={data.deals} leads={data.leads} isRtl={isRtl} t={t} onError={m => say(m, true)} />}

      {/* dialogs */}
      <ClientDetailModal
        lead={data.leads.find(l => l.id === detailId) || null}
        viewings={data.viewings}
        showAgent={data.isOrgAdmin}
        isRtl={isRtl}
        t={t}
        onClose={() => setDetailId(null)}
        onMove={moveLead}
        onAddNote={async (l, text) => { await act(() => deskApi(`/api/leads/${l.id}/notes`, { method: "POST", body: JSON.stringify({ text }) }), t("Note added.", "تمت إضافة الملاحظة.")); }}
        onFollowUp={setFollowUpLead}
        onSchedule={l => setViewingCtx({ viewing: null, presetLeadId: l.id })}
        onAddTask={l => setTaskCtx({ task: null, presetLeadId: l.id })}
        onEdit={l => setClientCtx({ client: l })}
        onArchive={l => { setDetailId(null); act(() => deskApi(`/api/leads/${l.id}/archive`, { method: "PATCH", body: JSON.stringify({ isArchived: true }) }), t("Client archived.", "تمت أرشفة العميل.")).catch(() => {}); }}
        onDelete={setDeleteClient}
      />
      <ClientModal open={!!clientCtx} client={clientCtx?.client || null} team={data.team} isOrgAdmin={data.isOrgAdmin}
        properties={data.properties} isRtl={isRtl} t={t} onClose={() => setClientCtx(null)} onSave={saveClient} />
      <ImportModal open={importOpen} team={data.team} isOrgAdmin={data.isOrgAdmin} isRtl={isRtl} t={t} onClose={() => setImportOpen(false)} onImport={importClients} />
      <ConfirmDialog
        open={!!dupWarning}
        title={t("You already have this number", "هذا الرقم موجود لديك")}
        description={t(`${dupWarning?.name} already has this phone number in your clients. Add another record anyway?`, `العميل ${dupWarning?.name} لديه هذا الرقم بالفعل. هل تريد إضافة سجل آخر؟`)}
        confirmLabel={t("Add anyway", "أضف على أي حال")}
        cancelLabel={t("Go back", "رجوع")}
        onCancel={() => setDupWarning(null)}
        onConfirm={async () => { const w = dupWarning!; try { await sendClient(w.form, null, true); } catch (e: any) { setDupWarning(null); say(e?.message || t("Could not save the client.", "تعذر حفظ العميل."), true); } }}
        isRtl={isRtl}
      />
      <ConfirmDialog
        open={!!deleteClient}
        title={t("Delete this client?", "حذف هذا العميل؟")}
        description={t("The client, their notes and their viewings are removed for good. Deals you recorded stay in your ledger.", "يُحذف العميل وملاحظاته ومعايناته نهائياً. أما الصفقات المسجلة فتبقى في سجلّك.")}
        confirmLabel={t("Delete", "حذف")}
        cancelLabel={t("Keep", "إبقاء")}
        tone="danger"
        onCancel={() => setDeleteClient(null)}
        onConfirm={async () => { const c = deleteClient!; setDeleteClient(null); setDetailId(null); await act(() => deskApi(`/api/crm/clients/${c.id}`, { method: "DELETE" }), t("Client deleted.", "تم حذف العميل.")).catch(() => {}); }}
        isRtl={isRtl}
      />
      <TaskModal open={!!taskCtx} task={taskCtx?.task || null} presetLeadId={taskCtx?.presetLeadId} leads={openLeads} team={data.team} isOrgAdmin={data.isOrgAdmin}
        isRtl={isRtl} t={t} onClose={() => setTaskCtx(null)} onSave={saveTask} />
      <ConfirmDialog
        open={!!deleteTask}
        title={t("Delete this task?", "حذف هذه المهمة؟")}
        description={deleteTask?.title}
        confirmLabel={t("Delete", "حذف")}
        cancelLabel={t("Keep it", "إبقاؤها")}
        tone="danger"
        onCancel={() => setDeleteTask(null)}
        onConfirm={async () => { const x = deleteTask!; setDeleteTask(null); await act(() => deskApi(`/api/tasks/${x.id}`, { method: "DELETE" }), t("Task deleted.", "تم حذف المهمة.")).catch(() => {}); }}
        isRtl={isRtl}
      />
      <FollowUpModal lead={followUpLead} isRtl={isRtl} t={t} onClose={() => setFollowUpLead(null)}
        onSave={async date => { const l = followUpLead!; await act(() => deskApi(`/api/leads/${l.id}/follow-up`, { method: "PATCH", body: JSON.stringify({ nextFollowUpDate: date }) }), date ? t("Follow-up saved.", "تم حفظ موعد المتابعة.") : t("Follow-up cleared.", "تمت إزالة موعد المتابعة.")); setFollowUpLead(null); }} />
      <LostModal lead={lostLead} isRtl={isRtl} t={t} onClose={() => setLostLead(null)}
        onSave={async reason => { const l = lostLead!; await act(() => deskApi("/api/leads/status", { method: "POST", body: JSON.stringify({ leadId: l.id, status: LeadStatus.LOST, lostReason: reason }) }), t("Marked as lost.", "تم تسجيلها كخسارة.")); setLostLead(null); }} />
      <DealModal open={!!dealCtx} lead={dealCtx?.lead || null} deal={dealCtx?.deal || null} renewing={dealCtx?.renewing || null} team={data.team} isOrgAdmin={data.isOrgAdmin}
        isRtl={isRtl} t={t} onClose={() => setDealCtx(null)} onSave={saveDeal}
        onWonOnly={dealCtx?.fromWon && dealCtx.lead ? async () => {
          const l = dealCtx.lead!;
          await act(() => deskApi("/api/leads/status", { method: "POST", body: JSON.stringify({ leadId: l.id, status: LeadStatus.CONVERTED }) }), t("Marked as won.", "تم تسجيلها كصفقة ناجحة."));
          setDealCtx(null);
        } : undefined} />
      <ViewingModal open={!!viewingCtx} viewing={viewingCtx?.viewing || null} presetLeadId={viewingCtx?.presetLeadId} leads={openLeads}
        isRtl={isRtl} t={t} onClose={() => setViewingCtx(null)}
        onSave={async v => {
          const existing = viewingCtx?.viewing;
          await act(() => existing
            ? deskApi(`/api/viewings/${existing.id}`, { method: "PATCH", body: JSON.stringify({ preferredDate: v.preferredDate, preferredTimeSlot: v.preferredTimeSlot, notes: v.notes }) })
            : deskApi("/api/viewings", { method: "POST", body: JSON.stringify(v) }),
            existing ? t("Viewing rescheduled.", "تمت إعادة جدولة المعاينة.") : t("Viewing scheduled - the client was emailed.", "تمت جدولة المعاينة - وصل العميلَ إيميل."));
          setViewingCtx(null);
        }} />
      <ConfirmDialog
        open={!!deleteDeal}
        title={t("Delete this deal?", "حذف هذه الصفقة؟")}
        description={t("It will be removed from your records and reports. If it was a mistake you can also just cancel it.", "ستُحذف من سجلاتك وتقاريرك. وإن كانت خطأً يمكنك إلغاؤها بدل الحذف.")}
        confirmLabel={t("Delete", "حذف")}
        cancelLabel={t("Keep it", "إبقاؤها")}
        tone="danger"
        onCancel={() => setDeleteDeal(null)}
        onConfirm={async () => { const d = deleteDeal!; setDeleteDeal(null); await act(() => deskApi(`/api/deals/${d.id}`, { method: "DELETE" }), t("Deal deleted.", "تم حذف الصفقة.")).catch(() => {}); }}
        isRtl={isRtl}
      />

      {toast && (
        <div role="status" className={`fixed bottom-20 md:bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[80] px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg ${toast.bad ? "bg-danger text-white" : "bg-chrome text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// small pieces
// ---------------------------------------------------------------------------------------------
function Kpi({ label, value, icon, warn, onClick }: { label: string; value: string; icon: React.ReactNode; warn?: boolean; onClick?: () => void }) {
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={`text-start bg-surface border rounded-xl p-3.5 ${warn ? "border-danger/40" : "border-border"} ${onClick ? "cursor-pointer hover:border-gold transition-colors" : ""}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${warn ? "text-danger" : "text-ink-muted"}`}>{icon}{label}</div>
      <div className="mt-1 font-serif text-xl font-semibold text-ink truncate">{value}</div>
    </Tag>
  );
}

function ContactRow({ lead, isRtl }: { lead: DeskLead; isRtl: boolean }) {
  const wa = waLink(leadPhone(lead), isRtl ? `مرحباً ${lead.visitorName}، بخصوص استفساركم العقاري.` : `Hello ${lead.visitorName}, regarding your property inquiry.`);
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold">
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900"><MessageCircle size={12} /><bdi dir="ltr">{lead.visitorPhone || "WhatsApp"}</bdi></a>}
      {lead.visitorPhone && <a href={`tel:${lead.visitorPhone}`} className="inline-flex items-center gap-1 text-ink hover:text-gold" aria-label="call"><Phone size={12} /></a>}
    </div>
  );
}

function FollowUpChip({ lead, today, isRtl, t, onClick }: { lead: DeskLead; today: string; isRtl: boolean; t: T; onClick: () => void }) {
  const day = followUpDay(lead);
  const late = !!day && day < today;
  const now = day === today;
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
        late ? "bg-danger-soft text-danger border-danger/30" : now ? "bg-warning-soft text-warning border-warning/30" : day ? "bg-surface-2 text-ink-muted border-border" : "border-dashed border-border text-ink-muted hover:border-gold hover:text-gold"
      }`}>
      <Clock size={10} />
      {day ? (late ? t("Overdue ", "متأخر ") : now ? t("Today", "اليوم") : "") + (now ? "" : fmtDay(day, isRtl)) : t("Set follow-up", "حدّد متابعة")}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------------------------
function PipelineBoard({ leads: allLeads, isRtl, t, showAgent, today, search, onSearch, sourceFilter, onSourceFilter, onAdd, onImport, onOpen, onMove, onFollowUp, onSchedule }: {
  leads: DeskLead[]; isRtl: boolean; t: T; showAgent: boolean; today: string;
  search: string; onSearch: (v: string) => void; sourceFilter: string; onSourceFilter: (v: string) => void;
  onAdd: () => void; onImport: () => void; onOpen: (l: DeskLead) => void;
  onMove: (l: DeskLead, s: LeadStatus) => void; onFollowUp: (l: DeskLead) => void; onSchedule: (l: DeskLead) => void;
}) {
  // search by name, phone (any spelling), email or what they are looking for; filter by where they came from
  const needle = search.trim().toLowerCase();
  const needleKey = phoneKey(search);
  const leads = allLeads.filter(l => {
    if (sourceFilter === "PLATFORM" && l.addedManually) return false;
    if (sourceFilter && sourceFilter !== "PLATFORM" && !(l.addedManually && (l.source || "OTHER") === sourceFilter)) return false;
    if (!needle) return true;
    return (
      l.visitorName.toLowerCase().includes(needle) ||
      (l.visitorEmail || "").toLowerCase().includes(needle) ||
      (l.interest || "").toLowerCase().includes(needle) ||
      (!!needleKey && [phoneKey(l.visitorPhone), phoneKey(l.visitorWhatsapp)].includes(needleKey)) ||
      (l.visitorPhone || "").replace(/\s/g, "").includes(needle.replace(/\s/g, ""))
    );
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  // won/lost columns only keep the last 30 days so the board does not grow forever
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const inColumn = (col: LeadStatus) =>
    leads
      .filter(l => columnForStatus(l.status) === col && (!isClosedStatus(col) || Date.parse(l.updatedDate) >= cutoff))
      .sort((a, b) => Date.parse(b.createdDate) - Date.parse(a.createdDate));

  if (allLeads.length === 0) {
    return <EmptyState icon={<Users size={20} />} title={t("No clients yet", "لا يوجد عملاء بعد")}
      description={t("Clients who ask about your listings appear here by themselves. Add everyone else - calls, walk-ins, referrals, your existing list - so your whole business lives in one place.", "العملاء الذين يستفسرون عن إعلاناتك يظهرون هنا تلقائياً. أضف بقية عملائك - اتصالات، زيارات، توصيات، قائمتك الحالية - ليصبح عملك كله في مكان واحد.")}
      action={<div className="flex gap-2 flex-wrap justify-center"><Button size="sm" leftIcon={<UserPlus size={14} />} onClick={onAdd}>{t("Add your first client", "أضف أول عميل")}</Button><Button variant="outline" size="sm" leftIcon={<Upload size={14} />} onClick={onImport}>{t("Import a list", "استيراد قائمة")}</Button></div>} />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-muted pointer-events-none" />
          <Input value={search} onChange={e => onSearch(e.target.value)} placeholder={t("Search name, phone or what they want", "ابحث بالاسم أو الهاتف أو المطلوب")} className="!ps-9 !py-2" aria-label={t("Search clients", "بحث في العملاء")} />
        </div>
        <select aria-label={t("Filter by source", "تصفية حسب المصدر")} value={sourceFilter} onChange={e => onSourceFilter(e.target.value)}
          className="px-2.5 py-2 bg-surface border border-border rounded-lg text-xs font-semibold text-ink cursor-pointer">
          <option value="">{t("All sources", "كل المصادر")}</option>
          <option value="PLATFORM">Nerou Finder</option>
          {LEAD_SOURCES.map(src => <option key={src} value={src}>{isRtl ? LEAD_SOURCE_TEXT[src].ar : LEAD_SOURCE_TEXT[src].en}</option>)}
        </select>
        {(search || sourceFilter) && <span className="text-[11px] text-ink-muted">{t(`${leads.length} of ${allLeads.length}`, `${leads.length} من ${allLeads.length}`)}</span>}
      </div>
      <p className="text-[11px] text-ink-muted mb-2">{t("Drag a card to move a client between stages, or use the stage menu on the card.", "اسحب البطاقة لنقل العميل بين المراحل، أو استخدم قائمة المرحلة في البطاقة.")}</p>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
        {BOARD_COLUMNS.map(col => {
          const items = inColumn(col);
          const text = STAGE_TEXT[col];
          return (
            <section key={col}
              onDragOver={e => { e.preventDefault(); setOverCol(col); }}
              onDragLeave={() => setOverCol(c => (c === col ? null : c))}
              onDrop={e => { e.preventDefault(); setOverCol(null); const l = leads.find(x => x.id === dragId); setDragId(null); if (l) onMove(l, col); }}
              className={`snap-start shrink-0 w-72 rounded-xl border border-t-4 ${STAGE_ACCENT[col]} bg-canvas ${overCol === col ? "border-gold bg-gold/5" : "border-border"}`}>
              <header className="px-3 py-2.5 flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink">{isRtl ? text.ar : text.en}</h4>
                <span className="text-[11px] font-bold text-ink-muted bg-surface-2 rounded-full px-2 py-0.5">{items.length}</span>
              </header>
              <div className="px-2 pb-2 space-y-2 min-h-[80px] max-h-[62vh] overflow-y-auto">
                {items.map(l => (
                  <article key={l.id} draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className={`bg-surface border border-border rounded-lg p-3 space-y-2 cursor-grab active:cursor-grabbing shadow-sm ${dragId === l.id ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button type="button" onClick={() => onOpen(l)} dir="auto" className="block max-w-full text-start text-sm font-bold text-ink truncate hover:text-gold cursor-pointer" title={t("Open client", "فتح العميل")}>{l.visitorName}</button>
                        {l.propertyTitle && <p dir="auto" className="text-[11px] text-ink-muted truncate">{l.propertyTitle}</p>}
                      </div>
                      <span className="text-[10px] text-ink-muted shrink-0">{ago(l.createdDate, isRtl)}</span>
                    </div>
                    {l.message && <p dir="auto" className="text-[11px] text-ink-muted line-clamp-2 italic">"{l.message}"</p>}
                    <ContactRow lead={l} isRtl={isRtl} />
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${l.addedManually ? "bg-gold-soft text-gold-active" : "bg-surface-2 text-ink-muted"}`}>{sourceLabel(l, isRtl)}</span>
                      {!!l.budget && <span className="font-semibold text-ink-muted">{fmtMoney(l.budget, isRtl)}</span>}
                      {!!l.notes?.length && <span className="text-ink-muted">{l.notes.length === 1 ? t("1 note", "ملاحظة واحدة") : t(`${l.notes.length} notes`, `${l.notes.length} ملاحظات`)}</span>}
                    </div>
                    {col === LeadStatus.LOST && l.lostReason && <p className="text-[11px] text-ink-muted">{t("Reason: ", "السبب: ")}{l.lostReason}</p>}
                    {showAgent && l.agentName && <p className="text-[10px] text-ink-muted">{t("Agent: ", "الوكيل: ")}{l.agentName}</p>}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isOpenLead(l) && <FollowUpChip lead={l} today={today} isRtl={isRtl} t={t} onClick={() => onFollowUp(l)} />}
                      {isOpenLead(l) && (
                        <button type="button" onClick={() => onSchedule(l)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-border text-ink-muted hover:border-gold hover:text-gold cursor-pointer">
                          <CalendarPlus size={10} />{t("Viewing", "معاينة")}
                        </button>
                      )}
                    </div>
                    <select aria-label={t("Move to stage", "نقل إلى مرحلة")} value={columnForStatus(l.status)} onChange={e => onMove(l, e.target.value as LeadStatus)}
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-[11px] font-semibold text-ink cursor-pointer">
                      {BOARD_COLUMNS.map(s => <option key={s} value={s}>{isRtl ? STAGE_TEXT[s].ar : STAGE_TEXT[s].en}</option>)}
                    </select>
                  </article>
                ))}
                {items.length === 0 && <p className="text-center text-[11px] text-ink-muted py-4">{t("Nothing here", "لا شيء هنا")}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------------------------
function FollowUps({ leads, isRtl, t, today, showAgent, onSet, onQuick, onMove }: {
  leads: DeskLead[]; isRtl: boolean; t: T; today: string; showAgent: boolean;
  onSet: (l: DeskLead) => void; onQuick: (l: DeskLead, days: number) => void; onMove: (l: DeskLead, s: LeadStatus) => void;
}) {
  const week = addDaysToDate(today, 7);
  const dayOf = (l: DeskLead) => followUpDay(l);
  const byDate = (a: DeskLead, b: DeskLead) => (dayOf(a) || "").localeCompare(dayOf(b) || "");
  const groups: { title: string; tone: string; items: DeskLead[] }[] = [
    { title: t("Overdue", "متأخرة"), tone: "text-danger", items: leads.filter(l => dayOf(l) && dayOf(l)! < today).sort(byDate) },
    { title: t("Today", "اليوم"), tone: "text-warning", items: leads.filter(l => dayOf(l) === today) },
    { title: t("Next 7 days", "الأيام السبعة القادمة"), tone: "text-ink", items: leads.filter(l => dayOf(l) && dayOf(l)! > today && dayOf(l)! <= week).sort(byDate) },
    { title: t("Later", "لاحقاً"), tone: "text-ink-muted", items: leads.filter(l => dayOf(l) && dayOf(l)! > week).sort(byDate) },
    { title: t("No follow-up planned", "بلا موعد متابعة"), tone: "text-ink-muted", items: leads.filter(l => !dayOf(l)).sort((a, b) => Date.parse(a.updatedDate) - Date.parse(b.updatedDate)) }
  ];
  if (leads.length === 0) {
    return <EmptyState icon={<BellRing size={20} />} title={t("Nothing to follow up", "لا توجد متابعات")} description={t("Open clients will show up here.", "سيظهر هنا العملاء المفتوحون.")} />;
  }
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-ink-muted">{t("You get an email reminder the morning a follow-up is due, and a nudge for clients left waiting for days.", "يصلك تذكير بالإيميل صباح موعد المتابعة، وتنبيه للعملاء الذين تُركوا ينتظرون أياماً.")}</p>
      {groups.filter(g => g.items.length > 0).map(g => (
        <section key={g.title}>
          <h4 className={`text-xs font-bold mb-2 ${g.tone}`}>{g.title} <span className="text-ink-muted font-semibold">({g.items.length})</span></h4>
          <div className="bg-surface border border-border rounded-xl divide-y divide-surface-2">
            {g.items.map(l => (
              <div key={l.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-ink">{l.visitorName}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface-2 text-ink-muted">{isRtl ? STAGE_TEXT[l.status]?.ar : STAGE_TEXT[l.status]?.en}</span>
                    {dayOf(l) && <span className="text-[11px] text-ink-muted">{fmtDay(dayOf(l), isRtl)}</span>}
                  </div>
                  {l.propertyTitle && <p className="text-[11px] text-ink-muted">{l.propertyTitle}</p>}
                  <p className="text-[11px] text-ink-muted">{t("Last activity ", "آخر نشاط ")}{ago(l.updatedDate, isRtl)}{showAgent && l.agentName ? ` · ${l.agentName}` : ""}</p>
                  <ContactRow lead={l} isRtl={isRtl} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button type="button" onClick={() => onMove(l, LeadStatus.CONTACTED)} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-ink hover:border-gold cursor-pointer inline-flex items-center gap-1"><Check size={12} />{t("Contacted", "تم التواصل")}</button>
                  {[[1, t("+1d", "+١ يوم")], [3, t("+3d", "+٣ أيام")], [7, t("+1w", "+أسبوع")]].map(([d, label]) => (
                    <button key={String(d)} type="button" onClick={() => onQuick(l, d as number)} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-ink-muted hover:border-gold hover:text-gold cursor-pointer">{label as string}</button>
                  ))}
                  <button type="button" onClick={() => onSet(l)} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-ink-muted hover:border-gold hover:text-gold cursor-pointer inline-flex items-center gap-1"><Clock size={12} />{t("Date...", "تاريخ...")}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Viewings
// ---------------------------------------------------------------------------------------------
function Viewings({ viewings, isRtl, t, today, showAgent, onNew, onReschedule, onStatus }: {
  viewings: DeskViewing[]; isRtl: boolean; t: T; today: string; showAgent: boolean;
  onNew: () => void; onReschedule: (v: DeskViewing) => void; onStatus: (v: DeskViewing, s: string) => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const live = (v: DeskViewing) => v.status !== "CANCELLED" && v.status !== "COMPLETED";
  const upcoming = viewings.filter(v => v.preferredDate >= today && live(v)).sort((a, b) => (a.preferredDate + a.preferredTimeSlot).localeCompare(b.preferredDate + b.preferredTimeSlot));
  const past = viewings.filter(v => !(v.preferredDate >= today && live(v))).sort((a, b) => (b.preferredDate + b.preferredTimeSlot).localeCompare(a.preferredDate + a.preferredTimeSlot));
  const days = [...new Set(upcoming.map(v => v.preferredDate))];
  const tomorrow = addDaysToDate(today, 1);
  const dayTitle = (d: string) => (d === today ? t("Today", "اليوم") : d === tomorrow ? t("Tomorrow", "غداً") : "") + (d === today || d === tomorrow ? " · " : "") + fmtFullDay(d, isRtl);

  const Row = ({ v }: { v: DeskViewing }) => {
    const st = VIEWING_STATUS_TEXT[v.status];
    const wa = waLink(v.visitorWhatsapp || v.visitorPhone, isRtl ? `مرحباً ${v.visitorName}، تذكير بموعد المعاينة ${v.preferredDate} ${v.preferredTimeSlot}.` : `Hello ${v.visitorName}, a reminder of your viewing on ${v.preferredDate} at ${v.preferredTimeSlot}.`);
    return (
      <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 w-24 text-sm font-bold text-ink tabular-nums">{v.preferredTimeSlot}</div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-ink">{v.visitorName || t("Client", "عميل")}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.status === "CONFIRMED" ? "bg-success-soft text-success" : v.status === "REQUESTED" ? "bg-warning-soft text-warning" : v.status === "CANCELLED" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-muted"}`}>{isRtl ? st.ar : st.en}</span>
            </div>
            {v.propertyTitle && <p className="text-[11px] text-ink-muted">{v.propertyTitle}</p>}
            {v.notes && <p className="text-[11px] text-ink-muted italic">{v.notes}</p>}
            {showAgent && v.agentName && <p className="text-[10px] text-ink-muted">{t("Agent: ", "الوكيل: ")}{v.agentName}</p>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><MessageCircle size={12} /><bdi dir="ltr">{v.visitorPhone}</bdi></a>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {v.status === "REQUESTED" && <button type="button" onClick={() => onStatus(v, "CONFIRMED")} className="px-2.5 py-1.5 rounded bg-gold text-gold-ink text-[11px] font-bold cursor-pointer">{t("Confirm", "تأكيد")}</button>}
          {live(v) && <button type="button" onClick={() => onReschedule(v)} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-ink hover:border-gold cursor-pointer">{t("Reschedule", "إعادة جدولة")}</button>}
          {v.status === "CONFIRMED" && <button type="button" onClick={() => onStatus(v, "COMPLETED")} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-ink hover:border-gold cursor-pointer inline-flex items-center gap-1"><Check size={12} />{t("Done", "تمت")}</button>}
          {live(v) && <button type="button" onClick={() => onStatus(v, "CANCELLED")} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-danger hover:border-danger cursor-pointer inline-flex items-center gap-1"><X size={12} />{t("Cancel", "إلغاء")}</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-ink-muted max-w-xl">{t("Clients and you both get an email the day before a confirmed viewing. Rescheduling emails the client the new time.", "يصلك ويصل العميل إيميل قبل المعاينة المؤكدة بيوم. وإعادة الجدولة ترسل للعميل الموعد الجديد.")}</p>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={onNew}>{t("Schedule a viewing", "جدولة معاينة")}</Button>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState icon={<CalendarClock size={20} />} title={t("No upcoming viewings", "لا توجد معاينات قادمة")}
          description={t("Schedule one for a client, or confirm requests that come in from buyers.", "جدول معاينة لأحد العملاء، أو أكّد الطلبات الواردة من المشترين.")} />
      ) : days.map(d => (
        <section key={d}>
          <h4 className={`text-xs font-bold mb-2 ${d === today ? "text-gold-active" : "text-ink"}`}>{dayTitle(d)}</h4>
          <div className="bg-surface border border-border rounded-xl divide-y divide-surface-2">
            {upcoming.filter(v => v.preferredDate === d).map(v => <Row key={v.id} v={v} />)}
          </div>
        </section>
      ))}
      {past.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowPast(p => !p)} className="text-xs font-bold text-ink-muted hover:text-ink cursor-pointer underline decoration-dotted">
            {showPast ? t("Hide earlier and cancelled", "إخفاء السابقة والملغاة") : t(`Show earlier and cancelled (${past.length})`, `عرض السابقة والملغاة (${past.length})`)}
          </button>
          {showPast && <div className="mt-2 bg-surface border border-border rounded-xl divide-y divide-surface-2 opacity-80">{past.slice(0, 50).map(v => (
            <div key={v.id}><div className="px-3 pt-2 text-[10px] font-bold text-ink-muted">{fmtDay(v.preferredDate, isRtl)}</div><Row v={v} /></div>
          ))}</div>}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Deals & commissions
// ---------------------------------------------------------------------------------------------
function Deals({ deals, isRtl, t, canEdit, showAgent, onNew, onEdit, onReceived, onCancel, onDelete }: {
  deals: DeskDeal[]; isRtl: boolean; t: T; canEdit: boolean; showAgent: boolean;
  onNew: () => void; onEdit: (d: DeskDeal) => void; onReceived: (d: DeskDeal) => void; onCancel: (d: DeskDeal) => void; onDelete: (d: DeskDeal) => void;
}) {
  const live = deals.filter(d => d.status !== "CANCELLED");
  const received = live.filter(d => d.commissionStatus === "RECEIVED").reduce((s, d) => s + d.commissionAmount, 0);
  const expected = live.filter(d => d.commissionStatus === "EXPECTED").reduce((s, d) => s + d.commissionAmount, 0);
  const volume = live.reduce((s, d) => s + d.dealValue, 0);
  const sorted = [...deals].sort((a, b) => b.closedDate.localeCompare(a.closedDate));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={t("Deals closed", "صفقات مغلقة")} value={String(live.length)} icon={<Check size={15} />} />
        <Kpi label={t("Total value", "إجمالي القيمة")} value={fmtMoney(volume, isRtl)} icon={<TrendingUp size={15} />} />
        <Kpi label={t("Commission received", "عمولات مستلمة")} value={fmtMoney(received, isRtl)} icon={<Banknote size={15} />} />
        <Kpi label={t("Commission expected", "عمولات متوقعة")} value={fmtMoney(expected, isRtl)} icon={<Clock size={15} />} />
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-ink-muted max-w-xl">{t("Your own record of closed deals and what you earn on them.", "سجلّك الخاص بالصفقات المغلقة وما تكسبه منها.")}</p>
        {canEdit && <Button size="sm" leftIcon={<Plus size={14} />} onClick={onNew}>{t("Record a deal", "تسجيل صفقة")}</Button>}
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon={<Banknote size={20} />} title={t("No deals recorded yet", "لا توجد صفقات مسجلة بعد")}
          description={t("When you win a client, record the deal here to track your commission.", "عندما تكسب عميلاً سجّل الصفقة هنا لتتابع عمولتك.")} />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead className="bg-ink-inverse text-ink-muted">
              <tr className="text-start">
                {[t("Closed", "الإغلاق"), t("Property / client", "العقار / العميل"), t("Type", "النوع"), t("Value", "القيمة"), t("Commission", "العمولة"), t("Status", "الحالة"), ""].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 font-bold text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-2">
              {sorted.map(d => (
                <tr key={d.id} className={d.status === "CANCELLED" ? "opacity-50" : ""}>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtDay(d.closedDate, isRtl)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-ink">{d.propertyTitle}</div>
                    <div className="text-ink-muted">{d.clientName}{showAgent && d.agentName ? ` · ${d.agentName}` : ""}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div>{d.dealType === "SALE" ? t("Sale", "بيع") : t("Rent", "إيجار")}</div>
                    {d.contractEndDate && (
                      <div className="text-[10px] text-ink-muted whitespace-nowrap">
                        {t("Ends ", "ينتهي ")}{fmtDate(d.contractEndDate, isRtl)}
                        {d.renewalStatus === "RENEWED" ? " · " + t("renewed", "تم التجديد") : d.renewalStatus === "NOT_RENEWING" ? " · " + t("not renewing", "لن يجدد") : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtMoney(d.dealValue, isRtl)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-bold text-ink">{fmtMoney(d.commissionAmount, isRtl)}</div>
                    {d.commissionRate !== undefined && <div className="text-ink-muted">{d.commissionRate}%</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {d.status === "CANCELLED"
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted">{t("Cancelled", "ملغاة")}</span>
                      : d.commissionStatus === "RECEIVED"
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-soft text-success">{t("Received", "مستلمة")}</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning-soft text-warning">{t("Expected", "متوقعة")}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {d.status !== "CANCELLED" && d.commissionStatus === "EXPECTED" && (
                        <button type="button" onClick={() => onReceived(d)} className="px-2 py-1 rounded border border-border text-[11px] font-semibold hover:border-gold cursor-pointer whitespace-nowrap">{t("Mark received", "تم الاستلام")}</button>
                      )}
                      <button type="button" onClick={() => onEdit(d)} aria-label={t("Edit", "تعديل")} className="p-1.5 rounded hover:bg-surface-2 text-ink-muted cursor-pointer"><Pencil size={13} /></button>
                      <button type="button" onClick={() => onCancel(d)} aria-label={d.status === "CANCELLED" ? t("Reopen", "إعادة فتح") : t("Cancel deal", "إلغاء الصفقة")} className="p-1.5 rounded hover:bg-surface-2 text-ink-muted cursor-pointer"><X size={13} /></button>
                      <button type="button" onClick={() => onDelete(d)} aria-label={t("Delete", "حذف")} className="p-1.5 rounded hover:bg-danger-soft text-danger cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------
function Reports({ deals, leads, isRtl, t, onError }: { deals: DeskDeal[]; leads: DeskLead[]; isRtl: boolean; t: T; onError: (m: string) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");
  const monthly = useMemo(
    () => monthlySummary(deals.filter(d => (!from || d.closedDate >= from) && (!to || d.closedDate <= to))),
    [deals, from, to]
  );

  // where the clients come from, and how many of each source turned into a won deal
  const bySource = useMemo(() => {
    const m = new Map<string, { label: string; clients: number; won: number; lost: number }>();
    for (const l of leads) {
      const key = l.addedManually ? l.source || "OTHER" : "PLATFORM";
      const row = m.get(key) || { label: sourceLabel(l, isRtl), clients: 0, won: 0, lost: 0 };
      row.clients += 1;
      if (l.status === LeadStatus.CONVERTED) row.won += 1;
      if (l.status === LeadStatus.LOST) row.lost += 1;
      m.set(key, row);
    }
    return [...m.values()].sort((a, b) => b.clients - a.clients);
  }, [leads, isRtl]);

  const run = async (kind: string) => {
    setBusy(kind);
    try { await downloadCsv(kind, from, to); } catch (e: any) { onError(e?.message || t("Export failed.", "فشل التصدير.")); } finally { setBusy(""); }
  };
  const REPORTS = [
    { kind: "leads", title: t("Clients & pipeline", "العملاء ومسار البيع"), hint: t("Every client with stage, follow-up and contact details", "كل عميل مع مرحلته وموعد متابعته وبيانات التواصل") },
    { kind: "viewings", title: t("Viewings", "المعاينات"), hint: t("Your viewing schedule and outcomes", "جدول المعاينات ونتائجها") },
    { kind: "deals", title: t("Deals & commissions", "الصفقات والعمولات"), hint: t("Each closed deal with its commission and status", "كل صفقة مغلقة مع عمولتها وحالتها") },
    { kind: "tasks", title: t("Tasks", "المهام"), hint: t("Your scheduled tasks with their status", "مهامك المجدولة مع حالتها") },
    { kind: "monthly", title: t("Monthly commission summary", "ملخص العمولات الشهري"), hint: t("Deals, value and commission per month", "الصفقات والقيمة والعمولة لكل شهر") }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="rp-from" className="block text-[11px] font-semibold text-ink-muted mb-1">{t("From", "من")}</label>
          <Input id="rp-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label htmlFor="rp-to" className="block text-[11px] font-semibold text-ink-muted mb-1">{t("To", "إلى")}</label>
          <Input id="rp-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="w-44" />
        </div>
        {(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-xs font-semibold text-ink-muted underline cursor-pointer pb-2.5">{t("All dates", "كل التواريخ")}</button>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {REPORTS.map(r => (
          <div key={r.kind} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{r.title}</p>
              <p className="text-[11px] text-ink-muted">{r.hint}</p>
            </div>
            <Button variant="outline" size="sm" loading={busy === r.kind} leftIcon={<Download size={13} />} onClick={() => run(r.kind)}>CSV</Button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-muted">{t("Files open directly in Excel or Google Sheets, Arabic included.", "تُفتح الملفات مباشرة في Excel أو Google Sheets مع دعم كامل للعربية.")}</p>

      {bySource.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-ink mb-2">{t("Where your clients come from", "من أين يأتيك عملاؤك")}</h4>
          <div className="bg-surface border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-xs min-w-[420px]">
              <thead className="bg-ink-inverse text-ink-muted">
                <tr>{[t("Source", "المصدر"), t("Clients", "العملاء"), t("Won", "تمت الصفقة"), t("Lost", "خسارة"), t("Win rate", "نسبة النجاح")].map(h => <th key={h} className="px-3 py-2.5 font-bold text-start">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {bySource.map(r => (
                  <tr key={r.label}>
                    <td className="px-3 py-2.5 font-bold text-ink">{r.label}</td>
                    <td className="px-3 py-2.5">{r.clients}</td>
                    <td className="px-3 py-2.5">{r.won}</td>
                    <td className="px-3 py-2.5">{r.lost}</td>
                    <td className="px-3 py-2.5">{r.clients ? Math.round((r.won / r.clients) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h4 className="text-xs font-bold text-ink mb-2">{t("Commission by month", "العمولات حسب الشهر")}</h4>
        {monthly.length === 0 ? (
          <p className="text-xs text-ink-muted bg-surface border border-dashed border-border rounded-xl p-6 text-center">{t("No closed deals in this period.", "لا توجد صفقات مغلقة في هذه الفترة.")}</p>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="bg-ink-inverse text-ink-muted">
                <tr>{[t("Month", "الشهر"), t("Deals", "الصفقات"), t("Sales", "المبيعات"), t("Rentals", "الإيجارات"), t("Commission", "العمولة"), t("Received", "المستلمة")].map(h => <th key={h} className="px-3 py-2.5 font-bold text-start">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-surface-2">
                {monthly.map(r => (
                  <tr key={r.month}>
                    <td className="px-3 py-2.5 font-bold text-ink">{r.month}</td>
                    <td className="px-3 py-2.5">{r.deals}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtMoney(r.saleValue, isRtl)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtMoney(r.rentValue, isRtl)}</td>
                    <td className="px-3 py-2.5 font-bold text-ink whitespace-nowrap">{fmtMoney(r.commissionTotal, isRtl)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtMoney(r.commissionReceived, isRtl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
