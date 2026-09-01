/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";

interface NotificationBellProps {
  isRtl: boolean;
  // Lets each workspace decide what "go to leads" means for it (just a setActiveTab call
  // today, but kept generic rather than hardcoding a tab id here).
  onClick: () => void;
}

// Polling interval for the unread-lead count. No websockets/SSE in this app anywhere else -
// this matches the existing polling/manual-refresh convention (see onRefreshAll usage across
// the workspace components) rather than introducing a new realtime mechanism for one feature.
const POLL_INTERVAL_MS = 25000;

// In-app Lead Notification Center: a small bell icon with an unread-lead badge, mounted in
// each workspace's header/toolbar. Clicking it navigates to the Leads tab (via onClick) but
// deliberately does NOT mark anything read itself - only actually opening a specific lead
// does that (see the mark-as-read calls wired into each workspace's Leads tab).
export default function NotificationBell({ isRtl, onClick }: NotificationBellProps) {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await fetch("/api/leads/unread-count", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCount(typeof data.count === "number" ? data.count : 0);
      } catch (err) {
        console.error("Failed to fetch unread lead count:", err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative p-2 rounded-full border bg-surface border-border text-ink-muted hover:text-ink cursor-pointer transition-colors shrink-0"
      title={isRtl ? "العملاء المحتملون الجدد" : "New leads"}
      aria-label={isRtl ? "الإشعارات" : "Notifications"}
    >
      <Bell size={16} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-danger text-white text-[9px] font-bold leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
