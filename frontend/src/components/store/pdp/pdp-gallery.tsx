"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, Heart, Sparkles } from "lucide-react";

interface PdpGalleryProps {
  images: string[];
  productTitle: string;
  thumbnailPosition?: "bottom" | "left" | "right";
  enableZoom?: boolean;
  enableLightbox?: boolean;
  isWishlisted: boolean;
  onWishlistToggle: () => void;
  wishlistLoading?: boolean;
  isBestseller?: boolean;
  isFeatured?: boolean;
}

export function PdpGallery({
  images,
  productTitle,
  thumbnailPosition = "bottom",
  enableZoom = true,
  enableLightbox = true,
  isWishlisted,
  onWishlistToggle,
  wishlistLoading = false,
  isBestseller = false,
  isFeatured = false,
}: PdpGalleryProps) {
  const validImages = images && images.length > 0
    ? images.filter(Boolean)
    : ["/images/default-cake.jpg"];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomStyle, setZoomStyle] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const mainImage = validImages[activeIndex] || validImages[0] || "/images/default-cake.jpg";

  // Handle keyboard events for lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
      if (e.key === "ArrowRight") setActiveIndex((prev) => (prev + 1) % validImages.length);
      if (e.key === "ArrowLeft") setActiveIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, validImages.length]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableZoom) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({ x, y, active: true });
  };

  const handleMouseLeave = () => {
    setZoomStyle((prev) => ({ ...prev, active: false }));
  };

  // Thumbnail strip element
  const renderThumbnails = (orientation: "horizontal" | "vertical") => {
    if (validImages.length <= 1) return null;

    return (
      <div
        className={`flex ${
          orientation === "vertical"
            ? "flex-col gap-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-none shrink-0"
            : "flex-row gap-3 overflow-x-auto pb-2 scrollbar-none w-full"
        }`}
      >
        {validImages.map((img, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={`View image ${idx + 1} of ${validImages.length}`}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 shrink-0 ${
                orientation === "vertical" ? "w-20 h-20 sm:w-22 sm:h-22" : "w-20 h-20 sm:w-24 sm:h-24"
              } ${
                isActive
                  ? "border-2 border-[#1D2F5D] ring-2 ring-[#D4AF37]/50 shadow-md scale-[1.02]"
                  : "border border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300"
              }`}
            >
              <Image
                src={img}
                alt={`${productTitle} thumbnail ${idx + 1}`}
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Gallery Container with Thumbnail Layouts */}
      <div
        className={`flex gap-4 ${
          thumbnailPosition === "left"
            ? "flex-col-reverse sm:flex-row"
            : thumbnailPosition === "right"
            ? "flex-col-reverse sm:flex-row-reverse"
            : "flex-col"
        }`}
      >
        {/* Vertical thumbnails for Left or Right layouts */}
        {(thumbnailPosition === "left" || thumbnailPosition === "right") && (
          <div className="hidden sm:block">
            {renderThumbnails("vertical")}
          </div>
        )}

        {/* Primary Main Image Frame */}
        <div className="relative w-full aspect-square sm:aspect-[4/3] md:aspect-square bg-white rounded-3xl sm:rounded-[32px] overflow-hidden shadow-sm border border-slate-200/90 group select-none">
          {/* Main Image with Optional Zoom */}
          <div
            className="relative w-full h-full cursor-zoom-in overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => enableLightbox && setIsLightboxOpen(true)}
          >
            <Image
              src={mainImage}
              alt={productTitle}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className={`object-cover transition-transform duration-300 ease-out ${
                zoomStyle.active ? "scale-150" : "scale-100 group-hover:scale-[1.02]"
              }`}
              style={
                zoomStyle.active
                  ? {
                      transformOrigin: `${zoomStyle.x}% ${zoomStyle.y}%`,
                    }
                  : undefined
              }
            />
          </div>

          {/* Badges Overlay */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
            {isBestseller && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#D4AF37] text-white shadow-md">
                <Sparkles className="w-3 h-3" /> Bestseller
              </span>
            )}
            {isFeatured && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1D2F5D] text-white shadow-md">
                Signature Choice
              </span>
            )}
          </div>

          {/* Controls Overlay: Wishlist & Lightbox */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            {enableLightbox && (
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                aria-label="Open fullscreen image view"
                className="w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-slate-200 shadow-sm backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-[#1D2F5D] transition-all hover:scale-105"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onWishlistToggle}
              disabled={wishlistLoading}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={`w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-slate-200 shadow-sm backdrop-blur-md flex items-center justify-center transition-all hover:scale-105 ${
                wishlistLoading ? "opacity-60 cursor-wait" : ""
              }`}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isWishlisted
                    ? "fill-[#B76E79] text-[#B76E79]"
                    : "text-slate-600 hover:text-[#1D2F5D]"
                }`}
              />
            </button>
          </div>

          {/* Navigation Arrows for Multiple Images */}
          {validImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
                }}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:text-[#1D2F5D] transition-all sm:opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) => (prev + 1) % validImages.length);
                }}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:text-[#1D2F5D] transition-all sm:opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Mobile Image Index Pill Counter */}
              <div className="absolute bottom-4 right-4 bg-slate-900/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium tracking-wide">
                {activeIndex + 1} / {validImages.length}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Horizontal Thumbnails */}
      {thumbnailPosition === "bottom" && renderThumbnails("horizontal")}

      {/* Mobile thumbnails if left/right were hidden on small screens */}
      {(thumbnailPosition === "left" || thumbnailPosition === "right") && (
        <div className="block sm:hidden">
          {renderThumbnails("horizontal")}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product Image Gallery Modal"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Close fullscreen gallery"
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-xl"
          >
            ✕
          </button>

          <div
            className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-full max-h-[80vh] rounded-2xl overflow-hidden">
              <Image
                src={mainImage}
                alt={productTitle}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>

            {validImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveIndex((prev) => (prev - 1 + validImages.length) % validImages.length)}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((prev) => (prev + 1) % validImages.length)}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
