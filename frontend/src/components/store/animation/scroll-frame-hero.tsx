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
  totalFrames: 112,
  firstFrame: 1,
  lastFrame: 112,
  scrollLengthVh: 420,
  nativeWidth: 1920,
  nativeHeight: 1080,
  easing: 0.18,
};

export function getFrameUrl(frameNumber: number, isMobile = false): string {
  const clamped = Math.max(1, Math.min(FRAME_CONFIG.totalFrames, Math.round(frameNumber)));
  const padded = String(clamped).padStart(4, "0");
  const transform = isMobile ? "f_auto,q_auto,w_800" : "f_auto,q_auto";
  return `https://res.cloudinary.com/r0k56n3j/image/upload/${transform}/v1786881616/frames1_${padded}.jpg`;
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

  // Mutable state (Zero React state on scroll)
  const currentFrameRef = useRef<number>(1);
  const targetFrameRef = useRef<number>(1);
  const lastDrawnImageIndexRef = useRef<number>(-1);
  const scrollProgressRef = useRef<number>(0);
  const loadedFramesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const isMobileRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  // ── 1. Direct Canvas Draw ──────────────────────────────────────────────────
  const drawFrame = useCallback((frameNumber: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clamped = Math.max(1, Math.min(FRAME_CONFIG.totalFrames, Math.round(frameNumber)));
    let img = loadedFramesRef.current.get(clamped);

    // If target frame not loaded yet, find closest available frame for smooth transition
    let isFallback = false;
    if (!img) {
      isFallback = true;
      const keys = Array.from(loadedFramesRef.current.keys());
      if (keys.length > 0) {
        keys.sort((a, b) => Math.abs(a - clamped) - Math.abs(b - clamped));
        img = loadedFramesRef.current.get(keys[0]);
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || FRAME_CONFIG.nativeWidth;
    const ih = img.naturalHeight || FRAME_CONFIG.nativeHeight;

    // Cover math (zero distortion)
    const scale = Math.max(cw / iw, ch / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    const nx = (cw - nw) / 2;
    const ny = (ch - nh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, nx, ny, nw, nh);

    if (!isFallback) {
      lastDrawnImageIndexRef.current = clamped;
    }
  }, []);

  // ── 2. Resize Canvas Buffer ────────────────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    isMobileRef.current = window.innerWidth < 768;
    drawFrame(Math.round(currentFrameRef.current));
  }, [drawFrame]);

  // ── 3. Full Frame Preloader ────────────────────────────────────────────────
  useEffect(() => {
    isMobileRef.current = window.innerWidth < 768;

    // Load Frame 1 immediately
    const img1 = new Image();
    img1.crossOrigin = "anonymous";
    img1.src = getFrameUrl(1, isMobileRef.current);
    img1.onload = () => {
      loadedFramesRef.current.set(1, img1);
      drawFrame(1);
    };

    // Preload all 112 frames
    for (let f = 1; f <= FRAME_CONFIG.totalFrames; f++) {
      if (f === 1) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = getFrameUrl(f, isMobileRef.current);
      img.onload = () => {
        loadedFramesRef.current.set(f, img);
        const cur = Math.round(currentFrameRef.current);
        if (cur === f || lastDrawnImageIndexRef.current !== cur) {
          drawFrame(cur);
        }
      };
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });

    // Expose dev debugging functions on window
    (window as any).__cakeToHomeDebug = {
      drawFrame,
      setFrame: (frame: number) => {
        targetFrameRef.current = frame;
        currentFrameRef.current = frame;
        drawFrame(frame);
      },
      getCurrentFrame: () => currentFrameRef.current,
      getTargetFrame: () => targetFrameRef.current,
      getLoadedCount: () => loadedFramesRef.current.size,
      hasFrame: (f: number) => loadedFramesRef.current.has(f),
    };

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      delete (window as any).__cakeToHomeDebug;
    };
  }, [drawFrame, resizeCanvas]);

  // ── 4. Scroll Listener ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;

      if (totalScrollable <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalScrollable));

      scrollProgressRef.current = progress;
      targetFrameRef.current = 1 + progress * (FRAME_CONFIG.totalFrames - 1);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── 5. RAF Single Render Loop ──────────────────────────────────────────────
  useEffect(() => {
    let lastRenderedFrame = -1;

    const renderLoop = () => {
      // Smoothly interpolate towards target frame
      const diff = targetFrameRef.current - currentFrameRef.current;
      if (Math.abs(diff) > 0.001) {
        currentFrameRef.current += diff * FRAME_CONFIG.easing;
      } else {
        currentFrameRef.current = targetFrameRef.current;
      }

      const frameToDraw = Math.max(
        1,
        Math.min(FRAME_CONFIG.totalFrames, Math.round(currentFrameRef.current))
      );

      if (
        frameToDraw !== lastRenderedFrame ||
        lastDrawnImageIndexRef.current !== frameToDraw
      ) {
        drawFrame(frameToDraw);
        lastRenderedFrame = frameToDraw;
      }

      const p = scrollProgressRef.current;

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

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [drawFrame]);

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

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/60 pointer-events-none" />

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
