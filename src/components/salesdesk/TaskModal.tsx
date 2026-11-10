import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal.js";
import { Button } from "../ui/Button.js";
import { FormField, Input, Select, Textarea } from "../ui/FormField.js";
import { addDaysToDate, qatarDate, qatarTime } from "../../lib/crm.js";
import { DeskLead, DeskTask, T } from "./shared.js";

const today = () => qatarDate(Date.now());

export interface TaskForm {
  title: string;
  dueDate: string;
  dueTime: string;
  notes: string;
  leadId: string;
  agentId: string;
}

/** Add or edit a scheduled task (a to-do with a Qatar date and time that is emailed to the agent). */
export function TaskModal({ open, task, leads, presetLeadId, team, isOrgAdmin, isRtl, t, onClose, onSave }: {
  open: boolean; task: DeskTask | null; leads: DeskLead[]; presetLeadId?: string; team: { id: string; fullName: string }[];
  isOrgAdmin: boolean; isRtl: boolean; t: T; onClose: () => void;
  /** Throw to keep the dialog open; the message is shown inside it. */
  onSave: (form: TaskForm, existing: DeskTask | null) => Promise<void>;
}) {
  const [f, setF] = useState<TaskForm>({ title: "", dueDate: "", dueTime: "09:00", notes: "", leadId: "", agentId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setError("");
    if (task) {
      const at = Date.parse(task.dueAt);
      setF({ title: task.title, dueDate: qatarDate(at), dueTime: qatarTime(at), notes: task.notes || "", leadId: task.leadId || "", agentId: task.agentId });
    } else {
      setF({ title: "", dueDate: addDaysToDate(today(), 1), dueTime: "09:00", notes: "", leadId: presetLeadId || "", agentId: "" });
    }
  }, [open, task, presetLeadId]);
  if (!open) return null;

  // reminder emails are not sent overnight, so a task set for the night is emailed at 07:00
  const overnight = !!f.dueTime && (f.dueTime < "07:00" || f.dueTime >= "21:00");

  const submit = async () => {
    setError("");
    if (!f.title.trim()) return setError(t("Write what you need to do.", "اكتب ما تريد إنجازه."));
    if (!f.dueDate) return setError(t("Choose a date.", "اختر تاريخاً."));
    if (!f.dueTime) return setError(t("Choose a time.", "اختر وقتاً."));
    setBusy(true);
    try { await onSave(f, task); } catch (e: any) { setError(e?.message || t("Could not save the task.", "تعذر حفظ المهمة.")); } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      isRtl={isRtl}
      size="md"
      title={task ? t("Edit task", "تعديل المهمة") : t("Add a task", "إضافة مهمة")}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
          <Button size="sm" loading={busy} onClick={submit}>{task ? t("Save changes", "حفظ التعديلات") : t("Add task", "إضافة المهمة")}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label={t("What do you need to do?", "ما الذي تريد إنجازه؟")} htmlFor="tk-title" required>
          <Input id="tk-title" dir="auto" value={f.title} maxLength={200} autoFocus onChange={e => set("title", e.target.value)}
            placeholder={t("e.g. Call the owner about the price", "مثلاً: الاتصال بالمالك بخصوص السعر")} />
        </FormField>
        <div className="flex flex-wrap gap-2">
          {[[0, t("Today", "اليوم")], [1, t("Tomorrow", "غداً")], [3, t("In 3 days", "بعد 3 أيام")], [7, t("Next week", "الأسبوع القادم")]].map(([d, label]) => (
            <button key={String(d)} type="button" onClick={() => set("dueDate", addDaysToDate(today(), d as number))}
              className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-ink hover:border-gold hover:text-gold cursor-pointer">{label as string}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("Date", "التاريخ")} htmlFor="tk-date" required>
            <Input id="tk-date" type="date" value={f.dueDate} min={today()} onChange={e => set("dueDate", e.target.value)} />
          </FormField>
          <FormField label={t("Time (Qatar)", "الوقت (بتوقيت قطر)")} htmlFor="tk-time" required>
            <Input id="tk-time" type="time" value={f.dueTime} onChange={e => set("dueTime", e.target.value)} />
          </FormField>
        </div>
        <p className={`text-xs ${overnight ? "text-warning bg-warning-soft rounded-lg px-3 py-2" : "text-ink-muted"}`}>
          {overnight
            ? t("Reminder emails are sent between 07:00 and 21:00 - this one will reach you at 07:00 in the morning.", "تُرسل إيميلات التذكير بين 7 صباحاً و9 مساءً - هذا التذكير سيصلك الساعة 7 صباحاً.")
            : t("You get an email within the hour of this time, and a notification in the app.", "يصلك إيميل خلال ساعة من هذا الوقت، وإشعار داخل المنصة.")}
        </p>
        <FormField label={t("Client (optional)", "العميل (اختياري)")} htmlFor="tk-lead">
          <Select id="tk-lead" value={f.leadId} onChange={e => set("leadId", e.target.value)}>
            <option value="">{t("Not linked to a client", "غير مرتبطة بعميل")}</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.visitorName}{l.propertyTitle ? ` - ${l.propertyTitle}` : ""}</option>)}
          </Select>
        </FormField>
        {isOrgAdmin && !task && (
          <FormField label={t("For", "لـ")} htmlFor="tk-agent">
            <Select id="tk-agent" value={f.agentId} onChange={e => set("agentId", e.target.value)}>
              <option value="">{t("Me", "أنا")}</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
            </Select>
          </FormField>
        )}
        <FormField label={t("Notes (optional)", "ملاحظات (اختياري)")} htmlFor="tk-notes">
          <Textarea id="tk-notes" dir="auto" rows={2} maxLength={1000} value={f.notes} onChange={e => set("notes", e.target.value)} />
        </FormField>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
