/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Star, MessageSquare, AlertCircle, Check, Loader2, Flag } from "lucide-react";

interface ProfileReviewsSectionProps {
  targetType: "AGENT" | "AGENCY";
  targetId: string;
  currentUser: any;
  isRtl: boolean;
}

export default function ProfileReviewsSection({
  targetType,
  targetId,
  currentUser,
  isRtl
}: ProfileReviewsSectionProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  // FIX 10: server-computed aggregate (average/count), shared logic with the agent dashboard
  // and admin moderation view instead of a local, non-persisted computation.
  const [summary, setSummary] = useState<{ average: number; count: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [reportedIds, setReportedIds] = useState<string[]>([]);

  // FIX 10: let visitors report a review as abusive/policy-violating - surfaces in the admin
  // moderation queue's "reported" filter without auto-hiding it.
  const handleReport = async (reviewId: string) => {
    if (!currentUser) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (res.ok) setReportedIds(prev => [...prev, reviewId]);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReviews = async () => {
    try {
      const [reviewsRes, summaryRes] = await Promise.all([
        fetch(`/api/reviews?targetType=${targetType}&targetId=${targetId}`),
        fetch(`/api/reviews/summary?targetType=${targetType}&targetId=${targetId}`)
      ]);
      if (reviewsRes.ok) setReviews(await reviewsRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch (e) {
      console.error("Error loading reviews:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [targetType, targetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          targetType,
          targetId,
          rating,
          comment
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isRtl ? "تعذر إرسال التقييم." : "Failed to submit review."));
      } else {
        setSuccess(isRtl 
          ? "تم تقديم تقييمك بنجاح وهو قيد المراجعة الإدارية الآن." 
          : "Review submitted successfully! It is currently pending admin approval."
        );
        setComment("");
        setRating(5);
        fetchReviews();
      }
    } catch (err) {
      setError(isRtl ? "حدث خطأ غير متوقع." : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
          <MessageSquare size={14} className="text-gold" />
          <span>{isRtl ? "التقييمات والمراجعات" : "Ratings & Reviews"}</span>
        </h4>
        {summary && summary.count > 0 && (
          <div className="flex items-center gap-1 bg-gold/10 text-gold px-2 py-0.5 rounded-md text-xs font-bold">
            <Star size={12} className="fill-gold" />
            <span>{summary.average.toFixed(1)} ({summary.count})</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-gold" size={20} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reviews List */}
          {reviews.length === 0 ? (
            <p className="text-xs text-ink-muted italic bg-canvas p-3 rounded-lg border border-border text-center">
              {isRtl 
                ? "لا توجد مراجعات معتمدة بعد لهذا المستشار. كن أول من يكتب تقييماً!" 
                : "No verified reviews yet. Be the first to share your experience!"}
            </p>
          ) : (
            <div className="relative">
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-3 bg-surface rounded-lg border border-border space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-ink">{rev.reviewerName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-muted">
                        {new Date(rev.createdDate).toLocaleDateString(isRtl ? "ar-QA" : "en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </span>
                      {currentUser && (
                        <button
                          type="button"
                          onClick={() => handleReport(rev.id)}
                          disabled={reportedIds.includes(rev.id)}
                          title={isRtl ? "الإبلاغ عن هذا التقييم" : "Report this review"}
                          className="text-ink-faint hover:text-rose-600 disabled:text-rose-600 disabled:cursor-default cursor-pointer"
                        >
                          <Flag size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={12}
                        className={s <= rev.rating ? "fill-gold text-gold" : "text-gray-200"}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">{rev.comment}</p>
                  {rev.reply && (
                    <div className="mt-1.5 pl-3 border-l-2 border-gold/40 bg-canvas p-2 rounded">
                      <p className="text-[10px] font-bold text-ink">{isRtl ? "رد صاحب الملف" : "Response from the listing owner"}</p>
                      <p className="text-[11px] text-ink-muted mt-0.5">{rev.reply.text}</p>
                    </div>
                  )}
                </div>
              ))}
              </div>
              {/* Scroll affordance: hints that more reviews exist below the fixed-height,
                  scrollable list instead of the cut-off just looking like the end of content. */}
              {reviews.length > 3 && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent rounded-b-lg" />
              )}
            </div>
          )}

          {/* Review Submission Form */}
          <div className="bg-canvas p-4 rounded-xl border border-border space-y-3">
            <span className="text-xs font-bold text-ink block">
              {isRtl ? "كتابة تقييم موثق" : "Leave a Verified Review"}
            </span>

            {currentUser ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Stars selector */}
                <div className="space-y-1">
                  <span className="text-[10px] text-ink-muted uppercase tracking-wider block">
                    {isRtl ? "التقييم بالنجوم" : "Your Rating"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="text-gold hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star
                          size={20}
                          className={s <= rating ? "fill-gold text-gold" : "text-gray-300"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div className="space-y-1">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={isRtl ? "اكتب تعليقك هنا..." : "Share your experience with this profile..."}
                    rows={2}
                    className="w-full p-2.5 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-gold text-ink"
                    required
                  />
                </div>

                {error && (
                  <div className="p-2.5 bg-red-50 text-red-800 border border-red-100 rounded-lg text-[11px] flex gap-2 items-center">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="p-2.5 bg-green-50 text-green-800 border border-green-100 rounded-lg text-[11px] flex gap-2 items-center">
                    <Check size={14} className="text-green-600 flex-shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-ink-muted max-w-[70%] leading-normal">
                    {isRtl 
                      ? "تنبيه: يمكنك فقط تقييم المستشار أو الشركة التي أرسلت إليها طلباً مسبقاً." 
                      : "Note: Eligibility check active. Only profiles with active lead inquiries can submit feedback."}
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 bg-chrome hover:bg-gold hover:text-ink text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-55"
                  >
                    {submitting && <Loader2 className="animate-spin" size={12} />}
                    <span>{isRtl ? "إرسال التقييم" : "Submit"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-ink-muted">
                  {isRtl 
                    ? "الرجاء تسجيل الدخول أولاً لتتمكن من كتابة تقييم." 
                    : "Please log in to submit a rating or feedback on this profile."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
