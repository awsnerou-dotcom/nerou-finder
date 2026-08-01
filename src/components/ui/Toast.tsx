/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastTone = "info" | "success" | "warning" | "danger";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ShowToastOptions {
  tone?: ToastTone;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Read anywhere in the tree to fire a toast: const { showToast } = useToast();
// showToast("Saved successfully", { tone: "success" }).
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fails loudly rather than silently no-op'ing, so a missing <ToastProvider> at the app
    // root is caught immediately during development instead of manifesting as "toasts just
    // don't show up" bug reports later.
    throw new Error("useToast() must be used within a <ToastProvider>.");
  }
  return ctx;
}

const TONE_STYLES: Record<ToastTone, { icon: React.ComponentType<{ size?: number; className?: string }>; iconClass: string }> = {
  info: { icon: Info, iconClass: "text-info" },
  success: { icon: CheckCircle2, iconClass: "text-success" },
  warning: { icon: AlertTriangle, iconClass: "text-warning" },
  danger: { icon: XCircle, iconClass: "text-danger" },
};

// Mount once near the app root (see App.tsx). Replaces the 6 independently-duplicated local
// toast implementations found across AgencyWorkspace/AgentWorkspace/ControlCenter/
// DeveloperWorkspace/SupportTicketsView/VerificationDocumentsPanel, and the window.alert()
// fallbacks in files that had no toast mechanism at all (VisitorExperience, and two error
// paths in AgentWorkspace that had toast state but used alert() anyway).
export function ToastProvider({ children, isRtl = false }: { children: React.ReactNode; isRtl?: boolean }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, options?: ShowToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tone = options?.tone ?? "info";
    const duration = options?.duration ?? 4500;
    setToasts((prev) => [...prev, { id, message, tone }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed z-[200] bottom-5 ${isRtl ? "left-5" : "right-5"} flex flex-col gap-2 w-[calc(100%-2.5rem)] max-w-sm pointer-events-none`}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {toasts.map((t) => {
              const { icon: Icon, iconClass } = TONE_STYLES[t.tone];
              return (
                <div
                  key={t.id}
                  role="status"
                  aria-live="polite"
                  className="pointer-events-auto animate-toast-in flex items-start gap-3 bg-surface border border-border rounded-xl shadow-modal p-3.5"
                >
                  <Icon size={18} className={`shrink-0 mt-0.5 ${iconClass}`} />
                  <p className="text-sm text-ink flex-1 leading-snug">{t.message}</p>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label={isRtl ? "إغلاق الإشعار" : "Dismiss notification"}
                    className="shrink-0 text-ink-faint hover:text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
