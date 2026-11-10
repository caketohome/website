"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ShoppingBag, Loader2 } from "lucide-react";

interface PdpStickyBarProps {
  title: string;
  thumbnail: string;
  selectedWeightName?: string;
  totalPrice: number;
  onAddToCart: () => void;
  cartLoading: boolean;
  isOutOfStock: boolean;
  enabledMobile?: boolean;
  enabledDesktop?: boolean;
  addToCartText?: string;
}

export function PdpStickyBar({
  title,
  thumbnail,
  selectedWeightName,
  totalPrice,
  onAddToCart,
  cartLoading,
  isOutOfStock,
  enabledMobile = true,
  enabledDesktop = false,
  addToCartText = "Add",
}: PdpStickyBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Trigger sticky bar after scrolling down 500px
      if (window.scrollY > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      data-testid="pdp-sticky-bar"
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-xl px-4 py-3 transition-transform duration-300 animate-in slide-in-from-bottom-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        enabledMobile ? "block" : "hidden"
      } ${enabledDesktop ? "md:block" : "md:hidden"}`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Thumbnail & Title Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
            <Image
              src={thumbnail || "/images/placeholder-cake.jpg"}
              alt={title}
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#0F172A] truncate block">
              {title}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              {selectedWeightName && (
                <span className="font-semibold text-slate-700">{selectedWeightName}</span>
              )}
              <span>•</span>
              <span className="font-bold text-[#0F172A] text-xs">₹{totalPrice}</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={onAddToCart}
          disabled={cartLoading || isOutOfStock}
          className="shrink-0 py-2.5 px-5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
        >
          {cartLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShoppingBag className="w-3.5 h-3.5" />
          )}
          <span>{isOutOfStock ? "Sold Out" : addToCartText}</span>
        </button>
      </div>
    </div>
  );
}
