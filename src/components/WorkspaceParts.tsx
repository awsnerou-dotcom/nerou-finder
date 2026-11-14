/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import type { LucideIcon } from "lucide-react";
import { Building2, Mail, MessageSquare, Phone } from "lucide-react";
import { Badge } from "./ui/Badge.js";
import type { Accent } from "./WorkspaceShell.js";
import { leadStatusTone, listingStatusTone } from "../lib/dashboardMetrics.js";
import { leadStatusLabel, listingStatusLabel, timeAgo } from "../lib/statusLabels.js";
import type { Lead, Property } from "../types.js";

// The building blocks of the pages inside the agent and agency workspaces, so every section looks like it belongs to the
// same product: a header with a coloured icon, a strip of numbers, an enquiry card and a listing card.

const TILE: Record<Accent, string> = {
  indigo: "bg-indigo-100 text-indigo-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  teal: "bg-teal-100 text-teal-700",
  violet: "bg-violet-100 text-violet-700",
  rose: "bg-rose-100 text-rose-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  gold: "bg-gold-soft text-gold-active"
};

/** The top of every section: what this page is, in one line, and its main button. */
export function SectionHeader({ icon: Icon, accent = "gold", title, description, action }: { icon: LucideIcon; accent?: Accent; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${TILE[accent]}`}>
          <Icon size={24} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-semibold text-ink leading-tight">{title}</h3>
          {description && <p className="text-[13px] text-ink-muted mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0 flex-wrap">{action}</div>}
    </div>
  );
}

export interface StripItem {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  accent?: Accent;
  /** pressing it filters or opens something */
  onClick?: () => void;
  active?: boolean;
}

/** A row of small numbers under a section header ("12 live, 3 paused, 2 waiting"); each can be a filter. */
export function StatStrip({ items }: { items: StripItem[] }) {
  return (
    <div className={`grid grid-cols-2 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
      {items.map(i => {
        const Icon = i.icon;
        const body = (
          <>
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TILE[i.accent || "gold"]}`}>
              <Icon size={20} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="min-w-0 text-start">
              <span className="block font-serif text-xl font-semibold text-ink leading-none tabular-nums">{i.value}</span>
              <span className="block text-[12px] text-ink-muted mt-1 leading-tight truncate">{i.label}</span>
            </span>
          </>
        );
        const cls = `flex items-center gap-3 rounded-2xl border bg-surface p-3.5 shadow-card ${i.active ? "border-gold ring-1 ring-gold/50" : "border-border"}`;
        return i.onClick ? (
          <button key={i.label} type="button" onClick={i.onClick} aria-pressed={!!i.active} className={`${cls} cursor-pointer transition hover:border-gold`}>{body}</button>
        ) : (
          <div key={i.label} className={cls}>{body}</div>
        );
      })}
    </div>
  );
}

const AVATAR_TONE = {
  danger: "bg-rose-100 text-rose-700",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  info: "bg-sky-100 text-sky-700",
  gold: "bg-gold-soft text-gold-active",
  neutral: "bg-surface-2 text-ink-muted"
} as const;

/** One enquiry: who, how to reach them, what they asked, where it stands, and what you can do about it. */
export function LeadCard({
  lead,
  isRtl,
  now,
  unread,
  onOpen,
  onViewProperty,
  controls,
  footer
}: {
  lead: Lead;
  isRtl: boolean;
  now: number;
  unread?: boolean;
  onOpen: () => void;
  onViewProperty?: () => void;
  controls?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const phone = (lead.visitorWhatsapp || lead.visitorPhone || "").replace(/[^0-9]/g, "");
  const tone = leadStatusTone(lead.status);
  const hello = encodeURIComponent(isRtl ? `مرحباً ${lead.visitorName}، بخصوص استفساركم العقاري.` : `Hello ${lead.visitorName}, regarding your property inquiry.`);
  const when = timeAgo(lead.createdDate, now, isRtl);
  return (
    <article className={`bg-surface rounded-2xl border shadow-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 ${lead.status === "NEW" ? "border-danger/40" : "border-border"}`}>
      <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-serif text-lg font-bold ${AVATAR_TONE[tone]}`} aria-hidden>
        {(lead.visitorName || "?").slice(0, 1).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={onOpen} className="font-semibold text-ink text-[15px] hover:text-gold-active cursor-pointer">{lead.visitorName}</button>
          {unread && <span className="w-2 h-2 rounded-full bg-danger shrink-0" title={isRtl ? "غير مقروء" : "Unread"} />}
          <Badge tone={tone} dot>{leadStatusLabel(lead.status, isRtl)}</Badge>
          {when && <span className="text-[12px] text-ink-faint">{when}</span>}
        </div>

        {lead.message && (
          <p className="text-[13px] text-ink-muted leading-relaxed bg-surface-2/60 rounded-xl px-3 py-2 line-clamp-2">“{lead.message}”</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`https://wa.me/${phone}?text=${hello}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors"
          >
            <MessageSquare size={14} aria-hidden /> {isRtl ? "واتساب" : "WhatsApp"}
          </a>
          <a
            href={`tel:${lead.visitorPhone}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-chrome hover:bg-chrome-hover text-white text-[12px] font-semibold transition-colors"
          >
            <Phone size={14} aria-hidden /> <span dir="ltr">{lead.visitorPhone}</span>
          </a>
          {lead.visitorEmail && (
            <a
              href={`mailto:${lead.visitorEmail}`}
              title={lead.visitorEmail}
              aria-label={lead.visitorEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-ink-muted hover:text-ink hover:bg-surface-2 text-[12px] font-semibold transition-colors"
            >
              <Mail size={14} aria-hidden /> {isRtl ? "بريد" : "Email"}
            </a>
          )}
          {onViewProperty && (
            <button type="button" onClick={onViewProperty} className="text-[12px] font-semibold text-gold-active hover:underline cursor-pointer">
              {isRtl ? "العقار المرتبط" : "Related property"}
            </button>
          )}
        </div>
        {footer}
      </div>

      {controls && <div className="flex items-center gap-2 flex-wrap shrink-0">{controls}</div>}
    </article>
  );
}

/** A listing: photo with its status on it, title, place, price and views; the page adds its own controls as children. */
export function ListingCard({ property, isRtl, children, notice }: { property: Property; isRtl: boolean; children?: React.ReactNode; notice?: React.ReactNode }) {
  const image = property.images?.[0];
  return (
    <article className="bg-surface rounded-2xl border border-border shadow-card overflow-hidden flex flex-col sm:flex-row">
      <div className="relative sm:w-44 h-44 sm:h-auto shrink-0 bg-surface-2">
        {image ? <img src={image} alt={property.title} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-ink-faint" aria-hidden><Building2 size={36} strokeWidth={1.5} /></div>}
        <Badge tone={listingStatusTone(property.listingStatus)} dot className="absolute top-2.5 start-2.5 bg-white/95 shadow-sm !normal-case">{listingStatusLabel(property.listingStatus, isRtl)}</Badge>
      </div>
      <div className="flex-1 min-w-0 p-4 flex flex-col gap-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-faint tracking-wide" dir="ltr">{property.listingId}</p>
          <h4 className="text-[15px] font-semibold text-ink leading-snug truncate">{isRtl ? property.titleAr || property.title : property.title}</h4>
          <p className="text-[12px] text-ink-muted truncate">{property.district}, {property.city}</p>
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <p className="font-serif text-lg font-semibold text-gold-active tabular-nums">{property.price?.toLocaleString()} <span className="text-[12px] font-sans font-semibold">{property.currency || "QAR"}</span></p>
          <p className="text-[12px] text-ink-muted tabular-nums">{(property.views || 0).toLocaleString()} {isRtl ? "مشاهدة" : "views"} · {(property.uniqueViews || 0).toLocaleString()} {isRtl ? "فريدة" : "unique"}</p>
        </div>
        {notice}
        {children}
      </div>
    </article>
  );
}
