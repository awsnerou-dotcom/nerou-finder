/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

// Shared "nothing here yet" state - standardizes what was previously a mix of single thin
// lines of text (e.g. HelpCenterView's "No articles found"), components that silently
// render nothing at all (BoostRecommendations returning null with no messaging), and a couple
// of two-tier heading+subtext treatments (CareersView) - into one consistent pattern with room
// for an icon and an optional call-to-action.
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
      {icon && (
        <div className="mb-4 w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-ink-faint">
          {icon}
        </div>
      )}
      <p className="font-serif text-base font-semibold text-ink mb-1">{title}</p>
      {description && <p className="text-sm text-ink-muted max-w-sm mb-5">{description}</p>}
      {action}
    </div>
  );
}
