/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export type BadgeTone = "neutral" | "gold" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  gold: "bg-gold-soft text-gold-active",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-ink-faint",
  gold: "bg-gold",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

// Shared status pill - standardizes the badge/chip pattern used for listing status, verification
// state, ticket priority, etc. across the app (previously each screen picked its own ad hoc
// colors, e.g. green-600/red-600/blue-600 mixed with the custom gold/charcoal palette).
export function Badge({ tone = "neutral", dot = false, className = "", children, ...rest }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
        text-[11px] font-bold uppercase tracking-wide
        ${TONE_CLASSES[tone]}
        ${className}
      `.replace(/\s+/g, " ").trim()}
      {...rest}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASSES[tone]}`} />}
      {children}
    </span>
  );
}
