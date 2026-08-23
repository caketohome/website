"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { Heading, Text, Badge, Button } from "@medusajs/ui";
import { Sparkles, ArrowRight, ShieldCheck, Clock, Layers } from "lucide-react";

export interface AnimationFrameItem {
  id: string;
  sequence: number;
  filename: string;
  url: string;
  optimized_url?: string;
  original_size?: number; // bytes
  compressed_size?: number; // bytes
  savings_pct?: number; // percentage
  width?: number;
  height?: number;
  format?: string;
  device_target?: "desktop" | "tablet" | "mobile" | "all";
}

export interface DeviceAnimationConfig {
  enabled?: boolean;
  animation_type?: "scroll_frame" | "autoplay" | "marquee" | "fade" | "slide" | "zoom" | "carousel" | "none";
  use_desktop_fallback?: boolean;
  frames?: AnimationFrameItem[];
  frame_count?: number;

  // Animation parameters
  trigger?: "on_scroll" | "on_enter" | "manual";
  speed?: "slow" | "normal" | "fast" | "custom";
  scroll_length_vh?: number; // e.g. 280
  sensitivity?: number;
  scrub?: boolean;
  fps?: number;
  duration?: number;
  easing?: "linear" | "ease_in" | "ease_out" | "ease_in_out";
  smoothing?: boolean;
  loop?: boolean;
  reverse?: boolean;
  direction?: "forward" | "reverse";

  // Preload & Compression
  preload_strategy?: "aggressive" | "balanced" | "lazy" | "poster_first";
  compression_quality?: "high" | "balanced" | "performance";

  // Content
  badge?: string;
  badge_icon?: string;
  badge_bg?: string;
  badge_color?: string;
  headline?: string;
  subheadline?: string;
  description?: string;

  cta_primary_visible?: boolean;
  cta_primary_text?: string;
  cta_primary_url?: string;
  cta_primary_bg?: string;
  cta_primary_color?: string;

  cta_secondary_visible?: boolean;
  cta_secondary_text?: string;
  cta_secondary_url?: string;
  cta_secondary_bg?: string;
  cta_secondary_color?: string;

  // Story phases (optional Phase 2 / Phase 3 overlays during scroll scrub)
  craft_badge?: string;
  craft_heading?: string;
  craft_text?: string;

  fleet_badge?: string;
  fleet_heading?: string;
  fleet_text?: string;
  fleet_cta_text?: string;
  fleet_cta_url?: string;

  // Fallback poster
  poster_image?: string;
}

export interface ScrollFrameAnimationProps {
  sectionId?: string;
  config?: {
    // Root level fallbacks
    headline?: string;
    subheadline?: string;
    badge_text?: string;
    badge_icon?: string;
    badge_bg?: string;
    badge_color?: string;
    cta_primary_visible?: boolean;
    cta_primary_text?: string;
    cta_primary_url?: string;
    cta_primary_bg?: string;
    cta_primary_color?: string;
    cta_secondary_visible?: boolean;
    cta_secondary_text?: string;
    cta_secondary_url?: string;
    cta_secondary_bg?: string;
    cta_secondary_color?: string;
    craft_badge?: string;
    craft_heading?: string;
    craft_text?: string;
    fleet_badge?: string;
    fleet_heading?: string;
    fleet_text?: string;
    fleet_cta_text?: string;
    fleet_cta_url?: string;
    poster_image?: string;
    bg_image?: string;
    disable_scroll_sequence?: boolean;

    // Device-specific configurations
    desktop?: DeviceAnimationConfig;
    tablet?: DeviceAnimationConfig;
    mobile?: DeviceAnimationConfig;
  };
  isPreview?: boolean;
  previewDevice?: "desktop" | "tablet" | "mobile";

  // Flat / Legacy Props Compatibility
  headline?: string;
  subheadline?: string;
  badgeText?: string;
  badgeIcon?: string;
  badgeBg?: string;
  badgeColor?: string;
  ctaPrimaryVisible?: boolean;
  ctaPrimaryText?: string;
  ctaPrimaryUrl?: string;
  ctaPrimaryBg?: string;
  ctaPrimaryColor?: string;
  ctaSecondaryVisible?: boolean;
  ctaSecondaryText?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryBg?: string;
  ctaSecondaryColor?: string;
  craftBadge?: string;
  craftHeading?: string;
  craftText?: string;
  fleetBadge?: string;
  fleetHeading?: string;
  fleetText?: string;
  fleetCtaText?: string;
  fleetCtaUrl?: string;
}

// Global in-memory decoded image cache to prevent re-fetching across re-renders
const RUNTIME_IMAGE_CACHE = new Map<string, HTMLImageElement>();
const RUNTIME_IN_FLIGHT = new Set<string>();

function preloadSingleImage(url: string, onLoaded?: (img: HTMLImageElement) => void) {
  if (!url) return;
  const cached = RUNTIME_IMAGE_CACHE.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    if (onLoaded) onLoaded(cached);
    return;
  }
  if (RUNTIME_IN_FLIGHT.has(url)) return;

  RUNTIME_IN_FLIGHT.add(url);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url;
  img.onload = () => {
    RUNTIME_IN_FLIGHT.delete(url);
    RUNTIME_IMAGE_CACHE.set(url, img);
    if (onLoaded) onLoaded(img);
  };
  img.onerror = () => {
    RUNTIME_IN_FLIGHT.delete(url);
  };
}

export function ScrollFrameAnimation({
  sectionId = "scroll_frame_main",
  config: passedConfig,
  isPreview = false,
  previewDevice,
  ...flatProps
}: ScrollFrameAnimationProps) {
  // Merge flat props into config if config not provided
  const config = passedConfig || {
    headline: flatProps.headline,
    subheadline: flatProps.subheadline,
    badge_text: flatProps.badgeText,
    badge_icon: flatProps.badgeIcon,
    badge_bg: flatProps.badgeBg,
    badge_color: flatProps.badgeColor,
    cta_primary_visible: flatProps.ctaPrimaryVisible,
    cta_primary_text: flatProps.ctaPrimaryText,
    cta_primary_url: flatProps.ctaPrimaryUrl,
    cta_primary_bg: flatProps.ctaPrimaryBg,
    cta_primary_color: flatProps.ctaPrimaryColor,
    cta_secondary_visible: flatProps.ctaSecondaryVisible,
    cta_secondary_text: flatProps.ctaSecondaryText,
    cta_secondary_url: flatProps.ctaSecondaryUrl,
    cta_secondary_bg: flatProps.ctaSecondaryBg,
    cta_secondary_color: flatProps.ctaSecondaryColor,
    craft_badge: flatProps.craftBadge,
    craft_heading: flatProps.craftHeading,
    craft_text: flatProps.craftText,
    fleet_badge: flatProps.fleetBadge,
    fleet_heading: flatProps.fleetHeading,
    fleet_text: flatProps.fleetText,
    fleet_cta_text: flatProps.fleetCtaText,
    fleet_cta_url: flatProps.fleetCtaUrl,
  };
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const introOverlayRef = useRef<HTMLDivElement | null>(null);
  const craftOverlayRef = useRef<HTMLDivElement | null>(null);
  const fleetOverlayRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Active Device state (Detected via MatchMedia on client or forced via isPreview)
  const [currentDevice, setCurrentDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  // High-Frequency mutable animation state (zero React state on scroll ticks)
  const currentFrameIdxRef = useRef<number>(0);
  const targetFrameIdxRef = useRef<number>(0);
  const lastDrawnFrameRef = useRef<number>(-1);
  const rafIdRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef<boolean>(false);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── 1. Device Resolution ──────────────────────────────────────────────────
  useEffect(() => {
    if (previewDevice) {
      setCurrentDevice(previewDevice);
      return;
    }
    if (typeof window === "undefined") return;

    const checkMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(checkMotion.matches);
    const motionListener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    checkMotion.addEventListener("change", motionListener);

    const updateDevice = () => {
      const width = window.innerWidth;
      if (width < 640) setCurrentDevice("mobile");
      else if (width < 1024) setCurrentDevice("tablet");
      else setCurrentDevice("desktop");
    };

    updateDevice();
    window.addEventListener("resize", updateDevice, { passive: true });
    return () => {
      window.removeEventListener("resize", updateDevice);
      checkMotion.removeEventListener("change", motionListener);
    };
  }, [previewDevice]);

  // ── 2. Active Config Computation ──────────────────────────────────────────
  const desktopCfg: DeviceAnimationConfig = config.desktop || {};
  const tabletCfg: DeviceAnimationConfig = config.tablet?.use_desktop_fallback !== false && (!config.tablet?.frames || config.tablet.frames.length === 0)
    ? desktopCfg
    : config.tablet || desktopCfg;
  const mobileCfg: DeviceAnimationConfig = config.mobile?.use_desktop_fallback !== false && (!config.mobile?.frames || config.mobile.frames.length === 0)
    ? desktopCfg
    : config.mobile || desktopCfg;

  const activeDeviceConfig: DeviceAnimationConfig =
    currentDevice === "mobile" ? mobileCfg : currentDevice === "tablet" ? tabletCfg : desktopCfg;

  // Extract frames (fallback to root poster/bg_image if no frame array configured)
  const rawFrames = activeDeviceConfig.frames || [];
  const frames: AnimationFrameItem[] = rawFrames.length > 0
    ? [...rawFrames].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)).slice(0, 22)
    : [];

  const totalFrames = frames.length;
  const isAnimationEnabled =
    config.disable_scroll_sequence !== true &&
    activeDeviceConfig.enabled !== false &&
    !prefersReducedMotion &&
    totalFrames > 0;

  const animationType = activeDeviceConfig.animation_type || (totalFrames > 0 ? "scroll_frame" : "none");
  const isScrub = activeDeviceConfig.scrub !== false;
  const scrollLengthVh = activeDeviceConfig.scroll_length_vh ?? (activeDeviceConfig.speed === "slow" ? 350 : activeDeviceConfig.speed === "fast" ? 200 : 280);
  const easingRate = activeDeviceConfig.easing === "linear" ? 0.25 : activeDeviceConfig.easing === "ease_out" ? 0.18 : 0.14;

  // Text / Content resolution (Device specific with root fallback)
  const headline = activeDeviceConfig.headline || config.headline || "Handcrafted Gourmet Cakes Delivered in 2 Hours";
  const subheadline = activeDeviceConfig.subheadline || config.subheadline || "Fresh, artisanal birthday & wedding cakes across Bangalore. Midnight delivery available!";
  const badgeText = activeDeviceConfig.badge || config.badge_text || "100% Fresh & Artisanal • Express 2-Hour Delivery";
  const badgeBg = activeDeviceConfig.badge_bg || config.badge_bg;
  const badgeColor = activeDeviceConfig.badge_color || config.badge_color;

  const primaryCtaVisible = activeDeviceConfig.cta_primary_visible ?? config.cta_primary_visible ?? true;
  const primaryCtaText = activeDeviceConfig.cta_primary_text || config.cta_primary_text || "Explore Cakes";
  const primaryCtaUrl = activeDeviceConfig.cta_primary_url || config.cta_primary_url || "/products";
  const primaryCtaBg = activeDeviceConfig.cta_primary_bg || config.cta_primary_bg;
  const primaryCtaColor = activeDeviceConfig.cta_primary_color || config.cta_primary_color;

  const secondaryCtaVisible = activeDeviceConfig.cta_secondary_visible ?? config.cta_secondary_visible ?? true;
  const secondaryCtaText = activeDeviceConfig.cta_secondary_text || config.cta_secondary_text || "Birthday Specials";
  const secondaryCtaUrl = activeDeviceConfig.cta_secondary_url || config.cta_secondary_url || "/products?occasion=birthday";

  const craftBadge = activeDeviceConfig.craft_badge || config.craft_badge || "Master Chocolatier Recipe";
  const craftHeading = activeDeviceConfig.craft_heading || config.craft_heading || "Every Layer, A Symphony of Flavor";
  const craftText = activeDeviceConfig.craft_text || config.craft_text || "Crafted with Belgian cocoa, Madagascan vanilla, and fresh dairy cream. Baked to order within minutes of your celebration.";

  const fleetBadge = activeDeviceConfig.fleet_badge || config.fleet_badge || "Climate-Controlled Transit";
  const fleetHeading = activeDeviceConfig.fleet_heading || config.fleet_heading || "Pristine & Chilled To Your Table";
  const fleetText = activeDeviceConfig.fleet_text || config.fleet_text || "Specially engineered shock-absorbent cake domes guarantee zero damage during transit across Bangalore.";
  const fleetCtaText = activeDeviceConfig.fleet_cta_text || config.fleet_cta_text || "Order for Today";
  const fleetCtaUrl = activeDeviceConfig.fleet_cta_url || config.fleet_cta_url || "/products";

  const posterImage = activeDeviceConfig.poster_image || config.poster_image || config.bg_image || (frames.length > 0 ? frames[0].url : "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1400");

  // ── 3. Frame Preloading Strategy ──────────────────────────────────────────
  useEffect(() => {
    if (frames.length === 0) return;

    // Step 1: Preload poster / 1st frame immediately
    preloadSingleImage(frames[0].optimized_url || frames[0].url, () => {
      setLoadedCount((c) => Math.max(c, 1));
      drawCanvasFrame(0);
    });

    // Step 2: Progressive stream of remaining frames when section enters viewport
    const sectionEl = sectionRef.current;
    if (!sectionEl || typeof IntersectionObserver === "undefined") {
      frames.forEach((f) => preloadSingleImage(f.optimized_url || f.url));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Preload rest progressively in sequence
          frames.slice(1).forEach((frame, idx) => {
            setTimeout(() => {
              preloadSingleImage(frame.optimized_url || frame.url, () => {
                setLoadedCount((c) => c + 1);
              });
            }, idx * 20);
          });
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, [frames]);

  // ── 4. Canvas Draw Routine (Cover Math + DPR Scaling) ─────────────────────
  const drawCanvasFrame = useCallback(
    (frameIndex: number) => {
      const canvas = canvasRef.current;
      if (!canvas || frames.length === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const clamped = Math.max(0, Math.min(frames.length - 1, Math.round(frameIndex)));
      const targetFrame = frames[clamped];
      if (!targetFrame) return;

      const url = targetFrame.optimized_url || targetFrame.url;
      let img = RUNTIME_IMAGE_CACHE.get(url);

      // Fallback to nearest loaded frame if current target not decoded yet
      if (!img || !img.complete || img.naturalWidth === 0) {
        const loadedFrames = frames.filter((f) => {
          const item = RUNTIME_IMAGE_CACHE.get(f.optimized_url || f.url);
          return item && item.complete && item.naturalWidth > 0;
        });
        if (loadedFrames.length > 0) {
          loadedFrames.sort((a, b) => Math.abs(a.sequence - targetFrame.sequence) - Math.abs(b.sequence - targetFrame.sequence));
          img = RUNTIME_IMAGE_CACHE.get(loadedFrames[0].optimized_url || loadedFrames[0].url);
        }
      }

      if (!img || !img.complete || img.naturalWidth === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;

      if (canvas.width !== canvasWidth * dpr || canvas.height !== canvasHeight * dpr) {
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Object-fit: cover math
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawWidth = canvasWidth;
      let drawHeight = canvasHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > imgRatio) {
        drawHeight = canvasWidth / imgRatio;
        offsetY = (canvasHeight - drawHeight) / 2;
      } else {
        drawWidth = canvasHeight * imgRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      ctx.restore();

      lastDrawnFrameRef.current = clamped;
    },
    [frames]
  );

  // ── 5. Overlay Interpolation (Intro -> Craft Story -> Fleet Guarantee) ───
  const updateOverlays = useCallback((progress: number) => {
    // Phase 1 (Intro): 0.00 -> 0.28
    if (introOverlayRef.current) {
      let opacity = 0;
      let translateY = 0;
      if (progress < 0.15) {
        opacity = 1 - progress * 1.5;
        translateY = progress * -40;
      } else if (progress < 0.28) {
        opacity = Math.max(0, 1 - (progress - 0.15) / 0.13);
        translateY = -40 - (progress - 0.15) * 60;
      }
      introOverlayRef.current.style.opacity = opacity.toFixed(3);
      introOverlayRef.current.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
      introOverlayRef.current.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
    }

    // Phase 2 (Craft Story): 0.28 -> 0.64
    if (craftOverlayRef.current) {
      let opacity = 0;
      let translateY = 20;
      if (progress >= 0.28 && progress <= 0.42) {
        const t = (progress - 0.28) / 0.14;
        opacity = t;
        translateY = 20 * (1 - t);
      } else if (progress > 0.42 && progress < 0.52) {
        opacity = 1;
        translateY = 0;
      } else if (progress >= 0.52 && progress <= 0.64) {
        const t = (progress - 0.52) / 0.12;
        opacity = Math.max(0, 1 - t);
        translateY = -20 * t;
      }
      craftOverlayRef.current.style.opacity = opacity.toFixed(3);
      craftOverlayRef.current.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
      craftOverlayRef.current.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
    }

    // Phase 3 (Fleet Guarantee): 0.65 -> 1.00
    if (fleetOverlayRef.current) {
      let opacity = 0;
      let translateY = 20;
      if (progress >= 0.65 && progress <= 0.78) {
        const t = (progress - 0.65) / 0.13;
        opacity = t;
        translateY = 20 * (1 - t);
      } else if (progress > 0.78) {
        opacity = 1;
        translateY = 0;
      }
      fleetOverlayRef.current.style.opacity = opacity.toFixed(3);
      fleetOverlayRef.current.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
      fleetOverlayRef.current.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
    }

    // Progress Bar
    if (progressBarRef.current) {
      progressBarRef.current.style.transform = `scaleX(${progress.toFixed(3)})`;
    }
  }, []);

  // ── 6. RAF Animation Render Loop ──────────────────────────────────────────
  const startRafLoop = useCallback(() => {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    const loop = () => {
      const diff = targetFrameIdxRef.current - currentFrameIdxRef.current;

      if (Math.abs(diff) > 0.005) {
        currentFrameIdxRef.current += diff * easingRate;
        const rounded = Math.round(currentFrameIdxRef.current);
        if (rounded !== lastDrawnFrameRef.current) {
          drawCanvasFrame(rounded);
        }
      } else if (Math.round(currentFrameIdxRef.current) !== lastDrawnFrameRef.current) {
        currentFrameIdxRef.current = targetFrameIdxRef.current;
        drawCanvasFrame(Math.round(currentFrameIdxRef.current));
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [drawCanvasFrame, easingRate]);

  // ── 7. Scroll Listener & Scrub Engine ─────────────────────────────────────
  useEffect(() => {
    if (!isAnimationEnabled || totalFrames <= 1) {
      drawCanvasFrame(0);
      updateOverlays(0);
      return;
    }

    startRafLoop();

    const handleScroll = () => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;
      if (totalScrollable <= 0) return;

      const currentScroll = -rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollable));

      if (isScrub) {
        targetFrameIdxRef.current = progress * (totalFrames - 1);
      }

      updateOverlays(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        isLoopRunningRef.current = false;
      }
    };
  }, [isAnimationEnabled, totalFrames, isScrub, startRafLoop, drawCanvasFrame, updateOverlays]);

  // ── 8. Autoplay Mode (Optional trigger) ───────────────────────────────────
  useEffect(() => {
    if (!isAnimationEnabled || animationType !== "autoplay" || totalFrames <= 1) return;

    const intervalMs = 1000 / (activeDeviceConfig.fps || 12);
    autoplayTimerRef.current = setInterval(() => {
      targetFrameIdxRef.current = (targetFrameIdxRef.current + 1) % totalFrames;
      drawCanvasFrame(targetFrameIdxRef.current);
    }, intervalMs);

    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    };
  }, [isAnimationEnabled, animationType, totalFrames, activeDeviceConfig.fps, drawCanvasFrame]);

  // ── 9. Static Fallback Mode (When animation disabled or zero frames) ─────
  if (!isAnimationEnabled || totalFrames === 0) {
    return (
      <section
        id={sectionId}
        ref={sectionRef}
        className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl border border-ui-border-base min-h-[420px] sm:min-h-[500px] flex items-center justify-center text-white"
        style={{
          backgroundImage: `url(${posterImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
        <div className="relative z-10 p-6 sm:p-12 max-w-3xl flex flex-col items-center text-center gap-4">
          {badgeText && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm"
              style={{
                backgroundColor: badgeBg || "rgba(255, 255, 255, 0.2)",
                color: badgeColor || "#ffffff",
              }}
            >
              <Sparkles className="w-3 h-3 text-rose-300" />
              <span>{badgeText}</span>
            </span>
          )}
          <Heading level="h1" className="text-3xl sm:text-5xl font-black tracking-tight leading-tight drop-shadow-md">
            {headline}
          </Heading>
          {subheadline && (
            <Text className="text-sm sm:text-base text-stone-200 max-w-xl font-medium drop-shadow-sm">
              {subheadline}
            </Text>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {primaryCtaVisible && (
              <Link href={primaryCtaUrl}>
                <Button
                  variant="primary"
                  size="large"
                  className="rounded-xl px-6 py-3 font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-all text-sm"
                  style={primaryCtaBg ? { backgroundColor: primaryCtaBg, color: primaryCtaColor } : undefined}
                >
                  {primaryCtaText} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            )}
            {secondaryCtaVisible && (
              <Link href={secondaryCtaUrl}>
                <Button
                  variant="secondary"
                  size="large"
                  className="rounded-xl px-5 py-3 font-bold bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-md transition-all text-sm"
                >
                  {secondaryCtaText}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── 10. Dynamic Scroll-Frame Sticky Section ───────────────────────────────
  return (
    <section
      id={sectionId}
      ref={sectionRef}
      className="scroll-frame-section relative w-full"
      style={{ height: `${scrollLengthVh}vh` }}
    >
      <div
        className="scroll-frame-sticky sticky top-0 h-screen w-full overflow-hidden bg-stone-950 flex items-center justify-center select-none"
      >
        {/* Hardware-Accelerated Canvas */}
        <canvas
          ref={canvasRef}
          className="scroll-frame-canvas absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

        {/* Ambient Gradient Overlays for High Contrast Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-transparent to-stone-950/40 pointer-events-none" />

        {/* Progress Bar (Sticky bottom indicator) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20 pointer-events-none">
          <div
            ref={progressBarRef}
            className="h-full bg-rose-500 origin-left transition-transform duration-75 ease-out"
            style={{ transform: "scaleX(0)" }}
          />
        </div>

        {/* ── Phase 1 Overlay (Intro Headline & Primary CTAs) ── */}
        <div
          ref={introOverlayRef}
          className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-12 text-center text-white z-10 max-w-4xl mx-auto will-change-transform"
        >
          {badgeText && (
            <span
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase mb-4 shadow-lg backdrop-blur-md border border-white/10"
              style={{
                backgroundColor: badgeBg || "rgba(225, 29, 72, 0.3)",
                color: badgeColor || "#FDA4AF",
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
              <span>{badgeText}</span>
            </span>
          )}
          <Heading level="h1" className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight drop-shadow-2xl max-w-3xl">
            {headline}
          </Heading>
          {subheadline && (
            <Text className="text-sm sm:text-lg text-stone-200 mt-3 max-w-2xl font-medium drop-shadow-md">
              {subheadline}
            </Text>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-6">
            {primaryCtaVisible && (
              <Link href={primaryCtaUrl}>
                <Button
                  variant="primary"
                  size="large"
                  className="rounded-xl px-7 py-3.5 font-extrabold text-sm sm:text-base shadow-2xl hover:scale-105 active:scale-95 transition-all"
                  style={primaryCtaBg ? { backgroundColor: primaryCtaBg, color: primaryCtaColor } : undefined}
                >
                  {primaryCtaText} <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            )}
            {secondaryCtaVisible && (
              <Link href={secondaryCtaUrl}>
                <Button
                  variant="secondary"
                  size="large"
                  className="rounded-xl px-6 py-3.5 font-bold text-sm sm:text-base bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-lg transition-all"
                >
                  {secondaryCtaText}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* ── Phase 2 Overlay (Craft / Artisan Kitchen Story) ── */}
        <div
          ref={craftOverlayRef}
          className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-12 text-center text-white z-10 max-w-3xl mx-auto opacity-0 will-change-transform pointer-events-none"
        >
          {craftBadge && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase mb-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{craftBadge}</span>
            </span>
          )}
          <Heading level="h2" className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight drop-shadow-2xl">
            {craftHeading}
          </Heading>
          {craftText && (
            <Text className="text-xs sm:text-base text-stone-200 mt-2.5 max-w-xl font-medium drop-shadow-md leading-relaxed">
              {craftText}
            </Text>
          )}
        </div>

        {/* ── Phase 3 Overlay (Fleet Guarantee & Midnight Delivery) ── */}
        <div
          ref={fleetOverlayRef}
          className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-12 text-center text-white z-10 max-w-3xl mx-auto opacity-0 will-change-transform pointer-events-none"
        >
          {fleetBadge && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase mb-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{fleetBadge}</span>
            </span>
          )}
          <Heading level="h2" className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight drop-shadow-2xl">
            {fleetHeading}
          </Heading>
          {fleetText && (
            <Text className="text-xs sm:text-base text-stone-200 mt-2.5 max-w-xl font-medium drop-shadow-md leading-relaxed">
              {fleetText}
            </Text>
          )}
          {fleetCtaText && (
            <div className="mt-5">
              <Link href={fleetCtaUrl}>
                <Button
                  variant="primary"
                  size="large"
                  className="rounded-xl px-7 py-3 font-extrabold shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm sm:text-base bg-rose-600 hover:bg-rose-700"
                >
                  {fleetCtaText} <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export const ScrollFrameHero = ScrollFrameAnimation;

