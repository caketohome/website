"use client";

import { useState } from "react";
import { Heading, Text, Badge, Button } from "@medusajs/ui";
import { Link } from "next-view-transitions";
import {
  ChevronDown, ChevronUp, Star, Sparkles, Clock, ShieldCheck,
  MapPin, CheckCircle2, ArrowRight, Heart, ShoppingBag, Truck,
  Check, Gift, Tag, Award, Zap, Smile
} from "lucide-react";
import { ScrollFrameHero } from "@frontend/components/store/animation/scroll-frame-hero";

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
  announcementBar?: {
    enabled?: boolean;
    text?: string;
    cta_text?: string;
    cta_url?: string;
    bg_color?: string;
  };
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

  // Filter and sort enabled sections
  const activeSections = sections
    .filter((s) => s.enabled !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div
      className="flex flex-col gap-10 w-full transition-colors duration-200"
      style={{
        backgroundColor: theme?.bg_color || "transparent",
        color: theme?.text_color || "inherit",
      }}
    >
      {/* Optional Announcement Bar */}
      {announcementBar?.enabled && announcementBar.text && (
        <div
          className="w-full py-2.5 px-4 text-center text-xs font-semibold text-white shadow-sm flex items-center justify-center gap-2 flex-wrap"
          style={{ backgroundColor: announcementBar.bg_color || "#e11d48" }}
        >
          <span>{announcementBar.text}</span>
          {announcementBar.cta_text && (
            <Link
              href={announcementBar.cta_url || "/products"}
              className="underline underline-offset-2 hover:opacity-90 font-bold ml-1"
            >
              {announcementBar.cta_text} →
            </Link>
          )}
        </div>
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

        const bgColor = config.background?.color || config.bg_color || "transparent";
        const borderRadius = config.background?.borderRadius || "0px";

        const wrapperStyle = (
          <style>{`
            .sec-wrap-${sectionKey} {
              padding-top: ${mbPadTop}px;
              padding-bottom: ${mbPadBot}px;
              margin-top: ${mbMarTop}px;
              margin-bottom: ${mbMarBot}px;
              background-color: ${bgColor};
              border-radius: ${borderRadius};
            }
            @media (min-width: 640px) and (max-width: 1023px) {
              .sec-wrap-${sectionKey} {
                padding-top: ${tbPadTop}px;
                padding-bottom: ${tbPadBot}px;
                margin-top: ${tbMarTop}px;
                margin-bottom: ${tbMarBot}px;
              }
            }
            @media (min-width: 1024px) {
              .sec-wrap-${sectionKey} {
                padding-top: ${dtPadTop}px;
                padding-bottom: ${dtPadBot}px;
                margin-top: ${dtMarTop}px;
                margin-bottom: ${dtMarBot}px;
              }
            }
          `}</style>
        );

        const renderSectionContent = () => {
          switch (section.type) {
            // ── 1. Hero Section ──────────────────────────────────────────
            case "hero": {
              const headline = config.headline || "Fresh Gourmet Cakes Delivered in 2 Hours";
              const subheadline = config.subheadline || "Handcrafted birthday and celebration cakes baked fresh daily across Bangalore.";
              const badgeText = config.badge_text || "Handcrafted Bakery";
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

              const primaryCtaVisible = config.cta_primary_visible !== false && !!(config.cta_primary_text || config.cta_text);
              const secondaryCtaVisible = config.cta_secondary_visible !== false && !!config.cta_secondary_text;

              const primaryCtaText = config.cta_primary_text || config.cta_text;
              const primaryCtaUrl = config.cta_primary_url || config.cta_url || "/products";
              const secondaryCtaText = config.cta_secondary_text;
              const secondaryCtaUrl = config.cta_secondary_url || "/products";

              if (config.disable_scroll_sequence !== true) {
                return (
                  <ScrollFrameHero
                    key={sectionKey}
                    headline={headline}
                    subheadline={subheadline}
                    badgeText={badgeText}
                  />
                );
              }

              return (
                <section key={sectionKey} className="w-full">
                  <style>{`
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
                  `}</style>
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
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold text-white tracking-wide uppercase">
                        <Sparkles className="w-3 h-3 text-amber-300" /> {badgeText}
                      </span>
                      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight drop-shadow-md leading-tight">
                        {headline}
                      </h1>
                      <p className="text-sm sm:text-lg text-white/90 drop-shadow max-w-xl font-medium">
                        {subheadline}
                      </p>
                      <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
                        {primaryCtaVisible && primaryCtaText && (
                          <Link href={primaryCtaUrl}>
                            <Button
                              variant="primary"
                              size="large"
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-900/30 px-6 py-2.5 rounded-xl border-none"
                              style={theme?.accent_color ? { backgroundColor: theme.accent_color } : undefined}
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

            // ── 2. Category Grid ─────────────────────────────────────────
            case "category_grid":
            case "categories": {
              const heading = config.heading || "Shop by Occasion & Flavour";
              const subheading = config.subheading || "Find the perfect cake handcrafted for your celebration";
              const categoryIds = config.category_ids || [];
              const displayCategories = categoryIds.length > 0
                ? categoryIds.map((cid: string) => allCategories.find((c: any) => c.id === cid)).filter(Boolean)
                : allCategories.slice(0, 6);

              const dtCols = desktopConfig.columns || config.columns || 3;
              const tbCols = tabletConfig.columns || 2;
              const mbCols = mobileConfig.columns || 2;

              const dtGap = desktopConfig.gap || 16;
              const tbGap = tabletConfig.gap || 14;
              const mbGap = mobileConfig.gap || 12;

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  <style>{`
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
                  `}</style>
                  <div className="flex flex-col gap-1">
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    {subheading && <Text className="text-xs sm:text-sm text-ui-fg-subtle">{subheading}</Text>}
                  </div>

                  <div className={`cat-grid-${sectionKey}`}>
                    {displayCategories.map((cat: any) => (
                      <Link
                        key={cat.id}
                        href={`/products?category=${cat.slug || cat.id}`}
                        className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-ui-bg-subtle border border-ui-border-base hover:shadow-lg hover:border-rose-300 transition-all flex flex-col justify-end p-4"
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
                    ))}
                  </div>
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
                displayProducts = allProducts.slice(0, 8);
              } else {
                displayProducts = allProducts.slice(0, 8);
              }

              // Responsive Card Settings (3 tiers)
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

              // Detailed Visibility Toggles
              const showImage = config.show_image !== false && desktopConfig.show_image !== false && mobileConfig.show_image !== false;
              const showTitle = config.show_title !== false && desktopConfig.show_title !== false && mobileConfig.show_title !== false;
              const showDesc = config.show_description !== false && desktopConfig.show_description !== false && mobileConfig.show_description !== false;
              const showPrice = config.show_price !== false && desktopConfig.price_visibility !== false && mobileConfig.price_visibility !== false;
              const showRating = config.show_rating !== false && desktopConfig.rating_visibility !== false && mobileConfig.rating_visibility !== false;
              const showBadge = config.show_badge !== false && desktopConfig.badge_visibility !== false && mobileConfig.badge_visibility !== false;
              const showCta = config.show_cta !== false && desktopConfig.cta_visibility !== false && mobileConfig.cta_visibility !== false;
              const ctaText = desktopConfig.cta_text || config.cta_text || "Order";

              // Style Overrides
              const cardRadius = config.card_radius || "16px";
              const cardBg = config.card_bg || undefined;
              const ctaBg = config.cta_bg || theme?.accent_color || undefined;

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  <style>{`
                    .prod-grid-${sectionKey} {
                      display: grid;
                      grid-template-columns: repeat(${mbCols}, minmax(0, 1fr));
                      gap: ${mbGap}px;
                    }
                    @media (min-width: 640px) and (max-width: 1023px) {
                      .prod-grid-${sectionKey} {
                        grid-template-columns: repeat(${tbCols}, minmax(0, 1fr));
                        gap: ${tbGap}px;
                      }
                    }
                    @media (min-width: 1024px) {
                      .prod-grid-${sectionKey} {
                        grid-template-columns: repeat(${dtCols}, minmax(0, 1fr));
                        gap: ${dtGap}px;
                      }
                    }
                    .prod-card-${sectionKey} {
                      height: ${mbCardHeight};
                    }
                    @media (min-width: 640px) and (max-width: 1023px) {
                      .prod-card-${sectionKey} {
                        height: ${tbCardHeight};
                      }
                    }
                    @media (min-width: 1024px) {
                      .prod-card-${sectionKey} {
                        height: ${dtCardHeight};
                      }
                    }
                    .prod-img-${sectionKey} {
                      height: ${mbImgHeight};
                    }
                    @media (min-width: 640px) and (max-width: 1023px) {
                      .prod-img-${sectionKey} {
                        height: ${tbImgHeight};
                      }
                    }
                    @media (min-width: 1024px) {
                      .prod-img-${sectionKey} {
                        height: ${dtImgHeight};
                      }
                    }
                  `}</style>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                        {heading}
                      </Heading>
                      {subheading && <Text className="text-xs sm:text-sm text-ui-fg-subtle">{subheading}</Text>}
                    </div>
                    <Link href="/products" className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                      View all <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className={`prod-grid-${sectionKey}`}>
                    {displayProducts.map((product: any) => {
                      const price = product.price || 599;
                      const originalPrice = product.original_price || Math.round(price * 1.25);
                      const thumbnail = product.thumbnail || product.images?.[0]?.url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400";
                      const alt = product.title ? `${product.title} - Fresh Cake Online Delivery` : "Artisanal Cake";
                      const slug = product.handle || product.slug || product.product_id || product.id;

                      return (
                        <div
                          key={product.id || product.product_id}
                          className={`prod-card-${sectionKey} group bg-ui-bg-base overflow-hidden border border-ui-border-base hover:border-rose-300 hover:shadow-xl transition-all flex flex-col justify-between`}
                          style={{
                            borderRadius: cardRadius,
                            backgroundColor: cardBg,
                          }}
                        >
                          {showImage && (
                            <Link href={`/products/${slug}`} className={`prod-img-${sectionKey} relative w-full bg-ui-bg-subtle overflow-hidden block`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={thumbnail}
                                alt={alt}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                              />
                              {showBadge && product.is_bestseller && (
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                                  Best Seller
                                </span>
                              )}
                              {showBadge && (
                                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold shadow-md flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" /> 2h
                                </span>
                              )}
                            </Link>
                          )}

                          <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1 justify-between">
                            <div className="flex flex-col gap-1">
                              {showRating && (
                                <div className="flex items-center gap-1 text-amber-500 text-[10px] sm:text-[11px] font-semibold">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{product.rating || "4.9"}</span>
                                  <span className="text-ui-fg-muted font-normal">({product.reviews_count || "120+"})</span>
                                </div>
                              )}
                              {showTitle && (
                                <Link href={`/products/${slug}`}>
                                  <h3 className="font-bold text-xs sm:text-sm text-ui-fg-base group-hover:text-rose-600 transition-colors line-clamp-1">
                                    {product.title || product.name}
                                  </h3>
                                </Link>
                              )}
                              {showDesc && product.description && (
                                <p className="text-[10px] sm:text-[11px] text-ui-fg-muted line-clamp-2">
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
                                    className="rounded-xl px-2.5 py-1 text-[11px] sm:text-xs"
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
                    })}
                  </div>
                </section>
              );
            }

            // ── 4. Promotional Banner ───────────────────────────────────
            case "promotional_banner":
            case "promo": {
              const headline = config.headline || "🎉 Special Offer — Flat 50% OFF";
              const subheadline = config.subheadline || "Valid on all celebration and birthday cakes above ₹299";
              const ctaText = config.cta_text || "Claim Discount";
              const ctaUrl = config.cta_url || "/products";
              const bgColor = config.bg_color || "#fef3c7";
              const textColor = config.text_color || "#92400e";

              const dtHeight = desktopConfig.height ? `${desktopConfig.height}px` : "auto";
              const tbHeight = tabletConfig.height ? `${tabletConfig.height}px` : "auto";
              const mbHeight = mobileConfig.height ? `${mobileConfig.height}px` : "auto";

              return (
                <section key={sectionKey} className="w-full">
                  <style>{`
                    .promo-banner-${sectionKey} {
                      min-height: ${mbHeight};
                    }
                    @media (min-width: 640px) and (max-width: 1023px) {
                      .promo-banner-${sectionKey} {
                        min-height: ${tbHeight};
                      }
                    }
                    @media (min-width: 1024px) {
                      .promo-banner-${sectionKey} {
                        min-height: ${dtHeight};
                      }
                    }
                  `}</style>
                  <div
                    className={`promo-banner-${sectionKey} rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm border border-ui-border-base`}
                    style={{ backgroundColor: bgColor, color: textColor }}
                  >
                    <div className="flex flex-col gap-1 text-center sm:text-left">
                      <h3 className="text-xl sm:text-2xl font-black">{headline}</h3>
                      <p className="text-xs sm:text-sm font-medium opacity-90">{subheadline}</p>
                    </div>
                    {ctaText && (
                      <Link href={ctaUrl}>
                        <Button
                          variant="primary"
                          size="large"
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-6 shrink-0 shadow-md"
                        >
                          {ctaText} →
                        </Button>
                      </Link>
                    )}
                  </div>
                </section>
              );
            }

            // ── 5. Image + Text / Brand Story ───────────────────────────
            case "image_text":
            case "brand_story": {
              const heading = config.heading || "Handcrafted with Pure Ingredients";
              const body = config.body || "At CakeToHome, our master bakers use only premium Belgian dark chocolate, Madagascar bourbon vanilla beans, and farm-fresh seasonal fruits.";
              const imageUrl = config.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
              const imageAlt = config.image_alt || heading;
              const ctaText = config.cta_text;
              const ctaUrl = config.cta_url || "/products";

              return (
                <section key={sectionKey} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-ui-bg-subtle/40 p-6 sm:p-10 rounded-3xl border border-ui-border-base">
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col gap-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-600">About Our Kitchen</span>
                    <Heading level="h2" className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    <p className="text-sm text-ui-fg-muted leading-relaxed whitespace-pre-line">
                      {body}
                    </p>
                    {ctaText && (
                      <Link href={ctaUrl} className="pt-2">
                        <Button variant="primary" size="large" className="rounded-xl px-6">
                          {ctaText} →
                        </Button>
                      </Link>
                    )}
                  </div>
                </section>
              );
            }

            // ── 6. Features / Benefits ──────────────────────────────────
            case "features": {
              const heading = config.heading || "Why CakeToHome is Bangalore's #1 Choice";
              const defaultFeatures = [
                { icon: "Truck", title: "2-Hour Express Delivery", desc: "Fastest doorstep cake delivery across Bangalore" },
                { icon: "Sparkles", title: "100% Eggless Options", desc: "All flavors available in pure vegetarian eggless variants" },
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

            // ── 7. FAQ Section ──────────────────────────────────────────
            case "faq": {
              const heading = config.heading || "Frequently Asked Questions";
              const defaultFaqs = [
                { q: "Do you deliver cakes at midnight in Bangalore?", a: "Yes! We offer guaranteed midnight delivery slots (11:30 PM – 12:05 AM) across all areas in Bangalore for birthdays and anniversaries." },
                { q: "Can I customize the cake size and flavour?", a: "Absolutely! You can choose sizes from 0.5 kg to 5.0 kg, select premium flavours (Belgian Chocolate, Red Velvet, Alphonso Mango, Lotus Biscoff), and add personal custom messages." },
                { q: "Are eggless cake options available?", a: "Yes, all our handcrafted cakes are available in pure eggless versions at no extra charge." },
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

            // ── 8. Location Coverage ────────────────────────────────────
            case "location_coverage": {
              const heading = config.heading || "📍 We Deliver Fresh Cakes Across Bangalore";
              const subheading = config.subheading || "Same-day & 2-hour express delivery available in all major clusters";
              const defaultAreas = [
                "Whitefield", "Indiranagar", "Koramangala", "HSR Layout",
                "Jayanagar", "JP Nagar", "Marathahalli", "Bellandur",
                "Electronic City", "Sarjapur Road", "Hebbal", "Yelahanka",
                "Malleshwaram", "Rajajinagar", "MG Road", "BTM Layout"
              ];
              const areas = (config.areas && config.areas.length > 0) ? config.areas : defaultAreas;

              return (
                <section key={sectionKey} className="flex flex-col gap-6 bg-gradient-to-r from-rose-50/50 to-orange-50/50 dark:from-rose-950/20 dark:to-orange-950/20 p-6 sm:p-8 rounded-3xl border border-rose-200/50 dark:border-rose-900/30 text-center items-center">
                  <div className="flex flex-col gap-1 max-w-xl">
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    <Text className="text-xs sm:text-sm text-ui-fg-subtle">{subheading}</Text>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                    {areas.map((area: string) => (
                      <span key={area} className="px-3 py-1 bg-white dark:bg-ui-bg-base rounded-full text-xs font-medium border border-ui-border-base shadow-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-rose-500" /> {area}
                      </span>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 9. Text Content / SEO Content ───────────────────────────
            case "text_content":
            case "seo_content": {
              const heading = config.heading;
              const body = config.body || "";

              return (
                <section key={sectionKey} className="max-w-4xl mx-auto w-full flex flex-col gap-4">
                  {heading && (
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                  )}
                  <div className="prose max-w-none text-xs sm:text-sm text-ui-fg-muted leading-relaxed whitespace-pre-line bg-ui-bg-subtle/30 p-6 rounded-2xl border border-ui-border-base">
                    {body}
                  </div>
                </section>
              );
            }

            // ── 10. Call to Action ──────────────────────────────────────
            case "cta": {
              const heading = config.heading || "Ready to Celebrate with Delicious Cake?";
              const ctaText = config.cta_text || "Order Your Cake Now";
              const ctaUrl = config.cta_url || "/products";

              return (
                <section
                  key={sectionKey}
                  className="bg-rose-600 text-white rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center gap-4 shadow-xl shadow-rose-900/20"
                  style={theme?.accent_color ? { backgroundColor: theme.accent_color } : undefined}
                >
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{heading}</h2>
                  <p className="text-sm sm:text-base text-white/90 max-w-lg">
                    Place your order now and enjoy artisanal gourmet cakes delivered to your doorstep in under 2 hours.
                  </p>
                  <Link href={ctaUrl} className="pt-2">
                    <Button variant="secondary" size="large" className="bg-white text-rose-600 font-bold hover:bg-white/90 px-8 py-3 rounded-xl shadow-lg border-none">
                      {ctaText} →
                    </Button>
                  </Link>
                </section>
              );
            }

            // ── 11. Occasions Grid ──────────────────────────────────────
            case "occasions_grid":
            case "occasions": {
              const heading = config.heading || "Cakes for Every Special Occasion";
              const subheading = config.subheading || "Birthdays, anniversaries, weddings, and milestones handcrafted to perfection";
              const occasionIds = config.occasion_ids || [];
              const displayOccasions = (occasionIds.length > 0 && occasions && occasions.length > 0)
                ? occasionIds.map((oid: string) => occasions.find((o: any) => o.id === oid || o.slug === oid)).filter(Boolean)
                : (occasions && occasions.length > 0 ? occasions.slice(0, 6) : [
                    { id: "occ_birthday", name: "Birthday Cakes", slug: "birthday", image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400" },
                    { id: "occ_anniversary", name: "Anniversary Cakes", slug: "anniversary", image_url: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=400" },
                    { id: "occ_wedding", name: "Wedding Cakes", slug: "wedding", image_url: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=400" },
                    { id: "occ_baby_shower", name: "Baby Shower Cakes", slug: "baby-shower", image_url: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=400" },
                  ]);

              const dtCols = desktopConfig.columns || config.columns || 4;
              const tbCols = tabletConfig.columns || 3;
              const mbCols = mobileConfig.columns || 2;
              const dtGap = desktopConfig.gap || 16;
              const tbGap = tabletConfig.gap || 14;
              const mbGap = mobileConfig.gap || 12;

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  <style>{`
                    .occ-grid-${sectionKey} {
                      display: grid;
                      grid-template-columns: repeat(${mbCols}, minmax(0, 1fr));
                      gap: ${mbGap}px;
                    }
                    @media (min-width: 640px) and (max-width: 1023px) {
                      .occ-grid-${sectionKey} {
                        grid-template-columns: repeat(${tbCols}, minmax(0, 1fr));
                        gap: ${tbGap}px;
                      }
                    }
                    @media (min-width: 1024px) {
                      .occ-grid-${sectionKey} {
                        grid-template-columns: repeat(${dtCols}, minmax(0, 1fr));
                        gap: ${dtGap}px;
                      }
                    }
                  `}</style>
                  <div className="flex flex-col gap-1">
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    {subheading && <Text className="text-xs sm:text-sm text-ui-fg-subtle">{subheading}</Text>}
                  </div>

                  <div className={`occ-grid-${sectionKey}`}>
                    {displayOccasions.map((occ: any) => (
                      <Link
                        key={occ.id || occ.slug}
                        href={`/products?occasion=${occ.slug || occ.id}`}
                        className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-ui-bg-subtle border border-ui-border-base hover:shadow-lg hover:border-rose-300 transition-all flex flex-col justify-end p-4"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={occ.image_url || occ.thumbnail || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600"}
                          alt={occ.name || "Occasion"}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="relative z-10 text-white">
                          <h3 className="font-bold text-sm sm:text-base leading-tight group-hover:text-rose-200 transition-colors flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5 text-rose-400" /> {occ.name}
                          </h3>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 12. Recommendations / Cross Sell ────────────────────────
            case "recommendations":
            case "cross_sell": {
              const heading = config.heading || "Chef's Handcrafted Recommendations";
              const subheading = config.subheading || "Specially curated pairings and best-sellers based on trending customer favorites";
              const recProducts = allProducts.slice(0, 4);

              return (
                <section key={sectionKey} className="flex flex-col gap-6 bg-gradient-to-br from-rose-50/60 to-purple-50/60 dark:from-rose-950/20 dark:to-purple-950/20 p-6 sm:p-8 rounded-3xl border border-rose-200/60 dark:border-rose-900/30">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" /> Curated Pairings
                      </span>
                      <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                        {heading}
                      </Heading>
                      {subheading && <Text className="text-xs sm:text-sm text-ui-fg-subtle">{subheading}</Text>}
                    </div>
                    <Link href="/products" className="text-xs font-semibold text-rose-600 hover:text-rose-700 hidden sm:flex items-center gap-1">
                      Explore All <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {recProducts.map((p: any) => {
                      const price = p.price || 599;
                      const thumbnail = p.thumbnail || p.images?.[0]?.url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=400";
                      const slug = p.handle || p.slug || p.id;
                      return (
                        <Link
                          key={p.id}
                          href={`/products/${slug}`}
                          className="group bg-white dark:bg-ui-bg-base rounded-2xl overflow-hidden border border-ui-border-base hover:border-rose-300 hover:shadow-lg transition-all flex flex-col justify-between"
                        >
                          <div className="aspect-[4/3] w-full overflow-hidden bg-ui-bg-subtle relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={thumbnail} alt={p.title || "Cake"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-bold">Recommended</span>
                          </div>
                          <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between">
                            <h4 className="font-bold text-xs sm:text-sm line-clamp-1 group-hover:text-rose-600 transition-colors">{p.title}</h4>
                            <div className="flex items-center justify-between pt-1 border-t border-ui-border-base">
                              <span className="text-sm font-extrabold text-ui-fg-base">₹{price}</span>
                              <span className="text-[11px] font-semibold text-rose-600 group-hover:underline">Order →</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            }

            // ── 13. Trust Badges / Compliance ───────────────────────────
            case "trust_badges":
            case "compliance": {
              const heading = config.heading || "CakeToHome Safety & Quality Assurance";
              const badges = [
                { icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />, title: "FSSAI Certified Bakery", desc: "Lic. No. 11223334000123 — 100% compliant with food safety regulations." },
                { icon: <Sparkles className="w-6 h-6 text-amber-500" />, title: "Pure Eggless Kitchens", desc: "Dedicated vegetarian prep lines with 100% pure vegetarian ingredients." },
                { icon: <Truck className="w-6 h-6 text-rose-500" />, title: "2-Hour Express Delivery", desc: "Temperature-controlled sanitized delivery boxes ensuring zero melting." },
                { icon: <Award className="w-6 h-6 text-indigo-500" />, title: "Freshly Baked Guarantee", desc: "Baked fresh only upon order confirmation with premium ingredients." },
              ];

              return (
                <section key={sectionKey} className="flex flex-col gap-6 py-2">
                  {heading && (
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight text-center" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {badges.map((b: any, bi: number) => (
                      <div key={bi} className="p-5 rounded-2xl bg-ui-bg-base border border-ui-border-base flex flex-col gap-2 shadow-sm">
                        <div className="p-3 bg-ui-bg-subtle rounded-xl w-fit">{b.icon}</div>
                        <h4 className="font-bold text-sm text-ui-fg-base">{b.title}</h4>
                        <p className="text-xs text-ui-fg-muted">{b.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            default:
              return null;
          }
        };

        if (section.type === "hero") {
          return (
            <div key={sectionKey} data-section-id={section.id} className="w-full relative">
              {renderSectionContent()}
            </div>
          );
        }

        return (
          <div
            key={sectionKey}
            data-section-id={section.id}
            onClick={() => isPreview && onSectionClick?.(section.id)}
            className={`sec-wrap-${sectionKey} relative w-full max-w-7xl mx-auto px-3 sm:px-6 md:px-10 transition-all duration-200 ${
              isPreview
                ? `cursor-pointer hover:ring-2 hover:ring-rose-400 hover:ring-offset-2 ${
                    isSelected ? "ring-4 ring-rose-500 ring-offset-4 shadow-2xl z-20" : ""
                  }`
                : ""
            }`}
          >
            {wrapperStyle}
            {isSelected && (
              <div className="absolute top-2 left-2 z-30 px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                <span>Selected: {section.name}</span>
              </div>
            )}
            {renderSectionContent()}
          </div>
        );
      })}
    </div>
  );
}
