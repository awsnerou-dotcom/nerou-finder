/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  isRtl: boolean;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
  autoComplete?: string;
  // Classes for the <input> itself, so each screen keeps its own existing field styling - this
  // component only adds the end-side padding the toggle button needs.
  className?: string;
  hasError?: boolean;
}

// Password field with a show/hide eye toggle. Anywhere a person types a password blind, a typo
// is only discovered after it has already been saved - the eye (and a confirmation field
// where a new password is being chosen) is what stops that.
export default function PasswordInput({
  value,
  onChange,
  isRtl,
  placeholder,
  required,
  minLength,
  autoFocus,
  autoComplete,
  className = "",
  hasError
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className={`${className} pe-11 ${hasError ? "!border-danger" : ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        className="absolute inset-y-0 end-0 px-3 flex items-center text-ink-muted hover:text-ink cursor-pointer"
        aria-label={visible ? (isRtl ? "إخفاء كلمة المرور" : "Hide password") : (isRtl ? "إظهار كلمة المرور" : "Show password")}
        title={visible ? (isRtl ? "إخفاء كلمة المرور" : "Hide password") : (isRtl ? "إظهار كلمة المرور" : "Show password")}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
