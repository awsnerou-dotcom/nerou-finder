/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isRtl?: boolean;
  closeLabel?: string;
}

// Shared modal shell - previously every modal in the app (login/signup, property compare,
// verification review, boost dialogs, etc.) was a hand-rolled `fixed inset-0` overlay div with
// its own close button, its own (often missing) Esc handling, and no focus management at all.
// This centralizes overlay + panel + focus trap + Esc-to-close + scroll-lock in one place.
export function Modal({ open, onClose, title, size = "md", children, footer, isRtl, closeLabel }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable?.[0] ?? panelRef.current)?.focus();
    };
    // Defer one tick so the panel is actually in the DOM before we try to focus into it.
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-overlay-in"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        dir={isRtl ? "rtl" : "ltr"}
        className={`
          relative w-full ${SIZE_CLASSES[size]} max-h-[90vh] flex flex-col
          bg-surface border border-border rounded-2xl shadow-modal
          animate-modal-in outline-none
        `.replace(/\s+/g, " ").trim()}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
            <h2 className="font-serif text-lg font-semibold text-ink text-balance">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel || (isRtl ? "إغلاق" : "Close")}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
