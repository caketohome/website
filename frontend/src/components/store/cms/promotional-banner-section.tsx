"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Copy, Check, Sparkles, Tag, ArrowRight } from "lucide-react";

export interface PromotionalBannerConfig {
  headline?: string;
  heading?: string;
  subheadline?: string;
  description?: string;
  coupon_code?: string;
  offer_code?: string;
  coupon_label?: string;
  coupon_visible?: boolean;
  coupon_bg?: string;
  coupon_text_color?: string;
  coupon_border_color?: string;
  coupon_border_radius?: number;
  coupon_padding_x?: number;
  coupon_padding_y?: number;
  badge_text?: string;
  badge_visible?: boolean;
  badge_bg?: string;
  badge_text_color?: string;
  badge_border_color?: string;
  icon?: string;
  graphic_image?: string;
  cta_text?: string;
  cta_url?: string;
  cta_link?: string;
  section_width_mode?: "container" | "full" | "custom";
  max_width?: string;
  inner_banner_width?: string;
  height_mode?: "auto" | "custom";
  bg_color?: string;
  section_bg_color?: string;
  gradient_enabled?: boolean;
  gradient_start?: string;
  gradient_end?: string;
  gradient_direction?: string;
  gradient_type?: "linear" | "radial";
  bg_image?: string;
  bg_image_position?: string;
  overlay_opacity?: number;
  border_enabled?: boolean;
  border_width?: number;
  border_style?: string;
  border_color?: string;
  border_radius?: number;
  shadow_preset?: "none" | "small" | "medium" | "large" | "custom";
  custom_shadow?: string;
  text_color?: string;
  headline_color?: string;
  headline_font_weight?: string;
  subtitle_color?: string;
  subtitle_line_height?: string;
  subtitle_max_width?: string;
  cta_bg_color?: string;
  cta_text_color?: string;
  cta_hover_bg?: string;
  cta_hover_text_color?: string;
  cta_border_radius?: number;
  cta_padding_x?: number;
  cta_padding_y?: number;
  cta_font_weight?: string;
  vertical_align?: string;
  target_devices?: "all" | "desktop_only" | "mobile_only" | "tablet_desktop";
  desktop?: any;
  tablet?: any;
  mobile?: any;
}

interface PromotionalBannerSectionProps {
  sectionId: string;
  config: PromotionalBannerConfig;
  desktopConfig?: any;
  tabletConfig?: any;
  mobileConfig?: any;
  isPreview?: boolean;
  isSelected?: boolean;
  onSectionClick?: (id: string) => void;
}

export function PromotionalBannerSection({
  sectionId,
  config,
  desktopConfig = {},
  tabletConfig = {},
  mobileConfig = {},
  isPreview = false,
  isSelected = false,
  onSectionClick,
}: PromotionalBannerSectionProps) {
  const [copied, setCopied] = useState(false);

  // Content Extraction
  const headline = config.headline || config.heading || "🎉 Monsoon Special — Flat 50% OFF";
  const rawSubheadline = config.subheadline || config.description || "Valid on all birthday & anniversary cakes above ₹299";
  const couponCode = config.coupon_code || config.offer_code;
  const couponLabel = config.coupon_label ?? "Use Code:";
  const showCoupon = config.coupon_visible !== false && !!couponCode;

  // Clean Subtitle (avoiding redundant repetition of the coupon code text)
  let cleanSubtitle = rawSubheadline;
  if (couponCode && cleanSubtitle.includes(couponCode)) {
    cleanSubtitle = cleanSubtitle
      .replace(new RegExp(`Use Code:?\\s*${couponCode}[.,—\\s-]*`, "gi"), "")
      .replace(new RegExp(`Code:?\\s*${couponCode}[.,—\\s-]*`, "gi"), "")
      .trim();
  }

  // Badge settings
  const badgeText = config.badge_text || "LIMITED TIME OFFER";
  const showBadge = config.badge_visible !== false && !!badgeText;
  const badgeBg = config.badge_bg || "rgba(245, 158, 11, 0.18)";
  const badgeTextColor = config.badge_text_color || "#92400e";
  const badgeBorderColor = config.badge_border_color || "rgba(245, 158, 11, 0.35)";

  // Offer Code Pill settings
  const couponBg = config.coupon_bg || "#ffffff";
  const couponTextColor = config.coupon_text_color || "#8A3F00";
  const couponBorderColor = config.coupon_border_color || "#F6C85F";
  const couponRadius = config.coupon_border_radius ?? 10;
  const couponPadX = config.coupon_padding_x ?? 12;
  const couponPadY = config.coupon_padding_y ?? 6;

  // Icons & CTA
  const icon = config.icon || (headline.startsWith("🎉") ? "" : "🎉");
  const ctaText = config.cta_text || "Claim Offer";
  const ctaUrl = config.cta_url || config.cta_link || "/products";
  const graphicImage = config.graphic_image;

  // Background computation (Outer Section default is transparent, Inner Card default is rich/gradient)
  const bgColor = config.bg_color || "#FFF2C2";
  const sectionBgColor = config.section_bg_color || "transparent";
  const gradientEnabled = config.gradient_enabled !== false;
  const gradientStart = config.gradient_start || bgColor;
  const gradientEnd = config.gradient_end || "#FFE494";
  const gradientDirection = config.gradient_direction || "90deg";

  const effectiveBg = gradientEnabled
    ? `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`
    : bgColor;

  // Border & Shadows
  const borderEnabled = config.border_enabled !== false;
  const borderWidth = borderEnabled ? (config.border_width ?? 1.5) : 0;
  const borderStyle = config.border_style || "solid";
  const borderColor = config.border_color || "#F6C85F";
  const borderRadius = config.border_radius ?? 24;

  const shadowPresets = {
    none: "none",
    small: "0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 1px 4px -1px rgba(0, 0, 0, 0.04)",
    medium: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
    large: "0 20px 35px -10px rgba(0, 0, 0, 0.12), 0 10px 15px -5px rgba(0, 0, 0, 0.06)",
    custom: config.custom_shadow || "0 10px 25px -5px rgba(0, 0, 0, 0.08)",
  };
  const boxShadow = shadowPresets[config.shadow_preset || "small"];

  // Typography
  const textColor = config.text_color || config.headline_color || "#8A3F00";
  const headlineWeight = config.headline_font_weight || "900";
  const subtitleColor = config.subtitle_color || "#6B3100";
  const subtitleLineHeight = config.subtitle_line_height || "1.45";
  const subtitleMaxWidth = config.subtitle_max_width || "680px";

  // CTA Button Styling
  const ctaBgColor = config.cta_bg_color || "#E11D48";
  const ctaTextColor = config.cta_text_color || "#FFFFFF";
  const ctaHoverBg = config.cta_hover_bg || "#BE123C";
  const ctaHoverTextColor = config.cta_hover_text_color || "#FFFFFF";
  const ctaBorderRadius = config.cta_border_radius ?? 14;
  const ctaPaddingX = config.cta_padding_x ?? 24;
  const ctaPaddingY = config.cta_padding_y ?? 12;
  const ctaFontWeight = config.cta_font_weight || "700";

  // Responsive Breakpoints: Desktop (dt), Tablet (tb), Mobile (mb)
  const dtPaddingTop = desktopConfig.padding_top ?? 22;
  const dtPaddingBottom = desktopConfig.padding_bottom ?? 22;
  const dtPaddingLeft = desktopConfig.padding_left ?? 32;
  const dtPaddingRight = desktopConfig.padding_right ?? 32;
  const dtHeight = desktopConfig.height && desktopConfig.height !== "auto" ? desktopConfig.height : "auto";
  const dtMinHeight = desktopConfig.min_height || "110px";
  const dtHeadlineSize = desktopConfig.headline_font_size || "1.65rem";
  const dtSubtitleSize = desktopConfig.subtitle_font_size || "0.95rem";
  const dtLayoutDirection = desktopConfig.layout_direction || "horizontal";
  const dtTextAlign = desktopConfig.text_alignment || "left";
  const dtCtaWidthMode = desktopConfig.cta_width_mode || "auto";

  const tbPaddingTop = tabletConfig.padding_top ?? 20;
  const tbPaddingBottom = tabletConfig.padding_bottom ?? 20;
  const tbPaddingLeft = tabletConfig.padding_left ?? 24;
  const tbPaddingRight = tabletConfig.padding_right ?? 24;
  const tbHeight = tabletConfig.height && tabletConfig.height !== "auto" ? tabletConfig.height : "auto";
  const tbMinHeight = tabletConfig.min_height || "110px";
  const tbHeadlineSize = tabletConfig.headline_font_size || "1.45rem";
  const tbSubtitleSize = tabletConfig.subtitle_font_size || "0.9rem";
  const tbLayoutDirection = tabletConfig.layout_direction || "horizontal";
  const tbTextAlign = tabletConfig.text_alignment || "left";
  const tbCtaWidthMode = tabletConfig.cta_width_mode || "auto";

  const mbPaddingTop = mobileConfig.padding_top ?? 18;
  const mbPaddingBottom = mobileConfig.padding_bottom ?? 18;
  const mbPaddingLeft = mobileConfig.padding_left ?? 16;
  const mbPaddingRight = mobileConfig.padding_right ?? 16;
  const mbHeight = mobileConfig.height && mobileConfig.height !== "auto" ? mobileConfig.height : "auto";
  const mbMinHeight = mobileConfig.min_height || "auto";
  const mbHeadlineSize = mobileConfig.headline_font_size || "1.2rem";
  const mbSubtitleSize = mobileConfig.subtitle_font_size || "0.85rem";
  const mbLayoutDirection = mobileConfig.layout_direction || "vertical";
  const mbTextAlign = mobileConfig.text_alignment || "center";
  const mbCtaWidthMode = mobileConfig.cta_width_mode || "full";

  const handleCopyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!couponCode) return;
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bannerClassName = `cth-promo-card-${sectionId}`;
  const ctaBtnClassName = `cth-promo-cta-${sectionId}`;

  return (
    <section
      id={`section-${sectionId}`}
      onClick={() => onSectionClick?.(sectionId)}
      className={`w-full transition-all relative ${
        isSelected ? "ring-2 ring-rose-500 ring-offset-4 rounded-2xl cursor-pointer" : ""
      } ${isPreview ? "hover:outline-dashed hover:outline-2 hover:outline-rose-400" : ""}`}
      style={{ backgroundColor: sectionBgColor }}
    >
      {/* Dynamic Scoped Responsive Stylesheet via dangerouslySetInnerHTML to prevent React hydration warnings */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Mobile Defaults (< 640px) */
        .${bannerClassName} {
          min-height: ${mbMinHeight};
          height: ${mbHeight};
          padding: ${mbPaddingTop}px ${mbPaddingRight}px ${mbPaddingBottom}px ${mbPaddingLeft}px;
          flex-direction: ${mbLayoutDirection === "horizontal" ? "row" : "column"};
          text-align: ${mbTextAlign};
          align-items: ${mbTextAlign === "center" ? "center" : mbTextAlign === "right" ? "flex-end" : "flex-start"};
        }
        .${bannerClassName} .promo-headline {
          font-size: ${mbHeadlineSize};
        }
        .${bannerClassName} .promo-subtitle {
          font-size: ${mbSubtitleSize};
        }
        .${ctaBtnClassName} {
          width: ${mbCtaWidthMode === "full" ? "100%" : "auto"};
          justify-content: center;
        }

        /* Tablet (640px - 1023px) */
        @media (min-width: 640px) and (max-width: 1023px) {
          .${bannerClassName} {
            min-height: ${tbMinHeight};
            height: ${tbHeight};
            padding: ${tbPaddingTop}px ${tbPaddingRight}px ${tbPaddingBottom}px ${tbPaddingLeft}px;
            flex-direction: ${tbLayoutDirection === "vertical" ? "column" : "row"};
            text-align: ${tbTextAlign};
            align-items: ${tbLayoutDirection === "vertical" ? (tbTextAlign === "center" ? "center" : "flex-start") : "center"};
            justify-content: space-between;
          }
          .${bannerClassName} .promo-headline {
            font-size: ${tbHeadlineSize};
          }
          .${bannerClassName} .promo-subtitle {
            font-size: ${tbSubtitleSize};
          }
          .${ctaBtnClassName} {
            width: ${tbCtaWidthMode === "full" ? "100%" : tbCtaWidthMode === "fixed" ? "200px" : "auto"};
          }
        }

        /* Desktop (>= 1024px) */
        @media (min-width: 1024px) {
          .${bannerClassName} {
            min-height: ${dtMinHeight};
            height: ${dtHeight};
            padding: ${dtPaddingTop}px ${dtPaddingRight}px ${dtPaddingBottom}px ${dtPaddingLeft}px;
            flex-direction: ${dtLayoutDirection === "vertical" ? "column" : "row"};
            text-align: ${dtTextAlign};
            align-items: ${dtLayoutDirection === "vertical" ? (dtTextAlign === "center" ? "center" : "flex-start") : "center"};
            justify-content: space-between;
          }
          .${bannerClassName} .promo-headline {
            font-size: ${dtHeadlineSize};
          }
          .${bannerClassName} .promo-subtitle {
            font-size: ${dtSubtitleSize};
          }
          .${ctaBtnClassName} {
            width: ${dtCtaWidthMode === "full" ? "100%" : dtCtaWidthMode === "fixed" ? "200px" : "auto"};
          }
        }

        /* CTA Hover State */
        .${ctaBtnClassName}:hover {
          background-color: ${ctaHoverBg} !important;
          color: ${ctaHoverTextColor} !important;
          transform: translateY(-1px);
        }
      `,
        }}
      />

      {/* Main Banner Container */}
      <div
        className="w-full mx-auto"
        style={{
          maxWidth: config.section_width_mode === "full" ? "100%" : config.max_width || "1400px",
        }}
      >
        <div
          className={`${bannerClassName} flex gap-4 sm:gap-6 relative overflow-hidden transition-all duration-200`}
          style={{
            background: effectiveBg,
            color: textColor,
            border: borderEnabled ? `${borderWidth}px ${borderStyle} ${borderColor}` : "none",
            borderRadius: `${borderRadius}px`,
            boxShadow: boxShadow,
            maxWidth: config.inner_banner_width || "100%",
          }}
        >
          {/* Optional Background Pattern / Image Overlay */}
          {config.bg_image && (
            <div
              className="absolute inset-0 pointer-events-none bg-cover bg-no-repeat"
              style={{
                backgroundImage: `url(${config.bg_image})`,
                backgroundPosition: config.bg_image_position || "center",
                opacity: (config.overlay_opacity ?? 20) / 100,
              }}
            />
          )}

          {/* Left Column: Content */}
          <div className="flex flex-col gap-1.5 z-10 min-w-0 flex-1">
            {/* Optional Badge */}
            {showBadge && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold tracking-wider uppercase w-fit mb-0.5 border"
                style={{
                  backgroundColor: badgeBg,
                  color: badgeTextColor,
                  borderColor: badgeBorderColor,
                }}
              >
                <Sparkles className="w-3 h-3" style={{ color: badgeTextColor }} />
                <span>{badgeText}</span>
              </div>
            )}

            {/* Headline */}
            <h3
              className="promo-headline tracking-tight leading-tight font-black"
              style={{
                color: textColor,
                fontWeight: headlineWeight,
              }}
            >
              {icon && !headline.startsWith(icon) && <span className="mr-1.5 inline-block">{icon}</span>}
              {headline}
            </h3>

            {/* Subheadline & Offer Code Pill */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {cleanSubtitle && (
                <p
                  className="promo-subtitle font-medium opacity-90"
                  style={{
                    color: subtitleColor,
                    lineHeight: subtitleLineHeight,
                    maxWidth: subtitleMaxWidth,
                  }}
                >
                  {cleanSubtitle}
                </p>
              )}

              {/* Offer Code Pill with Independent Styling */}
              {showCoupon && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer group active:scale-95 shadow-xs border"
                  style={{
                    backgroundColor: couponBg,
                    color: couponTextColor,
                    borderColor: couponBorderColor,
                    borderRadius: `${couponRadius}px`,
                    padding: `${couponPadY}px ${couponPadX}px`,
                  }}
                  title="Click to copy coupon code"
                >
                  <Tag className="w-3 h-3 group-hover:rotate-12 transition-transform opacity-75" />
                  {couponLabel && <span className="opacity-80 font-semibold">{couponLabel}</span>}
                  <span className="font-mono tracking-wide font-black">{couponCode}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 font-black animate-in zoom-in" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Optional Illustration */}
          {graphicImage && (
            <div className="hidden lg:flex items-center justify-center shrink-0 z-10">
              <img
                src={graphicImage}
                alt="Promotion"
                className="h-20 w-auto object-contain drop-shadow-md"
              />
            </div>
          )}

          {/* Right Column / CTA Action Button */}
          {ctaText && (
            <div className="shrink-0 z-10 flex items-center">
              <Link href={ctaUrl} className="w-full sm:w-auto">
                <button
                  type="button"
                  className={`${ctaBtnClassName} inline-flex items-center gap-2 font-bold transition-all shadow-md active:scale-95`}
                  style={{
                    backgroundColor: ctaBgColor,
                    color: ctaTextColor,
                    borderRadius: `${ctaBorderRadius}px`,
                    padding: `${ctaPaddingY}px ${ctaPaddingX}px`,
                    fontWeight: ctaFontWeight,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <span>{ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
