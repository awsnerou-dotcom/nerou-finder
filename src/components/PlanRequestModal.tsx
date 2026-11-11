/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Modal } from "./ui/Modal.js";
import { Button } from "./ui/Button.js";
import { Input } from "./ui/FormField.js";
import { MAX_REQUEST_MESSAGE } from "../lib/planRequest.js";

// "Request a plan": the form behind every paid plan on the Plans page. The page shows what each plan
// includes but not what it costs; the visitor sends their details and our team replies with the plan and
// the price that suits them. Nothing here creates an account.

export interface RequestablePlan { id: string; name: string }

const select = "w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm";

export default function PlanRequestModal({ isRtl, plans, initialPlanId, onClose, onStartTrial }: {
  isRtl: boolean;
  plans: RequestablePlan[];
  initialPlanId: string; // "" = not sure
  onClose: () => void;
  onStartTrial: () => void;
}) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [f, setF] = useState({ fullName: "", companyName: "", email: "", phone: "", planId: initialPlanId, agents: "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/plan-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, agents: f.agents === "" ? undefined : Number(f.agents), consent })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || t("We couldn't send your request. Please try again.", "تعذر إرسال طلبك. يرجى المحاولة مرة أخرى.")); return; }
      setSent(true);
    } catch {
      setError(t("We couldn't send your request. Please check your connection and try again.", "تعذر إرسال طلبك. تحقق من اتصالك وحاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Modal open onClose={onClose} isRtl={isRtl} size="md" title={t("Request sent", "تم إرسال الطلب")}>
        <div className="text-center space-y-4 py-2">
          <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
          <p className="text-sm text-ink leading-relaxed">
            {t("Thank you. Our team will contact you shortly to confirm the plan that suits you and complete your subscription. A short confirmation is on its way to your email.",
              "شكرًا لك. سيتواصل معك فريقنا قريبًا لتأكيد الباقة المناسبة لك وإتمام اشتراكك. وصلتك رسالة تأكيد مختصرة إلى بريدك الإلكتروني.")}
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button variant="outline" onClick={onStartTrial}>{t("Start the 60-day free trial meanwhile", "ابدأ التجربة المجانية 60 يومًا في الأثناء")}</Button>
            <Button onClick={onClose}>{t("Close", "إغلاق")}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} isRtl={isRtl} size="lg" title={t("Request a plan", "طلب باقة")}>
      <form onSubmit={submit} className="space-y-4 text-sm" noValidate>
        <p className="text-xs text-ink-muted leading-relaxed">
          {t("Tell us about your business. We will contact you to confirm the plan and the price that suit you. Sending this form does not create an account and does not commit you to anything.",
            "أخبرنا عن عملك. سنتواصل معك لتأكيد الباقة والسعر المناسبين لك. إرسال هذا النموذج لا ينشئ حسابًا ولا يُلزمك بأي شيء.")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("Your name *", "اسمك *")}</span>
            <Input value={f.fullName} onChange={set("fullName")} autoComplete="name" required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("Company (if any)", "الشركة (إن وجدت)")}</span>
            <Input value={f.companyName} onChange={set("companyName")} autoComplete="organization" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("Email *", "البريد الإلكتروني *")}</span>
            <Input type="email" dir="ltr" value={f.email} onChange={set("email")} autoComplete="email" required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("Phone / WhatsApp *", "الجوال / واتساب *")}</span>
            <Input type="tel" dir="ltr" value={f.phone} onChange={set("phone")} autoComplete="tel" required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("The plan you are interested in", "الباقة التي تهمك")}</span>
            <select value={f.planId} onChange={set("planId")} className={select}>
              <option value="">{t("Not sure - advise me", "لست متأكدًا - أرشدوني")}</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("How many agents will use it?", "كم وسيطًا سيستخدمها؟")}</span>
            <Input type="number" min={1} max={1000} dir="ltr" value={f.agents} onChange={set("agents")} />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-ink-muted">{t("Anything we should know? (optional)", "هل من شيء تريد إخبارنا به؟ (اختياري)")}</span>
          <textarea value={f.message} onChange={set("message")} rows={3} maxLength={MAX_REQUEST_MESSAGE} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm" />
        </label>

        {/* a field real visitors never see; a bot that fills everything gets quietly ignored */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
          <label>Website <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gold shrink-0" />
          <span className="text-xs text-ink-muted leading-relaxed">
            {t("I agree that Nerou Technology Services Trading may contact me about this request, and I have read the Privacy Policy.",
              "أوافق على أن تتواصل معي شركة نيرو تكنولوجي سيرفيسيس تريدنق بخصوص هذا الطلب، وقد قرأت سياسة الخصوصية.")}
          </span>
        </label>

        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t("Cancel", "إلغاء")}</Button>
          <Button type="submit" loading={busy}>{t("Send request", "إرسال الطلب")}</Button>
        </div>
      </form>
    </Modal>
  );
}
