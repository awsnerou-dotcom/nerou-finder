/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Award, BadgeCheck, Bed, Bath, Building2, Check, Copy, Globe, Languages, Mail, MapPin, MessageCircle, Phone, Ruler,
  Share2, Star, Users, X
} from "lucide-react";
import type { Property } from "../types.js";
import type { PublicProfile } from "../lib/publicProfile.js";
import { profileUrl, whatsappShareLink } from "../lib/profiles.js";
import type { ProfileKind } from "../lib/profiles.js";
import { useCurrency } from "../currencyContext.js";
import AgentBadges from "./AgentBadges.js";
import ProfileReviewsSection from "./ProfileReviewsSection.js";

// The public page of an agent or an agency (/agents/:slug, /agencies/:slug): who they are, how to reach them in one tap,
// their live listings and what their clients say. It is the page an agent sends to clients and posts on social media, and
// the page search engines index under their name.

export default function PublicProfileView({
  kind,
  slug,
  isRtl,
  currentUser,
  openReview = false,
  onClose,
  onOpenProperty,
  onOpenProfile
}: {
  kind: ProfileKind;
  slug: string;
  isRtl: boolean;
  currentUser: any;
  /** opened from a link that asks for a review */
  openReview?: boolean;
  onClose: () => void;
  onOpenProperty: (p: Property) => void;
  onOpenProfile: (kind: ProfileKind, slug: string) => void;
}) {
  const { formatPrice } = useCurrency();
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(12);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const wantsReview = openReview;

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setMissing(false);
    fetch(`/api/public/profile/${kind}/${slug}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: PublicProfile | null) => {
        if (cancelled) return;
        if (!data) { setMissing(true); return; }
        setProfile(data);
        // count the visit (once per visitor per half hour on the server)
        fetch(`/api/public/profile/${kind}/${data.id}/visit`, { method: "POST" }).catch(() => {});
      })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [kind, slug]);

  // the tab title follows the page, as the server already wrote it for the first load
  useEffect(() => {
    if (!profile) return;
    const before = document.title;
    const name = isRtl && profile.nameAr ? profile.nameAr : profile.name;
    document.title = `${name} | ${isRtl ? "نيرو فايندر" : "Nerou Finder"}`;
    return () => { document.title = before; };
  }, [profile, isRtl]);

  // a link sent to ask for a review lands on the reviews, ready to write one
  useEffect(() => {
    if (profile && wantsReview) setTimeout(() => reviewsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
  }, [profile, wantsReview]);

  const Back = isRtl ? ArrowRight : ArrowLeft;
  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 bg-canvas overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-ink cursor-pointer">
          <Back size={16} /> {t("Back", "رجوع")}
        </button>
        {children}
      </div>
    </div>
  );

  if (missing) {
    return shell(
      <div className="text-center py-24 space-y-3">
        <X size={32} className="mx-auto text-ink-faint" />
        <h2 className="font-serif text-xl font-semibold text-ink">{t("This page is not available", "هذه الصفحة غير متاحة")}</h2>
        <p className="text-sm text-ink-muted">{t("The profile may have moved or is not public.", "ربما انتقل الملف أو أنه غير عام.")}</p>
      </div>
    );
  }
  if (!profile) {
    return shell(<div className="flex justify-center py-32"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>);
  }

  const name = isRtl && profile.nameAr ? profile.nameAr : profile.name;
  const pageUrl = profileUrl(window.location.origin, kind, profile.slug, { isRtl });
  const shareMessage = isRtl ? `${name} على نيرو فايندر:\n${pageUrl}` : `${name} on Nerou Finder:\n${pageUrl}`;
  const waNumber = profile.whatsapp || profile.phone;
  const hello = isRtl ? `مرحباً ${name}، رأيت ملفك على نيرو فايندر.` : `Hello ${name}, I found your profile on Nerou Finder.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const since = profile.memberSince ? new Date(profile.memberSince).getFullYear() : null;
  const round = kind === "agents" ? "rounded-full" : "rounded-2xl";

  return shell(
    <>
      {/* hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-chrome via-chrome to-[#1d2f50] text-white p-6 sm:p-8 shadow-popover">
        <div className="pointer-events-none absolute -top-24 -end-16 w-72 h-72 rounded-full bg-gold/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          {profile.image ? (
            <img src={profile.image} alt={name} className={`w-28 h-28 object-cover ring-4 ring-gold/70 bg-white shrink-0 ${round}`} />
          ) : (
            <span className={`w-28 h-28 bg-gold text-gold-ink font-serif font-bold text-4xl flex items-center justify-center shrink-0 ${round}`}>{name.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-3xl font-medium">{name}</h1>
              {profile.verified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[12px] font-bold" title={(isRtl ? profile.verifiedLabelAr : profile.verifiedLabel) || undefined}>
                  <BadgeCheck size={14} /> {t("Verified", "موثّق")}
                </span>
              )}
            </div>
            <p className="text-[14px] text-gray-300 flex items-center gap-2 flex-wrap">
              <Building2 size={14} aria-hidden />
              {profile.org ? (
                <button type="button" onClick={() => onOpenProfile("agencies", profile.org!.slug)} className="font-semibold hover:text-gold cursor-pointer">{profile.org.name}</button>
              ) : (
                <span>{isRtl ? profile.subtitle.ar : profile.subtitle.en}</span>
              )}
              {since && <span className="text-gray-400">· {t(`on Nerou Finder since ${since}`, `على نيرو فايندر منذ ${since}`)}</span>}
            </p>
            <AgentBadges performance={profile.performance} isRtl={isRtl} size="md" />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-[13px] font-semibold">
                <Building2 size={14} className="text-gold" /> {profile.listingsCount} {t("live listings", "عقاراً منشوراً")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-[13px] font-semibold">
                <Star size={14} className="text-gold fill-gold" />
                {profile.rating.count > 0 ? `${profile.rating.average.toFixed(1)} (${profile.rating.count})` : t("No reviews yet", "لا تقييمات بعد")}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0 md:w-52">
            {waNumber && (
              <a href={whatsappShareLink(hello, waNumber)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors">
                <MessageCircle size={18} /> {t("WhatsApp", "واتساب")}
              </a>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors">
                <Phone size={18} /> <span dir="ltr">{profile.phone}</span>
              </a>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={copy} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[12px] font-semibold cursor-pointer transition-colors">
                {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />} {copied ? t("Copied", "تم النسخ") : t("Copy link", "نسخ الرابط")}
              </button>
              <a href={whatsappShareLink(shareMessage)} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[12px] font-semibold transition-colors">
                <Share2 size={14} /> {t("Share", "مشاركة")}
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* listings */}
          <section className="space-y-3" aria-label={t("Listings", "العقارات")}>
            <h2 className="font-serif text-xl font-semibold text-ink">{t("Live listings", "العقارات المنشورة")}</h2>
            {profile.listings.length === 0 ? (
              <p className="text-sm text-ink-muted bg-surface border border-dashed border-border rounded-2xl p-8 text-center">{t("No listings are live right now.", "لا توجد عقارات منشورة حالياً.")}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {profile.listings.slice(0, shown).map(p => (
                  <button key={p.id} type="button" onClick={() => onOpenProperty(p)} className="group text-start bg-surface border border-border rounded-2xl shadow-card overflow-hidden hover:shadow-popover hover:border-gold transition cursor-pointer">
                    <div className="aspect-[4/3] bg-surface-2 overflow-hidden">
                      {p.images?.[0] ? <img src={p.images[0]} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center text-ink-faint"><Building2 size={36} strokeWidth={1.5} /></div>}
                    </div>
                    <div className="p-4 space-y-1.5">
                      <p className="font-serif text-lg font-semibold text-gold-active tabular-nums">{formatPrice(p.price, isRtl)}</p>
                      <p className="text-[14px] font-semibold text-ink truncate">{isRtl ? p.titleAr || p.title : p.title}</p>
                      <p className="text-[12px] text-ink-muted flex items-center gap-1 truncate"><MapPin size={12} />{p.district}, {p.city}</p>
                      <p className="text-[12px] text-ink-muted flex items-center gap-3 pt-1">
                        {typeof p.bedrooms === "number" && <span className="inline-flex items-center gap-1"><Bed size={13} />{p.bedrooms === 0 ? t("Studio", "استوديو") : p.bedrooms}</span>}
                        {!!p.bathrooms && <span className="inline-flex items-center gap-1"><Bath size={13} />{p.bathrooms}</span>}
                        {!!p.area && <span className="inline-flex items-center gap-1"><Ruler size={13} />{Math.round(p.area)} {p.sizeUnit === "SQFT" ? t("sqft", "قدم²") : t("sqm", "م²")}</span>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {profile.listings.length > shown && (
              <button type="button" onClick={() => setShown(n => n + 12)} className="w-full py-3 rounded-2xl border border-border bg-surface text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors">
                {t(`Show more (${profile.listings.length - shown} left)`, `عرض المزيد (${profile.listings.length - shown})`)}
              </button>
            )}
          </section>

          {/* reviews: the page a client is sent to when asked for a review lands here */}
          <section ref={reviewsRef} id="reviews" className={`scroll-mt-6 rounded-2xl ${wantsReview ? "ring-2 ring-gold/60 p-1" : ""}`}>
            {wantsReview && (
              <p className="px-3 py-2.5 text-[13px] font-semibold text-gold-active">
                {currentUser
                  ? t("Thank you for taking a minute to write your review.", "شكراً لأنك خصصت دقيقة لكتابة تقييمك.")
                  : t("Sign in with the email you contacted them from to write your review.", "سجّل الدخول بالبريد الذي تواصلت به لتكتب تقييمك.")}
              </p>
            )}
            <ProfileReviewsSection targetType={kind === "agents" ? "AGENT" : "AGENCY"} targetId={profile.id} currentUser={currentUser} isRtl={isRtl} />
          </section>
        </div>

        {/* about */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <section className="bg-surface border border-border rounded-2xl shadow-card p-5 space-y-4">
            <h2 className="font-serif text-lg font-semibold text-ink">{t("About", "نبذة")}</h2>
            <p className="text-[13px] text-ink-muted leading-relaxed">
              {profile.bio || t("Registered on Nerou Finder, serving the Qatar property market.", "مسجّل على نيرو فايندر ويخدم سوق العقار في قطر.")}
            </p>
            {profile.specialties.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5"><MapPin size={12} />{t("Specialities", "التخصصات")}</p>
                <div className="flex flex-wrap gap-1.5">{profile.specialties.map(s => <span key={s} className="px-2.5 py-1 bg-surface-2 rounded-lg text-[12px] font-semibold text-ink-muted">{s}</span>)}</div>
              </div>
            )}
            {profile.languages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5"><Languages size={12} />{t("Languages", "اللغات")}</p>
                <div className="flex flex-wrap gap-1.5">{profile.languages.map(s => <span key={s} className="px-2.5 py-1 bg-surface-2 rounded-lg text-[12px] font-semibold text-ink-muted">{s}</span>)}</div>
              </div>
            )}
            {(profile.email || profile.website) && (
              <div className="space-y-2 pt-3 border-t border-border">
                {profile.email && <a href={`mailto:${profile.email}`} className="flex items-center gap-2 text-[13px] font-semibold text-ink hover:text-gold-active break-all"><Mail size={14} className="shrink-0" />{profile.email}</a>}
                {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[13px] font-semibold text-ink hover:text-gold-active break-all"><Globe size={14} className="shrink-0" />{profile.website.replace(/^https?:\/\//, "")}</a>}
              </div>
            )}
          </section>

          {profile.team && profile.team.length > 0 && (
            <section className="bg-surface border border-border rounded-2xl shadow-card p-5 space-y-3">
              <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2"><Users size={16} className="text-gold" />{t("Team", "فريق العمل")}</h2>
              <ul className="space-y-1">
                {profile.team.map(m => (
                  <li key={m.slug}>
                    <button type="button" onClick={() => onOpenProfile("agents", m.slug)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2 text-start cursor-pointer transition-colors">
                      {m.image ? <img src={m.image} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-gold-soft text-gold-active font-bold flex items-center justify-center">{m.name.slice(0, 1)}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink truncate">{m.name}</span>
                        <span className="block text-[11px] text-ink-muted">{m.listings} {t("listings", "عقاراً")}</span>
                      </span>
                      {m.verified && <Award size={14} className="text-gold shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
