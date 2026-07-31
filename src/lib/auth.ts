/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Reads the current user's id out of localStorage. Shared by AgencyWorkspace and
// DeveloperWorkspace (previously copy-pasted identically into both).
export function getActingUserId(): string {
  const saved = localStorage.getItem("nerou_user");
  if (!saved) return "";
  try {
    return JSON.parse(saved)?.id || "";
  } catch {
    return "";
  }
}
