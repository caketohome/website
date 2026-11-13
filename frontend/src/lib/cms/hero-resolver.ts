/**
 * Canonical Hero Banner Configuration Resolver
 *
 * Ensures single source of truth for Hero Banner data across:
 * 1. Admin CMS Page Configurator (live canvas preview)
 * 2. Static Hero Renderer (storefront fallback)
 * 3. ScrollFrameHero (storefront scroll animation intro overlay)
 *
 * Guaranteed Behaviors:
 * - Authoritative CMS precedence: Published/draft CMS field values ALWAYS win over defaults.
 * - Device prefix sanitization: Strips accidental "Desktop:", "Tablet:", "Mobile:" prefixes from customer copy.
 * - Responsive image fallback: Mobile/Tablet images gracefully fall back to Desktop image.
 * - Clean defaults: Fallbacks only activate when CMS fields are genuinely empty or undefined.
 */

export interface ResolvedHeroBannerConfig {
  headline: string;
  subheadline: string;
  badgeText: string;
  badgeBg?: string;
  badgeColor?: string;

  primaryCtaVisible: boolean;
  primaryCtaText: string;
  primaryCtaUrl: string;
  primaryCtaBg?: string;
  primaryCtaColor?: string;

  secondaryCtaVisible: boolean;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  secondaryCtaBg?: string;
  secondaryCtaColor?: string;

  desktopImage: string;
  tabletImage: string;
  mobileImage: string;
  activeImage: string;
  imageAlt: string;

  overlayOpacity: number;
  objectFit: "cover" | "contain";
  imagePosition: string;
  alignment: "left" | "center" | "right";
  height: string | number;

  craftBadge: string;
  craftHeading: string;
  craftText: string;

  fleetBadge: string;
  fleetHeading: string;
  fleetText: string;
  fleetCtaText: string;
  fleetCtaUrl: string;

  source: "published CMS" | "default";
}

const DEFAULT_HEADLINE = "Handcrafted Gourmet Cakes Delivered in 2 Hours";
const DEFAULT_SUBHEADLINE = "Fresh, artisanal birthday & wedding cakes across Kerala. Express 2-hour delivery available!";
const DEFAULT_BADGE = "100% Fresh & Artisanal • Express 2-Hour Delivery";
const DEFAULT_PRIMARY_CTA_TEXT = "Explore Cakes";
const DEFAULT_PRIMARY_CTA_URL = "/products";
const DEFAULT_SECONDARY_CTA_TEXT = "Birthday Specials";
const DEFAULT_SECONDARY_CTA_URL = "/products?occasion=birthday";
const DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1400";

/**
 * Strip accidental editor device prefixes like "Desktop: ", "Tablet: ", "Mobile: "
 */
export function sanitizeHeroText(text: string | null | undefined): string {
  if (!text || typeof text !== "string") return "";
  return text.replace(/^(Desktop|Tablet|Mobile):\s*/i, "").trim();
}

/**
 * Pure Canonical Resolver for Hero Banner Section Configuration
 */
export function resolveHeroBannerConfig(
  sectionOrConfig: any,
  device: "desktop" | "tablet" | "mobile" = "desktop"
): ResolvedHeroBannerConfig {
  const config = (sectionOrConfig && typeof sectionOrConfig === "object" && "config" in sectionOrConfig)
    ? (sectionOrConfig.config || {})
    : (sectionOrConfig || {});

  const deviceConfig = config[device] || {};

  // ── 1. Global / Canonical Text Fields ──────────────────────────────────────
  const rawHeadline = (config.headline && typeof config.headline === "string" && config.headline.trim())
    ? config.headline
    : (deviceConfig.headline && typeof deviceConfig.headline === "string" && deviceConfig.headline.trim())
    ? deviceConfig.headline
    : "";

  const headline = sanitizeHeroText(rawHeadline) || DEFAULT_HEADLINE;

  const rawSubheadline = (config.subheadline && typeof config.subheadline === "string" && config.subheadline.trim())
    ? config.subheadline
    : (deviceConfig.subheadline && typeof deviceConfig.subheadline === "string" && deviceConfig.subheadline.trim())
    ? deviceConfig.subheadline
    : "";

  const subheadline = sanitizeHeroText(rawSubheadline) || DEFAULT_SUBHEADLINE;

  const rawBadge = (config.badge_text && typeof config.badge_text === "string" && config.badge_text.trim())
    ? config.badge_text
    : (config.badge && typeof config.badge === "string" && config.badge.trim())
    ? config.badge
    : (deviceConfig.badge && typeof deviceConfig.badge === "string" && deviceConfig.badge.trim())
    ? deviceConfig.badge
    : (deviceConfig.badge_text && typeof deviceConfig.badge_text === "string" && deviceConfig.badge_text.trim())
    ? deviceConfig.badge_text
    : "";

  const badgeText = sanitizeHeroText(rawBadge) || DEFAULT_BADGE;

  // ── 2. Primary & Secondary CTAs ───────────────────────────────────────────
  const primaryCtaVisible = config.cta_primary_visible !== false && deviceConfig.cta_primary_visible !== false;
  const rawPrimaryText = config.cta_primary_text || config.cta_text || deviceConfig.cta_primary_text || "";
  const primaryCtaText = sanitizeHeroText(rawPrimaryText) || DEFAULT_PRIMARY_CTA_TEXT;
  const primaryCtaUrl = config.cta_primary_url || config.cta_url || deviceConfig.cta_primary_url || DEFAULT_PRIMARY_CTA_URL;

  const secondaryCtaVisible = config.cta_secondary_visible !== false && deviceConfig.cta_secondary_visible !== false;
  const rawSecondaryText = config.cta_secondary_text || deviceConfig.cta_secondary_text || "";
  const secondaryCtaText = sanitizeHeroText(rawSecondaryText) || DEFAULT_SECONDARY_CTA_TEXT;
  const secondaryCtaUrl = config.cta_secondary_url || deviceConfig.cta_secondary_url || DEFAULT_SECONDARY_CTA_URL;

  // ── 3. Responsive Images ──────────────────────────────────────────────────
  const desktopImage = (
    config.image_url ||
    config.bg_image ||
    config.desktop_image?.url ||
    config.desktop?.poster_image ||
    config.desktop?.bg_image ||
    (config.desktop?.frames?.[0]?.url) ||
    DEFAULT_HERO_IMAGE
  );

  const tabletImage = (
    config.tablet_image_url ||
    config.tablet_image?.url ||
    config.tablet?.poster_image ||
    config.tablet?.bg_image ||
    (config.tablet?.frames?.[0]?.url) ||
    desktopImage
  );

  const mobileImage = (
    config.mobile_image_url ||
    config.mobile_image?.url ||
    config.mobile?.poster_image ||
    config.mobile?.bg_image ||
    (config.mobile?.frames?.[0]?.url) ||
    desktopImage
  );

  const activeImage = device === "mobile" ? mobileImage : device === "tablet" ? tabletImage : desktopImage;
  const imageAlt = config.image_alt || config.bg_image_alt || config.desktop_image?.alt || headline;

  // ── 4. Layout & Spacing ───────────────────────────────────────────────────
  const overlayOpacity = typeof config.overlay_opacity === "number" ? config.overlay_opacity : 0.4;
  const objectFit: "cover" | "contain" = config.image_fit || config.object_fit || "cover";
  const imagePosition = config.image_position_align || config.image_position || "center";
  const alignment: "left" | "center" | "right" = config[device]?.alignment || config.alignment || "center";
  const height = config[device]?.height || (device === "desktop" ? "500px" : device === "tablet" ? "440px" : "380px");

  // ── 5. Story Overlays (Phases 2 & 3) ───────────────────────────────────────
  const craftBadge = config.craft_badge || deviceConfig.craft_badge || "Master Chocolatier Recipe";
  const craftHeading = config.craft_heading || deviceConfig.craft_heading || "Every Layer, A Symphony of Flavor";
  const craftText = config.craft_text || deviceConfig.craft_text || "Crafted with Belgian cocoa, Madagascan vanilla, and fresh dairy cream. Baked to order within minutes of your celebration.";

  const fleetBadge = config.fleet_badge || deviceConfig.fleet_badge || "Climate-Controlled Transit";
  const fleetHeading = config.fleet_heading || deviceConfig.fleet_heading || "Pristine & Chilled To Your Table";
  const fleetText = config.fleet_text || deviceConfig.fleet_text || "Specially engineered shock-absorbent cake domes guarantee zero damage during transit across Kerala.";
  const fleetCtaText = config.fleet_cta_text || deviceConfig.fleet_cta_text || "Order for Today";
  const fleetCtaUrl = config.fleet_cta_url || deviceConfig.fleet_cta_url || "/products";

  const isConfigured = Boolean(
    config.headline || config.subheadline || config.badge_text || config.cta_primary_text || config.bg_image || config.image_url
  );

  return {
    headline,
    subheadline,
    badgeText,
    badgeBg: config.badge_bg || deviceConfig.badge_bg,
    badgeColor: config.badge_color || deviceConfig.badge_color,

    primaryCtaVisible,
    primaryCtaText,
    primaryCtaUrl,
    primaryCtaBg: config.cta_primary_bg || deviceConfig.cta_primary_bg,
    primaryCtaColor: config.cta_primary_color || deviceConfig.cta_primary_color,

    secondaryCtaVisible,
    secondaryCtaText,
    secondaryCtaUrl,
    secondaryCtaBg: config.cta_secondary_bg || deviceConfig.cta_secondary_bg,
    secondaryCtaColor: config.cta_secondary_color || deviceConfig.cta_secondary_color,

    desktopImage,
    tabletImage,
    mobileImage,
    activeImage,
    imageAlt,

    overlayOpacity,
    objectFit,
    imagePosition,
    alignment,
    height,

    craftBadge,
    craftHeading,
    craftText,

    fleetBadge,
    fleetHeading,
    fleetText,
    fleetCtaText,
    fleetCtaUrl,

    source: isConfigured ? "published CMS" : "default",
  };
}
