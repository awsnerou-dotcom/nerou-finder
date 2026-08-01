/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

// Shared loading spinner - most call sites just want `<Spinner />`; `label` renders visible
// help text next to it for slower operations where a bare spinner reads as "is this stuck?".
export function Spinner({ size = 20, className = "", label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2 text-ink-muted" role="status" aria-live="polite">
      <Loader2 size={size} className={`animate-spin text-gold ${className}`} />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}
