"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import { Heading, Text, Button } from "@medusajs/ui";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { resolveHeroBannerConfig } from "@frontend/lib/cms/hero-resolver";

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
  scrub_smoothing?: "off" | "low" | "medium" | "high";
  first_frame_hold_pct?: number; // e.g. 0.06 (6%)
  final_frame_hold_pct?: number; // e.g. 0.10 (10%)
  crossfade?: boolean;
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
    scrub_smoothing?: "off" | "low" | "medium" | "high";
    first_frame_hold_pct?: number;
    final_frame_hold_pct?: number;

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

// ── Frame Loading State Machine ───────────────────────────────────────────────
export type FrameLoadState = "UNLOADED" | "LOADING" | "LOADED" | "FAILED";

// Global in-memory decoded image cache to prevent re-fetching across re-renders
const RUNTIME_IMAGE_CACHE = new Map<string, HTMLImageElement>();
const RUNTIME_FAILED_URLS = new Set<string>();
const RUNTIME_IN_FLIGHT = new Map<string, Promise<HTMLImageElement | null>>();
const RUNTIME_FRAME_STATES = new Map<string, FrameLoadState>();

export function resolveMediaUrl(url?: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/${trimmed}`;
}

export function resolveAnimationFrames(
  config: ScrollFrameAnimationProps["config"] | undefined,
  device: "desktop" | "tablet" | "mobile" = "desktop"
): AnimationFrameItem[] {
  if (!config) return [];
  const desktopCfg: DeviceAnimationConfig = config.desktop || {};
  const tabletCfg: DeviceAnimationConfig =
    config.tablet?.use_desktop_fallback !== false && (!config.tablet?.frames || config.tablet.frames.length === 0)
      ? desktopCfg
      : config.tablet || desktopCfg;
  const mobileCfg: DeviceAnimationConfig =
    config.mobile?.use_desktop_fallback !== false && (!config.mobile?.frames || config.mobile.frames.length === 0)
      ? desktopCfg
      : config.mobile || desktopCfg;

  const targetCfg: DeviceAnimationConfig =
    device === "mobile" ? mobileCfg : device === "tablet" ? tabletCfg : desktopCfg;

  const raw = targetCfg.frames && targetCfg.frames.length > 0 ? targetCfg.frames : desktopCfg.frames || [];
  if (!raw || raw.length === 0) return [];
  return [...raw]
    .filter((f) => f && (f.url || f.optimized_url))
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    .slice(0, 24);
}

export function preloadSingleImage(
  url: string,
  frameId?: string,
  onLoaded?: (img: HTMLImageElement) => void
): Promise<HTMLImageElement | null> {
  const resolvedUrl = resolveMediaUrl(url);
  if (!resolvedUrl) return Promise.resolve(null);

  const cacheKey = `${frameId || "frame"}:${resolvedUrl}`;

  // 1. Permanent Failure Guard: If URL or frame previously failed, block repeat network requests
  if (RUNTIME_FAILED_URLS.has(resolvedUrl) || RUNTIME_FRAME_STATES.get(cacheKey) === "FAILED") {
    RUNTIME_FRAME_STATES.set(cacheKey, "FAILED");
    return Promise.resolve(null);
  }

  // 2. Memory Cache Hit: Return already-decoded image instantly
  const cached = RUNTIME_IMAGE_CACHE.get(resolvedUrl);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    RUNTIME_FRAME_STATES.set(cacheKey, "LOADED");
    if (onLoaded) onLoaded(cached);
    return Promise.resolve(cached);
  }

  // 3. In-Flight Deduplication: Re-use active loading promise to prevent concurrent fetches
  if (RUNTIME_IN_FLIGHT.has(resolvedUrl)) {
    return RUNTIME_IN_FLIGHT.get(resolvedUrl)!;
  }

  // 4. State Transition: UNLOADED -> LOADING
  RUNTIME_FRAME_STATES.set(cacheKey, "LOADING");

  const loadPromise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = resolvedUrl;

    img.onload = () => {
      RUNTIME_IN_FLIGHT.delete(resolvedUrl);
      RUNTIME_IMAGE_CACHE.set(resolvedUrl, img);
      RUNTIME_FRAME_STATES.set(cacheKey, "LOADED");

      if (typeof img.decode === "function") {
        img.decode().then(() => {
          if (onLoaded) onLoaded(img);
          resolve(img);
        }).catch(() => {
          if (onLoaded) onLoaded(img);
          resolve(img);
        });
      } else {
        if (onLoaded) onLoaded(img);
        resolve(img);
      }
    };

    img.onerror = () => {
      RUNTIME_IN_FLIGHT.delete(resolvedUrl);
      RUNTIME_FAILED_URLS.add(resolvedUrl);
      RUNTIME_FRAME_STATES.set(cacheKey, "FAILED");
      resolve(null);
    };
  });

  RUNTIME_IN_FLIGHT.set(resolvedUrl, loadPromise);
  return loadPromise;
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
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const introOverlayRef = useRef<HTMLDivElement | null>(null);
  const craftOverlayRef = useRef<HTMLDivElement | null>(null);
  const fleetOverlayRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Active Device state (Detected via MatchMedia on client or forced via isPreview)
  const [currentDevice, setCurrentDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [showDebugHud, setShowDebugHud] = useState(false);

  // High-Frequency mutable animation state (zero React state on scroll ticks)
  const targetProgressRef = useRef<number>(0);
  const displayedProgressRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);
  const lastDrawnFrameRef = useRef<number>(-1);
  const lastRenderedImgRef = useRef<HTMLImageElement | null>(null);
  const bufferDimsRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });
  const rafIdRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef<boolean>(false);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── 1. Device Resolution & Debug HUD Toggle ───────────────────────────────
  useEffect(() => {
    if (previewDevice) {
      setCurrentDevice(previewDevice);
      return;
    }
    if (typeof window === "undefined") return;

    // Check if ?debug_scroll=true is present in URL
    if (window.location.search.includes("debug_scroll=1") || window.location.search.includes("debug_scroll=true")) {
      setShowDebugHud(true);
    }

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

  // ── 2. Active Config Computation via Single Source of Truth ───────────────
  const desktopCfg: DeviceAnimationConfig = config.desktop || {};
  const tabletCfg: DeviceAnimationConfig = config.tablet?.use_desktop_fallback !== false && (!config.tablet?.frames || config.tablet.frames.length === 0)
    ? desktopCfg
    : config.tablet || desktopCfg;
  const mobileCfg: DeviceAnimationConfig = config.mobile?.use_desktop_fallback !== false && (!config.mobile?.frames || config.mobile.frames.length === 0)
    ? desktopCfg
    : config.mobile || desktopCfg;

  const activeDeviceConfig: DeviceAnimationConfig =
    currentDevice === "mobile" ? mobileCfg : currentDevice === "tablet" ? tabletCfg : desktopCfg;

  // Authoritative frames extraction
  const frames: AnimationFrameItem[] = React.useMemo(() => {
    return resolveAnimationFrames(config, currentDevice);
  }, [config, currentDevice]);

  const totalFrames = frames.length;

  // Stale cache invalidation when frame set identity changes
  const frameUrlsKey = React.useMemo(() => {
    return frames.map((f) => f.url || f.optimized_url).join("|");
  }, [frames]);

  useEffect(() => {
    if (lastRenderedImgRef.current && frames.length > 0) {
      const isStillInFrames = frames.some(
        (f) => resolveMediaUrl(f.optimized_url || f.url) === lastRenderedImgRef.current?.src
      );
      if (!isStillInFrames) {
        lastRenderedImgRef.current = null;
        lastDrawnFrameRef.current = -1;
      }
    }
  }, [frameUrlsKey, frames]);

  // Lifecycle logging
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[MOUNT] ScrollFrameHero (${sectionId}) | device: ${currentDevice} | frames: ${totalFrames}`);
    }
    return () => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[UNMOUNT] ScrollFrameHero (${sectionId})`);
      }
    };
  }, [sectionId, currentDevice, totalFrames]);

  // Animation is enabled whenever sequence is not explicitly disabled and valid frames exist
  const isAnimationEnabled =
    config.disable_scroll_sequence !== true &&
    activeDeviceConfig.enabled !== false &&
    totalFrames > 0;

  const animationType = activeDeviceConfig.animation_type || (totalFrames > 0 ? "scroll_frame" : "none");
  const isScrub = activeDeviceConfig.scrub !== false;
  const scrollLengthVh = activeDeviceConfig.scroll_length_vh ?? (currentDevice === "mobile" ? 240 : activeDeviceConfig.speed === "slow" ? 350 : activeDeviceConfig.speed === "fast" ? 200 : 280);

  // Cinematic scrub smoothing factor
  const smoothingPreset = activeDeviceConfig.scrub_smoothing || config.scrub_smoothing || (activeDeviceConfig.smoothing !== false ? "medium" : "off");
  const smoothingFactor =
    smoothingPreset === "off"
      ? 1.0
      : smoothingPreset === "low"
      ? 0.35
      : smoothingPreset === "high"
      ? 0.08
      : 0.16; // "medium" default

  // First Frame Hold & Final Frame Hold
  const firstFrameHold = activeDeviceConfig.first_frame_hold_pct ?? config.first_frame_hold_pct ?? 0.06; // 6% hold
  const finalFrameHold = activeDeviceConfig.final_frame_hold_pct ?? config.final_frame_hold_pct ?? 0.10; // 10% hold

  // Canonical Hero Banner Content Resolution (Single Source of Truth)
  const resolvedHero = useMemo(() => {
    return resolveHeroBannerConfig(config, currentDevice);
  }, [config, currentDevice]);

  const headline = resolvedHero.headline;
  const subheadline = resolvedHero.subheadline;
  const badgeText = resolvedHero.badgeText;
  const badgeBg = resolvedHero.badgeBg;
  const badgeColor = resolvedHero.badgeColor;

  const primaryCtaVisible = resolvedHero.primaryCtaVisible;
  const primaryCtaText = resolvedHero.primaryCtaText;
  const primaryCtaUrl = resolvedHero.primaryCtaUrl;
  const primaryCtaBg = resolvedHero.primaryCtaBg;
  const primaryCtaColor = resolvedHero.primaryCtaColor;

  const secondaryCtaVisible = resolvedHero.secondaryCtaVisible;
  const secondaryCtaText = resolvedHero.secondaryCtaText;
  const secondaryCtaUrl = resolvedHero.secondaryCtaUrl;
  const secondaryCtaBg = resolvedHero.secondaryCtaBg;
  const secondaryCtaColor = resolvedHero.secondaryCtaColor;

  const craftBadge = resolvedHero.craftBadge;
  const craftHeading = resolvedHero.craftHeading;
  const craftText = resolvedHero.craftText;

  const fleetBadge = resolvedHero.fleetBadge;
  const fleetHeading = resolvedHero.fleetHeading;
  const fleetText = resolvedHero.fleetText;
  const fleetCtaText = resolvedHero.fleetCtaText;
  const fleetCtaUrl = resolvedHero.fleetCtaUrl;

  const posterImage = resolveMediaUrl(activeDeviceConfig.poster_image || config.poster_image || resolvedHero.activeImage);

  // Helper to extract cached decoded image or nearest loaded frame
  const getLoadedFrameImage = useCallback((frame: AnimationFrameItem): HTMLImageElement | null => {
    const url = resolveMediaUrl(frame.optimized_url || frame.url);
    const img = RUNTIME_IMAGE_CACHE.get(url);
    if (img && img.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }, []);

  // Expose Dev-Only Canonical Debug Global
  const updateDebugGlobal = useCallback((renderedIdx: number, renderedImg: HTMLImageElement | null) => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "production") return;
    const targetIdx = Math.max(0, Math.min(frames.length - 1, Math.floor(displayedProgressRef.current * (frames.length - 1))));
    const targetFrame = frames[targetIdx];
    const renderedFrame = renderedIdx >= 0 && renderedIdx < frames.length ? frames[renderedIdx] : targetFrame;

    (window as any).__CAKETOHOME_HERO_DEBUG__ = {
      pageId: "cmspg_home",
      sectionId,
      sectionType: "hero",
      animationType,
      device: currentDevice,
      source: resolvedHero.source,
      headline: resolvedHero.headline,
      subheadline: resolvedHero.subheadline,
      badge: resolvedHero.badgeText,
      primaryCtaText: resolvedHero.primaryCtaText,
      primaryCtaUrl: resolvedHero.primaryCtaUrl,
      secondaryCtaText: resolvedHero.secondaryCtaText,
      secondaryCtaUrl: resolvedHero.secondaryCtaUrl,
      imageUrl: resolvedHero.activeImage,
      frameCount: totalFrames,
      currentFrameId: targetFrame?.id || null,
      currentFrameUrl: targetFrame ? resolveMediaUrl(targetFrame.optimized_url || targetFrame.url) : null,
      renderedFrameId: renderedFrame?.id || null,
      renderedFrameUrl: renderedImg?.src || (renderedFrame ? resolveMediaUrl(renderedFrame.optimized_url || renderedFrame.url) : null),
      posterUrl: posterImage,
      fallbackUrl: undefined,
      frameUrls: frames.map((f) => resolveMediaUrl(f.optimized_url || f.url)),
      progress: displayedProgressRef.current,
      smoothing: smoothingPreset,
    };
  }, [sectionId, animationType, currentDevice, totalFrames, frames, posterImage, smoothingPreset, resolvedHero]);

  // Ensure dev debug global is populated on mount and config changes
  useEffect(() => {
    updateDebugGlobal(0, null);
  }, [updateDebugGlobal]);


  // ── 3. High-Performance Canvas Draw Routine (Full-Cover + Sub-Frame Crossfade) ──
  const drawCanvasFrame = useCallback(
    (fractionalIndex: number) => {
      const canvas = canvasRef.current;
      if (!canvas || frames.length === 0) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      const clamped = Math.max(0, Math.min(frames.length - 1, fractionalIndex));
      const baseIndex = Math.floor(clamped);
      const nextIndex = Math.min(frames.length - 1, baseIndex + 1);
      const blendFactor = clamped - baseIndex;

      const baseFrame = frames[baseIndex];
      const nextFrame = frames[nextIndex];
      if (!baseFrame) return;

      let baseImg = getLoadedFrameImage(baseFrame);
      const nextImg = nextFrame ? getLoadedFrameImage(nextFrame) : null;

      // If target base frame not yet ready, search nearest loaded frame in cache
      if (!baseImg) {
        const loadedFrames = frames.filter((f) => {
          const u = resolveMediaUrl(f.optimized_url || f.url);
          const item = RUNTIME_IMAGE_CACHE.get(u);
          return item && item.complete && item.naturalWidth > 0;
        });
        if (loadedFrames.length > 0) {
          loadedFrames.sort((a, b) => Math.abs(a.sequence - baseFrame.sequence) - Math.abs(b.sequence - baseFrame.sequence));
          baseImg = RUNTIME_IMAGE_CACHE.get(resolveMediaUrl(loadedFrames[0].optimized_url || loadedFrames[0].url)) || null;
        }
      }

      const activeBase = baseImg || lastRenderedImgRef.current;
      const containerWidth = canvas.clientWidth || window.innerWidth;
      const containerHeight = canvas.clientHeight || window.innerHeight;

      if (containerWidth === 0 || containerHeight === 0) return;

      // Draw Main Frame Image
      if (activeBase && activeBase.complete && activeBase.naturalWidth > 0) {
        lastRenderedImgRef.current = activeBase;
        lastDrawnFrameRef.current = baseIndex;

        const scale = Math.max(containerWidth / activeBase.naturalWidth, containerHeight / activeBase.naturalHeight);
        const drawW = activeBase.naturalWidth * scale;
        const drawH = activeBase.naturalHeight * scale;
        const offX = (containerWidth - drawW) / 2;
        const offY = (containerHeight - drawH) / 2;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.globalAlpha = 1.0;
        ctx.drawImage(activeBase, offX, offY, drawW, drawH);

        // Smooth Sub-frame Alpha Blending (Eliminates discrete frame jumping)
        if (
          blendFactor > 0.005 &&
          nextImg &&
          nextImg.complete &&
          nextImg.naturalWidth > 0 &&
          nextIndex !== baseIndex
        ) {
          const nextScale = Math.max(containerWidth / nextImg.naturalWidth, containerHeight / nextImg.naturalHeight);
          const nextDrawW = nextImg.naturalWidth * nextScale;
          const nextDrawH = nextImg.naturalHeight * nextScale;
          const nextOffX = (containerWidth - nextDrawW) / 2;
          const nextOffY = (containerHeight - nextDrawH) / 2;

          ctx.globalAlpha = blendFactor;
          ctx.drawImage(nextImg, nextOffX, nextOffY, nextDrawW, nextDrawH);
        }

        ctx.restore();
        updateDebugGlobal(baseIndex, activeBase);
      } else {
        // High-contrast procedural base fallback (ONLY on initial boot before any image decoded)
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, containerWidth, containerHeight);
        const hue = (baseIndex * 24 + 340) % 360;
        grad.addColorStop(0, `hsl(${hue}, 50%, 14%)`);
        grad.addColorStop(0.5, `hsl(${(hue + 30) % 360}, 60%, 8%)`);
        grad.addColorStop(1, `hsl(${hue}, 45%, 5%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, containerWidth, containerHeight);
        ctx.restore();
        updateDebugGlobal(baseIndex, null);
      }
    },
    [frames, getLoadedFrameImage, updateDebugGlobal]
  );

  // ── 4. Progressive Preloading & Pre-decoding ──────────────────────────────
  useEffect(() => {
    if (frames.length === 0) return;

    // 1. Immediately preload and decode frame 0
    const firstFrame = frames[0];
    if (firstFrame) {
      preloadSingleImage(firstFrame.optimized_url || firstFrame.url, firstFrame.id, (img) => {
        lastRenderedImgRef.current = img;
        drawCanvasFrame(0);
        setLoadedCount((c) => c + 1);
      });
    }

    // 2. Preload and decode remaining frames
    frames.slice(1).forEach((frame, idx) => {
      preloadSingleImage(frame.optimized_url || frame.url, frame.id, (img) => {
        setLoadedCount((c) => c + 1);
        const currentTarget = Math.round(displayedProgressRef.current * (frames.length - 1));
        if (currentTarget === idx + 1) {
          drawCanvasFrame(displayedProgressRef.current * (frames.length - 1));
        }
      });
    });
  }, [frames, drawCanvasFrame]);

  // ── 4b. ResizeObserver (Buffers resolution without draw-time resizing flashes) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasBufferSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const containerWidth = canvas.clientWidth || window.innerWidth;
      const containerHeight = canvas.clientHeight || window.innerHeight;
      if (containerWidth === 0 || containerHeight === 0) return;

      const bufferW = Math.floor(containerWidth * dpr);
      const bufferH = Math.floor(containerHeight * dpr);

      if (canvas.width !== bufferW || canvas.height !== bufferH) {
        canvas.width = bufferW;
        canvas.height = bufferH;
        bufferDimsRef.current = { w: bufferW, h: bufferH, dpr };
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
      const currentFractional = displayedProgressRef.current * (frames.length > 1 ? frames.length - 1 : 0);
      drawCanvasFrame(currentFractional);
    };

    updateCanvasBufferSize();
    const resizeObserver = new ResizeObserver(() => updateCanvasBufferSize());
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [frames, drawCanvasFrame]);

  // ── 5. Overlay Interpolation (Intro -> Craft Story -> Fleet Guarantee) ───
  const updateOverlays = useCallback((progress: number) => {
    // Phase 1 (Intro): 0.00 -> 0.25 (Maintains full visibility during first frame hold)
    if (introOverlayRef.current) {
      let opacity = 0;
      let translateY = 0;
      if (progress <= 0.08) {
        opacity = 1;
        translateY = 0;
      } else if (progress < 0.25) {
        const t = (progress - 0.08) / 0.17;
        opacity = Math.max(0, 1 - t);
        translateY = -50 * t;
      }
      introOverlayRef.current.style.opacity = opacity.toFixed(3);
      introOverlayRef.current.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
      introOverlayRef.current.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
    }

    // Phase 2 (Craft Story): 0.28 -> 0.64
    if (craftOverlayRef.current) {
      let opacity = 0;
      let translateY = 20;
      if (progress >= 0.26 && progress <= 0.38) {
        const t = (progress - 0.26) / 0.12;
        opacity = t;
        translateY = 20 * (1 - t);
      } else if (progress > 0.38 && progress < 0.54) {
        opacity = 1;
        translateY = 0;
      } else if (progress >= 0.54 && progress <= 0.66) {
        const t = (progress - 0.54) / 0.12;
        opacity = Math.max(0, 1 - t);
        translateY = -20 * t;
      }
      craftOverlayRef.current.style.opacity = opacity.toFixed(3);
      craftOverlayRef.current.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
      craftOverlayRef.current.style.pointerEvents = opacity > 0.4 ? "auto" : "none";
    }

    // Phase 3 (Fleet Guarantee): 0.68 -> 1.00 (Held steadily during final frame hold)
    if (fleetOverlayRef.current) {
      let opacity = 0;
      let translateY = 20;
      if (progress >= 0.68 && progress <= 0.82) {
        const t = (progress - 0.68) / 0.14;
        opacity = t;
        translateY = 20 * (1 - t);
      } else if (progress > 0.82) {
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

  // ── 6. Continuous RAF Scrub Engine ─────────────────────────────────────────
  const startRafLoop = useCallback(() => {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    const loop = () => {
      const diff = targetProgressRef.current - displayedProgressRef.current;

      if (Math.abs(diff) > 0.0001) {
        displayedProgressRef.current += diff * smoothingFactor;
        const fractionalFrame = displayedProgressRef.current * (totalFrames - 1);
        drawCanvasFrame(fractionalFrame);
        updateOverlays(displayedProgressRef.current);
      } else if (displayedProgressRef.current !== targetProgressRef.current) {
        displayedProgressRef.current = targetProgressRef.current;
        const fractionalFrame = displayedProgressRef.current * (totalFrames - 1);
        drawCanvasFrame(fractionalFrame);
        updateOverlays(displayedProgressRef.current);
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [drawCanvasFrame, smoothingFactor, totalFrames, updateOverlays]);

  // ── 7. Scroll Listener with Hold Mapping & Continuous Scrub ───────────────
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
      const viewportHeight = window.innerHeight;
      const totalScrollable = rect.height - viewportHeight;

      if (totalScrollable <= 0) return;

      const currentScroll = -rect.top;
      const rawProgress = Math.max(0, Math.min(1, currentScroll / totalScrollable));

      currentProgressRef.current = rawProgress;

      // Normalize animation progress with First Frame Hold and Final Frame Hold
      let effectiveProgress = 0;
      if (rawProgress <= firstFrameHold) {
        effectiveProgress = 0;
      } else if (rawProgress >= 1.0 - finalFrameHold) {
        effectiveProgress = 1.0;
      } else {
        effectiveProgress = (rawProgress - firstFrameHold) / (1.0 - firstFrameHold - finalFrameHold);
      }

      if (isScrub) {
        targetProgressRef.current = effectiveProgress;
        if (smoothingPreset === "off") {
          displayedProgressRef.current = effectiveProgress;
          drawCanvasFrame(effectiveProgress * (totalFrames - 1));
          updateOverlays(effectiveProgress);
        }
      }
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
  }, [isAnimationEnabled, totalFrames, isScrub, smoothingPreset, firstFrameHold, finalFrameHold, startRafLoop, drawCanvasFrame, updateOverlays]);

  // ── 8. Autoplay Mode (Optional trigger) ───────────────────────────────────
  useEffect(() => {
    if (!isAnimationEnabled || animationType !== "autoplay" || totalFrames <= 1) return;

    const intervalMs = 1000 / (activeDeviceConfig.fps || 12);
    autoplayTimerRef.current = setInterval(() => {
      targetProgressRef.current = (targetProgressRef.current + 1 / (totalFrames - 1)) % 1.0;
      drawCanvasFrame(targetProgressRef.current * (totalFrames - 1));
    }, intervalMs);

    return () => {
      if (autoplayTimerRef.current) clearInterval(autoplayTimerRef.current);
    };
  }, [isAnimationEnabled, animationType, totalFrames, activeDeviceConfig.fps, drawCanvasFrame]);

  // ── 9. Static Fallback Mode (When animation disabled or zero frames) ─────
  if (!isAnimationEnabled || totalFrames === 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[ScrollFrameHero] Rendering static fallback for section ${sectionId}. isAnimationEnabled: ${isAnimationEnabled}, totalFrames: ${totalFrames}`
      );
    }
    return (
      <section
        id={sectionId}
        ref={sectionRef}
        className="relative w-full overflow-hidden border-b border-ui-border-base min-h-[420px] sm:min-h-[500px] flex items-center justify-center text-white"
        data-cms-renderer="scroll-frame-hero-static-fallback"
        data-section-id={sectionId}
        data-cms-section-id={sectionId}
        data-section-type="hero"
        data-cms-section-type="hero"
        data-cms-headline={headline}
        data-cms-badge={badgeText}
        data-cms-primary-cta={primaryCtaText}
        data-cms-secondary-cta={secondaryCtaText}
        data-animation-mode="static"
        data-frame-count={totalFrames}
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

  // ── 10. Dynamic Scroll-Frame Full-Cover Sticky Section ────────────────────
  return (
    <section
      id={sectionId}
      ref={sectionRef}
      className="scroll-frame-section relative w-full overflow-visible"
      data-cms-renderer="scroll-frame-hero"
      data-section-id={sectionId}
      data-cms-section-id={sectionId}
      data-section-type="hero"
      data-cms-section-type="hero"
      data-cms-headline={headline}
      data-cms-badge={badgeText}
      data-cms-primary-cta={primaryCtaText}
      data-cms-secondary-cta={secondaryCtaText}
      data-animation-mode={animationType}
      data-frame-count={totalFrames}
      style={{ height: `${scrollLengthVh}vh` }}
    >
      <div
        ref={stickyRef}
        className="scroll-frame-sticky sticky top-0 h-screen sm:h-[100svh] w-full overflow-hidden bg-stone-950 flex items-center justify-center select-none"
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

        {/* Dev-Only Debug HUD (Visible via ?debug_scroll=1 or in dev) */}
        {showDebugHud && (
          <div className="fixed bottom-4 right-4 z-50 p-3.5 rounded-2xl bg-stone-950/90 backdrop-blur-md border border-white/20 text-white font-mono text-[11px] shadow-2xl flex flex-col gap-1.5 pointer-events-none select-none max-w-xs">
            <div className="font-bold text-rose-400 flex items-center justify-between">
              <span>🎬 Kitchen Story HUD</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded font-bold">{currentDevice}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-stone-300 mt-1">
              <span>Frames:</span>
              <span className="text-white font-bold">{totalFrames} ({loadedCount} loaded)</span>
              <span>Raw Scroll:</span>
              <span className="text-white">{(currentProgressRef.current * 100).toFixed(1)}%</span>
              <span>Target Prog:</span>
              <span className="text-white">{(targetProgressRef.current * 100).toFixed(1)}%</span>
              <span>Disp Prog:</span>
              <span className="text-white">{(displayedProgressRef.current * 100).toFixed(1)}%</span>
              <span>Disp Frame:</span>
              <span className="text-rose-300 font-bold">{(displayedProgressRef.current * (totalFrames - 1)).toFixed(2)}</span>
              <span>Hold (In/Out):</span>
              <span className="text-white">{(firstFrameHold * 100).toFixed(0)}% / {(finalFrameHold * 100).toFixed(0)}%</span>
              <span>Smoothing:</span>
              <span className="text-emerald-400 font-bold">{smoothingPreset}</span>
              <span>Track Height:</span>
              <span className="text-white">{scrollLengthVh}vh</span>
            </div>
          </div>
        )}

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
