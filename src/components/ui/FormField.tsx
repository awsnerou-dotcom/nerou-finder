/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

const CONTROL_BASE = `
  w-full bg-surface border rounded-lg px-3 py-2.5 text-sm text-ink
  placeholder:text-ink-faint
  transition-colors duration-150
  focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
  disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-2
`.replace(/\s+/g, " ").trim();

function controlClasses(hasError?: boolean, className = "") {
  return `${CONTROL_BASE} ${hasError ? "border-danger focus:ring-danger/30 focus:border-danger" : "border-border"} ${className}`.trim();
}

interface FieldWrapperProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

// Wraps any form control with a consistent label/hint/error layout - previously error text (if
// shown at all) appeared in a different place/style per form across the app.
export function FormField({ label, htmlFor, error, hint, required, children, className = "" }: FieldWrapperProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-muted">
          {label}
          {required && <span className="text-danger ms-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className, ...rest },
  ref
) {
  return <input ref={ref} className={controlClasses(error, className)} {...rest} />;
});

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, className, ...rest },
  ref
) {
  return <textarea ref={ref} className={controlClasses(error, className) + " resize-y min-h-24"} {...rest} />;
});

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error, className, children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={controlClasses(error, className) + " cursor-pointer"} {...rest}>
      {children}
    </select>
  );
});
