"use client";

import React, { useState, useEffect, useRef } from "react";
import { Heading, Text, Badge, Button } from "@medusajs/ui";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, Sparkles, Clock, ShieldCheck,
  MapPin, CheckCircle2, ArrowRight, Heart, ShoppingBag, Truck,
  Check, Gift, Tag, Award, Zap, Smile
} from "lucide-react";
import { ScrollFrameHero } from "@frontend/components/store/animation/scroll-frame-hero";
import { PromotionalBannerSection } from "./promotional-banner-section";
import { AnnouncementBarSection, AnnouncementBarConfig } from "./announcement-bar-section";

export interface PageSectionConfig {
  id: string;
  type: string;
  name: string;
  enabled?: boolean;
  order?: number;
  config?: Record<string, any>;
}

export interface PageRendererProps {
  sections: PageSectionConfig[];
  banners?: any[];
  allProducts?: any[];
  allCategories?: any[];
  occasions?: any[];
  isPreview?: boolean;
  selectedSectionId?: string | null;
  onSectionClick?: (sectionId: string) => void;
  announcementBar?: AnnouncementBarConfig | any;
  h1?: string;
  subheading?: string;
  introContent?: string;
  theme?: {
    bg_color?: string;
    text_color?: string;
    heading_color?: string;
    accent_color?: string;
  };
}

/**
 * Performant Section Motion / Entrance Animation Component
 * Uses IntersectionObserver to trigger GPU-accelerated CSS transforms.
 * Automatically respects prefers-reduced-motion.
 */
function SectionMotionWrapper({
  children,
  animationConfig,
  className = "",
}: {
  children: React.ReactNode;
  animationConfig?: {
    enabled?: boolean;
    type?: string;
    duration?: number;
    delay?: number;
    trigger?: "on_load" | "on_scroll";
    once?: boolean;
  };
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
    }
  }, []);

  const isAnimationEnabled = animationConfig?.enabled !== false && !prefersReducedMotion;
  const animationType = animationConfig?.type || "fade_up";
  const duration = animationConfig?.duration ?? 600;
  const delay = animationConfig?.delay ?? 0;
  const trigger = animationConfig?.trigger || "on_scroll";
  const once = animationConfig?.once !== false;

  useEffect(() => {
    if (!isAnimationEnabled) {
      setIsVisible(true);
      return;
    }

    if (trigger === "on_load") {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once && containerRef.current) {
              observer.unobserve(containerRef.current);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isAnimationEnabled, trigger, delay, once]);

  if (!isAnimationEnabled || animationType === "none") {
    return <div className={className}>{children}</div>;
  }

  // Generate CSS initial and animated states based on type
  let initialStyle: React.CSSProperties = {
    opacity: 0,
    transitionProperty: "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    transitionDelay: `${delay}ms`,
    willChange: "opacity, transform",
  };

  if (animationType === "fade_up") {
    initialStyle.transform = isVisible ? "translate3d(0, 0, 0)" : "translate3d(0, 32px, 0)";
  } else if (animationType === "fade_down") {
    initialStyle.transform = isVisible ? "translate3d(0, 0, 0)" : "translate3d(0, -32px, 0)";
  } else if (animationType === "slide_left") {
    initialStyle.transform = isVisible ? "translate3d(0, 0, 0)" : "translate3d(40px, 0, 0)";
  } else if (animationType === "slide_right") {
    initialStyle.transform = isVisible ? "translate3d(0, 0, 0)" : "translate3d(-40px, 0, 0)";
  } else if (animationType === "scale") {
    initialStyle.transform = isVisible ? "scale(1)" : "scale(0.94)";
  } else if (animationType === "reveal") {
    initialStyle.transform = isVisible ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, 20px, 0) scale(0.97)";
  }

  if (isVisible) {
    initialStyle.opacity = 1;
  }

  return (
    <div ref={containerRef} style={initialStyle} className={className}>
      {children}
    </div>
  );
}

/**
 * Reusable Product & Category Carousel Component
 */
function CarouselContainer({
  children,
  carouselConfig,
  itemsCount,
}: {
  children: React.ReactNode;
  carouselConfig?: {
    autoplay?: boolean;
    autoplay_speed?: number;
    pause_on_hover?: boolean;
    show_arrows?: boolean;
    show_dots?: boolean;
    loop?: boolean;
  };
  itemsCount: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const autoplay = carouselConfig?.autoplay ?? false;
  const autoplaySpeed = (carouselConfig?.autoplay_speed ?? 4) * 1000;
  const pauseOnHover = carouselConfig?.pause_on_hover !== false;
  const showArrows = carouselConfig?.show_arrows !== false;
  const showDots = carouselConfig?.show_dots !== false;

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = container.firstElementChild ? (container.firstElementChild as HTMLElement).offsetWidth + 16 : 300;
    const scrollAmount = direction === "left" ? -cardWidth : cardWidth;
    container.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  // Track active scroll index for dots
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = container.firstElementChild ? (container.firstElementChild as HTMLElement).offsetWidth + 16 : 300;
    const index = Math.round(container.scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, itemsCount - 1));
  };

  // Autoplay loop
  useEffect(() => {
    if (!autoplay || (pauseOnHover && isHovered) || itemsCount <= 1) return;

    const interval = setInterval(() => {
      if (!scrollRef.current) return;
      const container = scrollRef.current;
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScroll - 10) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scroll("right");
      }
    }, autoplaySpeed);

    return () => clearInterval(interval);
  }, [autoplay, autoplaySpeed, pauseOnHover, isHovered, itemsCount]);

  return (
    <div
      className="relative w-full group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Scrollable track */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-4 pt-1 snap-x snap-mandatory"
      >
        {children}
      </div>

      {/* Navigation Arrows */}
      {showArrows && itemsCount > 2 && (
        <>
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 dark:bg-ui-bg-base shadow-lg border border-ui-border-base flex items-center justify-center text-ui-fg-base hover:bg-rose-50 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100 z-20 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 dark:bg-ui-bg-base shadow-lg border border-ui-border-base flex items-center justify-center text-ui-fg-base hover:bg-rose-50 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100 z-20 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {showDots && itemsCount > 2 && (
        <div className="flex justify-center items-center gap-1.5 pt-2">
          {Array.from({ length: Math.min(itemsCount, 8) }).map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              onClick={() => {
                if (!scrollRef.current) return;
                const container = scrollRef.current;
                const cardWidth = container.firstElementChild ? (container.firstElementChild as HTMLElement).offsetWidth + 16 : 300;
                container.scrollTo({ left: dotIdx * cardWidth, behavior: "smooth" });
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeIndex === dotIdx ? "w-6 bg-rose-600" : "w-1.5 bg-ui-border-base hover:bg-ui-fg-muted"
              }`}
              aria-label={`Go to slide ${dotIdx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageRenderer({
  sections = [],
  banners = [],
  allProducts = [],
  allCategories = [],
  occasions = [],
  isPreview = false,
  selectedSectionId = null,
  onSectionClick,
  announcementBar,
  h1,
  subheading,
  introContent,
  theme,
}: PageRendererProps) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // Filter and sort enabled sections (prevent duplicate top announcement bar)
  const hasTopAnnouncement = Boolean(announcementBar && announcementBar.enabled !== false);
  const activeSections = sections
    .filter((s) => s.enabled !== false && (!hasTopAnnouncement || (s.type !== "announcement_bar" && s.type !== "announcement")))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div
      className="flex flex-col gap-10 w-full transition-colors duration-200"
      style={{
        backgroundColor: theme?.bg_color || "transparent",
        color: theme?.text_color || "inherit",
      }}
    >
      {/* Dynamic Edge-to-Edge Announcement Bar */}
      {announcementBar && announcementBar.enabled !== false && (
        <AnnouncementBarSection
          sectionId="page_announcement_bar"
          config={announcementBar}
          isPreview={isPreview}
        />
      )}

      {/* Optional Page Heading for Static / Landing Pages */}
      {(h1 || subheading || introContent) && (
        <div className="max-w-4xl mx-auto text-center px-4 pt-6 flex flex-col gap-3">
          {h1 && (
            <Heading
              level="h1"
              className="text-3xl sm:text-4xl font-extrabold tracking-tight"
              style={{ color: theme?.heading_color || undefined }}
            >
              {h1}
            </Heading>
          )}
          {subheading && (
            <Text className="text-base text-ui-fg-subtle max-w-2xl mx-auto">
              {subheading}
            </Text>
          )}
          {introContent && (
            <div className="prose prose-sm sm:prose max-w-none text-ui-fg-muted mt-2 text-left bg-ui-bg-subtle/50 p-6 rounded-2xl border border-ui-border-base">
              <p className="whitespace-pre-line leading-relaxed">{introContent}</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {activeSections.length === 0 && !h1 && (
        <div className="text-center py-20 px-4 border-2 border-dashed border-ui-border-base rounded-2xl max-w-xl mx-auto my-8">
          <Text className="text-sm font-semibold text-ui-fg-muted">
            This page has no published configuration.
          </Text>
          <Text className="text-xs text-ui-fg-subtle mt-1">
            Configure sections in the Page Configurator to see live content.
          </Text>
        </div>
      )}

      {/* Render Dynamic Sections */}
      {activeSections.map((section) => {
        const config = section.config || {};
        const desktopConfig = config.desktop || {};
        const tabletConfig = config.tablet || {};
        const mobileConfig = config.mobile || {};
        const sectionKey = section.id;

        const isSelected = isPreview && selectedSectionId === section.id;

        // Device visibility check
        const showOnDesktop = config.visibility?.desktop !== false && desktopConfig.visible !== false;
        const showOnTablet = config.visibility?.tablet !== false && tabletConfig.visible !== false;
        const showOnMobile = config.visibility?.mobile !== false && mobileConfig.visible !== false;

        // Spacing & background settings
        const mbPadTop = mobileConfig.paddingTop ?? config.paddingTop ?? 0;
        const mbPadBot = mobileConfig.paddingBottom ?? config.paddingBottom ?? 0;
        const tbPadTop = tabletConfig.paddingTop ?? mbPadTop;
        const tbPadBot = tabletConfig.paddingBottom ?? mbPadBot;
        const dtPadTop = desktopConfig.paddingTop ?? config.paddingTop ?? tbPadTop;
        const dtPadBot = desktopConfig.paddingBottom ?? config.paddingBottom ?? tbPadBot;

        const mbMarTop = mobileConfig.marginTop ?? config.marginTop ?? 0;
        const mbMarBot = mobileConfig.marginBottom ?? config.marginBottom ?? 0;
        const tbMarTop = tabletConfig.marginTop ?? mbMarTop;
        const tbMarBot = tabletConfig.marginBottom ?? mbMarBot;
        const dtMarTop = desktopConfig.marginTop ?? config.marginTop ?? tbMarTop;
        const dtMarBot = desktopConfig.marginBottom ?? config.marginBottom ?? tbMarBot;

        const isHeroOrStory = section.type === "hero" || section.type === "kitchen_story" || section.type === "scroll_frame";
        const isPromo = section.type === "promotional_banner" || section.type === "promo";
        const bgColor = isPromo
          ? (config.section_bg_color || "transparent")
          : (config.section_bg_color || config.background?.color || config.bg_color || "transparent");
        const borderRadius = isHeroOrStory ? "0px" : (config.background?.borderRadius || "0px");

        const wrapperStyle = (
          <style
            dangerouslySetInnerHTML={{
              __html: `
            .sec-wrap-${sectionKey} {
              display: ${showOnMobile ? "block" : "none"};
              padding-top: ${isHeroOrStory ? 0 : mbPadTop}px;
              padding-bottom: ${isHeroOrStory ? 0 : mbPadBot}px;
              margin-top: ${isHeroOrStory ? 0 : mbMarTop}px;
              margin-bottom: ${isHeroOrStory ? 0 : mbMarBot}px;
              background-color: ${bgColor};
              border-radius: ${borderRadius};
              width: 100%;
            }
            @media (min-width: 640px) and (max-width: 1023px) {
              .sec-wrap-${sectionKey} {
                display: ${showOnTablet ? "block" : "none"};
                padding-top: ${isHeroOrStory ? 0 : tbPadTop}px;
                padding-bottom: ${isHeroOrStory ? 0 : tbPadBot}px;
                margin-top: ${isHeroOrStory ? 0 : tbMarTop}px;
                margin-bottom: ${isHeroOrStory ? 0 : tbMarBot}px;
              }
            }
            @media (min-width: 1024px) {
              .sec-wrap-${sectionKey} {
                display: ${showOnDesktop ? "block" : "none"};
                padding-top: ${isHeroOrStory ? 0 : dtPadTop}px;
                padding-bottom: ${isHeroOrStory ? 0 : dtPadBot}px;
                margin-top: ${isHeroOrStory ? 0 : dtMarTop}px;
                margin-bottom: ${isHeroOrStory ? 0 : dtMarBot}px;
              }
            }
          `,
            }}
          />
        );

        const renderSectionContent = () => {
          switch (section.type) {
            // ── 1. Hero Section ──────────────────────────────────────────
            case "hero": {
              const headline = config.headline || "Handcrafted Gourmet Cakes Delivered in 2 Hours";
              const subheadline = config.subheadline || "Fresh, artisanal birthday & wedding cakes across Bangalore. Midnight delivery available!";
              const badgeText = config.badge_text || "100% Fresh & Artisanal • Express 2-Hour Delivery";
              const bgImage = config.bg_image || config.desktop_image?.url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1400";
              const bgImageAlt = config.bg_image_alt || config.desktop_image?.alt || headline;
              const mobileImage = config.mobile_image?.url || bgImage;
              const tabletImage = config.tablet_image?.url || bgImage;
              const overlayOpacity = config.overlay_opacity ?? 0.4;
              const objectFit = config.object_fit || "cover";
              const imagePosition = config.image_position || "center";

              // Responsive Alignment & Height
              const desktopAlignment = desktopConfig.alignment || config.alignment || "center";
              const tabletAlignment = tabletConfig.alignment || desktopAlignment;
              const mobileAlignment = mobileConfig.alignment || desktopAlignment;

              const primaryCtaVisible = config.cta_primary_visible !== false && !!(config.cta_primary_text || config.cta_text || "Order a Cake");
              const secondaryCtaVisible = config.cta_secondary_visible !== false && !!(config.cta_secondary_text || "View Collections");

              const primaryCtaText = config.cta_primary_text || config.cta_text || "Explore Cakes";
              const primaryCtaUrl = config.cta_primary_url || config.cta_url || "/products";
              const secondaryCtaText = config.cta_secondary_text || "Birthday Specials";
              const secondaryCtaUrl = config.cta_secondary_url || "/products?occasion=birthday";

              // Dynamic Scroll-Frame Hero with Multi-Device Frame Sets
              if (config.disable_scroll_sequence !== true) {
                return (
                  <ScrollFrameHero
                    key={sectionKey}
                    sectionId={sectionKey}
                    config={config}
                    isPreview={isPreview}
                  />
                );
              }

              return (
                <section key={sectionKey} className="w-full">
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                    .hero-container-${sectionKey} {
                      min-height: ${mobileConfig.height ? (typeof mobileConfig.height === "number" ? `${mobileConfig.height}px` : mobileConfig.height) : "380px"};
                    }
                    @media (min-width: 640px) and (max-width: 1023px) {
                      .hero-container-${sectionKey} {
                        min-height: ${tabletConfig.height ? (typeof tabletConfig.height === "number" ? `${tabletConfig.height}px` : tabletConfig.height) : "440px"};
                      }
                    }
                    @media (min-width: 1024px) {
                      .hero-container-${sectionKey} {
                        min-height: ${desktopConfig.height ? (typeof desktopConfig.height === "number" ? `${desktopConfig.height}px` : desktopConfig.height) : "500px"};
                      }
                    }
                  `,
                    }}
                  />
                  <div className={`hero-container-${sectionKey} relative w-full rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center shadow-xl border border-ui-border-base`}>
                    {/* Responsive background image */}
                    <picture className="absolute inset-0 w-full h-full">
                      {mobileImage && <source media="(max-width: 639px)" srcSet={mobileImage} />}
                      {tabletImage && <source media="(min-width: 640px) and (max-width: 1023px)" srcSet={tabletImage} />}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bgImage}
                        alt={bgImageAlt}
                        className={`w-full h-full object-${objectFit} object-${imagePosition}`}
                        loading="eager"
                      />
                    </picture>

                    {/* Dark overlay */}
                    <div
                      className="absolute inset-0 bg-black"
                      style={{ opacity: overlayOpacity }}
                    />

                    {/* Hero Content */}
                    <div
                      className={`relative z-10 p-6 sm:p-12 max-w-3xl flex flex-col gap-4 text-white ${
                        mobileAlignment === "left" ? "items-start text-left" : mobileAlignment === "right" ? "items-end text-right" : "items-center text-center"
                      } sm:${
                        tabletAlignment === "left" ? "items-start text-left" : tabletAlignment === "right" ? "items-end text-right" : "items-center text-center"
                      } lg:${
                        desktopAlignment === "left" ? "items-start text-left" : desktopAlignment === "right" ? "items-end text-right" : "items-center text-center"
                      }`}
                    >
                      {badgeText && (
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold text-white tracking-wide uppercase shadow-sm"
                          style={{
                            backgroundColor: config.badge_bg || undefined,
                            color: config.badge_color || undefined,
                          }}
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" /> {badgeText}
                        </span>
                      )}
                      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight drop-shadow-md leading-tight">
                        {headline}
                      </h1>
                      {subheadline && (
                        <p className="text-sm sm:text-lg text-white/90 drop-shadow max-w-xl font-medium">
                          {subheadline}
                        </p>
                      )}
                      <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
                        {primaryCtaVisible && primaryCtaText && (
                          <Link href={primaryCtaUrl}>
                            <Button
                              variant="primary"
                              size="large"
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-900/30 px-6 py-2.5 rounded-xl border-none"
                              style={{
                                backgroundColor: config.cta_primary_bg || theme?.accent_color || undefined,
                                color: config.cta_primary_color || undefined,
                              }}
                            >
                              {primaryCtaText} →
                            </Button>
                          </Link>
                        )}
                        {secondaryCtaVisible && secondaryCtaText && (
                          <Link href={secondaryCtaUrl}>
                            <Button
                              variant="secondary"
                              size="large"
                              className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-semibold px-5 py-2.5 rounded-xl border border-white/40"
                              style={{
                                backgroundColor: config.cta_secondary_bg || undefined,
                                color: config.cta_secondary_color || undefined,
                              }}
                            >
                              {secondaryCtaText}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            }

            // ── 1b. Kitchen Story / Scroll Frame Section ─────────────────
            case "kitchen_story":
            case "scroll_frame": {
              return (
                <ScrollFrameHero
                  key={sectionKey}
                  sectionId={sectionKey}
                  config={config}
                  isPreview={isPreview}
                />
              );
            }

            // ── 2. Category Grid / Carousel ──────────────────────────────
            case "category_grid":
            case "categories": {
              const heading = config.heading || "Shop by Occasion & Flavour";
              const subheading = config.subheading || "Find the perfect cake handcrafted for your celebration";
              const categoryIds = config.category_ids || [];
              const displayCategories = categoryIds.length > 0
                ? categoryIds.map((cid: string) => allCategories.find((c: any) => c.id === cid)).filter(Boolean)
                : allCategories.slice(0, 8);

              const layoutMode = config.layout || "grid"; // "grid" vs "carousel"
              const dtCols = desktopConfig.columns || config.columns || 4;
              const tbCols = tabletConfig.columns || 3;
              const mbCols = mobileConfig.columns || 2;

              const dtGap = desktopConfig.gap || 16;
              const tbGap = tabletConfig.gap || 14;
              const mbGap = mobileConfig.gap || 12;

              const renderCategoryCard = (cat: any) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug || cat.id}`}
                  className={`group relative rounded-2xl overflow-hidden aspect-[4/3] bg-ui-bg-subtle border border-ui-border-base hover:shadow-lg hover:border-rose-300 transition-all flex flex-col justify-end p-4 shrink-0 ${
                    layoutMode === "carousel" ? "w-[240px] sm:w-[280px] snap-start" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.image_url || cat.banner_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600"}
                    alt={cat.name || "Cake Category"}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="relative z-10 text-white">
                    <h3 className="font-bold text-sm sm:text-base leading-tight group-hover:text-rose-200 transition-colors">
                      {cat.name}
                    </h3>
                    {cat.description && (
                      <p className="text-[11px] text-white/80 line-clamp-1 mt-0.5">
                        {cat.description}
                      </p>
                    )}
                  </div>
                </Link>
              );

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                    .cat-grid-${sectionKey} {
                      display: grid;
                      grid-template-columns: repeat(${mbCols}, minmax(0, 1fr));
                      gap: ${mbGap}px;
                    }
                    @media (min-width: 640px) and (max-width: 1023px) {
                      .cat-grid-${sectionKey} {
                        grid-template-columns: repeat(${tbCols}, minmax(0, 1fr));
                        gap: ${tbGap}px;
                      }
                    }
                    @media (min-width: 1024px) {
                      .cat-grid-${sectionKey} {
                        grid-template-columns: repeat(${dtCols}, minmax(0, 1fr));
                        gap: ${dtGap}px;
                      }
                    }
                  `,
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                        {heading}
                      </Heading>
                      {subheading && <Text className="text-xs sm:text-sm text-ui-fg-subtle">{subheading}</Text>}
                    </div>
                    {config.view_all_url && (
                      <Link href={config.view_all_url} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
                        {config.view_all_text || "View All"} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  {layoutMode === "carousel" ? (
                    <CarouselContainer
                      carouselConfig={config.carousel}
                      itemsCount={displayCategories.length}
                    >
                      {displayCategories.map((cat: any) => renderCategoryCard(cat))}
                    </CarouselContainer>
                  ) : (
                    <div className={`cat-grid-${sectionKey}`}>
                      {displayCategories.map((cat: any) => renderCategoryCard(cat))}
                    </div>
                  )}
                </section>
              );
            }

            // ── 3. Product Grid / Best Sellers / New Arrivals ────────────
            case "product_grid":
            case "best_sellers":
            case "new_arrivals":
            case "featured_cakes":
            case "trending": {
              const heading = config.heading || (section.type === "new_arrivals" ? "✨ New Arrivals" : "🏆 Best-Selling Cakes");
              const subheading = config.subheading || "Freshly baked artisan recipes ready for express 2-hour delivery";
              const productIds = config.product_ids || [];
              const mode = config.mode || "best_sellers";

              let displayProducts = allProducts;
              if (productIds.length > 0) {
                displayProducts = productIds
                  .map((pid: string) => allProducts.find((p: any) => (p.id || p.product_id) === pid))
                  .filter(Boolean);
              } else if (mode === "best_sellers") {
                displayProducts = allProducts.filter((p: any) => p.is_bestseller).slice(0, 8);
                if (displayProducts.length === 0) displayProducts = allProducts.slice(0, 8);
              } else if (mode === "new_arrivals") {
                displayProducts = allProducts.filter((p: any) => p.is_new_arrival).slice(0, 8);
                if (displayProducts.length === 0) displayProducts = allProducts.slice(0, 8);
              } else {
                displayProducts = allProducts.slice(0, 8);
              }

              const layoutMode = config.layout || "grid"; // "grid" vs "carousel"
              const dtCols = desktopConfig.columns || config.columns || 4;
              const tbCols = tabletConfig.columns || 3;
              const mbCols = mobileConfig.columns || 2;

              const dtCardHeight = desktopConfig.card_height ? `${desktopConfig.card_height}px` : "auto";
              const tbCardHeight = tabletConfig.card_height ? `${tabletConfig.card_height}px` : "auto";
              const mbCardHeight = mobileConfig.card_height ? `${mobileConfig.card_height}px` : "auto";

              const dtImgHeight = desktopConfig.image_height ? `${desktopConfig.image_height}px` : "220px";
              const tbImgHeight = tabletConfig.image_height ? `${tabletConfig.image_height}px` : "180px";
              const mbImgHeight = mobileConfig.image_height ? `${mobileConfig.image_height}px` : "150px";

              const dtGap = desktopConfig.gap || 16;
              const tbGap = tabletConfig.gap || 14;
              const mbGap = mobileConfig.gap || 12;

              const showImage = config.show_image !== false;
              const showTitle = config.show_title !== false;
              const showDesc = config.show_description !== false;
              const showPrice = config.show_price !== false;
              const showRating = config.show_rating !== false;
              const showBadge = config.show_badge !== false;
              const showCta = config.show_cta !== false;
              const ctaText = config.cta_text || "Order";
              const ctaBg = config.cta_bg || theme?.accent_color;
              const cardRadius = config.card_radius || "16px";

              const renderProductCard = (product: any) => {
                const pid = product.id || product.product_id;
                const slug = product.slug || product.handle || pid;
                const price = product.price || product.base_price || 499;
                const originalPrice = product.original_price || product.compare_at_price || price;
                const rating = product.rating || 4.8;
                const reviewCount = product.review_count || product.reviews_count || 42;
                const image = product.thumbnail || product.image_url || product.images?.[0]?.url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600";

                return (
                  <div
                    key={pid}
                    className={`product-card-${sectionKey} bg-ui-bg-base border border-ui-border-base overflow-hidden flex flex-col justify-between hover:shadow-xl hover:border-rose-300 transition-all duration-300 group shrink-0 ${
                      layoutMode === "carousel" ? "w-[240px] sm:w-[280px] snap-start" : ""
                    }`}
                    style={{ borderRadius: cardRadius }}
                  >
                    {showImage && (
                      <div className={`product-img-box-${sectionKey} relative w-full overflow-hidden bg-ui-bg-subtle`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image}
                          alt={product.title || "Cake"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        {showBadge && (product.is_bestseller || product.is_featured || product.is_new_arrival) && (
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white shadow-sm">
                              {product.is_bestseller ? "Bestseller" : product.is_new_arrival ? "New" : "Featured"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3.5 sm:p-4 flex flex-col gap-2 flex-1 justify-between">
                      <div className="flex flex-col gap-1">
                        {showRating && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{rating}</span>
                            <span className="text-ui-fg-muted font-normal">({reviewCount})</span>
                          </div>
                        )}
                        {showTitle && (
                          <Link href={`/products/${slug}`}>
                            <h3 className="font-bold text-xs sm:text-sm text-ui-fg-base hover:text-rose-600 transition-colors line-clamp-1">
                              {product.title}
                            </h3>
                          </Link>
                        )}
                        {showDesc && product.description && (
                          <p className="text-[11px] text-ui-fg-muted line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-ui-border-base">
                        {showPrice && (
                          <div>
                            <span className="text-sm sm:text-base font-extrabold text-ui-fg-base">
                              ₹{price.toLocaleString()}
                            </span>
                            {originalPrice > price && (
                              <span className="text-[10px] sm:text-xs text-ui-fg-muted line-through ml-1 font-normal">
                                ₹{originalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                        {showCta && (
                          <Link href={`/products/${slug}`}>
                            <Button
                              variant="primary"
                              size="small"
                              className="rounded-xl px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                              style={ctaBg ? { backgroundColor: ctaBg } : undefined}
                            >
                              <ShoppingBag className="w-3 h-3 mr-1" /> {ctaText}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                    .prod-grid-${sectionKey} {
                      display: grid;
                      grid-template-columns: repeat(${mbCols}, minmax(0, 1fr));
                      gap: ${mbGap}px;
                    }
                    .product-card-${sectionKey} { height: ${mbCardHeight}; }
                    .product-img-box-${sectionKey} { height: ${mbImgHeight}; }

                    @media (min-width: 640px) and (max-width: 1023px) {
                      .prod-grid-${sectionKey} {
                        grid-template-columns: repeat(${tbCols}, minmax(0, 1fr));
                        gap: ${tbGap}px;
                      }
                      .product-card-${sectionKey} { height: ${tbCardHeight}; }
                      .product-img-box-${sectionKey} { height: ${tbImgHeight}; }
                    }
                    @media (min-width: 1024px) {
                      .prod-grid-${sectionKey} {
                        grid-template-columns: repeat(${dtCols}, minmax(0, 1fr));
                        gap: ${dtGap}px;
                      }
                      .product-card-${sectionKey} { height: ${dtCardHeight}; }
                      .product-img-box-${sectionKey} { height: ${dtImgHeight}; }
                    }
                  `,
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                        {heading}
                      </Heading>
                      {subheading && <Text className="text-xs sm:text-sm text-ui-fg-subtle">{subheading}</Text>}
                    </div>
                    {config.view_all_url && (
                      <Link href={config.view_all_url} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
                        {config.view_all_text || "View All"} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  {layoutMode === "carousel" ? (
                    <CarouselContainer
                      carouselConfig={config.carousel}
                      itemsCount={displayProducts.length}
                    >
                      {displayProducts.map((product: any) => renderProductCard(product))}
                    </CarouselContainer>
                  ) : (
                    <div className={`prod-grid-${sectionKey}`}>
                      {displayProducts.map((product: any) => renderProductCard(product))}
                    </div>
                  )}
                </section>
              );
            }

            // ── 4. Announcement Bar Section ─────────────────────────────
            case "announcement_bar":
            case "announcement": {
              return (
                <AnnouncementBarSection
                  key={sectionKey}
                  sectionId={section.id || sectionKey}
                  config={config}
                  isPreview={isPreview}
                  isSelected={selectedSectionId === section.id}
                  onSectionClick={onSectionClick}
                />
              );
            }

            // ── 5. Promotional Banner ───────────────────────────────────
            case "promotional_banner":
            case "promo": {
              return (
                <PromotionalBannerSection
                  key={sectionKey}
                  sectionId={section.id || sectionKey}
                  config={config}
                  desktopConfig={desktopConfig}
                  tabletConfig={tabletConfig}
                  mobileConfig={mobileConfig}
                  isPreview={isPreview}
                  isSelected={selectedSectionId === section.id}
                  onSectionClick={onSectionClick}
                />
              );
            }

            // ── 6. Image + Text / Brand Story ───────────────────────────
            case "image_text":
            case "brand_story": {
              const heading = config.heading || "Handcrafted with Pure Ingredients";
              const body = config.body || "At CakeToHome, our master bakers use only premium Belgian dark chocolate, Madagascar bourbon vanilla beans, and farm-fresh seasonal fruits.";
              const imageUrl = config.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
              const imageAlt = config.image_alt || heading;
              const badgeText = config.badge_text || "About Our Kitchen";
              const ctaText = config.cta_text;
              const ctaUrl = config.cta_url || "/products";
              const imagePosition = config.image_position || "left";

              return (
                <section key={sectionKey} className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-ui-bg-subtle/40 p-6 sm:p-10 rounded-3xl border border-ui-border-base ${imagePosition === "right" ? "md:grid-flow-dense" : ""}`}>
                  <div className={`relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md ${imagePosition === "right" ? "md:col-start-2" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col gap-4">
                    {badgeText && (
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                        {badgeText}
                      </span>
                    )}
                    <Heading level="h2" className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    <p className="text-sm text-ui-fg-muted leading-relaxed whitespace-pre-line">
                      {body}
                    </p>
                    {ctaText && (
                      <Link href={ctaUrl} className="pt-2">
                        <Button variant="primary" size="large" className="rounded-xl px-6 font-bold">
                          {ctaText} →
                        </Button>
                      </Link>
                    )}
                  </div>
                </section>
              );
            }

            // ── 6b. Kitchen Story / Dedicated Scroll-Frame Animation ───────
            case "kitchen_story":
            case "scroll_frame": {
              return (
                <ScrollFrameHero
                  key={sectionKey}
                  sectionId={sectionKey}
                  config={config}
                  isPreview={isPreview}
                />
              );
            }

            // ── 7. Features / Benefits ──────────────────────────────────
            case "features": {
              const heading = config.heading || "Why CakeToHome is Bangalore's #1 Choice";
              const defaultFeatures = [
                { icon: "Truck", title: "2-Hour Express Delivery", desc: "Fastest doorstep cake delivery across Bangalore" },
                { icon: "Sparkles", title: "Artisan Quality", desc: "Premium gourmet cakes crafted with Belgian chocolate and fresh fruits" },
                { icon: "Clock", title: "Midnight Delivery", desc: "Special midnight surprise slots (11:30 PM - 12:05 AM)" },
                { icon: "ShieldCheck", title: "Artisanal Fresh Baking", desc: "Baked fresh after order placement with zero preservatives" },
              ];
              const featuresList = (config.features && config.features.length > 0) ? config.features : defaultFeatures;

              const getIcon = (iconName: string) => {
                switch (iconName) {
                  case "Truck": return <Truck className="w-6 h-6 text-rose-500" />;
                  case "Sparkles": return <Sparkles className="w-6 h-6 text-amber-500" />;
                  case "Clock": return <Clock className="w-6 h-6 text-indigo-500" />;
                  case "ShieldCheck": return <ShieldCheck className="w-6 h-6 text-emerald-500" />;
                  case "Heart": return <Heart className="w-6 h-6 text-pink-500" />;
                  case "Star": return <Star className="w-6 h-6 text-yellow-500" />;
                  case "Gift": return <Gift className="w-6 h-6 text-purple-500" />;
                  case "Award": return <Award className="w-6 h-6 text-blue-500" />;
                  default: return <Sparkles className="w-6 h-6 text-rose-500" />;
                }
              };

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  {heading && (
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight text-center" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {featuresList.map((feat: any, i: number) => (
                      <div key={i} className="p-5 rounded-2xl bg-ui-bg-base border border-ui-border-base flex flex-col gap-2.5 shadow-sm">
                        <div className="p-3 bg-ui-bg-subtle rounded-xl w-fit">{getIcon(feat.icon)}</div>
                        <h4 className="font-bold text-sm text-ui-fg-base">{feat.title}</h4>
                        <p className="text-xs text-ui-fg-muted">{feat.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 8. FAQ Section ──────────────────────────────────────────
            case "faq": {
              const heading = config.heading || "Frequently Asked Questions";
              const defaultFaqs = [
                { q: "Do you deliver cakes at midnight in Bangalore?", a: "Yes! We offer guaranteed midnight delivery slots (11:30 PM – 12:05 AM) across all areas in Bangalore for birthdays and anniversaries." },
                { q: "Can I customize the cake size and flavour?", a: "Absolutely! You can choose sizes from 0.5 kg to 5.0 kg, select premium flavours (Belgian Chocolate, Red Velvet, Alphonso Mango, Lotus Biscoff), and add personal custom messages." },
                { q: "How fresh are CakeToHome cakes?", a: "Every single cake is baked fresh to order in our local kitchen hubs using premium ingredients with zero artificial preservatives." },
              ];
              const faqs = (config.faqs && config.faqs.length > 0) ? config.faqs : defaultFaqs;

              const faqJsonLd = {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": faqs.map((f: any) => ({
                  "@type": "Question",
                  "name": f.q,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": f.a,
                  },
                })),
              };

              return (
                <section key={sectionKey} className="max-w-3xl mx-auto w-full flex flex-col gap-6">
                  <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
                  />
                  <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight text-center" style={{ color: theme?.heading_color }}>
                    {heading}
                  </Heading>
                  <div className="flex flex-col gap-2.5">
                    {faqs.map((faq: any, fi: number) => {
                      const isOpen = openFaqIdx === fi;
                      return (
                        <div
                          key={fi}
                          className="border border-ui-border-base rounded-xl overflow-hidden bg-ui-bg-base transition-all"
                        >
                          <button
                            onClick={() => setOpenFaqIdx(isOpen ? null : fi)}
                            className="w-full p-4 text-left font-semibold text-xs sm:text-sm flex items-center justify-between gap-3 hover:bg-ui-bg-subtle/50 transition-colors"
                          >
                            <span>{faq.q}</span>
                            {isOpen ? <ChevronUp className="w-4 h-4 text-ui-fg-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-ui-fg-muted shrink-0" />}
                          </button>
                          {isOpen && (
                            <div className="p-4 pt-0 text-xs text-ui-fg-muted leading-relaxed border-t border-ui-border-base/50 bg-ui-bg-subtle/20">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            }

            // ── 9. Location Coverage ────────────────────────────────────
            case "location_coverage": {
              const heading = config.heading || "📍 We Deliver Fresh Cakes Across Bangalore";
              const subheading = config.subheading || "Same-day & 2-hour express delivery available in all major clusters";
              const defaultAreas = [
                "Whitefield", "Indiranagar", "Koramangala", "HSR Layout",
                "Jayanagar", "JP Nagar", "Marathahalli", "Bellandur",
                "Electronic City", "Hebbal", "Malleshwaram", "Rajajinagar",
                "Yelahanka", "Sarjapur Road", "BTM Layout", "Banashankari"
              ];
              const areas = (config.areas && config.areas.length > 0) ? config.areas : defaultAreas;

              return (
                <section key={sectionKey} className="flex flex-col gap-5 p-6 sm:p-8 bg-ui-bg-subtle/60 rounded-3xl border border-ui-border-base text-center">
                  <div className="max-w-xl mx-auto flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">{config.badge || "Coverage Area"}</span>
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    <Text className="text-xs sm:text-sm text-ui-fg-subtle">
                      {subheading}
                    </Text>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl mx-auto">
                    {areas.map((area: string, ai: number) => (
                      <span
                        key={ai}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-ui-bg-base border border-ui-border-base shadow-xs text-ui-fg-base hover:border-rose-400 hover:text-rose-600 transition-colors"
                      >
                        <MapPin className="w-3 h-3 text-rose-500" />
                        {area}
                      </span>
                    ))}
                  </div>
                  {config.cta_text && (
                    <div className="pt-2">
                      <Link href={config.cta_url || "/products"}>
                        <Button variant="secondary" size="small" className="rounded-xl px-5">
                          {config.cta_text} →
                        </Button>
                      </Link>
                    </div>
                  )}
                </section>
              );
            }

            // ── 10. Text / SEO Content Block ────────────────────────────
            case "text_content":
            case "seo_content": {
              const heading = config.heading || "Artisanal Cake Delivery";
              const content = config.content || "";
              return (
                <section key={sectionKey} className="max-w-4xl mx-auto w-full p-6 bg-ui-bg-subtle/30 rounded-2xl border border-ui-border-base flex flex-col gap-3">
                  <Heading level="h2" className="text-xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                    {heading}
                  </Heading>
                  <div className="prose prose-sm max-w-none text-ui-fg-muted leading-relaxed whitespace-pre-line">
                    {content}
                  </div>
                </section>
              );
            }

            // ── 11. Call to Action Block ────────────────────────────────
            case "cta": {
              const heading = config.heading || "Ready to Celebrate?";
              const subheading = config.subheading || "Order handcrafted cakes baked fresh and delivered in 2 hours.";
              const ctaText = config.cta_text || "Order Now";
              const ctaUrl = config.cta_url || "/products";

              return (
                <section key={sectionKey} className="w-full p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-rose-600 to-pink-600 text-white text-center flex flex-col items-center gap-4 shadow-xl">
                  <Heading level="h2" className="text-2xl sm:text-4xl font-extrabold text-white">
                    {heading}
                  </Heading>
                  <Text className="text-sm sm:text-base text-white/90 max-w-xl">
                    {subheading}
                  </Text>
                  <Link href={ctaUrl} className="pt-2">
                    <Button size="large" className="bg-white hover:bg-white/90 text-rose-600 font-extrabold px-8 py-3 rounded-xl shadow-lg border-none">
                      {ctaText} →
                    </Button>
                  </Link>
                </section>
              );
            }

            default:
              return (
                <section key={sectionKey} className="p-4 bg-ui-bg-subtle rounded-xl border border-ui-border-base text-xs text-ui-fg-muted">
                  Section type &quot;{section.type}&quot; content preview.
                </section>
              );
          }
        };

        return (
          <div
            key={sectionKey}
            data-section-id={sectionKey}
            onClick={() => onSectionClick?.(sectionKey)}
            className={`transition-all ${
              isSelected ? "ring-2 ring-rose-500 ring-offset-2 rounded-2xl cursor-pointer" : ""
            } ${isPreview ? "hover:outline-dashed hover:outline-2 hover:outline-rose-300" : ""}`}
          >
            {wrapperStyle}
            <div className={`sec-wrap-${sectionKey}`}>
              <SectionMotionWrapper animationConfig={config.animation}>
                {renderSectionContent()}
              </SectionMotionWrapper>
            </div>
          </div>
        );
      })}
    </div>
  );
}
