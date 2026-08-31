/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "./ui/index.js";

export interface TourStep {
  // Matches an element rendered elsewhere in the workspace with data-tour="<selector>".
  // Every selector used here must point at a Category-A (confirmed working) element -
  // never at a disabled/unwired feature.
  selector: string;
  title: string;
  body: string;
}

interface OnboardingTourProps {
  steps: TourStep[];
  isRtl: boolean;
  onFinish: () => void;
}

const TOOLTIP_WIDTH = 288;
const VIEWPORT_MARGIN = 12;

// Lightweight, dependency-free guided tour: a dimmed backdrop with a "spotlight" cut-out
// (pure CSS box-shadow trick, no canvas/SVG needed) around the real DOM element carrying a
// matching data-tour attribute, plus a small positioned tooltip with Next/Back/Skip. Steps
// whose target isn't present in the DOM (e.g. a tab hidden for this account state) are
// skipped automatically instead of pointing at nothing.
export default function OnboardingTour({ steps, isRtl, onFinish }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);

  useEffect(() => {
    const step = steps[stepIndex];
    if (!step) {
      onFinish();
      return;
    }

    const el = document.querySelector(`[data-tour="${step.selector}"]`);
    if (!el) {
      setMissingTarget(true);
      return;
    }
    setMissingTarget(false);

    el.scrollIntoView({ block: "center", behavior: "smooth" });

    const measure = () => setRect(el.getBoundingClientRect());
    // One tick so scrollIntoView has a chance to settle before measuring.
    const t = window.setTimeout(measure, 220);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, steps]);

  // Auto-skip a step whose target never rendered.
  useEffect(() => {
    if (!missingTarget) return;
    if (stepIndex < steps.length - 1) {
      setStepIndex(i => i + 1);
    } else {
      onFinish();
    }
  }, [missingTarget, stepIndex, steps.length, onFinish]);

  if (missingTarget || !rect) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const spaceBelow = window.innerHeight - rect.bottom;
  const placeAbove = spaceBelow < 180 && rect.top > 180;
  const top = placeAbove ? Math.max(VIEWPORT_MARGIN, rect.top - 10) : rect.bottom + 10;

  let left = isRtl ? rect.right - TOOLTIP_WIDTH : rect.left;
  left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN);

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={isRtl ? "جولة تعريفية" : "Guided tour"}>
      {/* Dimmed backdrop with a spotlight cut-out around the highlighted element */}
      <div
        className="absolute rounded-xl pointer-events-none transition-all duration-200"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(15, 13, 11, 0.65)",
          outline: "2px solid var(--gold, #bf9b30)",
          outlineOffset: 2,
        }}
      />

      <div
        className="absolute w-[288px] max-w-[calc(100vw-24px)] bg-surface border border-gold/40 rounded-xl shadow-modal p-4 space-y-3 animate-modal-in"
        style={{ top: placeAbove ? undefined : top, bottom: placeAbove ? window.innerHeight - top : undefined, left }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-serif text-sm font-bold text-ink leading-snug">{step.title}</h4>
          <button
            type="button"
            onClick={onFinish}
            aria-label={isRtl ? "تخطي الجولة" : "Skip tour"}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-ink-faint hover:text-ink hover:bg-surface-2 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">{step.body}</p>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === stepIndex ? "bg-gold" : "bg-border"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="ghost" size="sm" type="button" onClick={() => setStepIndex(i => i - 1)}>
                {isRtl ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={() => (isLast ? onFinish() : setStepIndex(i => i + 1))}
            >
              {isLast ? (isRtl ? "إنهاء" : "Finish") : isRtl ? "التالي" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
