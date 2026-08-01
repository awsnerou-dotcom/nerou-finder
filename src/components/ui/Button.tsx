/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gold text-gold-ink hover:bg-gold-hover active:bg-gold-active shadow-card disabled:hover:bg-gold",
  secondary:
    "bg-surface-2 text-ink hover:bg-border border border-border disabled:hover:bg-surface-2",
  outline:
    "bg-transparent text-ink border border-border-strong hover:bg-surface-2 disabled:hover:bg-transparent",
  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink disabled:hover:bg-transparent",
  danger:
    "bg-danger text-white hover:brightness-95 active:brightness-90 shadow-card disabled:hover:brightness-100",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

// Shared button primitive - every button in the app should render through this rather than a
// hand-rolled <button className="..."> so variant/size/focus/disabled/loading states stay
// consistent across all 27+ screens instead of drifting per-component.
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    className = "",
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-semibold tracking-tight
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer select-none
        ${fullWidth ? "w-full" : ""}
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${className}
      `.replace(/\s+/g, " ").trim()}
      {...rest}
    >
      {loading ? (
        <Loader2 className="animate-spin shrink-0" size={size === "sm" ? 14 : 16} />
      ) : (
        leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="shrink-0 inline-flex">{rightIcon}</span>}
    </button>
  );
});
