/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdDate: string;
}

interface NotificationBellProps {
  isRtl: boolean;
  // Called whenever the user clicks into an individual notification (after it's marked read) -
  // lets each host screen decide what "go look at this" means for it (a tab switch in a
  // workspace); omit it where there's nothing more specific to do (e.g. the public marketplace
  // header, where the notification's own body text is already the whole story).
  onClick?: () => void;
}

// Polling fallback interval - the WebSocket push (see notifyUser()/wss in server.ts) is what
// makes this feel instant while connected; polling just keeps the badge eventually-correct if
// the socket drops (a corporate proxy blocking WS, a brief network blip, etc.) without the user
// having to reload the page.
const POLL_INTERVAL_MS = 25000;
const RECONNECT_DELAY_MS = 4000;

function timeAgo(iso: string, isRtl: boolean): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return isRtl ? "الآن" : "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return isRtl ? `منذ ${minutes} د` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isRtl ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isRtl ? `منذ ${days} يوم` : `${days}d ago`;
}

// In-app Notification Center: a bell icon with an unread badge and a dropdown listing recent
// notifications, live-updated over a WebSocket connection (falls back to polling if the socket
// is unavailable). Originally lead-count-only for agent/agency/developer workspaces; now backed
// by the generic /api/notifications system so it also covers reviews, saved searches/
// properties, referrals, and support tickets - and can be mounted for a logged-in buyer too.
export default function NotificationBell({ isRtl, onClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setNotifications(data);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);

    // Live push over WebSocket - reconnects with a fixed delay on close/error rather than
    // giving up, since a dropped connection (sleep/wake, brief network loss) is the common case,
    // not a permanent failure.
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const token = localStorage.getItem("token");
      if (!token || cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "notification" && payload.notification) {
            setNotifications(prev => [payload.notification, ...prev].slice(0, 50));
          }
        } catch (err) {
          console.error("Failed to parse notification push:", err);
        }
      };
      ws.onclose = () => {
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    }
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="relative p-2 rounded-full border bg-surface border-border text-ink-muted hover:text-ink cursor-pointer transition-colors shrink-0"
        title={isRtl ? "الإشعارات" : "Notifications"}
        aria-label={isRtl ? "الإشعارات" : "Notifications"}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-danger text-white text-[9px] font-bold leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute mt-2 w-80 max-h-96 overflow-y-auto bg-surface border border-border rounded-lg shadow-2xl z-50 ${
            isRtl ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-surface">
            <span className="text-xs font-bold text-ink">{isRtl ? "الإشعارات" : "Notifications"}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] text-gold hover:underline cursor-pointer"
              >
                <Check size={11} />
                {isRtl ? "تعليم الكل كمقروء" : "Mark all read"}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-ink-muted text-center py-8">
              {isRtl ? "لا توجد إشعارات" : "No notifications yet"}
            </p>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  setIsOpen(false);
                  onClick?.();
                }}
                className={`w-full text-left rtl:text-right px-3 py-2.5 border-b border-border last:border-0 hover:bg-canvas transition-colors cursor-pointer flex items-start gap-2 ${
                  !n.read ? "bg-gold/5" : ""
                }`}
              >
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 shrink-0" />}
                <div className={`min-w-0 ${n.read ? "ps-3.5" : ""}`}>
                  <p className="text-xs font-bold text-ink truncate">{n.title}</p>
                  <p className="text-[11px] text-ink-muted line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">{timeAgo(n.createdDate, isRtl)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
