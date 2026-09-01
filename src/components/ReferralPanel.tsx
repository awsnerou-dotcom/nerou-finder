/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Gift, Copy, Check, Users, Zap } from "lucide-react";
import { User } from "../types.js";
import { Card } from "./ui/Card.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";

interface ReferralPanelProps {
  user: User;
  isRtl: boolean;
}

interface ReferralStats {
  referralCode: string | null;
  successfulReferralsCount: number;
  bonusBoostCredits: number;
}

// "Invite & Earn" dashboard card: shows the caller's own referral code/link and reward
// progress. Mounted in the Dashboard tab of AgentWorkspace/AgencyWorkspace/DeveloperWorkspace,
// wherever each already renders its StatCard grid.
export default function ReferralPanel({ user, isRtl }: ReferralPanelProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  // Mirrors PropertyDetailView.tsx's handleShare "copied" feedback pattern - a local boolean
  // flipped back after a couple of seconds, no toast infrastructure needed.
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/users/${user.id}/referral-stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setStats(await res.json());
      } catch (err) {
        console.error("Failed to fetch referral stats:", err);
      }
    };
    fetchStats();
  }, [user.id]);

  if (!stats || !stats.referralCode) return null;

  const referralLink = `${window.location.origin}/?ref=${stats.referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-gold-soft text-gold-active flex items-center justify-center shrink-0">
            <Gift size={16} />
          </span>
          <div>
            <h4 className="font-serif text-sm font-bold text-ink">{isRtl ? "ادعُ واربح" : "Invite & Earn"}</h4>
            <p className="text-[10px] text-ink-muted">
              {isRtl
                ? `شارك رابطك - كل ${3} إحالات ناجحة تمنحك رصيد رفع إعلان مجاني.`
                : `Share your link - every 3 successful referrals earns you a free ad boost credit.`}
            </p>
          </div>
        </div>
        {stats.bonusBoostCredits > 0 && (
          <Badge tone="gold">
            <Zap size={11} />
            {isRtl ? `${stats.bonusBoostCredits} رصيد رفع مجاني` : `${stats.bonusBoostCredits} free boost credit${stats.bonusBoostCredits === 1 ? "" : "s"}`}
          </Badge>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 min-w-0 px-3 py-2 bg-canvas border border-border rounded-lg text-xs font-mono text-ink truncate">
          {referralLink}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={handleCopyLink} leftIcon={copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}>
          {copied ? (isRtl ? "تم النسخ" : "Copied") : (isRtl ? "نسخ الرابط" : "Copy Link")}
        </Button>
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-muted pt-1 border-t border-surface-2">
        <span className="flex items-center gap-1.5 pt-2">
          <Users size={13} className="text-gold" />
          <span className="font-bold text-ink">{stats.successfulReferralsCount}</span>
          <span>{isRtl ? "إحالة ناجحة" : "successful referral" + (stats.successfulReferralsCount === 1 ? "" : "s")}</span>
        </span>
        <span className="flex items-center gap-1.5 pt-2">
          <span className="font-bold text-ink">{isRtl ? "الكود: " : "Code: "}</span>
          <span className="font-mono font-bold text-gold">{stats.referralCode}</span>
        </span>
      </div>
    </Card>
  );
}
