"use client";

import React from "react";
import Link from "next/link";
import { Star, ShieldCheck, Award, HeartHandshake, Sparkles, CheckCircle2 } from "lucide-react";

interface PdpInfoPanelProps {
  title: string;
  category?: string;
  categorySlug?: string;
  sku?: string;
  rating?: number;
  reviewCount?: number;
  price: number;
  comparePrice?: number;
  shortDescription?: string;
  isBestseller?: boolean;
  isFeatured?: boolean;
  occasions?: Array<{ name: string; slug: string; icon?: string }>;
  showSku?: boolean;
  showRating?: boolean;
  showReviews?: boolean;
  showPrice?: boolean;
  showComparePrice?: boolean;
  onReviewsClick?: () => void;
}

export function PdpInfoPanel({
  title,
  category,
  categorySlug,
  sku,
  rating = 0,
  reviewCount = 0,
  price,
  comparePrice,
  shortDescription,
  isBestseller = false,
  isFeatured = false,
  occasions = [],
  showSku = true,
  showRating = true,
  showReviews = true,
  showPrice = true,
  showComparePrice = true,
  onReviewsClick,
}: PdpInfoPanelProps) {
  const catSlug = categorySlug || (category ? category.toLowerCase().replace(/\s+/g, "-") : "");
  const hasDiscount = Boolean(comparePrice && comparePrice > price);
  const discountPercent = hasDiscount && comparePrice
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Category & Status Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {category && (
          <Link
            href={`/products?category=${catSlug}`}
            className="inline-flex items-center px-3.5 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold bg-white text-brand-text border border-brand-primary/20 hover:border-brand-primary transition-colors shadow-2xs"
          >
            {category}
          </Link>
        )}

        {isBestseller && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-gold-light/90 text-brand-gold-dark border border-brand-gold/40">
            <Sparkles className="w-3 h-3 text-brand-gold" /> Bestseller
          </span>
        )}

        {isFeatured && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300">
            Chef's Special
          </span>
        )}

        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 100% Fresh
        </span>
      </div>

      {/* Main Title Heading */}
      <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-text leading-tight tracking-tight">
        {title}
      </h1>

      {/* Ratings, Review Count & SKU Row */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-sm">
        {showRating && Number(rating) > 0 && reviewCount > 0 && (
          <div className="flex items-center gap-1.5 bg-brand-gold-light/60 px-3 py-1 rounded-full border border-brand-gold/25">
            <span className="text-brand-gold-dark font-bold text-sm flex items-center gap-1">
              ★ {Number(rating).toFixed(1)}
            </span>
            {showReviews && (
              <button
                type="button"
                onClick={onReviewsClick}
                className="text-slate-600 hover:text-brand-primary text-xs font-medium underline underline-offset-2 transition-colors cursor-pointer"
              >
                ({reviewCount} reviews)
              </button>
            )}
          </div>
        )}

        {showSku && sku && (
          <div className="text-xs text-slate-400 font-mono tracking-wider">
            SKU: <span className="text-slate-600 font-medium">{sku}</span>
          </div>
        )}
      </div>

      {/* Price Display Section */}
      {showPrice && (
        <div className="flex items-baseline gap-3 pt-1">
          <span className="font-serif text-3xl sm:text-4xl font-bold text-brand-text tracking-tight">
            ₹{price}
          </span>

          {showComparePrice && hasDiscount && (
            <span className="text-lg text-slate-400 line-through font-sans">
              ₹{comparePrice}
            </span>
          )}

          {hasDiscount && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
              {discountPercent}% OFF
            </span>
          )}

          <span className="text-xs text-slate-500 font-normal">
            (Inclusive of all taxes)
          </span>
        </div>
      )}

      {/* Short Description */}
      {shortDescription && (
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-sans pt-1">
          {shortDescription}
        </p>
      )}

      {/* Occasion Tags */}
      {occasions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ideal For:
          </span>
          {occasions.map((occ) => (
            <Link
              key={occ.slug}
              href={`/occasions/${occ.slug}`}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-brand-gold-light/60 border border-slate-200 text-xs font-medium text-slate-700 hover:text-brand-primary transition-all shadow-2xs"
            >
              <span>{occ.icon || "🎂"}</span>
              <span>{occ.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
