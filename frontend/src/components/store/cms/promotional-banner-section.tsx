"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Tag, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { copyText, PENDING_COUPON_KEY } from "@/lib/util/clipboard";

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
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [claimState, setClaimState] = useState<{
    status: "idle" | "loading" | "applied" | "saved" | "error";
    message?: string;
  }>({ status: "idle" });

  // Content Extraction
  // No made-up offers: the banner shows only what the CMS configures.
  const headline = config.headline || config.heading || "";
  const rawSubheadline = config.subheadline || config.description || "";
  const couponCode = config.coupon_code || config.offer_code;
  const couponLabel = config.coupon_label ?? "Use Code:";
  const showCoupon = config.coupon_visible !== false && !!couponCode;

  // Clean Subtitle (avoiding redundant repetition of the coupon code text)
  let cleanSubtitle = rawSubheadline;
  if (!headline && !couponCode) return null;
  if (couponCode && cleanSubtitle.includes(couponCode)) {
    cleanSubtitle = cleanSubtitle
      .replace(new RegExp(`Use Code:?\\s*${couponCode}[.,—\\s-]*`, "gi"), "")
      .replace(new RegExp(`Code:?\\s*${couponCode}[.,—\\s-]*`, "gi"), "")
      .trim();
  }

  // Badge settings
  const badgeText = config.badge_text || ""; // no badge unless the CMS sets one
  const showBadge = config.badge_visible !== false && !!badgeText;
  const badgeTextColor = config.badge_text_color || "#9B6A19";

  // Offer Code Pill settings
  const couponBg = config.coupon_bg || "#ffffff";
  const couponTextColor = config.coupon_text_color || "#1D2F5D";
  const couponBorderColor = config.coupon_border_color || "#E5E7EB";
  const couponRadius = config.coupon_border_radius ?? 10;
  const couponPadX = config.coupon_padding_x ?? 12;
  const couponPadY = config.coupon_padding_y ?? 6;

  // Icons & CTA
  const icon = config.icon || ""; // no automatic emoji
  const ctaText = config.cta_text || "Claim Offer";
  const ctaUrl = config.cta_url || config.cta_link || "/products";
  const graphicImage = config.graphic_image;

  // Background computation (Outer Section default is transparent, Inner Card default is rich/gradient)
  const bgColor = config.bg_color || "#F8F3EB";
  const sectionBgColor = config.section_bg_color || "transparent";
  const gradientEnabled = config.gradient_enabled === true; // solid card by default (brand: no heavy gradients)
  const gradientStart = config.gradient_start || bgColor;
  const gradientEnd = config.gradient_end || "#F5E8CC";
  const gradientDirection = config.gradient_direction || "90deg";

  const effectiveBg = gradientEnabled
    ? `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`
    : bgColor;

  // Border & Shadows
  const borderEnabled = config.border_enabled !== false;
  const borderWidth = borderEnabled ? (config.border_width ?? 1) : 0;
  const borderStyle = config.border_style || "solid";
  const borderColor = config.border_color || "#E8D3A8";
  const borderRadius = config.border_radius ?? 16;

  const shadowPresets = {
    none: "none",
    small: "0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 1px 4px -1px rgba(0, 0, 0, 0.04)",
    medium: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
    large: "0 20px 35px -10px rgba(0, 0, 0, 0.12), 0 10px 15px -5px rgba(0, 0, 0, 0.06)",
    custom: config.custom_shadow || "0 10px 25px -5px rgba(0, 0, 0, 0.08)",
  };
  const boxShadow = shadowPresets[config.shadow_preset || "small"];

  // Typography
  const textColor = config.text_color || config.headline_color || "#1D2F5D";
  const headlineWeight = config.headline_font_weight || "600";
  const subtitleColor = config.subtitle_color || "#4B5563";
  const subtitleLineHeight = config.subtitle_line_height || "1.45";
  const subtitleMaxWidth = config.subtitle_max_width || "680px";

  // CTA Button Styling
  const ctaBgColor = config.cta_bg_color || "#1D2F5D";
  const ctaTextColor = config.cta_text_color || "#FFFFFF";
  const ctaHoverBg = config.cta_hover_bg || "#245A96";
  const ctaHoverTextColor = config.cta_hover_text_color || "#FFFFFF";
  const ctaBorderRadius = config.cta_border_radius ?? 10;
  const ctaPaddingX = config.cta_padding_x ?? 24;
  const ctaPaddingY = config.cta_padding_y ?? 12;
  const ctaFontWeight = config.cta_font_weight || "600";

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

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!couponCode) return;
    const ok = await copyText(couponCode);
    setCopyFailed(!ok);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  // Claim Offer: validate through the existing cart promo endpoint (backend owns
  // eligibility, min order, cap, expiry). Only navigate on a valid result.
  const handleClaimOffer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreview) return;
    if (!couponCode) {
      router.push(ctaUrl);
      return;
    }
    setClaimState({ status: "loading" });
    try {
      const cartRes: any = await apiClient.getCart();
      const cartId = cartRes?.cart?.id || cartRes?.id;
      const items = cartRes?.cart?.items || cartRes?.items || [];
      if (!cartId || items.length === 0) {
        // Nothing to discount yet: remember the code so checkout applies it, then shop.
        try { sessionStorage.setItem(PENDING_COUPON_KEY, couponCode); } catch {}
        setClaimState({
          status: "saved",
          message: `Code ${couponCode} saved. Add a cake to your bag and it will be applied at checkout.`,
        });
        router.push(ctaUrl);
        return;
      }
      const res: any = await apiClient.applyPromoCode(cartId, couponCode);
      if (res?.valid) {
        try { sessionStorage.setItem(PENDING_COUPON_KEY, res.code || couponCode); } catch {}
        setClaimState({
          status: "applied",
          message: `${res.code || couponCode} applied. You save ₹${res.discount ?? 0}.`,
        });
        router.push("/checkout");
      } else {
        setClaimState({ status: "error", message: res?.error || "This offer cannot be applied to your bag." });
      }
    } catch (err: any) {
      setClaimState({ status: "error", message: err?.message || "Could not claim the offer. Please try again." });
    }
  };

  const bannerClassName = `cth-promo-card-${sectionId}`;
  const ctaBtnClassName = `cth-promo-cta-${sectionId}`;

  return (
    <section
      id={`section-${sectionId}`}
      onClick={() => onSectionClick?.(sectionId)}
      className={`w-full transition-all relative ${
        isSelected ? "ring-2 ring-brand-gold/50 ring-offset-4 rounded-2xl cursor-pointer" : ""
      } ${isPreview ? "hover:outline-dashed hover:outline-2 hover:outline-brand-gold/60" : ""}`}
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
              <p className="text-xs font-semibold tracking-wide w-fit mb-0.5" style={{ color: badgeTextColor }}>
                {badgeText}
              </p>
            )}

            {/* Headline */}
            <h3
              className="promo-headline font-serif tracking-tight leading-tight"
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
                  aria-label={`Copy coupon code ${couponCode}`}
                >
                  <Tag className="w-3 h-3 group-hover:rotate-12 transition-transform opacity-75" />
                  {couponLabel && <span className="opacity-80 font-semibold">{couponLabel}</span>}
                  <span className={`font-mono tracking-wide font-black ${copyFailed ? "select-all" : ""}`}>{couponCode}</span>
                  {copied ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-black">
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </span>
                  ) : (
                    <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              )}
              <span role="status" aria-live="polite" className="sr-only">
                {copied ? `Coupon code ${couponCode} copied` : ""}
              </span>
              {copyFailed && (
                <span role="alert" className="text-xs font-semibold" style={{ color: subtitleColor }}>
                  Could not copy automatically. Select the code and copy it manually.
                </span>
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
            <div className="shrink-0 z-10 flex flex-col items-stretch gap-1">
              <button
                type="button"
                onClick={handleClaimOffer}
                disabled={claimState.status === "loading"}
                className={`${ctaBtnClassName} inline-flex items-center gap-2 font-bold transition-all shadow-md active:scale-95 disabled:opacity-70`}
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
                <span>{claimState.status === "loading" ? "Applying…" : ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span role="status" aria-live="polite" className="text-xs font-semibold max-w-[260px]" style={{ color: claimState.status === "error" ? "#B42318" : subtitleColor }}>
                {claimState.message || ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
