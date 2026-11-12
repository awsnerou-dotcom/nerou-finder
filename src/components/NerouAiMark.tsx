import React from "react";

// Nerou's own mark for the AI property search: a magnifying glass with a house inside it and a small
// "signal" dot. It replaces the four-point sparkle, which looks like another company's AI logo.
// Draws in the current text colour, so it takes the colour of whatever it sits on.
export default function NerouAiMark({ size = 20, strokeWidth = 1.9, className = "" }: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M7 11.4 10.5 8.3l3.5 3.1" />
      <path d="M8.2 10.6v3.6h4.6v-3.6" />
      <path d="M15.7 15.7 21 21" />
      <circle cx="19.4" cy="4.6" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
