/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Theme is applied by stamping data-theme="light"|"dark" on <html>, which the design tokens
// in src/index.css key off of (overriding the OS prefers-color-scheme in both directions).
// "system" clears the override and lets the OS preference drive it via the media query alone.
export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "nerou_theme";

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function getSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

// Resolves "system" down to the actual light/dark value currently in effect - useful for UI
// that needs to show which theme is active right now (e.g. a sun/moon toggle icon).
export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  return preference === "system" ? (getSystemPrefersDark() ? "dark" : "light") : preference;
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    root.setAttribute("data-theme", preference);
    window.localStorage.setItem(STORAGE_KEY, preference);
  }
}

// Applies the persisted preference as early as possible (called once from main.tsx, before
// React mounts) so the page never flashes the wrong theme on load.
export function applyStoredThemeOnBoot(): void {
  const preference = getStoredThemePreference();
  if (preference !== "system") {
    document.documentElement.setAttribute("data-theme", preference);
  }
}
