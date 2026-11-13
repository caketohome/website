import React from "react";
import Image from "next/image";
import Link from "next/link";

export type LogoVariant = "navy" | "white" | "black";
export type LogoMode = "full" | "symbol";

export interface CakeToHomeLogoProps {
  /**
   * Color variant:
   * - "navy": Deep Navy (#0F172A) for light and white backgrounds
   * - "white": Pure White (#FFFFFF) for dark, chocolate, and navy surfaces
   * - "black": Monochrome Black for thermal printers, KOT, and monochrome receipts
   */
  variant?: LogoVariant;
  /**
   * Display mode:
   * - "full": Full brand mark with delivery scooter symbol and "cake to home" wordmark (1024x614, aspect ~1.67)
   * - "symbol": Delivery scooter symbol with cherry only (square 1:1 ratio)
   */
  mode?: LogoMode;
  /**
   * Optional width in pixels (or responsive Tailwind classes via className)
   */
  width?: number;
  /**
   * Optional height in pixels
   */
  height?: number;
  /**
   * Optional wrapping link URL (e.g. "/"). When null, renders without an anchor.
   */
  href?: string | null;
  /**
   * Extra container classes (e.g. "hover:opacity-90 transition-opacity")
   */
  className?: string;
  /**
   * Next.js image loading priority (use true for above-the-fold header logos)
   */
  priority?: boolean;
  /**
   * Accessible alt description
   */
  alt?: string;
}

export function CakeToHomeLogo({
  variant = "navy",
  mode = "full",
  width,
  height,
  href = null,
  className = "",
  priority = false,
  alt = "CakeToHome — Artisanal Cakes & Online Delivery",
}: CakeToHomeLogoProps) {
  // Resolve canonical asset path from centralized brand structure
  let src = "/assets/brand/caketo-home-logo-navy.png";
  if (mode === "symbol") {
    src = variant === "white"
      ? "/assets/brand/caketo-home-symbol-white.png"
      : "/assets/brand/caketo-home-symbol-navy.png";
  } else {
    if (variant === "white") {
      src = "/assets/brand/caketo-home-logo-white.png";
    } else if (variant === "black") {
      src = "/assets/brand/caketo-home-logo-black.png";
    } else {
      src = "/assets/brand/caketo-home-logo-navy.png";
    }
  }

  // Calculate default dimensions preserving exact natural aspect ratio
  // Full logo aspect ratio is 1024 / 614 = 1.6677
  // Symbol aspect ratio is 1:1
  const defaultWidth = mode === "symbol" ? (width || height || 40) : (width || (height ? Math.round(height * 1.6677) : 140));
  const defaultHeight = mode === "symbol" ? (height || width || 40) : (height || Math.round(defaultWidth / 1.6677));

  const imageElement = (
    <Image
      src={src}
      alt={alt}
      width={defaultWidth}
      height={defaultHeight}
      priority={priority}
      className={`object-contain select-none shrink-0 ${className}`}
      style={{
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
        aspectRatio: mode === "symbol" ? "1 / 1" : "1024 / 614",
      }}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center shrink-0 focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:ring-offset-2 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
        aria-label={alt}
      >
        {imageElement}
      </Link>
    );
  }

  return imageElement;
}

export default CakeToHomeLogo;

