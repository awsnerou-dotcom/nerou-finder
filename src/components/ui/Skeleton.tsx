/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "block" | "circle";
}

// Shared skeleton placeholder. Before this, only VisitorExperience's property grid had a real
// content-shaped loading state (inline, not reusable) - everywhere else either showed a bare
// spinner in an empty panel or popped content in with no loading affordance at all.
export function Skeleton({ variant = "block", className = "", ...rest }: SkeletonProps) {
  const shape =
    variant === "circle" ? "rounded-full" : variant === "text" ? "rounded-md h-3.5" : "rounded-lg";
  return (
    <div
      className={`animate-pulse bg-surface-2 ${shape} ${className}`}
      aria-hidden="true"
      {...rest}
    />
  );
}

// Convenience preset: a property/listing card skeleton, matching the real card's rough shape
// (image + title line + meta line) so the loading state doesn't visually jump when data arrives.
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-xl overflow-hidden ${className}`}>
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="p-4 space-y-2.5">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2" />
        <div className="flex gap-3 pt-1">
          <Skeleton variant="text" className="w-12" />
          <Skeleton variant="text" className="w-12" />
          <Skeleton variant="text" className="w-12" />
        </div>
      </div>
    </div>
  );
}

// Convenience preset: a dense table/list row skeleton for admin/dashboard tables.
export function RowSkeleton({ columns = 4, className = "" }: { columns?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-4 py-3 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" className={i === 0 ? "w-1/4" : "flex-1"} />
      ))}
    </div>
  );
}
