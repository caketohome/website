"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Tag, Copy, Check, ArrowRight, X, Sparkles } from "lucide-react";

export interface AnnouncementBarConfig {
  enabled?: boolean;
  text?: string;
  message?: string;
  icon?: string;
  badge_text?: string;
  badge_visible?: boolean;
  badge_bg?: string;
  badge_text_color?: string;

  // Display Mode
  display_mode?: "static" | "marquee";

  // Scrolling / Marquee
  scrolling_text?: string;
  scroll_enabled?: boolean;
  scroll_speed?: "slow" | "normal" | "fast" | "custom";
  scroll_speed_duration?: number; // seconds
  scroll_direction?: "left" | "right";
  pause_on_hover?: boolean;

  // Action Master Toggle
  action_enabled?: boolean;

  // Action Mode
  action_type?: "none" | "copy_coupon" | "open_link" | "copy_and_link";

  // Coupon settings
  coupon_code?: string;
  copy_button_text?: string;
  copy_success_text?: string;
  coupon_bg?: string;
  coupon_text_color?: string;
  coupon_border_color?: string;
  coupon_border_radius?: number;

  // CTA Link settings
  cta_text?: string;
  cta_url?: string;
  cta_target?: "_self" | "_blank";
  cta_bg_color?: string;
  cta_text_color?: string;
  cta_hover_bg?: string;
  cta_hover_text?: string;
  cta_border_color?: string;
  cta_border_radius?: number;

  // Design & Colors
  bg_mode?: "solid" | "gradient";
  bg_color?: string;
  gradient_start?: string;
  gradient_end?: string;
  gradient_direction?: string;
  text_color?: string;
  accent_color?: string;
  border_top_color?: string;
  border_bottom_color?: string;
  border_bottom_width?: number;

  // Height & Dimensions
  height_mode?: "auto" | "custom";
  desktop_height?: string | number;
  tablet_height?: string | number;
  mobile_height?: string | number;
  content_max_width?: string;
  content_alignment?: "center" | "space_between" | "left";

  // Spacing
  padding_x?: number;
  padding_y?: number;
  element_gap?: number;

  // Typography
  desktop_font_size?: string;
  tablet_font_size?: string;
  mobile_font_size?: string;
  font_weight?: string;
  letter_spacing?: string;

  // Behavior & Scheduling
  position_mode?: "static" | "sticky";
  dismissible?: boolean;
  schedule?: {
    enabled?: boolean;
    start?: string | null;
    end?: string | null;
    timezone?: string;
  };
}

interface AnnouncementBarSectionProps {
  sectionId?: string;
  config?: AnnouncementBarConfig;
  isPreview?: boolean;
  isSelected?: boolean;
  onSectionClick?: (id: string) => void;
}

export function AnnouncementBarSection({
  sectionId = "announcement_bar",
  config = {},
  isPreview = false,
  isSelected = false,
  onSectionClick,
}: AnnouncementBarSectionProps) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isScheduledActive, setIsScheduledActive] = useState(true);

  // Check scheduling window
  useEffect(() => {
    if (!config.schedule?.enabled) {
      setIsScheduledActive(true);
      return;
    }
    try {
      const now = new Date();
      if (config.schedule.start) {
        const startDate = new Date(config.schedule.start);
        if (now < startDate) { setIsScheduledActive(false); return; }
      }
      if (config.schedule.end) {
        const endDate = new Date(config.schedule.end);
        if (now > endDate) { setIsScheduledActive(false); return; }
      }
      setIsScheduledActive(true);
    } catch {
      setIsScheduledActive(true);
    }
  }, [config.schedule]);

  // Check session dismissal
  useEffect(() => {
    if (typeof window === "undefined" || !config.dismissible || isPreview) return;
    try {
      const isDismissed = sessionStorage.getItem(`cth_announcement_dismissed_${sectionId}`);
      if (isDismissed === "true") setDismissed(true);
    } catch { /* Ignore */ }
  }, [config.dismissible, sectionId, isPreview]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
    if (typeof window !== "undefined") {
      try { sessionStorage.setItem(`cth_announcement_dismissed_${sectionId}`, "true"); } catch { /* Safe */ }
    }
  };

  // ── Guard: Do not render if disabled, dismissed, or outside schedule ──
  const isEnabled = config.enabled !== false;
  if ((!isEnabled || dismissed || !isScheduledActive) && !isPreview) {
    return null;
  }

  // ── Display Mode ──
  const displayMode = config.display_mode || "static";

  // ── Content ──
  // NO hardcoded fallback. Use CMS values only.
  const staticText = config.text || config.message || "";
  const scrollingText = config.scrolling_text || staticText || "";
  const messageText = displayMode === "marquee" ? scrollingText : staticText;

  // If there's no content at all and we're not in preview, don't render
  if (!messageText && !isPreview) return null;

  const icon = config.icon || "";
  const badgeText = config.badge_text;
  const showBadge = config.badge_visible !== false && !!badgeText;
  const badgeBg = config.badge_bg || "rgba(255, 255, 255, 0.2)";
  const badgeTextColor = config.badge_text_color || "#FFFFFF";

  // ── Action ──
  const actionEnabled = config.action_enabled !== false;
  const actionType = actionEnabled
    ? (config.action_type ||
       (config.coupon_code && config.cta_text ? "copy_and_link"
         : config.coupon_code ? "copy_coupon"
         : config.cta_text ? "open_link"
         : "none"))
    : "none";

  const couponCode = config.coupon_code || "";
  const copyBtnText = config.copy_button_text || "Copy Code";
  const copySuccessText = config.copy_success_text || "Copied!";
  const couponBg = config.coupon_bg || "rgba(255, 255, 255, 0.95)";
  const couponTextColor = config.coupon_text_color || "#991B1B";
  const couponBorderColor = config.coupon_border_color || "rgba(255, 255, 255, 0.4)";
  const couponRadius = config.coupon_border_radius ?? 8;

  const ctaText = config.cta_text || "";
  const ctaUrl = config.cta_url || "/products";
  const ctaTarget = config.cta_target || "_self";
  const ctaBgColor = config.cta_bg_color || "#FFFFFF";
  const ctaTextColor = config.cta_text_color || "#991B1B";
  const ctaHoverBg = config.cta_hover_bg || "#FEE2E2";
  const ctaHoverText = config.cta_hover_text || "#7F1D1D";
  const ctaBorderColor = config.cta_border_color || "transparent";
  const ctaRadius = config.cta_border_radius ?? 8;

  // ── Background ──
  const bgMode = config.bg_mode || (config.gradient_start ? "gradient" : "solid");
  const bgColor = config.bg_color || "#E11D48";
  const gradientStart = config.gradient_start || bgColor;
  const gradientEnd = config.gradient_end || "#BE123C";
  const gradientDirection = config.gradient_direction || "90deg";
  const effectiveBg = bgMode === "gradient"
    ? `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`
    : bgColor;

  // ── Typography ──
  const textColor = config.text_color || "#FFFFFF";
  const fontWeight = config.font_weight || "700";
  const letterSpacing = config.letter_spacing || "normal";

  // ── Dimensions ──
  const isSticky = config.position_mode === "sticky";
  const contentMaxWidth = config.content_max_width || "1440px";
  const contentAlignment = config.content_alignment || "center";

  const dtFontSize = config.desktop_font_size || "0.875rem";
  const tbFontSize = config.tablet_font_size || "0.8125rem";
  const mbFontSize = config.mobile_font_size || "0.75rem";

  const dtHeight = config.height_mode === "custom" ? (typeof config.desktop_height === "number" ? `${config.desktop_height}px` : config.desktop_height || "44px") : "auto";
  const tbHeight = config.height_mode === "custom" ? (typeof config.tablet_height === "number" ? `${config.tablet_height}px` : config.tablet_height || "44px") : "auto";
  const mbHeight = config.height_mode === "custom" ? (typeof config.mobile_height === "number" ? `${config.mobile_height}px` : config.mobile_height || "auto") : "auto";

  const padX = config.padding_x ?? 24;
  const padY = config.padding_y ?? 10;

  // ── Marquee config ──
  const scrollSpeed = config.scroll_speed || "normal";
  const scrollSpeedDuration = config.scroll_speed_duration ?? (scrollSpeed === "slow" ? 30 : scrollSpeed === "fast" ? 10 : 20);
  const scrollDirection = config.scroll_direction || "left";
  const pauseOnHover = config.pause_on_hover !== false;

  // ── Handlers ──
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!couponCode) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(couponCode).catch(() => {
          const el = document.createElement("textarea");
          el.value = couponCode;
          el.style.position = "fixed";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
        });
      } else {
        const el = document.createElement("textarea");
        el.value = couponCode;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
    } catch {
      // Ignored
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const barId = `cth-announcement-${sectionId}`;
  const ctaBtnClass = `cth-ann-cta-${sectionId}`;
  const marqueeId = `cth-marquee-${sectionId}`;
  const isExternalUrl = ctaUrl.startsWith("http://") || ctaUrl.startsWith("https://");

  // ── Render Coupon Button (shared between copy_coupon and copy_and_link modes) ──
  const renderCouponButton = () => {
    if (!couponCode) return null;
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy coupon code ${couponCode}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-black transition-all cursor-pointer group active:scale-95 shadow-sm shrink-0 border"
        style={{
          backgroundColor: couponBg,
          color: couponTextColor,
          borderColor: couponBorderColor,
          borderRadius: `${couponRadius}px`,
        }}
        title="Click to copy code"
      >
        <Tag className="w-3 h-3 group-hover:rotate-12 transition-transform" />
        <span className="font-mono tracking-wider">{couponCode}</span>
        {copied ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold ml-0.5">
            <Check className="w-3.5 h-3.5" />
            <span>{copySuccessText}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-bold opacity-80 group-hover:opacity-100 ml-0.5">
            <Copy className="w-3 h-3" />
            <span>{copyBtnText}</span>
          </span>
        )}
      </button>
    );
  };

  // ── Render CTA Link (shared between open_link and copy_and_link modes) ──
  const renderCtaLink = () => {
    if (!ctaText) return null;
    const classes = `${ctaBtnClass} inline-flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold transition-all shadow-sm active:scale-95 border`;
    const styles = {
      backgroundColor: ctaBgColor,
      color: ctaTextColor,
      borderColor: ctaBorderColor,
      borderRadius: `${ctaRadius}px`,
      textDecoration: "none" as const,
    };
    if (isExternalUrl) {
      return (
        <a href={ctaUrl} target={ctaTarget} rel="noopener noreferrer" className={classes} style={styles}>
          <span>{ctaText}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      );
    }
    return (
      <Link href={ctaUrl} className={classes} style={styles}>
        <span>{ctaText}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  };

  // ── Render Actions ──
  const renderActions = () => {
    if (actionType === "none") return null;
    if (actionType === "copy_coupon") return renderCouponButton();
    if (actionType === "open_link") return <div className="shrink-0">{renderCtaLink()}</div>;
    if (actionType === "copy_and_link") {
      return (
        <div className="flex items-center gap-2 shrink-0">
          {renderCouponButton()}
          {renderCtaLink()}
        </div>
      );
    }
    return null;
  };

  // ── Render Message Content (Static or Marquee) ──
  const renderMessageContent = () => {
    if (displayMode === "marquee" && scrollingText) {
      // Marquee: continuously scrolling text
      return (
        <div className="overflow-hidden flex-1 min-w-0 relative" style={{ maskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)" }}>
          <div
            className={marqueeId}
            style={{
              display: "inline-flex",
              whiteSpace: "nowrap",
              willChange: "transform",
              animationName: `cth-marquee-scroll-${sectionId}`,
              animationDuration: `${scrollSpeedDuration}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationDirection: scrollDirection === "right" ? "reverse" : "normal",
            }}
          >
            {/* Duplicate content for seamless loop */}
            <span className="inline-flex items-center gap-6 px-4" style={{ fontWeight, letterSpacing, color: textColor }}>
              {icon && <span className="text-sm sm:text-base">{icon}</span>}
              <span>{scrollingText}</span>
            </span>
            <span className="inline-flex items-center gap-6 px-4" style={{ fontWeight, letterSpacing, color: textColor }}>
              {icon && <span className="text-sm sm:text-base">{icon}</span>}
              <span>{scrollingText}</span>
            </span>
            <span className="inline-flex items-center gap-6 px-4" style={{ fontWeight, letterSpacing, color: textColor }}>
              {icon && <span className="text-sm sm:text-base">{icon}</span>}
              <span>{scrollingText}</span>
            </span>
          </div>
        </div>
      );
    }

    // Static mode
    return (
      <div
        className="flex items-center gap-1.5 font-bold tracking-tight leading-snug truncate max-w-full"
        style={{ color: textColor, fontWeight, letterSpacing }}
      >
        {icon && <span className="shrink-0 text-sm sm:text-base">{icon}</span>}
        <span className="truncate">{messageText || (isPreview ? "(No announcement text configured)" : "")}</span>
      </div>
    );
  };

  return (
    <div
      id={`section-${sectionId}`}
      onClick={() => onSectionClick?.(sectionId)}
      className={`cth-announcement-bar w-full max-w-none m-0 rounded-none overflow-hidden transition-all relative ${
        isSticky ? "sticky top-0 z-40" : "relative"
      } ${
        isSelected ? "ring-2 ring-rose-500 ring-offset-2 cursor-pointer" : ""
      } ${isPreview ? "hover:outline-dashed hover:outline-2 hover:outline-rose-300" : ""}`}
      style={{
        width: "100%",
        maxWidth: "none",
        margin: 0,
        borderRadius: 0,
        background: effectiveBg,
        color: textColor,
        borderBottom: config.border_bottom_width
          ? `${config.border_bottom_width}px solid ${config.border_bottom_color || "rgba(0,0,0,0.15)"}`
          : "none",
        borderTop: config.border_top_color ? `1px solid ${config.border_top_color}` : "none",
      }}
    >
      {/* Dynamic Scoped CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        #${barId} {
          min-height: ${mbHeight};
          font-size: ${mbFontSize};
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          #${barId} {
            min-height: ${tbHeight};
            font-size: ${tbFontSize};
          }
        }
        @media (min-width: 1024px) {
          #${barId} {
            min-height: ${dtHeight};
            font-size: ${dtFontSize};
          }
        }
        .${ctaBtnClass}:hover {
          background-color: ${ctaHoverBg} !important;
          color: ${ctaHoverText} !important;
        }
        @keyframes cth-marquee-scroll-${sectionId} {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-33.333%); }
        }
        ${pauseOnHover ? `#${barId}:hover .${marqueeId} { animation-play-state: paused; }` : ""}
      `,
        }}
      />

      {/* Inner Content Container */}
      <div
        id={barId}
        className="w-full mx-auto flex items-center justify-between transition-all flex-wrap sm:flex-nowrap gap-2 sm:gap-3"
        style={{
          maxWidth: contentMaxWidth === "full" ? "100%" : contentMaxWidth,
          padding: `${padY}px ${padX}px`,
        }}
      >
        {/* Main Message Column */}
        <div
          className={`flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 flex-1 ${
            contentAlignment === "center"
              ? "justify-center text-center"
              : contentAlignment === "left"
              ? "justify-start text-left"
              : "justify-between"
          }`}
        >
          {/* Optional Badge */}
          {showBadge && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 shadow-xs"
              style={{ backgroundColor: badgeBg, color: badgeTextColor }}
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>{badgeText}</span>
            </span>
          )}

          {/* Message Content (Static or Marquee) */}
          {renderMessageContent()}

          {/* Actions */}
          {renderActions()}
        </div>

        {/* Dismiss (X) Button */}
        {config.dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss announcement"
            className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity shrink-0 ml-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-white"
            style={{ color: textColor }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
