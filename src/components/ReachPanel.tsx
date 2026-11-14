/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Eye, Globe, Link2, MessageCircle, Share2, Star } from "lucide-react";
import DashboardChart from "./DashboardChart.js";
import type { ShareStats } from "../lib/shareStats.js";
import { profileUrl, reviewRequestMessage, whatsappShareLink } from "../lib/profiles.js";
import type { ProfileKind } from "../lib/profiles.js";
import type { Lead } from "../types.js";
import { LeadStatus } from "../types.js";

// "Your public page" for the dashboards: the address to send to clients, the numbers that show it working (visits to the page
// and visitors who came through links the owner shared), and a one-tap way to ask a client for a review.

interface StatsResponse extends ShareStats { kind: ProfileKind; slug: string; path: string }

function CopyButton({ text, label, doneLabel, icon }: { text: string; label: string; doneLabel: string; icon: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* clipboard blocked */ } }}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface text-[13px] font-semibold text-ink hover:bg-surface-2 cursor-pointer transition-colors"
    >
      {done ? <Check size={15} className="text-success" /> : icon}
      {done ? doneLabel : label}
    </button>
  );
}

export function PublicPagePanel({ isRtl, name }: { isRtl: boolean; name: string }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/share-stats", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => (r.ok ? r.json() : null))
      .then((d: StatsResponse | null) => {
        if (cancelled || !d) return;
        setStats(d);
        // the page exists once there is something on it (a live listing, or verification)
        fetch(`/api/public/profile/${d.kind}/${d.slug}`).then(r => { if (!cancelled) setLive(r.ok); }).catch(() => {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!stats) return null;
  const origin = window.location.origin;
  const url = profileUrl(origin, stats.kind, stats.slug, { isRtl });
  const reviewUrl = profileUrl(origin, stats.kind, stats.slug, { isRtl, review: true });
  const message = isRtl ? `${name} على نيرو فايندر:\n${url}` : `${name} on Nerou Finder:\n${url}`;
  const chart = stats.series.map(d => ({ label: d.date.slice(5), value: d.profile, secondaryValue: d.share }));
  const hasData = stats.profileViews + stats.shareVisits > 0;

  return (
    <section className="bg-surface rounded-2xl border border-border shadow-card p-5 space-y-5" aria-label={t("Your public page", "صفحتك العامة")}>
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0"><Globe size={24} strokeWidth={2.25} /></span>
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold text-ink leading-tight">{t("Your public page", "صفحتك العامة")}</h3>
          <p className="text-[13px] text-ink-muted mt-0.5">
            {t("One link with your listings, reviews and contact buttons. Put it in your WhatsApp bio, your email signature and your social profiles.", "رابط واحد فيه عقاراتك وتقييماتك وأزرار التواصل. ضعه في نبذة واتساب وتوقيع البريد وحساباتك الاجتماعية.")}
          </p>
        </div>
      </div>

      {live === false && (
        <p className="text-[13px] font-medium text-ink bg-warning-soft border border-warning/30 rounded-xl px-4 py-3">
          {t("Your page appears to the public once you have a live listing or your account is verified.", "تظهر صفحتك للجميع عندما يكون لديك عقار منشور أو يتم توثيق حسابك.")}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[14rem] px-3.5 py-2.5 rounded-xl bg-surface-2 text-[13px] font-semibold text-ink-muted truncate" dir="ltr" title={url}>
          {url.replace(/^https?:\/\//, "")}
        </div>
        <CopyButton text={url} label={t("Copy link", "نسخ الرابط")} doneLabel={t("Copied", "تم النسخ")} icon={<Copy size={15} />} />
        <a href={whatsappShareLink(message)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold transition-colors">
          <MessageCircle size={15} /> {t("Send on WhatsApp", "إرسال عبر واتساب")}
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface text-[13px] font-semibold text-ink hover:bg-surface-2 transition-colors">
          <ExternalLink size={15} /> {t("Open", "فتح")}
        </a>
        <CopyButton text={reviewUrl} label={t("Review link", "رابط التقييم")} doneLabel={t("Copied", "تم النسخ")} icon={<Star size={15} />} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3.5">
          <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0"><Eye size={20} strokeWidth={2.25} /></span>
          <span><span className="block font-serif text-xl font-semibold text-ink leading-none tabular-nums">{stats.profileViews}</span><span className="block text-[12px] text-ink-muted mt-1">{t("page visits, last 30 days", "زيارات الصفحة آخر 30 يوماً")}</span></span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3.5">
          <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Share2 size={20} strokeWidth={2.25} /></span>
          <span><span className="block font-serif text-xl font-semibold text-ink leading-none tabular-nums">{stats.shareVisits}</span><span className="block text-[12px] text-ink-muted mt-1">{t("visitors from links you shared", "زوار من روابط شاركتها")}</span></span>
        </div>
      </div>

      {hasData ? (
        <DashboardChart data={chart} type="bar" height={180} valueLabel={t("Page visits", "زيارات الصفحة")} secondaryValueLabel={t("From shared links", "من روابط مشاركة")} isRtl={isRtl} />
      ) : (
        <p className="text-[13px] text-ink-muted bg-surface-2/60 rounded-xl px-4 py-3">
          {t("No visits yet. Share a listing from My Listings (Share button) or send your page link, and the numbers start here.", "لا زيارات بعد. شارك عقاراً من «عقاراتي» (زر مشاركة) أو أرسل رابط صفحتك، وستبدأ الأرقام بالظهور هنا.")}
        </p>
      )}

      {stats.top.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5"><Link2 size={13} />{t("Listings your sharing sells best", "العقارات التي تجلب أكثر الزوار من مشاركتك")}</p>
          <ul className="divide-y divide-border/70">
            {stats.top.map(l => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 text-[13px] font-semibold text-ink truncate">{l.title}</span>
                <span className="text-[12px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-1 tabular-nums">{l.shareVisits} {t("visits", "زيارة")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Clients who can actually review you (they contacted you through the platform), each with a WhatsApp message ready to send. */
export function ReviewInvitePanel({ leads, agentName, slug, isRtl }: { leads: Lead[]; agentName: string; slug: string; isRtl: boolean }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const reviewUrl = profileUrl(window.location.origin, "agents", slug, { isRtl, review: true });
  const rank = (l: Lead) => (l.status === LeadStatus.CONVERTED ? 0 : l.status === LeadStatus.NEGOTIATION ? 1 : 2);
  // only people who came through the platform with an email can review (the server checks the same), newest first within a rank
  const eligible = leads
    .filter(l => !l.isArchived && !l.addedManually && !!l.visitorEmail && l.status !== LeadStatus.LOST)
    .sort((a, b) => rank(a) - rank(b) || Date.parse(b.createdDate) - Date.parse(a.createdDate))
    .slice(0, 8);

  return (
    <section className="bg-surface rounded-2xl border border-border shadow-card p-5 space-y-4" aria-label={t("Ask for reviews", "اطلب تقييمات")}>
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"><Star size={24} strokeWidth={2.25} /></span>
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink leading-tight">{t("Ask happy clients for a review", "اطلب تقييماً من العملاء الراضين")}</h3>
          <p className="text-[13px] text-ink-muted mt-0.5">
            {t("Reviews are what make a stranger call you. Only people who contacted you through Nerou Finder can write one, which keeps every review real.", "التقييمات هي ما يجعل الغريب يتصل بك. لا يكتبها إلا من تواصل معك عبر نيرو فايندر، فتبقى كل التقييمات حقيقية.")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <CopyButton text={reviewRequestMessage({ agentName, url: reviewUrl, isRtl })} label={t("Copy the message", "نسخ الرسالة")} doneLabel={t("Copied", "تم النسخ")} icon={<Copy size={15} />} />
        <CopyButton text={reviewUrl} label={t("Copy only the link", "نسخ الرابط فقط")} doneLabel={t("Copied", "تم النسخ")} icon={<Link2 size={15} />} />
      </div>

      {eligible.length === 0 ? (
        <p className="text-[13px] text-ink-muted bg-surface-2/60 rounded-xl px-4 py-3">
          {t("No client has contacted you through the platform with an email yet. When one does, they appear here.", "لم يتواصل معك عميل عبر المنصة ببريد إلكتروني بعد. حين يحدث ذلك سيظهر هنا.")}
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {eligible.map(l => (
            <li key={l.id} className="flex items-center gap-3 py-3">
              <span className="w-9 h-9 rounded-xl bg-surface-2 text-ink font-serif font-bold flex items-center justify-center shrink-0">{(l.visitorName || "?").slice(0, 1).toUpperCase()}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink truncate">{l.visitorName}</span>
                <span className="block text-[12px] text-ink-muted">{l.status === LeadStatus.CONVERTED ? t("Deal done: the best time to ask", "تمت الصفقة: أفضل وقت للطلب") : t("Enquired through the platform", "استفسر عبر المنصة")}</span>
              </span>
              <a
                href={whatsappShareLink(reviewRequestMessage({ clientName: l.visitorName, agentName, url: reviewUrl, isRtl }), l.visitorWhatsapp || l.visitorPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors"
              >
                <MessageCircle size={14} /> {t("Ask on WhatsApp", "اطلب عبر واتساب")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
