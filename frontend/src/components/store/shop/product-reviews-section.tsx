"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Plus,
  ShieldCheck,
  Filter,
  ArrowUpDown,
  X,
  AlertCircle
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

interface ReviewItem {
  id: string;
  product_id: string;
  rating: number;
  title: string;
  review_text: string;
  comment?: string;
  author_name?: string;
  customer_name?: string;
  purchased_variant?: string | null;
  is_verified_purchase: boolean;
  admin_response?: {
    author: string;
    message: string;
    responded_at: string;
  } | null;
  reply?: string | null;
  created_at: string;
}

interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

interface ProductReviewsSectionProps {
  productId: string;
  productTitle: string;
  initialReviews?: ReviewItem[];
  initialAverage?: number;
  initialCount?: number;
  initialDistribution?: RatingDistribution;
}

export function ProductReviewsSection({
  productId,
  productTitle,
  initialReviews = [],
  initialAverage = 0,
  initialCount = 0,
  initialDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}: ProductReviewsSectionProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [averageRating, setAverageRating] = useState<number>(initialAverage);
  const [totalCount, setTotalCount] = useState<number>(initialCount);
  const [distribution, setDistribution] = useState<RatingDistribution>(initialDistribution);
  const [loading, setLoading] = useState(false);

  // Filters & Sorting State
  const [sort, setSort] = useState<"recent" | "highest" | "lowest">("recent");
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Modal / Drawer Form State
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [formRating, setFormRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [formTitle, setFormTitle] = useState("");
  const [formReviewText, setFormReviewText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);

  // Fetch reviews from API
  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.getProductReviews(productId, {
        sort,
        rating: ratingFilter,
        verified_only: verifiedOnly,
      });

      if (res?.success) {
        setReviews(res.reviews || []);
        if (res.aggregate) {
          setAverageRating(res.aggregate.average_rating || 0);
          setTotalCount(res.aggregate.total_reviews || 0);
          if (res.aggregate.rating_distribution) {
            setDistribution(res.aggregate.rating_distribution);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load product reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId, sort, ratingFilter, verifiedOnly]);

  // Check purchase eligibility when opening write review modal
  const handleOpenWriteReview = async () => {
    setFormError(null);
    setFormSuccess(false);
    try {
      const res: any = await apiClient.getCustomerEligibleReviews();
      if (res?.success) {
        const eligibleForThisProduct = (res.eligible_items || []).filter(
          (item: any) => item.product_id === productId || item.product_id === `prod_${productId}`
        );

        const unreviewed = eligibleForThisProduct.filter((item: any) => !item.has_reviewed);

        if (unreviewed.length > 0) {
          setEligibleOrders(unreviewed);
          setSelectedOrderId(unreviewed[0].order_id);
          setIsEligible(true);
          setEligibilityReason(null);
        } else if (eligibleForThisProduct.length > 0) {
          setIsEligible(false);
          setEligibilityReason("You have already reviewed this cake for all your delivered orders.");
        } else {
          setIsEligible(false);
          setEligibilityReason("Only customers who have purchased and received this cake can submit a verified review.");
        }
      } else {
        setIsEligible(false);
        setEligibilityReason("Please log in with your customer account to submit a review.");
      }
    } catch (err) {
      setIsEligible(false);
      setEligibilityReason("Please log in with your customer account to submit a review.");
    } finally {
      setIsWriteModalOpen(true);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Please enter a review headline.");
      return;
    }
    if (!formReviewText.trim()) {
      setFormError("Please share details about your tasting experience.");
      return;
    }
    if (formRating < 1 || formRating > 5) {
      setFormError("Please select a rating between 1 and 5 stars.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res: any = await apiClient.submitProductReview(productId, {
        orderId: selectedOrderId || undefined,
        rating: formRating,
        title: formTitle.trim(),
        reviewText: formReviewText.trim(),
      });

      if (res?.success) {
        setFormSuccess(true);
        setTimeout(() => {
          setIsWriteModalOpen(false);
          setFormTitle("");
          setFormReviewText("");
          setFormSuccess(false);
          fetchReviews();
        }, 1200);
      } else {
        setFormError(res?.error || res?.message || "Failed to submit review. Please try again.");
      }
    } catch (err: any) {
      setFormError(err?.message || "Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels: Record<number, string> = {
    1: "Needs Improvement",
    2: "Fair",
    3: "Good & Fresh",
    4: "Very Delicious",
    5: "Exceptional / 5-Star Gourmet",
  };

  return (
    <div id="customer-reviews-section" className="mt-12 pt-10 border-t border-gray-200">
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
        <div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-[#1D2F5D]" />
            <span>Verified Customer Reviews</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Real feedback from verified customers who ordered and enjoyed this handcrafted cake.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenWriteReview}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white text-xs font-bold transition shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" /> Write a Review
        </button>
      </div>

      {/* ── Rating Overview & Distribution ── */}
      <div className="bg-gradient-to-br from-[#FDFBF7]/70 via-white to-amber-50/40 border border-[#D4AF37]/20 rounded-3xl p-6 sm:p-8 mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left: Big Average Score */}
          <div className="md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-[#D4AF37]/20 pb-6 md:pb-0 md:pr-8">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black text-gray-900 tracking-tight">
                {totalCount > 0 ? averageRating.toFixed(1) : "—"}
              </span>
              <span className="text-sm font-bold text-gray-400">/ 5.0</span>
            </div>

            {/* Stars */}
            <div className="flex items-center gap-1 my-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(averageRating) && totalCount > 0
                      ? "fill-amber-400 text-amber-400"
                      : "fill-gray-200 text-gray-200"
                  }`}
                />
              ))}
            </div>

            <p className="text-xs font-semibold text-gray-600">
              {totalCount > 0
                ? `Based on ${totalCount} verified customer review${totalCount > 1 ? "s" : ""}`
                : "No verified reviews submitted yet"}
            </p>

            <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Verified Purchases Only
            </div>
          </div>

          {/* Right: 5-Star Distribution Bars */}
          <div className="md:col-span-8 space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars as keyof RatingDistribution] || 0;
              const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setRatingFilter(ratingFilter === stars ? undefined : stars)}
                    className={`flex items-center gap-1 font-bold w-12 text-left hover:text-[#1D2F5D] transition ${
                      ratingFilter === stars ? "text-[#1D2F5D] font-extrabold" : "text-gray-700"
                    }`}
                  >
                    <span>{stars}</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </button>

                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        ratingFilter === stars ? "bg-[#1D2F5D]" : "bg-amber-400"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <span className="w-12 text-right font-mono font-medium text-gray-500 text-[11px]">
                    {count} ({percent}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filters & Controls Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-600 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          <button
            type="button"
            onClick={() => setRatingFilter(undefined)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              ratingFilter === undefined
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            All Ratings
          </button>

          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRatingFilter(ratingFilter === s ? undefined : s)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition ${
                ratingFilter === s
                  ? "bg-[#1D2F5D] text-white border-[#1D2F5D]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <span>{s}</span>
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            </button>
          ))}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37]/50"
          >
            <option value="recent">Most Recent</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>
        </div>
      </div>

      {/* ── Reviews Cards List ── */}
      {loading ? (
        <div className="py-12 text-center text-gray-400 text-xs animate-pulse">
          Loading customer reviews...
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-gray-50/70 border border-gray-200/80 rounded-3xl p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-gold-soft text-[#D4AF37] mx-auto flex items-center justify-center">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-gray-900">Be the first to review this cake!</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Share your thoughts on freshness, flavor, and delivery to help other cake lovers celebrate.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenWriteReview}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Write a Review
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => {
            const reviewerName = rev.customer_name || rev.author_name || "Verified Customer";
            const dateStr = rev.created_at
              ? new Date(rev.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Recent";

            return (
              <div
                key={rev.id}
                className="bg-white border border-gray-200/80 hover:border-gray-300 rounded-2xl p-5 shadow-xs transition space-y-3"
              >
                {/* Top Row: Rating + Verified Badge + Date */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= rev.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-gray-200 text-gray-200"
                          }`}
                        />
                      ))}
                    </div>

                    <span className="font-bold text-sm text-gray-900">{rev.title}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {rev.is_verified_purchase && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Verified Purchase
                      </span>
                    )}
                    <span>•</span>
                    <span>{dateStr}</span>
                  </div>
                </div>

                {/* Review Text */}
                <p className="text-xs text-gray-700 leading-relaxed">{rev.review_text || rev.comment}</p>

                {/* Bottom Bar: Customer Name & Purchased Variant */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-gold-soft text-[#152347] font-black text-[11px] flex items-center justify-center">
                      {reviewerName[0]}
                    </span>
                    <span className="font-semibold text-gray-800">{reviewerName}</span>
                    {rev.purchased_variant && (
                      <span className="text-[11px] text-gray-400">• Size: {rev.purchased_variant}</span>
                    )}
                  </div>
                </div>

                {/* Official Bakery Chef Response Box */}
                {(rev.admin_response || rev.reply) && (
                  <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span>👨‍🍳 {rev.admin_response?.author || "CakeToHome Bakery Chef"}</span>
                      <span className="text-[10px] font-normal text-amber-700">(Official Bakery Response)</span>
                    </p>
                    <p className="text-amber-800 text-[11px] italic">
                      &ldquo;{rev.admin_response?.message || rev.reply}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Interactive Write Review Modal / Drawer ── */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-200 p-6 sm:p-8 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="text-lg font-black text-gray-900 tracking-tight">
                  Review Your Gourmet Cake
                </h4>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{productTitle}</p>
              </div>

              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ineligible Notice */}
            {!isEligible ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-gray-900">Verified Purchase Required</h5>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    {eligibilityReason || "To ensure genuine reviews, only customers who have ordered and received this cake can submit a verified review."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => router.push("/login?redirect=" + encodeURIComponent(window.location.pathname))}
                    className="px-4 py-2 rounded-xl bg-[#1D2F5D] text-white text-xs font-bold hover:bg-[#152347] transition"
                  >
                    Log In to Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWriteModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Review Submission Form */
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Order Selector (if multiple delivered orders) */}
                {eligibleOrders.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">Select Order</label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-gray-200 bg-white"
                    >
                      {eligibleOrders.map((ord) => (
                        <option key={ord.order_id} value={ord.order_id}>
                          Order #{ord.order_number || ord.order_id} (Delivered {new Date(ord.order_delivered_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Star Rating Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-900 block">Overall Rating *</label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setFormRating(star)}
                          className="p-1 text-gray-300 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= (hoverRating || formRating)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-gray-200 text-gray-200"
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <span className="text-xs font-bold text-gray-700 ml-2">
                      {ratingLabels[hoverRating || formRating]}
                    </span>
                  </div>
                </div>

                {/* Review Title Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-900">Review Headline *</label>
                    <span className="text-[10px] text-gray-400">{formTitle.length}/120</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., Heavenly moist sponge and prompt express delivery!"
                    className="w-full text-xs font-medium p-3 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37]/50"
                  />
                </div>

                {/* Review Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-900">Detailed Feedback *</label>
                    <span className="text-[10px] text-gray-400">{formReviewText.length}/2000</span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    maxLength={2000}
                    value={formReviewText}
                    onChange={(e) => setFormReviewText(e.target.value)}
                    placeholder="Tell us about the texture, sweetness balance, freshness, and packaging..."
                    className="w-full text-xs font-medium p-3 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37]/50"
                  />
                </div>

                {/* Error Banner */}
                {formError && (
                  <div className="p-3 bg-brand-gold-soft border border-[#D4AF37]/30 text-[#152347] text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {formSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Thank you! Your verified review has been published.</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsWriteModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || formSuccess}
                    className="px-6 py-2.5 rounded-xl bg-[#1D2F5D] hover:bg-[#152347] disabled:opacity-50 text-white text-xs font-bold transition shadow-sm"
                  >
                    {submitting ? "Submitting..." : "Publish Review"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
