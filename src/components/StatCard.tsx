/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Card } from "./ui/Card.js";
import { Skeleton } from "./ui/Skeleton.js";

export type StatCardTrendDirection = "up" | "down" | "neutral";

export interface StatCardTrend {
  label: string;
  direction: StatCardTrendDirection;
}

export interface StatCardProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  trend?: StatCardTrend;
  subtitle?: React.ReactNode;
  onClick?: () => void;
  // Renders on the same always-dark "chrome" brand surface used for the app's nav/hero
  // panels (see App.tsx's bg-chrome usage) - intended for the one or two "hero" KPIs a
  // dashboard wants to visually anchor (e.g. platform MRR), not for every tile.
  dark?: boolean;
  loading?: boolean;
  className?: string;
}

// Light-mode trend colors map directly onto the semantic tokens; dark (chrome) surfaces need
// their own mapping since text-ink-muted would be unreadable on bg-chrome.
const TREND_TEXT_LIGHT: Record<StatCardTrendDirection, string> = {
  up: "text-success",
  down: "text-danger",
  neutral: "text-ink-muted",
};
const TREND_TEXT_DARK: Record<StatCardTrendDirection, string> = {
  up: "text-success",
  down: "text-danger",
  neutral: "text-gray-400",
};
const TREND_GLYPH: Record<StatCardTrendDirection, string> = {
  up: "↑",
  down: "↓",
  neutral: "•",
};

// Shared KPI tile, composed from the shared Card primitive so every dashboard's stat tiles
// share the same surface/border/radius/shadow instead of each screen hand-rolling its own
// "bg-surface p-5 rounded-xl border border-border" div (which is exactly what ControlCenter,
// AgentWorkspace, AgencyWorkspace and DeveloperWorkspace were each doing slightly differently
// before this component existed).
export default function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  subtitle,
  onClick,
  dark = false,
  loading = false,
  className = "",
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <Skeleton variant="text" className="w-20" />
          <Skeleton variant="circle" className="w-8 h-8 shrink-0" />
        </div>
        <Skeleton variant="text" className="h-6 w-16 mb-2.5" />
        <Skeleton variant="text" className="w-28" />
      </Card>
    );
  }

  const trendTextClass = trend ? (dark ? TREND_TEXT_DARK[trend.direction] : TREND_TEXT_LIGHT[trend.direction]) : "";

  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`
        text-left w-full
        ${dark ? "bg-chrome border-chrome-hover text-white" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `.replace(/\s+/g, " ").trim()}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? "text-gray-400" : "text-ink-muted"}`}>
          {label}
        </span>
        {Icon && (
          <span
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
              dark ? "bg-white/10 text-gold" : "bg-gold-soft text-gold-active"
            }`}
          >
            <Icon size={15} />
          </span>
        )}
      </div>
      <h3 className={`text-2xl font-serif font-bold leading-tight ${dark ? "text-gold" : "text-ink"}`}>{value}</h3>
      {(subtitle || trend) && (
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {trend && (
            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trendTextClass}`}>
              <span aria-hidden="true">{TREND_GLYPH[trend.direction]}</span>
              <span>{trend.label}</span>
            </span>
          )}
          {subtitle && <span className={`text-[10px] ${dark ? "text-gray-400" : "text-ink-muted"}`}>{subtitle}</span>}
        </div>
      )}
    </Card>
  );
}
