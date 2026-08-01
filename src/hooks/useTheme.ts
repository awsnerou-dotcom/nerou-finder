/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from "react";
import {
  ThemePreference,
  applyThemePreference,
  getStoredThemePreference,
  getSystemPrefersDark,
  resolveTheme,
} from "../lib/theme.js";

// Drives the theme toggle: exposes the user's stored preference ("light" | "dark" | "system")
// plus the resolved light/dark value currently in effect (for icon state), and keeps both in
// sync if the OS-level color scheme changes while "system" is selected.
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference());
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(preference));

  useEffect(() => {
    setResolved(resolveTheme(preference));
  }, [preference]);

  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(getSystemPrefersDark() ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    setPreference(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolveTheme(preference) === "dark" ? "light" : "dark");
  }, [preference, setTheme]);

  return { preference, resolved, setTheme, toggle };
}
