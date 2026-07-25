/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Star, MessageSquare, AlertCircle, Check, Loader2 } from "lucide-react";

interface ProfileReviewsSectionProps {
  targetType: "AGENT" | "ORGANIZATION";
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
  const [loading, setLoading] = useState<boolean>(true);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?targetType=${targetType}&targetId=${targetId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
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
      const token = sessionStorage.getItem("nerou_token");
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
        setError(data.error || "Failed to submit review.");
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
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6 pt-4 border-t border-[#e6e2de]">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1918] flex items-center gap-1.5">
          <MessageSquare size={14} className="text-[#bf9b30]" />
          <span>{isRtl ? "التقييمات والمراجعات" : "Ratings & Reviews"}</span>
        </h4>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1 bg-[#bf9b30]/10 text-[#bf9b30] px-2 py-0.5 rounded-md text-xs font-bold">
            <Star size={12} className="fill-[#bf9b30]" />
            <span>{avgRating} ({reviews.length})</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-[#bf9b30]" size={20} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reviews List */}
          {reviews.length === 0 ? (
            <p className="text-xs text-[#6e6b66] italic bg-[#fcfbfa] p-3 rounded-lg border border-[#e6e2de] text-center">
              {isRtl 
                ? "لا توجد مراجعات معتمدة بعد لهذا المستشار. كن أول من يكتب تقييماً!" 
                : "No verified reviews yet. Be the first to share your experience!"}
            </p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-3 bg-white rounded-lg border border-[#e6e2de] space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#1a1918]">{rev.reviewerName}</span>
                    <span className="text-[#6e6b66]">
                      {new Date(rev.createdDate).toLocaleDateString(isRtl ? "ar-QA" : "en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={12}
                        className={s <= rev.rating ? "fill-[#bf9b30] text-[#bf9b30]" : "text-gray-200"}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-[#4c4943] leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          )}

          {/* Review Submission Form */}
          <div className="bg-[#fcfbfa] p-4 rounded-xl border border-[#e6e2de] space-y-3">
            <span className="text-xs font-bold text-[#1a1918] block">
              {isRtl ? "كتابة تقييم موثق" : "Leave a Verified Review"}
            </span>

            {currentUser ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Stars selector */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#6e6b66] uppercase tracking-wider block">
                    {isRtl ? "التقييم بالنجوم" : "Your Rating"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="text-[#bf9b30] hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star
                          size={20}
                          className={s <= rating ? "fill-[#bf9b30] text-[#bf9b30]" : "text-gray-300"}
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
                    className="w-full p-2.5 bg-white border border-[#e6e2de] rounded-lg text-xs focus:outline-none focus:border-[#bf9b30] text-[#1a1918]"
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
                  <p className="text-[9px] text-[#6e6b66] max-w-[70%] leading-normal">
                    {isRtl 
                      ? "تنبيه: يمكنك فقط تقييم المستشار أو الشركة التي أرسلت إليها طلباً مسبقاً." 
                      : "Note: Eligibility check active. Only profiles with active lead inquiries can submit feedback."}
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] hover:text-[#1a1918] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-55"
                  >
                    {submitting && <Loader2 className="animate-spin" size={12} />}
                    <span>{isRtl ? "إرسال التقييم" : "Submit"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-[#6e6b66]">
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
