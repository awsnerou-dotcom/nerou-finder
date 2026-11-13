import { Award, Zap } from "lucide-react";
import type { AgentPerformance } from "../lib/agentPerformance.js";
import { formatReplyTime } from "../lib/agentPerformance.js";

// The two badges an agent earns from how fast they really answer enquiries (see src/lib/agentPerformance.ts). Nothing
// renders for an agent who has not earned one.
export default function AgentBadges({ performance, isRtl, size = "sm" }: { performance?: AgentPerformance | null; isRtl: boolean; size?: "sm" | "md" }) {
  if (!performance || (!performance.top && !performance.badge)) return null;
  const text = size === "md" ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";
  const reply = performance.badge === "WITHIN_HOUR"
    ? (isRtl ? "يردّ خلال ساعة" : "Replies within an hour")
    : performance.badge === "WITHIN_FEW_HOURS"
      ? (isRtl ? "يردّ خلال ساعات" : "Replies within hours")
      : performance.badge === "WITHIN_DAY"
        ? (isRtl ? "يردّ خلال يوم" : "Replies within a day")
        : null;
  const title = performance.medianMinutes !== null
    ? (isRtl
        ? `متوسط الردّ ${formatReplyTime(performance.medianMinutes, true)} على آخر ${performance.responded} استفسار`
        : `Typical first reply ${formatReplyTime(performance.medianMinutes, false)}, from the last ${performance.responded} enquiries`)
    : undefined;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {performance.top && (
        <span className={`inline-flex items-center gap-1 rounded-full bg-chrome text-[#e6cf93] font-bold ${text}`} title={isRtl ? "وسيط موثّق، يردّ بسرعة ولديه عقارات نشطة" : "Verified, quick to reply and with an active portfolio"}>
          <Award size={size === "md" ? 12 : 10} />{isRtl ? "وسيط مميّز" : "Top agent"}
        </span>
      )}
      {reply && (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold ${text}`} title={title}>
          <Zap size={size === "md" ? 12 : 10} />{reply}
        </span>
      )}
    </span>
  );
}
