/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Check, Clock, Copy, Eye, Info, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { AttentionItem } from "../lib/workspaceAttention.js";
import type { Property } from "../types.js";

// The frame shared by the agent and agency workspaces: a welcome band, who you are, a dark side menu where every section
// has its own coloured icon and a label (a row of icons on a phone), and the page itself.

/** Every section gets its own colour so an icon reads as an icon and is recognised at a glance. */
export type Accent = "indigo" | "emerald" | "amber" | "sky" | "teal" | "violet" | "rose" | "fuchsia" | "gold";

// Full class names (not built from strings) so Tailwind can see them.
const ACCENTS: Record<Accent, { dark: string; solid: string; light: string; hover: string }> = {
  indigo: { dark: "bg-indigo-400/20 text-indigo-200", solid: "bg-indigo-500 text-white", light: "bg-indigo-100 text-indigo-700", hover: "group-hover:bg-indigo-500 group-hover:text-white" },
  emerald: { dark: "bg-emerald-400/20 text-emerald-200", solid: "bg-emerald-500 text-white", light: "bg-emerald-100 text-emerald-700", hover: "group-hover:bg-emerald-500 group-hover:text-white" },
  amber: { dark: "bg-amber-400/20 text-amber-200", solid: "bg-amber-500 text-white", light: "bg-amber-100 text-amber-700", hover: "group-hover:bg-amber-500 group-hover:text-white" },
  sky: { dark: "bg-sky-400/20 text-sky-200", solid: "bg-sky-500 text-white", light: "bg-sky-100 text-sky-700", hover: "group-hover:bg-sky-500 group-hover:text-white" },
  teal: { dark: "bg-teal-400/20 text-teal-200", solid: "bg-teal-500 text-white", light: "bg-teal-100 text-teal-700", hover: "group-hover:bg-teal-500 group-hover:text-white" },
  violet: { dark: "bg-violet-400/20 text-violet-200", solid: "bg-violet-500 text-white", light: "bg-violet-100 text-violet-700", hover: "group-hover:bg-violet-500 group-hover:text-white" },
  rose: { dark: "bg-rose-400/20 text-rose-200", solid: "bg-rose-500 text-white", light: "bg-rose-100 text-rose-700", hover: "group-hover:bg-rose-500 group-hover:text-white" },
  fuchsia: { dark: "bg-fuchsia-400/20 text-fuchsia-200", solid: "bg-fuchsia-500 text-white", light: "bg-fuchsia-100 text-fuchsia-700", hover: "group-hover:bg-fuchsia-500 group-hover:text-white" },
  gold: { dark: "bg-gold/20 text-gold", solid: "bg-gold text-gold-ink", light: "bg-gold-soft text-gold-active", hover: "group-hover:bg-gold group-hover:text-gold-ink" }
};

export interface NavItem {
  id: string;
  label: { en: string; ar: string };
  icon: LucideIcon;
  accent?: Accent;
  /** a small count shown on the item (unread enquiries, items waiting) */
  badge?: number;
  /** the data-tour selector the product tour points at */
  tourId?: string;
}

export interface NavGroup {
  id: string;
  label: { en: string; ar: string };
  items: NavItem[];
}

export interface WorkspaceIdentity {
  image?: string;
  /** shown when there is no image */
  initial: string;
  title: string;
  subtitle?: React.ReactNode;
}

const STORAGE_KEY = "ws-nav-collapsed";

function readCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

// The product tour looks elements up by data-tour. Both menus (phone strip, desktop sidebar) are in the page and the
// hidden one would be found first, so only the one that is actually showing carries the marker.
function useIsDesktop(): boolean {
  const query = "(min-width: 1024px)";
  const [on, setOn] = useState<boolean>(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : true));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return on;
}

function Avatar({ identity, size }: { identity: WorkspaceIdentity; size: number }) {
  const box = { width: size, height: size };
  return identity.image ? (
    <img src={identity.image} alt="" style={box} className="rounded-xl object-cover bg-white shrink-0 ring-2 ring-gold/70" />
  ) : (
    <span style={box} className="rounded-xl bg-gold text-gold-ink font-serif font-bold flex items-center justify-center shrink-0 text-lg ring-2 ring-gold/40">
      {identity.initial.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Count({ n, className = "" }: { n?: number; className?: string }) {
  if (!n || n <= 0) return null;
  return (
    <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full bg-gold text-gold-ink text-[11px] font-bold leading-[22px] text-center tabular-nums shadow-sm ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** The welcome band at the top of a workspace: a deep navy panel with a soft gold glow, instead of plain text on a flat page. */
export function WorkspaceHero({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-chrome via-chrome to-[#1d2f50] text-white px-5 py-6 sm:px-8 sm:py-7 shadow-popover">
      <div className="pointer-events-none absolute -top-24 -end-16 w-72 h-72 rounded-full bg-gold/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 start-1/3 w-64 h-64 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.16em]">{eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl font-serif font-medium mt-1">{title}</h2>
          {subtitle && <p className="text-[13px] text-gray-300 mt-1.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export default function WorkspaceShell({
  groups,
  active,
  onSelect,
  identity,
  isRtl,
  children
}: {
  groups: NavGroup[];
  active: string;
  onSelect: (id: string) => void;
  identity: WorkspaceIdentity;
  isRtl: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const toggle = () => {
    setCollapsed(c => {
      try { localStorage.setItem(STORAGE_KEY, c ? "0" : "1"); } catch { /* private mode: it just will not be remembered */ }
      return !c;
    });
  };
  const flat = groups.flatMap(g => g.items);
  const strip = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  // On a phone the strip scrolls sideways: keep the chosen section in view.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [active]);

  const label = (i: { label: { en: string; ar: string } }) => (isRtl ? i.label.ar : i.label.en);
  const collapseLabel = collapsed ? (isRtl ? "توسيع القائمة" : "Expand menu") : (isRtl ? "تصغير القائمة" : "Collapse menu");

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      {/* Phone and small tablet: one row of coloured icons with labels under them. */}
      <nav aria-label={isRtl ? "أقسام مساحة العمل" : "Workspace sections"} className="lg:hidden mb-5 rounded-2xl bg-chrome shadow-card">
        <div ref={strip} className="flex overflow-x-auto scrollbar-none snap-x px-2 gap-1 py-2">
          {flat.map(item => {
            const Icon = item.icon;
            const on = item.id === active;
            const a = ACCENTS[item.accent || "gold"];
            return (
              <button
                key={item.id}
                type="button"
                data-tour={isDesktop ? undefined : item.tourId}
                aria-current={on ? "page" : undefined}
                onClick={() => onSelect(item.id)}
                className={`relative snap-center shrink-0 min-w-[80px] flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${on ? "bg-white/10 ring-1 ring-gold/60 text-white" : "text-gray-300 hover:bg-white/5"}`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${on ? a.solid : a.dark}`}>
                  <Icon size={22} strokeWidth={2.25} aria-hidden />
                </span>
                <span className="text-[11px] font-semibold leading-tight whitespace-nowrap">{label(item)}</span>
                {!!item.badge && item.badge > 0 && <Count n={item.badge} className="absolute top-1 end-2 !min-w-[18px] !h-[18px] !leading-[18px] !text-[10px] !px-1" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop: a dark side panel with the identity card and a vertical menu. */}
      <aside className={`hidden lg:block shrink-0 sticky top-24 transition-[width] duration-200 ${collapsed ? "w-[80px]" : "w-[272px]"}`}>
        <div className="rounded-3xl bg-gradient-to-b from-chrome to-[#16243d] text-white shadow-popover overflow-hidden">
          <div className={`flex items-center gap-3 border-b border-white/10 ${collapsed ? "justify-center p-3.5" : "p-5"}`}>
            <Avatar identity={identity} size={collapsed ? 42 : 48} />
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-serif text-[16px] font-semibold text-white leading-snug truncate" title={identity.title}>{identity.title}</p>
                {identity.subtitle && <div className="text-[11px] text-gray-300 mt-0.5 leading-snug">{identity.subtitle}</div>}
              </div>
            )}
          </div>

          <nav aria-label={isRtl ? "أقسام مساحة العمل" : "Workspace sections"} className="p-3 space-y-3.5">
            {groups.map((group, gi) => (
              <div key={group.id}>
                {!collapsed ? (
                  <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{label(group)}</p>
                ) : (
                  gi > 0 && <div className="mx-3 mb-2 border-t border-white/10" aria-hidden />
                )}
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const on = item.id === active;
                    const a = ACCENTS[item.accent || "gold"];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-tour={isDesktop ? item.tourId : undefined}
                        aria-current={on ? "page" : undefined}
                        title={collapsed ? label(item) : undefined}
                        onClick={() => onSelect(item.id)}
                        className={`group relative w-full flex items-center gap-3 rounded-2xl cursor-pointer transition-colors text-[13.5px] font-semibold ${collapsed ? "justify-center p-2" : "px-2.5 py-2"} ${on ? "bg-white/10 ring-1 ring-gold/60 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"}`}
                      >
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${on ? a.solid : a.dark}`}>
                          <Icon size={21} strokeWidth={2.25} aria-hidden />
                        </span>
                        {!collapsed && <span className="flex-1 min-w-0 truncate text-start">{label(item)}</span>}
                        {!collapsed && <Count n={item.badge} />}
                        {collapsed && !!item.badge && item.badge > 0 && <span className="absolute top-1.5 end-2 w-3 h-3 rounded-full bg-gold ring-2 ring-chrome" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <button
            type="button"
            onClick={toggle}
            aria-label={collapseLabel}
            title={collapseLabel}
            className={`w-full flex items-center gap-2 border-t border-white/10 text-[12px] font-semibold text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors ${collapsed ? "justify-center p-3.5" : "px-5 py-3.5"}`}
          >
            {(collapsed !== isRtl) ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>{collapseLabel}</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-6">{children}</div>
    </div>
  );
}

const TONE_STYLE: Record<AttentionItem["tone"], { row: string; tile: string; Icon: LucideIcon }> = {
  danger: { row: "border-danger/30 bg-danger-soft", tile: "bg-danger text-white", Icon: AlertTriangle },
  warning: { row: "border-warning/30 bg-warning-soft", tile: "bg-warning text-white", Icon: Clock },
  info: { row: "border-border bg-surface-2/60", tile: "bg-sky-100 text-sky-700", Icon: Info }
};

/** "Needs your attention": each row says what is wrong and takes you to where it is fixed. All clear when empty. */
export function AttentionPanel({ items, onGo, isRtl }: { items: AttentionItem[]; onGo: (tab: string) => void; isRtl: boolean }) {
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  return (
    <section className="bg-surface rounded-2xl border border-border shadow-card p-5" aria-label={isRtl ? "ما يحتاج انتباهك" : "Needs your attention"}>
      <h3 className="font-serif text-base font-semibold text-ink mb-3">{isRtl ? "ما يحتاج انتباهك" : "Needs your attention"}</h3>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-success-soft border border-success/20 p-4">
          <span className="w-9 h-9 rounded-lg bg-success text-white flex items-center justify-center shrink-0"><CheckCircle2 size={20} strokeWidth={2.25} /></span>
          <p className="text-sm font-medium text-ink">{isRtl ? "كل شيء على ما يرام. لا شيء ينتظرك الآن." : "All clear. Nothing is waiting for you right now."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(item => {
            const { row, tile, Icon } = TONE_STYLE[item.tone];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onGo(item.tab)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-start cursor-pointer transition hover:brightness-95 ${row}`}
                >
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tile}`}><Icon size={19} strokeWidth={2.25} aria-hidden /></span>
                  <span className="flex-1 text-[13px] font-medium text-ink leading-snug">{isRtl ? item.ar : item.en}</span>
                  <Arrow size={16} className="text-ink-muted shrink-0" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export interface QuickAction {
  id: string;
  label: { en: string; ar: string };
  hint?: { en: string; ar: string };
  icon: LucideIcon;
  accent?: Accent;
  onClick: () => void;
}

/** Big, obvious shortcuts to the things done every day. */
export function QuickActions({ actions, isRtl }: { actions: QuickAction[]; isRtl: boolean }) {
  return (
    <div className={`grid grid-cols-2 ${actions.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
      {actions.map(a => {
        const Icon = a.icon;
        const c = ACCENTS[a.accent || "gold"];
        return (
          <button
            key={a.id}
            type="button"
            onClick={a.onClick}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-start shadow-card cursor-pointer transition hover:-translate-y-0.5 hover:border-gold hover:shadow-popover"
          >
            <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${c.light} ${c.hover}`}>
              <Icon size={24} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink leading-snug">{isRtl ? a.label.ar : a.label.en}</span>
              {a.hint && <span className="block text-[11px] text-ink-muted leading-snug mt-0.5">{isRtl ? a.hint.ar : a.hint.en}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The listings that are getting looked at, with a one-tap way to copy the public link to send to a client. */
export function TopListingsPanel({ properties, isRtl, onOpenAll }: { properties: Pick<Property, "id" | "title" | "titleAr" | "district" | "city" | "views" | "price" | "currency">[]; isRtl: boolean; onOpenAll?: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (properties.length === 0) return null;
  const copy = async (id: string) => {
    const link = `${window.location.origin}${isRtl ? "/ar" : ""}/properties/${id}`;
    try { await navigator.clipboard.writeText(link); setCopied(id); setTimeout(() => setCopied(c => (c === id ? null : c)), 2000); } catch { /* clipboard blocked: nothing to do */ }
  };
  return (
    <section className="bg-surface rounded-2xl border border-border shadow-card p-5" aria-label={isRtl ? "الأكثر مشاهدة" : "Most viewed"}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-serif text-base font-semibold text-ink">{isRtl ? "الأكثر مشاهدة" : "Most viewed listings"}</h3>
        {onOpenAll && <button type="button" onClick={onOpenAll} className="text-[12px] font-bold text-gold-active hover:underline cursor-pointer">{isRtl ? "كل العقارات" : "All listings"}</button>}
      </div>
      <ol className="divide-y divide-border/70">
        {properties.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <span className="w-8 h-8 rounded-full bg-gold text-gold-ink text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink truncate">{isRtl ? p.titleAr || p.title : p.title}</span>
              <span className="block text-[12px] text-ink-muted truncate">{p.district}, {p.city} · {p.price?.toLocaleString()} {p.currency}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-sky-700 bg-sky-100 rounded-full px-2 py-1 tabular-nums shrink-0"><Eye size={14} strokeWidth={2.25} aria-hidden />{(p.views || 0).toLocaleString()}</span>
            <button
              type="button"
              onClick={() => copy(p.id)}
              title={isRtl ? "نسخ رابط العقار" : "Copy listing link"}
              aria-label={isRtl ? "نسخ رابط العقار" : "Copy listing link"}
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors"
            >
              {copied === p.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied === p.id ? (isRtl ? "تم النسخ" : "Copied") : (isRtl ? "نسخ الرابط" : "Copy link")}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
