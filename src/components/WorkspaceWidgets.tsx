/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AlertTriangle, ArrowRight, ArrowLeft, Check, Clock } from "lucide-react";
import { subscriptionAlert } from "../lib/workspaceReadiness.js";
import type { Checklist, ChecklistTab } from "../lib/workspaceReadiness.js";

// Dashboard widgets shared by the agent and subscriber workspaces. Each one draws only from real account data and
// draws nothing when there is nothing to say.

/** "Your subscription ends in 6 days" / "has ended" - for an agent or an agency with an expiry date. */
export function SubscriptionAlertBanner({ expiry, isRtl, onOpen }: { expiry?: string; isRtl: boolean; onOpen?: () => void }) {
  const alert = subscriptionAlert(expiry, Date.now());
  if (!alert) return null;
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const expired = alert.level === "expired";
  const message = expired
    ? t(
        `Your subscription ended ${alert.days === 0 ? "today" : `${alert.days} day${alert.days === 1 ? "" : "s"} ago`}. Contact the Nerou Finder team to renew and keep your listings visible.`,
        `انتهى اشتراكك ${alert.days === 0 ? "اليوم" : `منذ ${alert.days} ${alert.days === 1 ? "يوم" : "أيام"}`}. تواصل مع فريق نيرو فايندر للتجديد وإبقاء عقاراتك ظاهرة.`
      )
    : t(
        `Your subscription ends ${alert.days === 0 ? "today" : `in ${alert.days} day${alert.days === 1 ? "" : "s"}`}. Contact the Nerou Finder team to renew without a gap.`,
        `ينتهي اشتراكك ${alert.days === 0 ? "اليوم" : `بعد ${alert.days} ${alert.days === 1 ? "يوم" : "أيام"}`}. تواصل مع فريق نيرو فايندر للتجديد دون انقطاع.`
      );
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const body = (
    <>
      {expired ? <AlertTriangle size={18} className="text-danger shrink-0" /> : <Clock size={18} className="text-warning shrink-0" />}
      <span className="flex-1 text-sm font-medium text-ink text-start">{message}</span>
      {onOpen && <Arrow size={16} className="text-ink-muted shrink-0" />}
    </>
  );
  const cls = `w-full flex items-center gap-3 p-4 rounded-2xl border ${expired ? "bg-danger-soft border-danger/30" : "bg-warning-soft border-warning/30"}`;
  return onOpen
    ? <button type="button" onClick={onOpen} className={`${cls} cursor-pointer hover:brightness-95 transition`}>{body}</button>
    : <div className={cls} role="status">{body}</div>;
}

/** "Complete your profile": what is done, what is next, and a button to the place where each task is done. */
export function ReadinessCard({ checklist, isRtl, onGo }: { checklist: Checklist; isRtl: boolean; onGo: (tab: ChecklistTab) => void }) {
  if (checklist.done >= checklist.total) return null;
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const next = checklist.items.filter(i => !i.done);
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  return (
    <section className="bg-surface rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-serif text-lg font-medium text-ink">{t("Complete your profile", "أكمل ملفك الشخصي")}</h3>
          <p className="text-[13px] text-ink-muted mt-0.5">
            {t("A complete profile is found more, trusted more and gets more enquiries.", "الملف المكتمل يظهر أكثر ويكسب ثقة أكبر ويتلقى استفسارات أكثر.")}
          </p>
        </div>
        <div className="text-end">
          <p className="font-serif text-2xl font-medium text-ink tabular-nums leading-none">{checklist.percent}%</p>
          <p className="text-[11px] text-ink-faint mt-1 tabular-nums">{checklist.done} / {checklist.total}</p>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={checklist.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${checklist.percent}%` }} />
      </div>
      <ul className="mt-4 divide-y divide-border/70">
        {checklist.items.map(i => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i.done ? "bg-success-soft text-success" : "border border-border-strong text-transparent"}`}>
              {i.done && <Check size={13} strokeWidth={3} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-sm font-semibold ${i.done ? "text-ink-faint line-through" : "text-ink"}`}>{isRtl ? i.ar : i.en}</span>
              {!i.done && <span className="block text-[12px] text-ink-muted">{isRtl ? i.hintAr : i.hintEn}</span>}
            </span>
            {!i.done && i.id === next[0].id && (
              <button type="button" onClick={() => onGo(i.tab)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-chrome text-white text-[13px] font-semibold hover:bg-chrome-hover transition-colors cursor-pointer">
                {t("Do it now", "ابدأ الآن")}<Arrow size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
