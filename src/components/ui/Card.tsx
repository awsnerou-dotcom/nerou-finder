/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
}

// Shared card surface - standardizes on rounded-xl + border-border + shadow-card, replacing
// the dozens of hand-written `bg-surface rounded-xl border border-border ...` combinations
// (and their light drift, e.g. some using shadow-sm, some shadow-md, some none at all).
export function Card({ padded = true, interactive = false, className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={`
        bg-surface border border-border rounded-xl shadow-card
        ${padded ? "p-5" : ""}
        ${interactive ? "transition-shadow duration-200 hover:shadow-popover" : ""}
        ${className}
      `.replace(/\s+/g, " ").trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
