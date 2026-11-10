"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Zap, Share2, Check, AlertCircle, Loader2 } from "lucide-react";

interface PdpPurchaseActionsProps {
  totalPrice: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  cartLoading: boolean;
  isOutOfStock: boolean;
  branchStock: number | null;
  addToCartText?: string;
  buyNowText?: string;
  addedCartSuccess: boolean;
  cartError?: string | null;
  onDismissError?: () => void;
  productTitle: string;
}

export function PdpPurchaseActions({
  totalPrice,
  quantity,
  onQuantityChange,
  onAddToCart,
  onBuyNow,
  cartLoading,
  isOutOfStock,
  branchStock,
  addToCartText = "Add to Bag",
  buyNowText = "Buy Now",
  addedCartSuccess,
  cartError,
  onDismissError,
  productTitle,
}: PdpPurchaseActionsProps) {
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const shareData = {
      title: productTitle,
      text: `Order ${productTitle} from CakeToHome!`,
      url: window.location.href,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled or share failed
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      } catch {
        // fallback
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full pt-4 border-t-2 border-slate-200/80 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm">
      {/* Price Summary & Quantity Stepper */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
            Total Payable
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl sm:text-4xl font-bold text-[#0F172A] leading-tight">
              ₹{totalPrice}
            </span>
          </div>
          {branchStock !== null ? (
            <span
              className={`text-[11px] font-semibold mt-0.5 ${
                branchStock > 5
                  ? "text-emerald-700"
                  : branchStock > 0
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {branchStock > 5
                ? `● In Stock (${branchStock} available)`
                : branchStock > 0
                ? `● Low Stock (Only ${branchStock} left)`
                : "● Out of Stock at selected branch"}
            </span>
          ) : (
            <span
              className={`text-[11px] font-semibold mt-0.5 ${
                isOutOfStock ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {isOutOfStock
                ? "● Temporarily Unavailable at this Kitchen"
                : "● Freshly Baked on Order • Available for Delivery"}
            </span>
          )}
        </div>

        {/* Quantity Stepper */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={quantity <= 1 || cartLoading}
            aria-label="Decrease quantity"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg font-bold transition-colors"
          >
            -
          </button>
          <span className="w-9 text-center font-bold text-sm text-slate-900 select-none">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            disabled={cartLoading || (branchStock !== null ? quantity >= branchStock : quantity >= 20)}
            aria-label="Increase quantity"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent text-lg font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* CTA Buttons: Add to Bag & Buy Now */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          data-testid="pdp-add-to-bag"
          onClick={onAddToCart}
          disabled={cartLoading || isOutOfStock}
          className="w-full py-4 px-6 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {cartLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Adding...</span>
            </>
          ) : isOutOfStock ? (
            <span>Sold Out</span>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>{addToCartText} • ₹{totalPrice}</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-testid="pdp-buy-now"
          onClick={onBuyNow}
          disabled={cartLoading || isOutOfStock}
          className="w-full py-4 px-6 rounded-2xl bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>{buyNowText}</span>
        </button>
      </div>

      {/* Share Button & Feedback */}
      <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#2563EB] font-medium transition-colors py-1 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{shareSuccess ? "Link copied to clipboard! 🎉" : "Share this cake"}</span>
        </button>

        <span className="text-[11px] text-slate-400">
          ✨ Freshly baked on order
        </span>
      </div>

      {/* Add to Bag Error Banner */}
      {cartError && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span>{cartError}</span>
          </div>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="text-rose-500 hover:text-rose-700 text-xs font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Added to Bag Success Toast Banner */}
      {addedCartSuccess && !cartError && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1E3A8A] border border-blue-400/40 text-white text-xs font-medium shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span>Successfully added to your bag!</span>
          </div>
          <Link
            href="/checkout"
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold uppercase tracking-wider text-[10px] rounded-xl px-3 py-1.5 transition-all shadow-xs"
          >
            Checkout →
          </Link>
        </div>
      )}
    </div>
  );
}
