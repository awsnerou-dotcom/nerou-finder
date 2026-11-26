// "Add admin" in the control centre: the admin types a name and an email, nothing else. The new person
// chooses their own password from the emailed link, so no password ever passes through this screen.
import React, { useState } from "react";
import { Modal } from "./ui/Modal.js";
import { Button } from "./ui/Button.js";

export default function AddAdminDialog({ isRtl, onClose, onAdded }: { isRtl: boolean; onClose: () => void; onAdded: (email: string) => void }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ fullName, email })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || t("Could not add the admin.", "تعذرت إضافة الأدمن.")); return; }
      onAdded(d.user?.email || email);
    } catch {
      setError(t("Could not add the admin.", "تعذرت إضافة الأدمن."));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm";
  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="md" title={t("Add admin", "إضافة أدمن")}>
      <form onSubmit={submit} className="space-y-3 text-xs" data-testid="add-admin-form">
        <p className="p-3 rounded-lg bg-warning-soft text-warning">
          {t("An admin has full control: accounts, subscriptions and client data. Add only someone you fully trust.",
             "الأدمن يملك تحكمًا كاملًا: الحسابات والاشتراكات وبيانات العملاء. أضف فقط من تثق به ثقة كاملة.")}
        </p>
        <label className="block space-y-1">
          <span className="font-semibold text-ink-muted">{t("Name", "الاسم")}</span>
          <input required minLength={2} maxLength={80} value={fullName} onChange={e => setFullName(e.target.value)} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="font-semibold text-ink-muted">{t("Email", "الإيميل")}</span>
          <input required type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} className={field} />
        </label>
        <p className="text-ink-muted">
          {t("They will receive an email with a link to choose their own password (valid for 24 hours).",
             "سيصله إيميل فيه رابط يختار منه كلمة المرور بنفسه (صالح 24 ساعة).")}
        </p>
        {error && <p role="alert" className="p-2.5 rounded-lg bg-danger-soft text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
          <Button type="submit" size="sm" loading={busy}>{t("Add admin", "إضافة أدمن")}</Button>
        </div>
      </form>
    </Modal>
  );
}
