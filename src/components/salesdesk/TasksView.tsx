import React, { useState } from "react";
import { AlarmClock, Check, Circle, CircleCheck, KeyRound, ListChecks, MessageCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { addDaysToDate, daysBetween, qatarDate, qatarTime, taskReminderTime } from "../../lib/crm.js";
import type { SnoozeKind } from "../../lib/crm.js";
import { DeskDeal, DeskLead, DeskTask, T, ago, fmtDate, fmtDay, leadPhone, waLink } from "./shared.js";

/** A pending rental whose contract is ending soon (or ended in the last month). */
export function pendingRenewals(deals: DeskDeal[], today: string): (DeskDeal & { daysLeft: number })[] {
  return deals
    .filter(d => d.dealType === "RENT" && d.status === "CLOSED" && !!d.contractEndDate && (d.renewalStatus || "PENDING") === "PENDING")
    .map(d => ({ ...d, daysLeft: daysBetween(today, d.contractEndDate!) }))
    .filter(d => d.daysLeft >= -30)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function TasksView({ tasks, deals, leads, isRtl, t, today, showAgent, canEdit, onAdd, onEdit, onToggleDone, onSnooze, onDelete, onOpenLead, onRenewed, onNotRenewing, onEditDeal }: {
  tasks: DeskTask[]; deals: DeskDeal[]; leads: DeskLead[]; isRtl: boolean; t: T; today: string; showAgent: boolean; canEdit: boolean;
  onAdd: () => void; onEdit: (task: DeskTask) => void; onToggleDone: (task: DeskTask) => void; onSnooze: (task: DeskTask, kind: SnoozeKind) => void;
  onDelete: (task: DeskTask) => void; onOpenLead: (leadId: string) => void;
  onRenewed: (deal: DeskDeal) => void; onNotRenewing: (deal: DeskDeal) => void; onEditDeal: (deal: DeskDeal) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const open = tasks.filter(x => x.status === "OPEN");
  const done = tasks.filter(x => x.status === "DONE").sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")).slice(0, 15);
  const dayOf = (x: DeskTask) => qatarDate(taskReminderTime(x));
  const byTime = (a: DeskTask, b: DeskTask) => taskReminderTime(a) - taskReminderTime(b);
  const week = addDaysToDate(today, 7);
  const groups: { title: string; tone: string; items: DeskTask[] }[] = [
    { title: t("Overdue", "متأخرة"), tone: "text-danger", items: open.filter(x => dayOf(x) < today).sort(byTime) },
    { title: t("Today", "اليوم"), tone: "text-warning", items: open.filter(x => dayOf(x) === today).sort(byTime) },
    { title: t("Next 7 days", "الأيام السبعة القادمة"), tone: "text-ink", items: open.filter(x => dayOf(x) > today && dayOf(x) <= week).sort(byTime) },
    { title: t("Later", "لاحقاً"), tone: "text-ink-muted", items: open.filter(x => dayOf(x) > week).sort(byTime) }
  ];

  const renewals = pendingRenewals(deals, today);
  const soon = renewals.filter(r => r.daysLeft <= 120);
  const farCount = renewals.length - soon.length;

  const SNOOZE: [SnoozeKind, string][] = [
    ["1h", t("In 1 hour", "بعد ساعة")],
    ["tomorrow", t("Tomorrow morning", "غداً صباحاً")],
    ["3d", t("In 3 days", "بعد 3 أيام")],
    ["week", t("Next week", "الأسبوع القادم")]
  ];

  const TaskRow = ({ x, finished }: { x: DeskTask; finished?: boolean }) => {
    const at = taskReminderTime(x);
    const snoozed = !!x.snoozedUntil && Date.parse(x.snoozedUntil) > Date.now();
    const lead = x.leadId ? leads.find(l => l.id === x.leadId) : undefined;
    return (
      <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={() => onToggleDone(x)} aria-label={finished ? t("Reopen", "إعادة فتح") : t("Mark done", "تمت")}
            className={`mt-0.5 shrink-0 cursor-pointer ${finished ? "text-success" : "text-ink-muted hover:text-success"}`}>
            {finished ? <CircleCheck size={20} /> : <Circle size={20} />}
          </button>
          <div className="min-w-0 space-y-0.5">
            <p dir="auto" className={`text-sm font-bold ${finished ? "text-ink-muted line-through" : "text-ink"}`}>{x.title}</p>
            <p className="text-[11px] text-ink-muted">
              {fmtDay(qatarDate(Date.parse(x.dueAt)), isRtl)} · <bdi dir="ltr">{qatarTime(Date.parse(x.dueAt))}</bdi>
              {snoozed && <span className="text-warning font-semibold"> · {t("snoozed to ", "مؤجلة إلى ")}{fmtDay(qatarDate(at), isRtl)} <bdi dir="ltr">{qatarTime(at)}</bdi></span>}
              {finished && x.doneAt && <span> · {t("done ", "أُنجزت ")}{ago(x.doneAt, isRtl)}</span>}
              {showAgent && x.agentName ? ` · ${x.agentName}` : ""}
            </p>
            {x.notes && <p dir="auto" className="text-[11px] text-ink-muted">{x.notes}</p>}
            {lead && <button type="button" onClick={() => onOpenLead(lead.id)} dir="auto" className="text-[11px] font-semibold text-gold-active underline decoration-dotted cursor-pointer">{lead.visitorName}</button>}
          </div>
        </div>
        {!finished && (
          <div className="flex items-center gap-1.5 shrink-0">
            <select aria-label={t("Remind me later", "ذكّرني لاحقاً")} value="" onChange={e => { if (e.target.value) onSnooze(x, e.target.value as SnoozeKind); }}
              className="px-2 py-1.5 bg-surface border border-border rounded text-[11px] font-semibold text-ink-muted cursor-pointer">
              <option value="">{t("Remind later", "ذكّرني لاحقاً")}</option>
              {SNOOZE.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <button type="button" onClick={() => onEdit(x)} aria-label={t("Edit", "تعديل")} className="p-1.5 rounded hover:bg-surface-2 text-ink-muted cursor-pointer"><Pencil size={13} /></button>
            <button type="button" onClick={() => onDelete(x)} aria-label={t("Delete", "حذف")} className="p-1.5 rounded hover:bg-danger-soft text-danger cursor-pointer"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
    );
  };

  if (open.length === 0 && done.length === 0 && renewals.length === 0) {
    return (
      <EmptyState icon={<ListChecks size={20} />} title={t("No tasks or renewals yet", "لا توجد مهام أو تجديدات بعد")}
        description={t("Schedule a task - call an owner, collect a cheque, shoot a listing - and we email you when it is time. Rental contracts you record with an end date appear here before they expire.", "جدول مهمة - اتصال بمالك، تحصيل شيك، تصوير عقار - ونرسل لك إيميلاً في موعدها. وعقود الإيجار التي تسجلها بتاريخ انتهاء تظهر هنا قبل أن تنتهي.")}
        action={<Button size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>{t("Add a task", "إضافة مهمة")}</Button>} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-ink-muted max-w-xl">
          {t("Tasks and lease renewals are emailed to you in the same message as your follow-ups, between 07:00 and 21:00.", "تصلك المهام وتجديدات العقود بالإيميل نفسه مع المتابعات، بين 7 صباحاً و9 مساءً.")}
        </p>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={onAdd}>{t("Add a task", "إضافة مهمة")}</Button>
      </div>

      {soon.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-ink mb-1 flex items-center gap-1.5"><KeyRound size={14} className="text-gold" />{t("Lease renewals", "تجديد عقود الإيجار")} <span className="text-ink-muted font-semibold">({soon.length})</span></h4>
          <p className="text-[11px] text-ink-muted mb-2">{t("A renewal is a new commission with no marketing cost - call before they look elsewhere.", "التجديد عمولة جديدة بلا تكلفة تسويق - اتصل قبل أن يبحث المستأجر عن غيرك.")}</p>
          <div className="bg-surface border border-border rounded-xl divide-y divide-surface-2">
            {soon.map(r => {
              const lead = r.leadId ? leads.find(l => l.id === r.leadId) : undefined;
              const wa = lead ? waLink(leadPhone(lead), isRtl ? `مرحباً ${r.clientName}، بخصوص تجديد عقد الإيجار.` : `Hello ${r.clientName}, about renewing your lease.`) : undefined;
              const tone = r.daysLeft < 0 || r.daysLeft <= 30 ? "bg-danger-soft text-danger" : r.daysLeft <= 60 ? "bg-warning-soft text-warning" : "bg-surface-2 text-ink-muted";
              return (
                <div key={r.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span dir="auto" className="text-sm font-bold text-ink">{r.clientName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`}>
                        {r.daysLeft >= 0 ? t(`Ends in ${r.daysLeft} days`, `ينتهي بعد ${r.daysLeft} يوم`) : t(`Ended ${-r.daysLeft} days ago`, `انتهى منذ ${-r.daysLeft} يوم`)}
                      </span>
                    </div>
                    <p dir="auto" className="text-[11px] text-ink-muted">{r.propertyTitle} · {t("ends ", "ينتهي ")}{fmtDate(r.contractEndDate, isRtl)}{showAgent && r.agentName ? ` · ${r.agentName}` : ""}</p>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><MessageCircle size={12} />{t("Message on WhatsApp", "مراسلة على واتساب")}</a>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <button type="button" onClick={() => onRenewed(r)} className="px-2.5 py-1.5 rounded bg-gold text-gold-ink text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"><Check size={12} />{t("Renewed", "تم التجديد")}</button>
                      <button type="button" onClick={() => onNotRenewing(r)} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-ink hover:border-danger cursor-pointer inline-flex items-center gap-1"><X size={12} />{t("Not renewing", "لن يجدد")}</button>
                      <button type="button" onClick={() => onEditDeal(r)} className="px-2.5 py-1.5 rounded border border-border text-[11px] font-semibold text-ink-muted hover:border-gold cursor-pointer">{t("Change date", "تغيير التاريخ")}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {farCount > 0 && <p className="text-[11px] text-ink-muted mt-1.5">{t(`${farCount} more rentals end later than four months from now.`, `${farCount} عقود أخرى تنتهي بعد أكثر من أربعة أشهر.`)}</p>}
        </section>
      )}

      {groups.filter(g => g.items.length > 0).map(g => (
        <section key={g.title}>
          <h4 className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${g.tone}`}><AlarmClock size={14} />{g.title} <span className="text-ink-muted font-semibold">({g.items.length})</span></h4>
          <div className="bg-surface border border-border rounded-xl divide-y divide-surface-2">
            {g.items.map(x => <TaskRow key={x.id} x={x} />)}
          </div>
        </section>
      ))}

      {open.length === 0 && (
        <p className="text-xs text-ink-muted bg-surface border border-dashed border-border rounded-xl p-6 text-center">{t("No open tasks.", "لا توجد مهام مفتوحة.")}</p>
      )}

      {done.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone(p => !p)} className="text-xs font-bold text-ink-muted hover:text-ink cursor-pointer underline decoration-dotted">
            {showDone ? t("Hide finished tasks", "إخفاء المهام المنجزة") : t(`Show finished tasks (${done.length})`, `عرض المهام المنجزة (${done.length})`)}
          </button>
          {showDone && <div className="mt-2 bg-surface border border-border rounded-xl divide-y divide-surface-2 opacity-80">{done.map(x => <TaskRow key={x.id} x={x} finished />)}</div>}
        </section>
      )}
    </div>
  );
}
