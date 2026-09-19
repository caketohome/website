"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Heading, Text, Badge, Button, Input } from "@medusajs/ui";
import {
  Sparkles, Search, ArrowRight, Clock, ShieldCheck,
  ChevronDown, Heart, Award, CheckCircle2, Cake, Layers, Truck
} from "lucide-react";
import { FrameCache } from "./frame-cache";
import { ScrollSequenceCanvas } from "./scroll-sequence-canvas";
import {
  ScrollSequenceConfig,
  DEFAULT_SCROLL_SEQUENCE_CONFIG,
  resolveFrameUrl,
} from "./scroll-sequence-config";

export interface ScrollSequenceSectionProps {
  config?: Partial<ScrollSequenceConfig>;
  headline?: string;
  subheadline?: string;
  badgeText?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function ScrollSequenceSection({
  config: userConfig,
  headline = "Freshly Baked Happiness",
  subheadline = "Handcrafted artisanal cakes baked fresh daily across Bangalore with 2-hour express delivery.",
  badgeText = "100% Fresh & Artisanal • Express 2-Hour Delivery",
  onSearch,
  className = "",
}: ScrollSequenceSectionProps) {
  const mergedConfig = useMemo(
    () => ({ ...DEFAULT_SCROLL_SEQUENCE_CONFIG, ...userConfig }),
    [userConfig]
  );

  const sectionRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const [isInitialReady, setIsInitialReady] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create isolated FrameCache instance
  const frameCache = useMemo(
    () => new FrameCache(mergedConfig, isMobile),
    [mergedConfig, isMobile]
  );

  // Initialize and check environment capabilities
  useEffect(() => {
    // 1. Check Reduced Motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mediaQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleMotionChange);

    // 2. Check mobile viewport
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      frameCache.setMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile, { passive: true });

    // 3. Preload initial frame batch
    frameCache.preloadInitial().then(() => {
      setIsInitialReady(true);
      // Kick off background progressive preload
      frameCache.preloadAll();
    });

    return () => {
      mediaQuery.removeEventListener("change", handleMotionChange);
      window.removeEventListener("resize", checkMobile);
      frameCache.destroy();
    };
  }, [frameCache]);

  // Scroll listener computing normalized section progress (0 to 1)
  useEffect(() => {
    if (isReducedMotion) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const section = sectionRef.current;
          if (section) {
            const rect = section.getBoundingClientRect();
            const totalScrollable = rect.height - window.innerHeight;

            if (totalScrollable > 0) {
              const currentOffset = -rect.top;
              const rawProgress = currentOffset / totalScrollable;
              const clamped = Math.min(Math.max(rawProgress, 0), 1);
              setScrollProgress(clamped);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial measure

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isReducedMotion]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(searchQuery);
    else if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  // Phase Opacity Calculations for overlays
  // Phase 1 (0 -> 0.25): Intro headline & Search bar
  const introOpacity = Math.max(0, 1 - scrollProgress / 0.25);
  const introTransform = `translateY(-${Math.min(scrollProgress * 60, 40)}px)`;

  // Phase 2 (0.35 -> 0.75): Craftsmanship Highlight
  const highlight1Opacity = Math.min(
    Math.max((scrollProgress - 0.25) / 0.15, 0),
    Math.max(1 - (scrollProgress - 0.55) / 0.15, 0)
  );

  // Phase 3 (0.65 -> 0.95): Celebration & Delivery Callout
  const highlight2Opacity = Math.min(
    Math.max((scrollProgress - 0.65) / 0.15, 0),
    Math.max(1 - (scrollProgress - 0.90) / 0.10, 0)
  );

  // If user prefers reduced motion, render static high-performance hero
  if (isReducedMotion) {
    return (
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#1D2F5D] text-white p-6 sm:p-10 md:p-16 shadow-2xl">
        <div className="relative z-10 flex flex-col max-w-2xl gap-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-[#D4AF37]/60 w-fit">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{badgeText}</span>
          </div>
          <Heading level="h1" className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            {headline} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-[#D4AF37]/40 to-[#FFF8E7]">
              Delivered To Your Doorstep
            </span>
          </Heading>
          <Text className="text-slate-200 text-sm sm:text-base leading-relaxed">
            {subheadline}
          </Text>
          <div className="flex items-center gap-3 pt-2">
            <Link href="/products">
              <Button size="base" className="bg-[#1D2F5D] hover:bg-[#152347] text-white font-bold">
                Explore Cakes <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className={`relative w-full ${className}`}
      style={{
        height: mergedConfig.sectionHeight, // e.g. 450vh
      }}
      aria-label="Artisanal Cake Showcase"
    >
      {/* Sticky Fullscreen Canvas Viewport */}
      <div className="sticky top-0 h-[100vh] h-[100dvh] w-full overflow-hidden bg-[#0d1322] flex items-center justify-center select-none shadow-2xl">
        {/* Canvas Frame Animation */}
        <div className="absolute inset-0 w-full h-full">
          <ScrollSequenceCanvas
            frameCache={frameCache}
            targetProgress={scrollProgress}
            config={mergedConfig}
            onInitialFrameRendered={() => setIsInitialReady(true)}
          />

          {/* Premium Ambient Vignette & Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1322]/90 via-transparent to-[#0d1322]/60 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#0d1322]/40 to-[#0d1322]/90 pointer-events-none" />
        </div>

        {/* ── OVERLAY 1: INTRO HERO CONTENT (0% -> 25%) ───────────────────── */}
        <div
          className="absolute inset-0 z-20 flex flex-col justify-center px-4 sm:px-8 md:px-14 lg:px-20 max-w-7xl mx-auto pointer-events-none transition-all duration-75"
          style={{
            opacity: introOpacity,
            transform: introTransform,
            visibility: introOpacity > 0.01 ? "visible" : "hidden",
          }}
        >
          <div className="max-w-2xl flex flex-col gap-4 sm:gap-5 pointer-events-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-[#D4AF37]/60 w-fit shadow-lg">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
              <span className="truncate">{badgeText}</span>
            </div>

            <Heading
              level="h1"
              className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md"
            >
              {headline} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-[#D4AF37]/40 to-[#FFF8E7]">
                Delivered Fresh To Your Doorstep
              </span>
            </Heading>

            <Text className="text-[#D4AF37]/70 text-xs sm:text-sm md:text-base leading-relaxed drop-shadow-sm max-w-xl">
              {subheadline}
            </Text>

            {/* Quick Product Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative w-full max-w-lg mt-1">
              <Input
                type="text"
                placeholder="Search Belgian Chocolate, Red Velvet, Mango Mousse..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-11 pr-24 py-2.5 sm:py-3 rounded-xl bg-white/95 backdrop-blur-md text-gray-900 shadow-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#D4AF37]/50 border-0"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#1D2F5D] hover:bg-[#152347] text-white font-semibold text-xs transition-colors shadow-sm"
              >
                Search
              </button>
            </form>

            {/* Quick Filter CTAs */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
              <Link href="/products">
                <Button size="small" className="bg-gradient-to-r from-[#1D2F5D] to-[#D4AF37] hover:from-[#152347] hover:to-[#c59e2b] text-white font-bold shadow-lg text-xs sm:text-sm px-4 py-2">
                  Explore Cakes <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
              <Link href="/category/birthday-cakes">
                <Button variant="secondary" size="small" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md text-xs sm:text-sm px-3.5 py-2">
                  🎂 Birthday Bestsellers
                </Button>
              </Link>
              <Link href="/category/anniversary-cakes">
                <Button variant="secondary" size="small" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md text-xs sm:text-sm px-3.5 py-2">
                  💖 Anniversary Specials
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── OVERLAY 2: ARTISANAL CRAFTSMANSHIP (35% -> 60%) ─────────────── */}
        <div
          className="absolute inset-0 z-20 flex items-center justify-end px-4 sm:px-8 md:px-14 lg:px-20 max-w-7xl mx-auto pointer-events-none transition-all duration-75"
          style={{
            opacity: highlight1Opacity,
            visibility: highlight1Opacity > 0.01 ? "visible" : "hidden",
            transform: `translateY(${Math.max(-20, (0.45 - scrollProgress) * 50)}px)`,
          }}
        >
          <div className="max-w-md p-6 sm:p-8 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 text-white shadow-2xl space-y-3 pointer-events-auto">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" /> Handcrafted Mastery
            </div>
            <Heading level="h2" className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">
              Every Slice, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-[#D4AF37]/40">
                A Symphony of Flavor
              </span>
            </Heading>
            <Text className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Baked freshly from scratch upon order using 100% natural ingredients, rich Belgian dark chocolate ganache, and signature silky mousses.
            </Text>
            <div className="pt-2 flex items-center gap-3 text-xs text-[#D4AF37]/60 font-medium">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Artisanal Craftsmanship</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Zero Preservatives</span>
            </div>
          </div>
        </div>

        {/* ── OVERLAY 3: EXPRESS CELEBRATION DISPATCH (65% -> 90%) ─────────── */}
        <div
          className="absolute inset-0 z-20 flex items-center justify-start px-4 sm:px-8 md:px-14 lg:px-20 max-w-7xl mx-auto pointer-events-none transition-all duration-75"
          style={{
            opacity: highlight2Opacity,
            visibility: highlight2Opacity > 0.01 ? "visible" : "hidden",
            transform: `translateY(${Math.max(-20, (0.75 - scrollProgress) * 50)}px)`,
          }}
        >
          <div className="max-w-md p-6 sm:p-8 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 text-white shadow-2xl space-y-3 pointer-events-auto">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1D2F5D]/20 text-[#D4AF37]/80 text-[11px] font-bold border border-[#D4AF37]/30 uppercase tracking-wider">
              <Truck className="w-3.5 h-3.5" /> Express Fleet
            </div>
            <Heading level="h2" className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">
              Midnight & 2-Hour <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37]/40 via-[#D4AF37]/40 to-amber-100">
                Guaranteed Delivery
              </span>
            </Heading>
            <Text className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Temperature-controlled delivery units ensure your celebration arrives in picture-perfect condition, exactly on time.
            </Text>
            <div className="pt-2">
              <Link href="/products">
                <Button size="small" className="bg-[#1D2F5D] hover:bg-[#152347] text-white font-bold text-xs px-4 py-2">
                  Order For Today <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── INTERACTIVE SCROLL CUE (Bottom Bar) ─────────────────────────── */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 text-white/70 pointer-events-none transition-opacity duration-300"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 5) }}
        >
          <span className="text-[11px] font-medium tracking-wider uppercase text-[#D4AF37]/60/90 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" /> Scroll To Reveal
          </span>
          <div className="w-5 h-8 rounded-full border-2 border-white/40 flex items-start justify-center p-1">
            <div className="w-1 h-2 rounded-full bg-[#D4AF37] animate-bounce" />
          </div>
        </div>

        {/* ── PROGRESS INDICATOR LINE (Sticky Bottom Border) ───────────────── */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-30">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-[#1D2F5D] to-[#D4AF37] transition-all duration-75"
            style={{ width: `${Math.round(scrollProgress * 100)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
