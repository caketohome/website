"use client";

import React, { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Heading, Text, Badge, Button } from "@medusajs/ui";
import { Sparkles, Clock, ShieldCheck, ArrowRight } from "lucide-react";

export interface ScrollFrameHeroProps {
  headline?: string;
  subheadline?: string;
  badgeText?: string;
}

export const FRAME_CONFIG = {
  totalFrames: 22,
  firstFrame: 1,
  lastFrame: 22,
  scrollLengthVh: 280, // Extended scroll length for smooth ~25% slower cinematic playback
  nativeWidth: 1920,
  nativeHeight: 1080,
  easing: 0.14, // Moderately smoother & slower interpolation (approx 25-30% slower than 0.20)
};

/**
 * Resolves Cloudinary frame URL for frames1_0001.jpg through frames1_0022.jpg
 */
export function getFrameUrl(frameNumber: number, isMobile = false): string {
  const clamped = Math.max(1, Math.min(FRAME_CONFIG.totalFrames, Math.round(frameNumber)));
  const padded = String(clamped).padStart(4, "0");
  const transform = isMobile ? "f_auto,q_auto,w_800" : "f_auto,q_auto";
  return `https://res.cloudinary.com/r0k56n3j/image/upload/${transform}/frames1_${padded}.jpg`;
}

// Module-level singleton frame cache & in-flight tracker
// Guarantees zero duplicate network requests across React re-mounts, StrictMode, or navigation
const GLOBAL_FRAME_CACHE = new Map<number, HTMLImageElement>();
const IN_FLIGHT_REQUESTS = new Set<number>();

function loadSingleFrame(
  frameIdx: number,
  isMobile: boolean,
  onLoaded?: (frameIdx: number, imgElem: HTMLImageElement) => void
) {
  const clamped = Math.max(1, Math.min(FRAME_CONFIG.totalFrames, Math.round(frameIdx)));

  // If already cached in memory, notify immediately
  const existing = GLOBAL_FRAME_CACHE.get(clamped);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    if (onLoaded) onLoaded(clamped, existing);
    return;
  }

  // If request is already in-flight, avoid duplicate instantiation
  if (IN_FLIGHT_REQUESTS.has(clamped)) {
    return;
  }

  IN_FLIGHT_REQUESTS.add(clamped);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = getFrameUrl(clamped, isMobile);

  img.onload = () => {
    IN_FLIGHT_REQUESTS.delete(clamped);
    GLOBAL_FRAME_CACHE.set(clamped, img);
    if (onLoaded) onLoaded(clamped, img);
  };

  img.onerror = () => {
    IN_FLIGHT_REQUESTS.delete(clamped);
  };
}

export function ScrollFrameHero({
  headline = "Handcrafted Gourmet Cakes Delivered in 2 Hours",
  subheadline = "Fresh, artisanal birthday & wedding cakes across Bangalore. Midnight delivery available!",
  badgeText = "100% Fresh & Artisanal • Express 2-Hour Delivery",
}: ScrollFrameHeroProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const introOverlayRef = useRef<HTMLDivElement | null>(null);
  const craftOverlayRef = useRef<HTMLDivElement | null>(null);
  const fleetOverlayRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Mutable High-Frequency State (Zero React state on scroll ticks)
  const currentFrameRef = useRef<number>(1);
  const targetFrameRef = useRef<number>(1);
  const lastDrawnFrameRef = useRef<number>(-1);
  const scrollProgressRef = useRef<number>(0);
  const isMobileRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef<boolean>(false);

  // ── 1. Direct Canvas Draw (Cover Math + Zero Distortion) ─────────────────
  const drawFrame = useCallback((frameNumber: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clamped = Math.max(1, Math.min(FRAME_CONFIG.totalFrames, Math.round(frameNumber)));
    let img = GLOBAL_FRAME_CACHE.get(clamped);

    // Fallback: If target frame not loaded yet, find closest available loaded frame
    if (!img || !img.complete || img.naturalWidth === 0) {
      const loadedKeys = Array.from(GLOBAL_FRAME_CACHE.keys()).filter((k) => {
        const item = GLOBAL_FRAME_CACHE.get(k);
        return item && item.complete && item.naturalWidth > 0;
      });
      if (loadedKeys.length > 0) {
        loadedKeys.sort((a, b) => Math.abs(a - clamped) - Math.abs(b - clamped));
        img = GLOBAL_FRAME_CACHE.get(loadedKeys[0]);
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const iw = img.naturalWidth || FRAME_CONFIG.nativeWidth;
    const ih = img.naturalHeight || FRAME_CONFIG.nativeHeight;

    // Cover math (preserve aspect ratio, zero stretch)
    const scale = Math.max(cw / iw, ch / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    const nx = (cw - nw) / 2;
    const ny = (ch - nh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, nx, ny, nw, nh);
    lastDrawnFrameRef.current = clamped;
  }, []);

  // ── 2. Resize Canvas Buffer (High-DPI DPR capped at 2) ───────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(100, Math.round((rect.width || (typeof window !== "undefined" ? window.innerWidth : 1920)) * dpr));
    const h = Math.max(100, Math.round((rect.height || (typeof window !== "undefined" ? window.innerHeight : 1080)) * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      lastDrawnFrameRef.current = -1; // Reset so frame re-paints onto resized buffer
    }

    if (typeof window !== "undefined") {
      isMobileRef.current = window.innerWidth < 768;
    }

    drawFrame(Math.round(currentFrameRef.current));
  }, [drawFrame]);

  // ── 3. Optimized RAF Single Render Loop ──────────────────────────────────
  const updateOverlays = useCallback((p: number) => {
    // Update Progress Bar
    if (progressBarRef.current) {
      progressBarRef.current.style.transform = `scaleX(${p})`;
    }

    // Phase 1: Intro Overlay (0% -> 25%)
    if (introOverlayRef.current) {
      const op = p <= 0.22 ? Math.max(0, 1 - p / 0.20) : 0;
      const ty = p * -60;
      introOverlayRef.current.style.opacity = String(op);
      introOverlayRef.current.style.transform = `translateY(${ty}px)`;
      introOverlayRef.current.style.pointerEvents = op > 0.1 ? "auto" : "none";
    }

    // Phase 2: Craftsmanship Overlay (30% -> 60%)
    if (craftOverlayRef.current) {
      let op = 0;
      if (p >= 0.28 && p <= 0.60) {
        if (p < 0.38) op = (p - 0.28) / 0.10;
        else if (p > 0.50) op = (0.60 - p) / 0.10;
        else op = 1;
      }
      const ty = (p - 0.44) * -40;
      craftOverlayRef.current.style.opacity = String(op);
      craftOverlayRef.current.style.transform = `translateY(${ty}px)`;
      craftOverlayRef.current.style.pointerEvents = op > 0.1 ? "auto" : "none";
    }

    // Phase 3: Delivery Fleet Overlay (65% -> 95%)
    if (fleetOverlayRef.current) {
      let op = 0;
      if (p >= 0.63 && p <= 0.95) {
        if (p < 0.73) op = (p - 0.63) / 0.10;
        else if (p > 0.85) op = (0.95 - p) / 0.10;
        else op = 1;
      }
      const ty = (p - 0.79) * -40;
      fleetOverlayRef.current.style.opacity = String(op);
      fleetOverlayRef.current.style.transform = `translateY(${ty}px)`;
      fleetOverlayRef.current.style.pointerEvents = op > 0.1 ? "auto" : "none";
    }
  }, []);

  const startRenderLoop = useCallback(() => {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    const renderLoop = () => {
      // Smoothly interpolate towards target frame with controlled easing
      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.05) {
        currentFrameRef.current += diff * FRAME_CONFIG.easing;
      } else {
        currentFrameRef.current = target;
      }

      const frameToDraw = Math.max(
        1,
        Math.min(FRAME_CONFIG.totalFrames, Math.round(currentFrameRef.current))
      );

      drawFrame(frameToDraw);

      const p = scrollProgressRef.current;
      updateOverlays(p);

      // Keep running if not settled, or idle when stationary
      if (Math.abs(targetFrameRef.current - currentFrameRef.current) > 0.05) {
        rafIdRef.current = requestAnimationFrame(renderLoop);
      } else {
        isLoopRunningRef.current = false;
      }
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);
  }, [drawFrame, updateOverlays]);

  // ── 4. Initial Frame Load & Controlled 22-Frame Preload Pipeline ─────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    isMobileRef.current = window.innerWidth < 768;

    resizeCanvas();

    const handleFrameLoaded = (frameIdx: number) => {
      const cur = Math.round(currentFrameRef.current);
      if (cur === frameIdx || lastDrawnFrameRef.current === -1) {
        drawFrame(cur);
      }
    };

    // 1. Load Frame 1 immediately (Priority 1)
    loadSingleFrame(1, isMobileRef.current, handleFrameLoaded);

    // 2. Preload remaining frames (2 through 22) in one clean sequential queue
    let timer: NodeJS.Timeout | null = null;
    let nextFrame = 2;

    const loadNextFrame = () => {
      if (nextFrame > FRAME_CONFIG.totalFrames) return;
      loadSingleFrame(nextFrame, isMobileRef.current, handleFrameLoaded);
      nextFrame++;
      if (nextFrame <= FRAME_CONFIG.totalFrames) {
        timer = setTimeout(loadNextFrame, 25);
      }
    };

    timer = setTimeout(loadNextFrame, 40);

    const ro = new ResizeObserver(() => resizeCanvas());
    if (stickyRef.current) {
      ro.observe(stickyRef.current);
    }

    window.addEventListener("resize", resizeCanvas, { passive: true });

    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [drawFrame, resizeCanvas]);

  // ── 5. Scroll Listener (Tied strictly to Section Bounds) ─────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;

      if (totalScrollable <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalScrollable));

      scrollProgressRef.current = progress;
      // Formula: targetFrame = 1 + progress * (22 - 1)
      targetFrameRef.current = 1 + progress * (FRAME_CONFIG.totalFrames - 1);
      currentFrameRef.current = targetFrameRef.current;

      const frameToDraw = Math.max(
        1,
        Math.min(FRAME_CONFIG.totalFrames, Math.round(targetFrameRef.current))
      );
      drawFrame(frameToDraw);
      updateOverlays(progress);

      startRenderLoop();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [drawFrame, updateOverlays, startRenderLoop]);

  return (
    <section
      ref={sectionRef}
      className="scroll-frame-section relative w-full"
      style={{ height: `${FRAME_CONFIG.scrollLengthVh}vh` }}
    >
      <div
        ref={stickyRef}
        className="scroll-frame-sticky sticky top-0 h-screen w-full overflow-hidden bg-stone-950"
      >
        <canvas
          ref={canvasRef}
          className="scroll-frame-canvas absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

        {/* Subtle cinematic gradient overlay for readability without obscuring cake artwork */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />

        {/* Phase 1 Overlay (0% - 25%) */}
        <div
          ref={introOverlayRef}
          className="hero-overlay-intro absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10"
        >
          <div className="max-w-3xl flex flex-col items-center gap-4">
            <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-md rounded-full">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-rose-400 inline" />
              {badgeText}
            </Badge>
            <Heading level="h1" className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
              {headline}
            </Heading>
            <Text className="text-sm sm:text-base md:text-lg text-stone-200/90 max-w-2xl">
              {subheadline}
            </Text>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <Link href="/products">
                <Button size="large" className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg">
                  Explore Cakes <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/products?occasion=birthday">
                <Button variant="secondary" size="large" className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 px-6 py-3 rounded-xl">
                  Birthday Specials
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Phase 2 Overlay (30% - 60%) */}
        <div
          ref={craftOverlayRef}
          className="hero-overlay-craft absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10 opacity-0 pointer-events-none"
        >
          <div className="max-w-2xl flex flex-col items-center gap-3">
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-md rounded-full">
              <Clock className="w-3.5 h-3.5 mr-1.5 inline" />
              Master Chocolatier Recipe
            </Badge>
            <Heading level="h2" className="text-2xl sm:text-4xl font-extrabold text-white">
              Every Layer, A Symphony of Flavor
            </Heading>
            <Text className="text-sm sm:text-base text-stone-200/90">
              Crafted with Belgian cocoa, Madagascan vanilla, and fresh dairy cream. Baked to order within minutes of your celebration.
            </Text>
          </div>
        </div>

        {/* Phase 3 Overlay (65% - 95%) */}
        <div
          ref={fleetOverlayRef}
          className="hero-overlay-fleet absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10 opacity-0 pointer-events-none"
        >
          <div className="max-w-2xl flex flex-col items-center gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-md rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline" />
              Climate-Controlled Transit
            </Badge>
            <Heading level="h2" className="text-2xl sm:text-4xl font-extrabold text-white">
              Pristine & Chilled To Your Table
            </Heading>
            <Text className="text-sm sm:text-base text-stone-200/90">
              Specially engineered shock-absorbent cake domes guarantee zero damage during transit across Bangalore.
            </Text>
            <Link href="/products" className="mt-2">
              <Button size="large" className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg">
                Order for Today <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
          <div
            ref={progressBarRef}
            className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-rose-400 origin-left scale-x-0"
          />
        </div>
      </div>
    </section>
  );
}
