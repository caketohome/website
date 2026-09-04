"use client";

import React, { useState, useEffect, useRef } from "react";
import { Heading, Text, Badge, Button } from "@medusajs/ui";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Star, Sparkles, Clock, ShieldCheck,
  MapPin, CheckCircle2, ArrowRight, Heart, ShoppingBag, Truck,
  Check, Gift, Tag, Award, Zap, Smile, Mail, Phone, Calendar, Users, Eye,
  CheckSquare, Search, Copy, Share2, Layers, AlertCircle, Quote as QuoteIcon,
  ArrowLeftRight, Play, Compass, MessageCircle, Send
} from "lucide-react";
import { ScrollFrameHero } from "@frontend/components/store/animation/scroll-frame-hero";
import { PromotionalBannerSection } from "./promotional-banner-section";
import { AnnouncementBarSection, AnnouncementBarConfig } from "./announcement-bar-section";
import { resolveHeroBannerConfig } from "@frontend/lib/cms/hero-resolver";
import { resolveProducts } from "@frontend/lib/cms/pim-product-resolver";
import { getSectionDefinition } from "@frontend/lib/cms/section-registry";

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
    font_family?: string;
    heading_font?: string;
    border_radius?: string;
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

/**
 * Interactive Before & After Transformation Slider
 */
function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Baking Process",
  afterLabel = "Finished Creation",
}: {
  beforeUrl?: string;
  afterUrl?: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [sliderPos, setSliderPos] = useState(50);
  const bUrl = beforeUrl || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80";
  const aUrl = afterUrl || "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=800&q=80";

  return (
    <div className="relative w-full max-w-4xl mx-auto h-72 sm:h-96 rounded-3xl overflow-hidden shadow-2xl select-none border border-ui-border-base group">
      {/* After image (background) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={aUrl} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover" />
      <span className="absolute top-4 right-4 z-10 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold text-white shadow">
        {afterLabel}
      </span>

      {/* Before image (clipped overlay) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bUrl} alt={beforeLabel} className="absolute inset-0 w-full h-full object-cover" style={{ width: "100%", height: "100%", maxWidth: "none" }} />
        <span className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold text-white shadow">
          {beforeLabel}
        </span>
      </div>

      {/* Draggable Divider line */}
      <div className="absolute top-0 bottom-0 z-20 w-1 bg-white shadow-xl cursor-ew-resize flex items-center justify-center" style={{ left: `calc(${sliderPos}% - 2px)` }}>
        <div className="w-8 h-8 rounded-full bg-white text-rose-600 shadow-xl flex items-center justify-center text-xs font-black">
          ⇄
        </div>
      </div>

      {/* Invisible Range Slider */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPos}
        onChange={(e) => setSliderPos(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
        aria-label="Before and after transformation slider"
      />
    </div>
  );
}

/**
 * Interactive Lead Generation & Custom Cake Enquiry Form
 */
function InteractiveLeadForm({
  sectionKey,
  sectionType,
  heading,
  subheading,
  submitText = "Send Request",
  successMsg = "Thank you! Your enquiry has been received. Our bakery concierge will reach out within 15 minutes.",
  theme,
}: {
  sectionKey: string;
  sectionType: string;
  heading: string;
  subheading: string;
  submitText?: string;
  successMsg?: string;
  theme?: any;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanPhone = phone.replace(/\D/g, "");
    if (!name.trim() || name.trim().length < 2) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (cleanPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/v1/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: sectionType,
          name: name.trim(),
          phone: cleanPhone,
          email: email.trim() || undefined,
          details: details.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStatus("success");
        setReferenceId(data.id || `REQ-${Math.floor(100000 + Math.random() * 900000)}`);
      } else {
        setStatus("error");
        setErrorMsg(data.message || data.error || "Submission failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  };

  return (
    <section key={sectionKey} className="max-w-2xl mx-auto w-full p-6 sm:p-8 rounded-3xl bg-ui-bg-base border border-ui-border-base shadow-xl flex flex-col gap-5">
      <div className="text-center flex flex-col gap-1">
        <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
          {heading}
        </Heading>
        <Text className="text-xs sm:text-sm text-ui-fg-subtle">
          {subheading}
        </Text>
      </div>

      {status === "success" ? (
        <div className="p-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-2xl flex flex-col items-center text-center gap-2 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md">
            ✓
          </div>
          <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Enquiry Confirmed!</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md">{successMsg}</p>
          <span className="text-[11px] font-mono font-semibold bg-white dark:bg-ui-bg-base px-3 py-1 rounded-lg border border-emerald-300 mt-2 text-emerald-800">
            Ref ID: {referenceId}
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ui-fg-base">Your Name *</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Sharma"
                className="w-full px-3 py-2 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ui-fg-base">Phone Number *</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
          {sectionType !== "newsletter" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ui-fg-base">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya@example.com"
                className="w-full px-3 py-2 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}
          {sectionType !== "newsletter" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ui-fg-base">Celebration Details / Cake Requirements</label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Cake flavour, size (kg), date of celebration, delivery area..."
                className="w-full px-3 py-2 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}
          <Button
            type="submit"
            size="large"
            variant="primary"
            disabled={status === "loading"}
            className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white mt-1"
          >
            {status === "loading" ? (
              <span className="flex items-center gap-2">Submitting...</span>
            ) : (
              <span className="flex items-center gap-1.5"><Send className="w-4 h-4" /> {submitText}</span>
            )}
          </Button>
        </form>
      )}
    </section>
  );
}

/**
 * Interactive Pincode Delivery Serviceability Checker
 */
function PincodeServiceabilityWidget({
  heading = "📍 Check Delivery Serviceability & Speed",
  subheading = "Enter your 6-digit Bangalore postal code for instant cutoff calculation",
  theme,
}: {
  heading?: string;
  subheading?: string;
  theme?: any;
}) {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<{ serviceable: boolean; speed: string; hub: string; cutoff: string } | null>(null);
  const [error, setError] = useState("");

  const handleCheck = () => {
    setError("");
    const clean = pincode.trim().replace(/\D/g, "");
    if (clean.length !== 6) {
      setError("Please enter a valid 6-digit Indian PIN code.");
      setResult(null);
      return;
    }

    if (clean.startsWith("560")) {
      setResult({
        serviceable: true,
        speed: "Express 2-Hour Delivery Available",
        hub: "Indiranagar Flagship Kitchen (4.2 km)",
        cutoff: "Order before 11:30 PM for Same-Night Midnight Surprise",
      });
    } else {
      setResult({
        serviceable: true,
        speed: "Next-Day Scheduled Express Delivery",
        hub: "Regional Cold-Chain Dispatch Hub",
        cutoff: "Order before 6:00 PM for Next-Day Guaranteed Slot",
      });
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-6 rounded-3xl bg-ui-bg-base border border-ui-border-base shadow-md flex flex-col gap-4">
      <div className="text-center flex flex-col gap-1">
        <Heading level="h3" className="text-lg font-bold" style={{ color: theme?.heading_color }}>
          {heading}
        </Heading>
        <Text className="text-xs text-ui-fg-muted">{subheading}</Text>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          placeholder="e.g. 560038"
          className="flex-1 px-4 py-2.5 text-sm font-mono font-bold bg-ui-bg-subtle border border-ui-border-base rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
          onKeyDown={(e) => { if (e.key === "Enter") handleCheck(); }}
        />
        <Button onClick={handleCheck} variant="primary" className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold">
          Check Speed
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      {result && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs flex flex-col gap-1 text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-1.5 font-bold">
            <span>⚡ {result.speed}</span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Nearest Kitchen: {result.hub}</p>
          <p className="text-[11px] text-emerald-600 font-semibold">🕒 {result.cutoff}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Delivery Time Slot Selector
 */
function DeliveryTimeSlotPicker({
  heading = "Select Your Preferred Delivery Time Slot",
  subheading = "Cakes are baked to order within 45 minutes of scheduled dispatch",
}: {
  heading?: string;
  subheading?: string;
}) {
  const [selectedSlot, setSelectedSlot] = useState("express");

  const slots = [
    { id: "standard", name: "Standard Delivery (Free)", time: "10:00 AM – 1:00 PM • 2:00 PM – 5:00 PM • 6:00 PM – 9:00 PM", fee: "₹0" },
    { id: "express", name: "⚡ Express 2-Hour Delivery", time: "Dispatched hot from kitchen in cold-dome within 120 minutes", fee: "₹99" },
    { id: "midnight", name: "🌙 Midnight Surprise Delivery", time: "11:30 PM – 12:05 AM (Exact midnight cake delivery guarantee)", fee: "₹199" },
  ];

  return (
    <div className="w-full max-w-xl mx-auto p-6 rounded-3xl bg-ui-bg-base border border-ui-border-base shadow-md flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-ui-fg-base">{heading}</h3>
        <p className="text-xs text-ui-fg-muted mt-0.5">{subheading}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {slots.map((s) => (
          <div
            key={s.id}
            onClick={() => setSelectedSlot(s.id)}
            className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
              selectedSlot === s.id ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 shadow-sm" : "hover:bg-ui-bg-subtle border-ui-border-base"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedSlot === s.id ? "border-rose-600" : "border-ui-border-base"}`}>
                {selectedSlot === s.id && <div className="w-2 h-2 rounded-full bg-rose-600" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-ui-fg-base">{s.name}</span>
                <span className="text-[10px] text-ui-fg-muted">{s.time}</span>
              </div>
            </div>
            <span className="text-xs font-black text-rose-600">{s.fee}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Interactive Flagship Kitchens Directory & Branch Locator
 */
function StoreBranchLocator({
  heading = "📍 Our Bakery Flagship Kitchens & Hubs",
}: {
  heading?: string;
}) {
  const branches = [
    { id: "indiranagar", name: "Indiranagar Flagship Kitchen", addr: "100ft Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038", phone: "+91 98765 43210", hours: "8:00 AM – 11:30 PM", status: "Baking Fresh Now" },
    { id: "koramangala", name: "Koramangala Artisan Studio", addr: "80ft Road, 4th Block, Koramangala, Bengaluru 560034", phone: "+91 98765 43211", hours: "8:30 AM – 11:30 PM", status: "Open for Express Dispatch" },
    { id: "whitefield", name: "Whitefield Gourmet Hub", addr: "ITPL Main Road, Prestige Ozone, Whitefield 560066", phone: "+91 98765 43212", hours: "9:00 AM – 11:00 PM", status: "Open Now" },
    { id: "jayanagar", name: "Jayanagar Boutique Patisserie", addr: "11th Main, 4th Block, Jayanagar, Bengaluru 560011", phone: "+91 98765 43213", hours: "8:00 AM – 11:00 PM", status: "Open Now" },
  ];

  const [selectedBranch, setSelectedBranch] = useState(branches[0].id);
  const cur = branches.find((b) => b.id === selectedBranch) || branches[0];

  return (
    <div className="w-full max-w-3xl mx-auto p-6 sm:p-8 rounded-3xl bg-ui-bg-base border border-ui-border-base shadow-lg flex flex-col gap-5">
      <div className="text-center flex flex-col gap-1">
        <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Live Hubs</span>
        <h3 className="text-xl font-bold text-ui-fg-base">{heading}</h3>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {branches.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBranch(b.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              selectedBranch === b.id ? "bg-rose-600 text-white border-rose-600 shadow-md" : "bg-ui-bg-subtle text-ui-fg-muted border-ui-border-base hover:text-ui-fg-base"
            }`}
          >
            {b.name.split(" ")[0]} Hub
          </button>
        ))}
      </div>
      <div className="p-5 rounded-2xl bg-ui-bg-subtle/70 border border-ui-border-base flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full w-fit mx-auto sm:mx-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {cur.status}
          </span>
          <h4 className="font-bold text-sm text-ui-fg-base">{cur.name}</h4>
          <p className="text-xs text-ui-fg-muted flex items-center justify-center sm:justify-start gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {cur.addr}
          </p>
          <p className="text-xs text-ui-fg-muted flex items-center justify-center sm:justify-start gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {cur.hours}
          </p>
        </div>
        <a
          href={`tel:${cur.phone}`}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow whitespace-nowrap"
        >
          <Phone className="w-3.5 h-3.5" /> Call Hub ({cur.phone})
        </a>
      </div>
    </div>
  );
}

/**
 * Interactive Side-by-Side Product Comparison Matrix
 */
function ProductComparisonTable({
  heading = "Compare Our Artisan Cake Recipes",
  subheading = "Choose the perfect cake crafted for your celebration and guest count",
}: {
  heading?: string;
  subheading?: string;
}) {
  const items = [
    { title: "Belgian Dark Truffle", price: "₹699", servings: "4 - 6 guests", eggless: "100% Eggless", prep: "2 Hours Express", rating: "4.9 ★" },
    { title: "Royal Red Velvet Heart", price: "₹749", servings: "4 - 6 guests", eggless: "100% Eggless", prep: "2 Hours Express", rating: "4.8 ★" },
    { title: "Classic Black Forest", price: "₹599", servings: "4 - 6 guests", eggless: "100% Eggless", prep: "2 Hours Express", rating: "4.7 ★" },
    { title: "Berry Bliss Gateau", price: "₹799", servings: "6 - 8 guests", eggless: "100% Eggless", prep: "3 Hours Express", rating: "4.9 ★" },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto p-6 rounded-3xl bg-ui-bg-base border border-ui-border-base shadow-md flex flex-col gap-6 overflow-x-auto">
      <div className="text-center flex flex-col gap-1">
        <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Comparison</span>
        <h3 className="text-2xl font-bold text-ui-fg-base">{heading}</h3>
        <p className="text-xs text-ui-fg-muted">{subheading}</p>
      </div>
      <table className="w-full text-xs text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-ui-border-base bg-ui-bg-subtle/50">
            <th className="p-3 font-bold text-ui-fg-muted">Cake Feature</th>
            {items.map((it, i) => (
              <th key={i} className="p-3 font-extrabold text-ui-fg-base">{it.title}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-border-base/50">
          <tr>
            <td className="p-3 font-semibold text-ui-fg-muted">Starting Price</td>
            {items.map((it, i) => (
              <td key={i} className="p-3 font-black text-rose-600 text-sm">{it.price}</td>
            ))}
          </tr>
          <tr>
            <td className="p-3 font-semibold text-ui-fg-muted">Servings / Portions</td>
            {items.map((it, i) => (
              <td key={i} className="p-3 text-ui-fg-base">{it.servings}</td>
            ))}
          </tr>
          <tr>
            <td className="p-3 font-semibold text-ui-fg-muted">Dietary Status</td>
            {items.map((it, i) => (
              <td key={i} className="p-3 text-emerald-600 font-bold">🌱 {it.eggless}</td>
            ))}
          </tr>
          <tr>
            <td className="p-3 font-semibold text-ui-fg-muted">Preparation & Delivery</td>
            {items.map((it, i) => (
              <td key={i} className="p-3 text-amber-600 font-semibold">⚡ {it.prep}</td>
            ))}
          </tr>
          <tr>
            <td className="p-3 font-semibold text-ui-fg-muted">Customer Rating</td>
            {items.map((it, i) => (
              <td key={i} className="p-3 font-bold text-ui-fg-base">{it.rating}</td>
            ))}
          </tr>
          <tr>
            <td className="p-3 font-semibold text-ui-fg-muted">Action</td>
            {items.map((_, i) => (
              <td key={i} className="p-3">
                <Link href="/products">
                  <Button size="small" variant="primary" className="bg-rose-600 text-white rounded-lg text-xs font-bold">
                    Order Now
                  </Button>
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
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
        fontFamily: theme?.font_family && theme.font_family !== "inherit" ? theme.font_family : undefined,
        ["--theme-primary" as any]: theme?.accent_color || "#e11d48",
        ["--theme-secondary" as any]: theme?.heading_color || "#111827",
        ["--theme-accent" as any]: theme?.accent_color || "#e11d48",
        ["--theme-background" as any]: theme?.bg_color || "#ffffff",
        ["--theme-surface" as any]: "#f8fafc",
        ["--theme-text" as any]: theme?.text_color || "#1f2937",
        ["--theme-muted" as any]: "#64748b",
        ["--theme-border" as any]: "#e2e8f0",
        ["--theme-heading-font" as any]: theme?.heading_font && theme.heading_font !== "inherit" ? theme.heading_font : "inherit",
        ["--theme-body-font" as any]: theme?.font_family && theme.font_family !== "inherit" ? theme.font_family : "inherit",
        ["--theme-button-radius" as any]: theme?.border_radius || "12px",
        ["--theme-card-radius" as any]: theme?.border_radius ? `calc(${theme.border_radius} + 4px)` : "16px",
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

      {/* Optional Page Heading for Static / Landing Pages (only when no Hero banner is active) */}
      {(h1 || subheading || introContent) && !activeSections.some((s) => s.type === "hero" && s.enabled !== false) && (
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
              const resolvedHero = resolveHeroBannerConfig(config, "desktop");
              const headline = resolvedHero.headline;
              const subheadline = resolvedHero.subheadline;
              const badgeText = resolvedHero.badgeText;
              const bgImage = resolvedHero.desktopImage;
              const bgImageAlt = resolvedHero.imageAlt;
              const mobileImage = resolvedHero.mobileImage;
              const tabletImage = resolvedHero.tabletImage;
              const overlayOpacity = resolvedHero.overlayOpacity;
              const objectFit = resolvedHero.objectFit;
              const imagePosition = resolvedHero.imagePosition;

              // Responsive Alignment & Height
              const desktopAlignment = desktopConfig.alignment || resolvedHero.alignment;
              const tabletAlignment = tabletConfig.alignment || desktopAlignment;
              const mobileAlignment = mobileConfig.alignment || desktopAlignment;

              const primaryCtaVisible = resolvedHero.primaryCtaVisible;
              const secondaryCtaVisible = resolvedHero.secondaryCtaVisible;

              const primaryCtaText = resolvedHero.primaryCtaText;
              const primaryCtaUrl = resolvedHero.primaryCtaUrl;
              const secondaryCtaText = resolvedHero.secondaryCtaText;
              const secondaryCtaUrl = resolvedHero.secondaryCtaUrl;

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

              if (process.env.NODE_ENV === "development" && config.disable_scroll_sequence !== true) {
                console.error(
                  "INVALID RENDER PATH: CMS section has valid scroll_frame configuration but StaticHero was rendered for section:",
                  sectionKey
                );
              }

              return (
                <section
                  key={sectionKey}
                  className="w-full"
                  data-cms-renderer="static-hero"
                  data-section-id={sectionKey}
                  data-cms-section-id={sectionKey}
                  data-section-type="hero"
                  data-cms-section-type="hero"
                  data-cms-headline={headline}
                  data-cms-badge={badgeText}
                  data-cms-primary-cta={primaryCtaText}
                  data-cms-secondary-cta={secondaryCtaText}
                >
                  <script
                    dangerouslySetInnerHTML={{
                      __html: `
                        window.__CAKETOHOME_HERO_DEBUG__ = {
                          sectionId: ${JSON.stringify(sectionKey)},
                          sectionType: "hero",
                          animationType: "static",
                          source: ${JSON.stringify(resolvedHero.source)},
                          headline: ${JSON.stringify(headline)},
                          subheadline: ${JSON.stringify(subheadline)},
                          badge: ${JSON.stringify(badgeText)},
                          primaryCtaText: ${JSON.stringify(primaryCtaText)},
                          primaryCtaUrl: ${JSON.stringify(primaryCtaUrl)},
                          secondaryCtaText: ${JSON.stringify(secondaryCtaText)},
                          secondaryCtaUrl: ${JSON.stringify(secondaryCtaUrl)},
                        };
                      `,
                    }}
                  />
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

            // ── 1c. Hero Video Section ──────────────────────────────────
            case "hero_video": {
              const headline = config.headline || "Handcrafted Luxury Cakes For Every Celebration";
              const subheadline = config.subheadline || "Experience gourmet artisanal cakes baked fresh with pure butter and rich chocolate";
              const badgeText = config.badge_text || config.badge || "Pure Artisanal Baking • 2-Hour Express Delivery";
              const videoUrl = config.video_url || "https://assets.mixkit.co/videos/preview/mixkit-decorating-a-chocolate-cake-with-strawberries-42981-large.mp4";
              const posterUrl = config.desktop_image || config.poster_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1600&q=80";
              const primaryCtaText = config.cta_primary_text || config.cta_text || "Order Now";
              const primaryCtaUrl = config.cta_primary_url || config.cta_url || "/products";
              const secondaryCtaText = config.cta_secondary_text || "View Flavours";
              const secondaryCtaUrl = config.cta_secondary_url || "/products";
              const overlayOpacity = typeof config.overlay_opacity === "number" ? config.overlay_opacity : 0.45;

              return (
                <section key={sectionKey} className="relative w-full min-h-[440px] sm:min-h-[520px] rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl border border-ui-border-base bg-black text-white">
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster={posterUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                  >
                    <source src={videoUrl} type="video/mp4" />
                  </video>
                  <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />
                  <div className="relative z-10 p-6 sm:p-12 max-w-3xl flex flex-col items-center text-center gap-4">
                    {badgeText && (
                      <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/30">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        {badgeText}
                      </span>
                    )}
                    <Heading level="h1" className="text-3xl sm:text-5xl font-black text-white leading-tight">
                      {headline}
                    </Heading>
                    <Text className="text-sm sm:text-lg text-white/90 max-w-xl">
                      {subheadline}
                    </Text>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <Link href={primaryCtaUrl}>
                        <Button size="large" className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-8 py-3 rounded-xl shadow-lg border-none">
                          {primaryCtaText} →
                        </Button>
                      </Link>
                      {secondaryCtaText && (
                        <Link href={secondaryCtaUrl}>
                          <Button size="large" variant="secondary" className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border-white/40 px-6 py-3 rounded-xl">
                            {secondaryCtaText}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </section>
              );
            }

            // ── 1d. Split Hero Section (Configurable Ratio, Dual CTAs & Responsive Media) ──
            case "split_hero": {
              const eyebrow = config.eyebrow || "";
              const headline = config.headline || "Freshly Baked Every Morning";
              const subheadline = config.subheadline || "We source single-origin cocoa, farm-fresh dairy, and handcraft each celebration cake to perfection.";
              const description = config.description || config.body || "";
              const badgeText = config.badge_text || config.badge || "Artisanal Heritage";
              const mediaPosition = config.content_position === "right" ? "left" : (config.media_position || config.image_position || "right");
              const ratio = config.ratio || "50_50";
              const mobileStackOrder = config.mobile_stack_order || "image_first";

              // Responsive Media URLs
              const desktopImage = config.desktop_image || config.image_url || "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=1000&q=80";
              const tabletImage = config.tablet_image || desktopImage;
              const mobileImage = config.mobile_image || desktopImage;
              const videoUrl = config.video_url || "";
              const objectFit = config.object_fit || config.image_fit || "cover";
              const imageAlt = config.image_alt || headline;
              const contentAlign = config.content_alignment || "left";
              const vertAlign = config.vertical_alignment || "center";
              const trustText = config.trust_text || config.delivery_text || "Baked Fresh on Order";
              const ratingText = config.rating_text || "★ 4.9 (1.2k+ reviews)";
              const showFloatingBadge = config.show_floating_badge !== false;
              const embeddedFeatures: any[] = Array.isArray(config.features) && config.features.length > 0
                ? config.features.filter((f: any) => f.visible !== false)
                : (Array.isArray(config.feature_bullets) ? config.feature_bullets.filter((f: any) => f.visible !== false) : []);

              // Primary and Secondary CTAs
              const primaryCta = config.primary_cta || {
                text: config.cta_primary_text || config.cta_text || "Explore Cakes",
                url: config.cta_primary_url || config.cta_url || "/products",
                variant: "primary",
                new_tab: false,
              };
              const secondaryCta = config.secondary_cta || {
                text: config.cta_secondary_text || "",
                url: config.cta_secondary_url || "",
                variant: "secondary",
                new_tab: false,
              };

              // Ratio classes
              const contentRatioClass =
                ratio === "40_60" ? "lg:w-2/5" :
                ratio === "60_40" ? "lg:w-3/5" :
                ratio === "30_70" ? "lg:w-[30%]" :
                ratio === "70_30" ? "lg:w-[70%]" :
                "lg:w-1/2";

              const mediaRatioClass =
                ratio === "40_60" ? "lg:w-3/5" :
                ratio === "60_40" ? "lg:w-2/5" :
                ratio === "30_70" ? "lg:w-[70%]" :
                ratio === "70_30" ? "lg:w-[30%]" :
                "lg:w-1/2";

              const stackClass = mobileStackOrder === "content_first"
                ? (mediaPosition === "left" ? "flex flex-col lg:flex-row-reverse" : "flex flex-col lg:flex-row")
                : (mediaPosition === "left" ? "flex flex-col-reverse lg:flex-row-reverse" : "flex flex-col-reverse lg:flex-row");

              const alignClasses =
                contentAlign === "center" ? "items-center text-center" :
                contentAlign === "right" ? "items-end text-right" :
                "items-start text-left";

              const vertAlignClass =
                vertAlign === "top" ? "items-start" :
                vertAlign === "bottom" ? "items-end" :
                "items-center";

              return (
                <section key={sectionKey} className="w-full py-8 sm:py-12">
                  <div className={`${vertAlignClass} gap-8 lg:gap-12 ${stackClass}`}>
                    <div className={`${contentRatioClass} flex flex-col ${alignClasses} gap-4 w-full`}>
                      {eyebrow && (
                        <span className="text-xs font-bold tracking-wider uppercase text-rose-600">
                          {eyebrow}
                        </span>
                      )}
                      {badgeText && (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 shadow-sm">
                          <Sparkles className="w-3.5 h-3.5" /> {badgeText}
                        </span>
                      )}
                      <Heading level="h1" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ui-fg-base leading-tight">
                        {headline}
                      </Heading>
                      {subheadline && (
                        <Text className="text-base sm:text-lg font-medium text-ui-fg-subtle leading-relaxed">
                          {subheadline}
                        </Text>
                      )}
                      {description && (
                        <Text className="text-xs sm:text-sm text-ui-fg-muted leading-relaxed">
                          {description}
                        </Text>
                      )}

                      {/* Embedded Feature Highlights Repeater (1-6 items) */}
                      {embeddedFeatures.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-1 pb-1">
                          {embeddedFeatures.slice(0, 6).map((feat: any, fi: number) => (
                            <div
                              key={feat.id || fi}
                              className="p-2.5 rounded-xl bg-ui-bg-subtle/70 border border-ui-border-base flex items-start gap-2.5 text-left"
                            >
                              <div
                                className="p-1.5 rounded-lg shrink-0 flex items-center justify-center"
                                style={{ backgroundColor: feat.icon_color ? `${feat.icon_color}15` : "#fff1f2", color: feat.icon_color || "#e11d48" }}
                              >
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-ui-fg-base block truncate" style={{ color: feat.text_color || undefined }}>
                                  {feat.title}
                                </span>
                                {feat.description && (
                                  <span className="text-[11px] text-ui-fg-muted line-clamp-1 block">
                                    {feat.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        {primaryCta.text && primaryCta.url && (
                          <Link
                            href={primaryCta.url}
                            target={primaryCta.new_tab ? "_blank" : undefined}
                            rel={primaryCta.new_tab ? "noopener noreferrer" : undefined}
                          >
                            <Button size="large" className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-6 py-3 rounded-xl shadow-lg border-none">
                              {primaryCta.text} →
                            </Button>
                          </Link>
                        )}
                        {secondaryCta.text && secondaryCta.url && (
                          <Link
                            href={secondaryCta.url}
                            target={secondaryCta.new_tab ? "_blank" : undefined}
                            rel={secondaryCta.new_tab ? "noopener noreferrer" : undefined}
                          >
                            <Button size="large" variant="secondary" className="px-6 py-3 rounded-xl font-bold">
                              {secondaryCta.text}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className={`${mediaRatioClass} w-full relative`}>
                      <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-ui-border-base aspect-[4/3] bg-ui-bg-subtle">
                        {videoUrl ? (
                          <video
                            src={videoUrl}
                            poster={desktopImage}
                            autoPlay={config.autoplay !== false}
                            muted={config.muted !== false}
                            loop={config.loop !== false}
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <picture>
                            <source media="(max-width: 640px)" srcSet={mobileImage} />
                            <source media="(max-width: 1024px)" srcSet={tabletImage} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={desktopImage}
                              alt={imageAlt}
                              className={`w-full h-full object-${objectFit} hover:scale-105 transition-transform duration-700`}
                              loading="lazy"
                            />
                          </picture>
                        )}
                        {showFloatingBadge && (
                          <div className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg border border-white/40 flex items-center justify-between text-xs font-bold text-ui-fg-base">
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-rose-600" /> {trustText}</span>
                            <span className="text-emerald-600 flex items-center gap-1">{ratingText}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            }

            // ── 1e. Full Width Image Banner ─────────────────────────────
            case "full_width_image": {
              const headline = config.headline || "";
              const subheadline = config.subheadline || "";
              const imageUrl = config.desktop_image || config.image_url || "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=1600&q=80";
              const ctaText = config.cta_text || "";
              const ctaUrl = config.cta_url || "/products";

              return (
                <section key={sectionKey} className="w-full relative rounded-3xl overflow-hidden shadow-xl border border-ui-border-base min-h-[320px] sm:min-h-[420px] flex items-center justify-center text-white text-center p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={headline || "Cake banner"} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40" />
                  {(headline || ctaText) && (
                    <div className="relative z-10 max-w-2xl flex flex-col items-center gap-3">
                      {headline && <Heading level="h2" className="text-2xl sm:text-4xl font-extrabold text-white">{headline}</Heading>}
                      {subheadline && <Text className="text-sm sm:text-base text-white/90">{subheadline}</Text>}
                      {ctaText && (
                        <Link href={ctaUrl} className="pt-2">
                          <Button size="large" className="bg-white hover:bg-white/90 text-rose-600 font-extrabold px-6 py-2.5 rounded-xl shadow-md border-none">
                            {ctaText} →
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </section>
              );
            }

            // ── 1f. Video + Story Text ──────────────────────────────────
            case "video_text": {
              const headline = config.headline || "Behind The Sweet Magic";
              const subheadline = config.subheadline || "Watch how our pastry chefs hand-whip Belgian ganache and layer fresh sponge cakes daily.";
              const videoUrl = config.video_url || "https://assets.mixkit.co/videos/preview/mixkit-decorating-a-chocolate-cake-with-strawberries-42981-large.mp4";
              const primaryCtaText = config.cta_primary_text || "Meet Our Bakers";
              const primaryCtaUrl = config.cta_primary_url || "/about";

              return (
                <section key={sectionKey} className="w-full py-8">
                  <div className="flex flex-col lg:flex-row items-center gap-8 rounded-3xl bg-ui-bg-subtle p-6 sm:p-10 border border-ui-border-base">
                    <div className="flex-1 w-full rounded-2xl overflow-hidden shadow-lg aspect-video bg-black relative">
                      <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                        <source src={videoUrl} type="video/mp4" />
                      </video>
                    </div>
                    <div className="flex-1 flex flex-col items-start gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Artisan Kitchen</span>
                      <Heading level="h2" className="text-2xl sm:text-3xl font-extrabold text-ui-fg-base">{headline}</Heading>
                      <Text className="text-sm text-ui-fg-subtle leading-relaxed">{subheadline}</Text>
                      <Link href={primaryCtaUrl} className="pt-2">
                        <Button className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-6 py-2.5">
                          {primaryCtaText} →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </section>
              );
            }

            // ── 1g. Before & After Transformation Slider ────────────────
            case "before_after": {
              const heading = config.heading || "From Scratch to Masterpiece";
              const subheading = config.subheading || "Slide to witness the artistry behind every custom celebration cake";
              return (
                <section key={sectionKey} className="w-full py-8 flex flex-col items-center gap-6">
                  <div className="text-center max-w-xl">
                    <Heading level="h2" className="text-2xl sm:text-3xl font-extrabold text-ui-fg-base">{heading}</Heading>
                    <Text className="text-xs sm:text-sm text-ui-fg-subtle mt-1">{subheading}</Text>
                  </div>
                  <BeforeAfterSlider
                    beforeUrl={config.before_image_url}
                    afterUrl={config.after_image_url}
                    beforeLabel={config.before_label || "Raw Sponge & Ganache"}
                    afterLabel={config.after_label || "Handcrafted Masterpiece"}
                  />
                </section>
              );
            }

            // ── 2. Category Grid / Carousel ──────────────────────────────
            case "category_grid":
            case "categories":
            case "category_carousel":
            case "category_tiles":
            case "featured_categories": {
              const heading = config.heading || "Shop by Occasion & Flavour";
              const subheading = config.subheading || "Find the perfect cake handcrafted for your celebration";
              const categoryIds = config.category_ids || [];
              const displayCategories = categoryIds.length > 0
                ? categoryIds.map((cid: string) => allCategories.find((c: any) => c.id === cid)).filter(Boolean)
                : allCategories.slice(0, 8);

              const layoutMode = (section.type === "category_carousel" || config.layout === "carousel") ? "carousel" : (config.layout || "grid");
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

            // ── 2b. Occasions Grid & Carousel (Live PIM Database Integration with 4-Tier Fallback) ──
            case "occasions_grid":
            case "occasion_carousel": {
              const sectionLabel = config.section_label || config.badge_text || "";
              const heading = config.heading || "Celebrate Every Occasion";
              const subheading = config.subheading || "Handcrafted cakes tailored for life's sweetest moments";
              const isCarousel = section.type === "occasion_carousel" || config.layout === "carousel";
              const dataSource = config.data_source || "pim";
              const occasionMode = config.occasion_mode || "all_active";
              const selectedOccasions = Array.isArray(config.selected_occasions) ? config.selected_occasions : [];
              const columns = config.columns || 4;
              const viewAllText = config.view_all_text || "View All Occasions →";
              const viewAllUrl = config.view_all_url || "/occasions";
              const aspectRatio = config.aspect_ratio || "aspect-[4/3]";
              const imageFit = config.image_fit || "cover";
              const imagePosition = config.image_position || "center";
              const overlayOpacity = typeof config.overlay_opacity === "number" ? config.overlay_opacity : 80;
              const cardRadius = config.card_radius || "rounded-2xl";
              const showEmoji = config.show_emoji !== false;
              const showTitle = config.show_title !== false;
              const showDescription = config.show_description !== false;
              const showCta = config.show_cta !== false;
              const limit = typeof config.limit === "number" && config.limit > 0 ? config.limit : undefined;

              // Curated 4-Tier Fallback Dictionary for standard bakery celebration occasions
              const OCCASION_FALLBACK_IMAGES: Record<string, string> = {
                birthday: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=800&q=80",
                "birthday-cakes": "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=800&q=80",
                anniversary: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=800&q=80",
                "anniversary-cakes": "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=800&q=80",
                wedding: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800&q=80",
                "wedding-cakes": "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800&q=80",
                engagement: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80",
                valentine: "https://images.unsplash.com/photo-1518047601542-4505c678a202?w=800&q=80",
                "valentines-day": "https://images.unsplash.com/photo-1518047601542-4505c678a202?w=800&q=80",
                "mothers-day": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=800&q=80",
                "fathers-day": "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800&q=80",
                "baby-shower": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80",
                "baby-birthday": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80",
                graduation: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=800&q=80",
                farewell: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=800&q=80",
                retirement: "https://images.unsplash.com/photo-1542826438-bd32f43d626f?w=800&q=80",
                corporate: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&q=80",
                housewarming: "https://images.unsplash.com/photo-1562440499-64c9a111f713?w=800&q=80",
                "thank-you": "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=800&q=80",
                congratulations: "https://images.unsplash.com/photo-1567171466295-4afa63d45416?w=800&q=80",
                "get-well-soon": "https://images.unsplash.com/photo-1534432182912-63863115e106?w=800&q=80",
                christmas: "https://images.unsplash.com/photo-1512485800893-b09ec1ea62b1?w=800&q=80",
                "new-year": "https://images.unsplash.com/photo-1546554137-f86b9593a222?w=800&q=80",
                diwali: "https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?w=800&q=80",
                eid: "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=800&q=80",
                onam: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80",
                "raksha-bandhan": "https://images.unsplash.com/photo-1627834377411-8da5f4f09de8?w=800&q=80",
                "friendship-day": "https://images.unsplash.com/photo-1516054575922-f0b8eeadec1a?w=800&q=80",
                kids: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80",
              };

              const getResolvedOccasionImage = (occ: any): string => {
                if (!occ) return "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=800&q=80";
                // 1. Dedicated cover image from PIM
                if (typeof occ.cover_image === "string" && occ.cover_image.trim() !== "") {
                  return occ.cover_image.trim();
                }
                // 2. Thumbnail or secondary image
                if (typeof occ.thumbnail_image === "string" && occ.thumbnail_image.trim() !== "") {
                  return occ.thumbnail_image.trim();
                }
                if (typeof occ.secondary_image === "string" && occ.secondary_image.trim() !== "") {
                  return occ.secondary_image.trim();
                }
                // 3. Check legacy image_url if not the generic chocolate cake
                if (typeof occ.image_url === "string" && occ.image_url.trim() !== "" && !occ.image_url.includes("photo-1578985545062-69928b1d9587")) {
                  return occ.image_url.trim();
                }
                // 4. Slug-based curated fallback map
                const slugKey = (occ.slug || occ.id || occ.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
                for (const [key, url] of Object.entries(OCCASION_FALLBACK_IMAGES)) {
                  if (slugKey === key || slugKey.includes(key) || key.includes(slugKey)) {
                    return url;
                  }
                }
                if (typeof occ.image_url === "string" && occ.image_url.trim() !== "") {
                  return occ.image_url.trim();
                }
                // 5. Safe global celebration cake image
                return "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=800&q=80";
              };

              // Resolve occasions from live PIM database
              let displayOccasions: any[] = [];
              if (dataSource === "pim") {
                const liveList = (occasions && occasions.length > 0) ? occasions : [];
                // Filter active occasions only
                const activeList = liveList.filter((occ: any) =>
                  occ.active !== false &&
                  occ.status !== "archived" &&
                  occ.is_active !== false
                );

                if (occasionMode === "selected" && selectedOccasions.length > 0) {
                  displayOccasions = activeList.filter((occ: any) =>
                    selectedOccasions.includes(occ.id) ||
                    selectedOccasions.includes(occ.slug) ||
                    selectedOccasions.includes(occ.name)
                  );
                } else if (occasionMode === "featured") {
                  displayOccasions = activeList.filter((occ: any) => occ.featured === true || occ.is_featured === true);
                } else {
                  displayOccasions = activeList;
                }

                // Sort by display order
                displayOccasions.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
              } else if (Array.isArray(config.manual_occasions) && config.manual_occasions.length > 0) {
                displayOccasions = config.manual_occasions;
              }

              // Safe fallback only if database list is empty
              if (displayOccasions.length === 0) {
                displayOccasions = [
                  { id: "occ_bday", name: "Birthday Cakes", slug: "birthday", cover_image: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=800&q=80", icon: "🎂", desc: "Party sparklers, photo cakes & decadent truffles" },
                  { id: "occ_anni", name: "Anniversary Cakes", slug: "anniversary", cover_image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=800&q=80", icon: "💑", desc: "Romantic heart shapes, red velvet & champagne cakes" },
                  { id: "occ_wed", name: "Wedding Cakes", slug: "wedding", cover_image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800&q=80", icon: "💒", desc: "Multi-tier royal floral fondant towers" },
                  { id: "occ_kids", name: "Kids Cakes", slug: "kids", cover_image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80", icon: "🧸", desc: "Superheroes, unicorns & playful theme cakes" },
                ];
              }

              if (limit && limit > 0) {
                displayOccasions = displayOccasions.slice(0, limit);
              }

              const colsClass =
                columns === 2 ? "grid-cols-1 sm:grid-cols-2" :
                columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
                columns === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" :
                columns === 6 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" :
                "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

              const renderOccasionCard = (occ: any) => {
                const cardImg = getResolvedOccasionImage(occ);
                const emojiIcon = occ.emoji || occ.icon || "🎂";
                const cardTitle = occ.name || occ.title || "Occasion";
                const cardDesc = occ.short_description || occ.description || occ.desc || "";
                const focalPos = occ.image_position || imagePosition || "center";

                return (
                  <Link
                    key={occ.id || occ.slug}
                    href={`/products?occasion=${occ.slug || occ.id}`}
                    className={`group relative overflow-hidden ${aspectRatio} ${cardRadius} bg-ui-bg-subtle border border-ui-border-base hover:shadow-2xl hover:border-pink-300 transition-all flex flex-col justify-end p-4 shrink-0 ${
                      isCarousel ? "w-[240px] sm:w-[280px] snap-start" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cardImg}
                      alt={occ.alt_text || occ.name || "Occasion Cake"}
                      className="absolute inset-0 w-full h-full group-hover:scale-105 transition-transform duration-500"
                      style={{ objectFit: imageFit as any, objectPosition: focalPos }}
                      loading="lazy"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t transition-opacity duration-300"
                      style={{
                        background: `linear-gradient(to top, rgba(0,0,0,${overlayOpacity / 100}) 0%, rgba(0,0,0,${Math.max(0, overlayOpacity / 100 - 0.45)}) 50%, transparent 100%)`
                      }}
                    />
                    <div className="relative z-10 text-white">
                      {showEmoji && emojiIcon && (
                        <span className="text-xl mb-1 block drop-shadow-sm">{emojiIcon}</span>
                      )}
                      {showTitle && (
                        <h3 className="font-extrabold text-sm sm:text-base leading-tight group-hover:text-pink-200 transition-colors drop-shadow-sm">
                          {cardTitle}
                        </h3>
                      )}
                      {showDescription && cardDesc && (
                        <p className="text-[11px] text-white/90 line-clamp-1 mt-0.5 drop-shadow-sm font-medium">
                          {cardDesc}
                        </p>
                      )}
                      {showCta && (
                        <span className="text-[10px] font-bold text-pink-300 group-hover:text-white group-hover:underline mt-1 inline-flex items-center gap-0.5 transition-colors">
                          Explore Cakes →
                        </span>
                      )}
                    </div>
                  </Link>
                );
              };

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      {sectionLabel && (
                        <span className="text-xs font-bold uppercase tracking-wider text-pink-600">
                          {sectionLabel}
                        </span>
                      )}
                      <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight text-ui-fg-base" style={{ color: theme?.heading_color }}>
                        {heading}
                      </Heading>
                      {subheading && <Text className="text-xs sm:text-sm text-ui-fg-muted mt-0.5">{subheading}</Text>}
                    </div>
                    {viewAllUrl && (
                      <Link href={viewAllUrl} className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                        {viewAllText}
                      </Link>
                    )}
                  </div>
                  {isCarousel ? (
                    <CarouselContainer
                      carouselConfig={config.carousel}
                      itemsCount={displayOccasions.length}
                    >
                      {displayOccasions.map((occ: any) => renderOccasionCard(occ))}
                    </CarouselContainer>
                  ) : (
                    <div className={`grid ${colsClass} gap-4`}>
                      {displayOccasions.map((occ: any) => renderOccasionCard(occ))}
                    </div>
                  )}
                </section>
              );
            }

            // ── 3. Product Grid / Best Sellers / New Arrivals / Occasion Cakes ────────────
            case "product_grid":
            case "product_carousel":
            case "featured_products":
            case "best_sellers":
            case "new_arrivals":
            case "featured_cakes":
            case "trending":
            case "trending_products":
            case "recommendations":
            case "recently_viewed":
            case "related_products":
            case "quick_shop":
            case "birthday_cakes":
            case "anniversary_cakes":
            case "wedding_cakes":
            case "kids_cakes":
            case "corporate_cakes":
            case "festival_cakes":
            case "celebration_cakes":
            case "chef_recommendations": {
              const defaultHeading =
                section.type === "new_arrivals" ? "✨ New Arrivals" :
                section.type === "birthday_cakes" ? "🎂 Birthday Cakes" :
                section.type === "anniversary_cakes" ? "💑 Anniversary Cakes" :
                section.type === "wedding_cakes" ? "💒 Wedding Cakes" :
                section.type === "kids_cakes" ? "🧸 Kids Cakes" :
                section.type === "corporate_cakes" ? "🏢 Corporate Cakes" :
                section.type === "festival_cakes" ? "🎆 Festival Specials" :
                section.type === "celebration_cakes" ? "🎉 Celebration Cakes" :
                section.type === "recommendations" ? "⚡ Chef Recommendations" :
                section.type === "trending" || section.type === "trending_products" ? "📈 Trending Now" :
                "🏆 Best-Selling Cakes";

              const heading = config.heading || defaultHeading;
              const subheading = config.subheading || "Freshly baked artisan recipes ready for express 2-hour delivery";

              // Dynamic PIM product resolution
              let displayProducts = resolveProducts(allProducts, {
                ...config,
                occasion_filter: config.occasion_filter || (
                  section.type === "birthday_cakes" ? "birthday" :
                  section.type === "anniversary_cakes" ? "anniversary" :
                  section.type === "wedding_cakes" ? "wedding" :
                  section.type === "kids_cakes" ? "kids" :
                  section.type === "corporate_cakes" ? "corporate" :
                  section.type === "festival_cakes" ? "festival" :
                  undefined
                ),
                mode: config.mode || (
                  section.type === "new_arrivals" ? "new_arrivals" :
                  section.type === "trending" || section.type === "trending_products" ? "trending" :
                  section.type === "featured_cakes" || section.type === "featured_products" || section.type === "recommendations" ? "featured" :
                  section.type.includes("_cakes") ? "occasion" :
                  "best_sellers"
                ),
              }, allCategories, occasions);

              if (displayProducts.length === 0) {
                displayProducts = allProducts.slice(0, config.limit || 8);
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
              const showComparePrice = config.show_compare_price !== false;
              const showRating = config.show_rating !== false;
              const showReviewCount = config.show_review_count !== false;
              const showBadge = config.show_badge !== false;
              const showWeight = config.show_weight !== false;
              const showFlavour = config.show_flavour !== false;
              const showWishlist = config.show_wishlist !== false;
              const showStock = config.show_stock !== false;
              const showQuickAdd = config.show_quick_add !== false;
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
                const flavour = product.flavour || product.metadata?.flavour;
                const weight = product.weight || product.weights?.[0];

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
                        {showWishlist && (
                          <button
                            type="button"
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-ui-fg-muted hover:text-rose-600 shadow-sm transition-all"
                            aria-label="Wishlist"
                          >
                            <Heart className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="p-3.5 sm:p-4 flex flex-col gap-2 flex-1 justify-between">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {showRating && (
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{rating}</span>
                              {showReviewCount && <span className="text-ui-fg-muted font-normal">({reviewCount})</span>}
                            </div>
                          )}
                          {showFlavour && flavour && (
                            <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              {flavour}
                            </span>
                          )}
                          {showWeight && weight && (
                            <span className="text-[10px] text-ui-fg-muted font-medium bg-ui-bg-subtle px-1.5 py-0.5 rounded border border-ui-border-base">
                              {weight}
                            </span>
                          )}
                        </div>

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
                        {showStock && (
                          <span className={`text-[10px] font-semibold ${product.in_stock !== false ? "text-emerald-600" : "text-amber-600"}`}>
                            {product.in_stock !== false ? "● In Stock" : "● Made to Order"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-ui-border-base">
                        {showPrice && (
                          <div>
                            <span className="text-sm sm:text-base font-extrabold text-ui-fg-base">
                              ₹{price.toLocaleString()}
                            </span>
                            {showComparePrice && originalPrice > price && (
                              <span className="text-[10px] sm:text-xs text-ui-fg-muted line-through ml-1 font-normal">
                                ₹{originalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                        {(showCta || showQuickAdd) && (
                          <Link href={`/products/${slug}`}>
                            <Button
                              variant="primary"
                              size="small"
                              className="rounded-xl px-2.5 py-1 text-[11px] sm:text-xs font-bold"
                              style={ctaBg ? { backgroundColor: ctaBg } : undefined}
                            >
                              <ShoppingBag className="w-3 h-3 mr-1" /> {showQuickAdd ? "Quick Add" : ctaText}
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

            // ── 3b. Header Navigation ──────────────────────────────────
            case "header": {
              const brandName = config.brand_name || "CakeToHome";
              const showSearch = config.show_search !== false;
              const showCart = config.show_cart !== false;
              const phone = config.phone || "+91 98765 43210";

              return (
                <header key={sectionKey} className="w-full bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-ui-border-base py-3 px-4 sm:px-6 shadow-sm rounded-2xl mb-4">
                  <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-2">
                      <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                        🎂 {brandName}
                      </span>
                    </Link>

                    {/* Navigation items */}
                    <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-bold text-ui-fg-base">
                      <Link href="/products" className="hover:text-rose-600 transition-colors">All Cakes</Link>
                      <Link href="/products?mode=best_sellers" className="hover:text-rose-600 transition-colors">Best Sellers</Link>
                      <Link href="/products?egg_type=eggless" className="hover:text-emerald-600 transition-colors">100% Eggless</Link>
                      <Link href="/products?occasion=birthday" className="hover:text-rose-600 transition-colors">Birthday Cakes</Link>
                      <Link href="/products?occasion=anniversary" className="hover:text-rose-600 transition-colors">Anniversary</Link>
                    </nav>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                      {showSearch && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-ui-bg-subtle text-xs text-ui-fg-muted border border-ui-border-base">
                          <Search className="w-3.5 h-3.5" /> Search cakes...
                        </div>
                      )}
                      <a href={`tel:${phone}`} className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-ui-fg-subtle hover:text-rose-600">
                        <Phone className="w-3.5 h-3.5 text-rose-600" /> {phone}
                      </a>
                      {showCart && (
                        <Link href="/cart" className="relative p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                          <ShoppingBag className="w-5 h-5" />
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </header>
              );
            }

            // ── 3c. Mega Menu ───────────────────────────────────────────
            case "mega_menu": {
              const heading = config.heading || "Explore Our Complete Bakery Catalog";
              return (
                <section key={sectionKey} className="w-full bg-ui-bg-base border border-ui-border-base rounded-2xl p-6 shadow-md mb-4">
                  <div className="flex items-center justify-between border-b border-ui-border-base pb-3 mb-4">
                    <span className="font-extrabold text-sm text-ui-fg-base">{heading}</span>
                    <span className="text-xs font-bold text-rose-600">⚡ 2-Hour Express Delivery Available</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                    <div>
                      <span className="font-bold text-ui-fg-base mb-2 block uppercase tracking-wider text-[11px] text-rose-600">By Occasion</span>
                      <ul className="flex flex-col gap-2 text-ui-fg-subtle">
                        <li><Link href="/products?occasion=birthday" className="hover:text-rose-600">Birthday Cakes</Link></li>
                        <li><Link href="/products?occasion=anniversary" className="hover:text-rose-600">Anniversary Cakes</Link></li>
                        <li><Link href="/products?occasion=wedding" className="hover:text-rose-600">Wedding Cakes</Link></li>
                        <li><Link href="/products?occasion=kids" className="hover:text-rose-600">Kids Cartoon Cakes</Link></li>
                      </ul>
                    </div>
                    <div>
                      <span className="font-bold text-ui-fg-base mb-2 block uppercase tracking-wider text-[11px] text-purple-600">By Flavour</span>
                      <ul className="flex flex-col gap-2 text-ui-fg-subtle">
                        <li><Link href="/products?flavor=chocolate" className="hover:text-purple-600">Belgian Chocolate</Link></li>
                        <li><Link href="/products?flavor=red-velvet" className="hover:text-purple-600">Red Velvet Heart</Link></li>
                        <li><Link href="/products?flavor=butterscotch" className="hover:text-purple-600">Crunchy Butterscotch</Link></li>
                        <li><Link href="/products?flavor=fruit" className="hover:text-purple-600">Fresh Exotic Fruit</Link></li>
                      </ul>
                    </div>
                    <div>
                      <span className="font-bold text-ui-fg-base mb-2 block uppercase tracking-wider text-[11px] text-emerald-600">Special Diet</span>
                      <ul className="flex flex-col gap-2 text-ui-fg-subtle">
                        <li><Link href="/products?egg_type=eggless" className="hover:text-emerald-600">100% Eggless Cakes</Link></li>
                        <li><Link href="/products?diet=sugar-free" className="hover:text-emerald-600">Sugar-Free Delights</Link></li>
                        <li><Link href="/products?diet=vegan" className="hover:text-emerald-600">Vegan Sponge Cakes</Link></li>
                        <li><Link href="/products?diet=gluten-free" className="hover:text-emerald-600">Gluten-Free Cakes</Link></li>
                      </ul>
                    </div>
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-3 rounded-xl border border-rose-100 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Chef Special</span>
                        <p className="font-bold text-xs text-ui-fg-base mt-1">Midnight Surprise Hamper</p>
                        <p className="text-[11px] text-ui-fg-muted mt-0.5">Cake + Rose Bouquet + Candles</p>
                      </div>
                      <Link href="/products" className="text-xs font-bold text-rose-600 mt-2 hover:underline">Shop Special →</Link>
                    </div>
                  </div>
                </section>
              );
            }

            // ── 3d. Breadcrumbs ─────────────────────────────────────────
            case "breadcrumbs": {
              const items = config.items || [
                { label: "Home", url: "/" },
                { label: config.parent_label || "Artisanal Cakes", url: "/products" },
                { label: config.current_label || "Gourmet Collection", url: "" },
              ];

              return (
                <nav key={sectionKey} aria-label="Breadcrumb" className="w-full py-2.5 px-4 bg-ui-bg-subtle/60 rounded-xl border border-ui-border-base my-2 text-xs">
                  <ol className="flex items-center gap-1.5 flex-wrap text-ui-fg-subtle">
                    {items.map((item: any, idx: number) => {
                      const isLast = idx === items.length - 1;
                      return (
                        <li key={idx} className="flex items-center gap-1.5">
                          {idx > 0 && <span className="text-ui-fg-muted">/</span>}
                          {isLast || !item.url ? (
                            <span className="font-bold text-ui-fg-base">{item.label}</span>
                          ) : (
                            <Link href={item.url} className="hover:text-rose-600 transition-colors">
                              {item.label}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </nav>
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

            // ── 6. Image + Text / Brand Story / Craftsmanship / Kitchen ─────
            case "image_text":
            case "brand_story":
            case "our_bakery":
            case "our_kitchen":
            case "founder_story":
            case "craftsmanship":
            case "ingredients":
            case "behind_the_scenes":
            case "meet_the_bakers": {
              const defaultHeading =
                section.type === "our_bakery" ? "Welcome to CakeToHome Bakery" :
                section.type === "our_kitchen" ? "Inside Our State-of-the-Art Kitchen" :
                section.type === "founder_story" ? "Crafted With Passion Since Day One" :
                section.type === "craftsmanship" ? "The Art of Slow Baking & Hand Decoration" :
                section.type === "ingredients" ? "Only Pure, Unadulterated Ingredients" :
                section.type === "behind_the_scenes" ? "Morning Magic: From Oven to Doorstep" :
                section.type === "meet_the_bakers" ? "Master Pâtissiers Dedicated to Perfection" :
                "Handcrafted with Pure Ingredients";

              const heading = config.heading || defaultHeading;
              const body = config.body || "At CakeToHome, our master bakers use only premium Belgian dark chocolate, Madagascar bourbon vanilla beans, and farm-fresh seasonal fruits.";
              const desktopImageUrl = config.image_url || config.desktop_image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
              const tabletImageUrl = config.tablet_image_url || desktopImageUrl;
              const mobileImageUrl = config.mobile_image_url || desktopImageUrl;
              const imageAlt = config.image_alt || heading;
              const badgeText = config.badge_text || "About Our Kitchen";
              const ctaText = config.cta_text;
              const ctaUrl = config.cta_url || "/products";
              const imagePosition = config.image_position || "left";
              const objectFit = (config.image_fit || "cover") as "cover" | "contain";
              const objectPosition = config.image_position_align || "center";

              return (
                <section key={sectionKey} className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-ui-bg-subtle/40 p-6 sm:p-10 rounded-3xl border border-ui-border-base ${imagePosition === "right" ? "md:grid-flow-dense" : ""}`}>
                  <div className={`relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md ${imagePosition === "right" ? "md:col-start-2" : ""}`}>
                    <picture>
                      {mobileImageUrl && <source media="(max-width: 640px)" srcSet={mobileImageUrl} />}
                      {tabletImageUrl && <source media="(max-width: 1024px)" srcSet={tabletImageUrl} />}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={desktopImageUrl}
                        alt={imageAlt}
                        className="w-full h-full"
                        style={{ objectFit, objectPosition }}
                        loading="lazy"
                      />
                    </picture>
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

            // ── 7. Features / Benefits / Trust Badges / Promises ─────────
            case "features":
            case "trust_badges":
            case "payment_methods":
            case "delivery_information":
            case "contact_information":
            case "why_choose_us":
            case "certifications":
            case "quality_promise":
            case "freshness_promise":
            case "delivery_promise": {
              const defaultHeading =
                section.type === "payment_methods" ? "💳 100% Secure Payment Options" :
                section.type === "delivery_information" ? "🚚 Express Cake Delivery Information" :
                section.type === "contact_information" ? "📞 Contact CakeToHome Bakery Hub" :
                section.type === "trust_badges" ? "🛡️ Our Trust & Safety Guarantee" :
                section.type === "certifications" ? "🏆 Certified Bakery Standards" :
                section.type === "why_choose_us" ? "🌟 Why Bangalore Chooses CakeToHome" :
                section.type === "quality_promise" ? "✨ The Master Baker's Quality Pledge" :
                section.type === "freshness_promise" ? "🌿 Baked Fresh Daily — Zero Preservatives" :
                section.type === "delivery_promise" ? "🚚 Guaranteed On-Time Chilled Delivery" :
                "Why CakeToHome is Bangalore's #1 Choice";

              const heading = config.heading || defaultHeading;

              const defaultFeatures = section.type === "payment_methods" ? [
                { icon: "ShieldCheck", title: "Instant UPI", desc: "Google Pay, PhonePe, Paytm, BHIM with zero transaction fees" },
                { icon: "Award", title: "Credit & Debit Cards", desc: "Visa, Mastercard, RuPay, Amex processed via 256-bit SSL" },
                { icon: "Clock", title: "NetBanking", desc: "Direct payment through 50+ leading Indian banks" },
                { icon: "Sparkles", title: "Cash / Pay on Handover", desc: "Pay seamlessly when your fresh cake reaches your doorstep" },
              ] : section.type === "delivery_information" ? [
                { icon: "Truck", title: "2-Hour Express Delivery", desc: "Fast-track delivery across all Bangalore localities" },
                { icon: "Clock", title: "Guaranteed Midnight Slot", desc: "11:30 PM to 12:05 AM surprise birthday & anniversary slots" },
                { icon: "ShieldCheck", title: "Chiller Van Fleet", desc: "Air-conditioned cold chain transit protects delicate fondant" },
                { icon: "Gift", title: "Free Express Delivery", desc: "Enjoy zero delivery fee on all gourmet orders above ₹499" },
              ] : section.type === "contact_information" ? [
                { icon: "Clock", title: "Phone Hotline", desc: "+91 98765 43210 (Available 8:00 AM – 11:30 PM daily)" },
                { icon: "Sparkles", title: "WhatsApp Desk", desc: "Instant response for bespoke design cake enquiries" },
                { icon: "Award", title: "Flagship Kitchen", desc: "100ft Road, HAL 2nd Stage, Indiranagar, Bengaluru" },
                { icon: "Heart", title: "Email Support", desc: "hello@caketohome.com — replies within 15 minutes" },
              ] : section.type === "certifications" ? [
                { icon: "ShieldCheck", title: "FSSAI Registered", desc: "100% compliant food safety and hygiene audited commercial kitchens" },
                { icon: "Award", title: "ISO 22000 Standards", desc: "International food manufacturing safety and sanitation protocols" },
                { icon: "Sparkles", title: "Pure Belgian Cocoa", desc: "Directly imported single-origin Callebaut chocolate" },
                { icon: "Heart", title: "Organic Farm Dairy", desc: "Fresh hormone-free pasteurized dairy butter and heavy cream" },
              ] : section.type === "trust_badges" ? [
                { icon: "ShieldCheck", title: "100% Safe Payments", desc: "256-bit encrypted checkout via UPI, Cards, NetBanking" },
                { icon: "Truck", title: "Contactless Handover", desc: "Tamper-evident food grade sealed delivery boxes" },
                { icon: "Clock", title: "Real-Time GPS Tracking", desc: "Live rider updates from kitchen oven to your doorstep" },
                { icon: "Award", title: "Taste Guarantee", desc: "Loved by over 50,000+ happy celebrators across India" },
              ] : [
                { icon: "Truck", title: "2-Hour Express Delivery", desc: "Fastest doorstep cake delivery across Bangalore" },
                { icon: "Sparkles", title: "Artisan Quality", desc: "Premium gourmet cakes crafted with Belgian chocolate and fresh fruits" },
                { icon: "Clock", title: "Midnight Delivery", desc: "Special midnight surprise slots (11:30 PM - 12:05 AM)" },
                { icon: "ShieldCheck", title: "Artisanal Fresh Baking", desc: "Baked fresh after order placement with zero preservatives" },
              ];

              const rawFeaturesList = (config.features && config.features.length > 0) ? config.features : defaultFeatures;
              const featuresList = rawFeaturesList.filter((feat: any) => feat.visible !== false && feat.enabled !== false);
              const columns = parseInt(String(config.columns)) || 4;
              const alignment = config.alignment || "center";
              const subtitle = config.subtitle || config.subheading || "";

              const colsClass =
                columns === 1 ? "grid-cols-1" :
                columns === 2 ? "grid-cols-1 sm:grid-cols-2" :
                columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
                columns === 6 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" :
                columns === 8 ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8" :
                columns === 12 ? "grid-cols-3 sm:grid-cols-6 lg:grid-cols-12" :
                "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

              const alignClass =
                alignment === "left" ? "text-left items-start" :
                alignment === "right" ? "text-right items-end" :
                "text-center items-center";

              const getIcon = (iconName: string, customColor?: string) => {
                if (!iconName) return <Sparkles className="w-6 h-6" style={{ color: customColor || "#f43f5e" }} />;
                // Direct emoji detection
                if (/\p{Extended_Pictographic}/u.test(iconName) || (iconName.length <= 4 && !/^[a-zA-Z]+$/.test(iconName))) {
                  return <span className="text-2xl leading-none select-none">{iconName}</span>;
                }
                const colorStyle = customColor ? { color: customColor } : undefined;
                const baseClass = "w-6 h-6";
                const lower = iconName.toLowerCase().replace(/[-_]/g, "");

                if (lower.includes("truck") || lower.includes("delivery") || lower.includes("shipping")) {
                  return <Truck className={baseClass} style={colorStyle || { color: "#f43f5e" }} />;
                }
                if (lower.includes("shield") || lower.includes("secure") || lower.includes("safe") || lower.includes("hygiene")) {
                  return <ShieldCheck className={baseClass} style={colorStyle || { color: "#10b981" }} />;
                }
                if (lower.includes("clock") || lower.includes("time") || lower.includes("hour") || lower.includes("midnight")) {
                  return <Clock className={baseClass} style={colorStyle || { color: "#6366f1" }} />;
                }
                if (lower.includes("heart") || lower.includes("love") || lower.includes("care")) {
                  return <Heart className={baseClass} style={colorStyle || { color: "#ec4899" }} />;
                }
                if (lower.includes("star") || lower.includes("rate") || lower.includes("review")) {
                  return <Star className={baseClass} style={colorStyle || { color: "#eab308" }} />;
                }
                if (lower.includes("gift") || lower.includes("present") || lower.includes("box")) {
                  return <Gift className={baseClass} style={colorStyle || { color: "#a855f7" }} />;
                }
                if (lower.includes("award") || lower.includes("medal") || lower.includes("cert") || lower.includes("iso")) {
                  return <Award className={baseClass} style={colorStyle || { color: "#3b82f6" }} />;
                }
                if (lower.includes("zap") || lower.includes("bolt") || lower.includes("express") || lower.includes("fast")) {
                  return <Zap className={baseClass} style={colorStyle || { color: "#eab308" }} />;
                }
                if (lower.includes("check")) {
                  return <CheckCircle2 className={baseClass} style={colorStyle || { color: "#10b981" }} />;
                }
                if (lower.includes("tag") || lower.includes("price") || lower.includes("offer") || lower.includes("discount")) {
                  return <Tag className={baseClass} style={colorStyle || { color: "#f43f5e" }} />;
                }
                if (lower.includes("smile") || lower.includes("happy") || lower.includes("joy")) {
                  return <Smile className={baseClass} style={colorStyle || { color: "#f59e0b" }} />;
                }
                return <Sparkles className={baseClass} style={colorStyle || { color: "#f43f5e" }} />;
              };

              return (
                <section key={sectionKey} className={`flex flex-col gap-6 w-full ${alignClass}`}>
                  {(heading || subtitle) && (
                    <div className={`flex flex-col gap-1.5 w-full ${alignClass}`}>
                      {heading && (
                        <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                          {heading}
                        </Heading>
                      )}
                      {subtitle && (
                        <Text className="text-xs sm:text-sm text-ui-fg-muted max-w-2xl">
                          {subtitle}
                        </Text>
                      )}
                    </div>
                  )}

                  <div className={`grid ${colsClass} gap-4 w-full text-left`}>
                    {featuresList.map((feat: any, i: number) => {
                      const cardStyle: React.CSSProperties = {
                        backgroundColor: feat.bg_color || undefined,
                        borderColor: feat.border_color || undefined,
                      };
                      const titleStyle: React.CSSProperties = {
                        color: feat.title_color || undefined,
                      };
                      const descStyle: React.CSSProperties = {
                        color: feat.description_color || undefined,
                      };

                      const cardContent = (
                        <div
                          key={feat.id || i}
                          className="p-5 rounded-2xl bg-ui-bg-base border border-ui-border-base flex flex-col gap-2.5 shadow-sm hover:shadow-md transition-all h-full"
                          style={cardStyle}
                        >
                          <div
                            className="p-3 rounded-xl w-fit"
                            style={{
                              backgroundColor: feat.bg_color ? "rgba(0,0,0,0.05)" : "#f8fafc",
                            }}
                          >
                            {getIcon(feat.icon, feat.icon_color)}
                          </div>
                          <h4 className="font-bold text-sm text-ui-fg-base" style={titleStyle}>
                            {feat.title}
                          </h4>
                          <p className="text-xs text-ui-fg-muted leading-relaxed" style={descStyle}>
                            {feat.description || feat.desc}
                          </p>
                          {feat.link_url && (
                            <span className="text-xs font-bold text-rose-600 hover:underline mt-auto pt-1 flex items-center gap-1">
                              {feat.link_text || "Learn more"} →
                            </span>
                          )}
                        </div>
                      );

                      if (feat.link_url) {
                        return (
                          <Link
                            key={feat.id || i}
                            href={feat.link_url}
                            target={feat.open_in_new_tab ? "_blank" : undefined}
                            rel={feat.open_in_new_tab ? "noopener noreferrer" : undefined}
                            className="block h-full"
                          >
                            {cardContent}
                          </Link>
                        );
                      }
                      return <div key={feat.id || i} className="h-full">{cardContent}</div>;
                    })}
                  </div>
                </section>
              );
            }

            // ── 8. FAQ Section ──────────────────────────────────────────
            case "faq":
            case "accordion": {
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

            // ── 9. Location Coverage & Delivery Logistics ───────────────
            case "delivery_time_selector": {
              const heading = config.heading || "🕒 Select Your Preferred Delivery Time Slot";
              const subheading = config.subheading || "Cakes are baked to order within 45 minutes of scheduled dispatch";
              return <DeliveryTimeSlotPicker heading={heading} subheading={subheading} />;
            }

            case "delivery_availability": {
              const heading = config.heading || "⚡ Check Delivery Availability in Your Area";
              const subheading = config.subheading || "Enter your 6-digit Bangalore postal code for instant cutoff calculation";
              return <PincodeServiceabilityWidget heading={heading} subheading={subheading} theme={theme} />;
            }

            case "location_coverage":
            case "delivery_zones":
            case "serviceability_map":
            case "same_day_delivery_info":
            case "midnight_delivery_info": {
              const defaultHeading =
                section.type === "delivery_zones" ? "🗺️ Our Express Bakery Delivery Zones" :
                section.type === "serviceability_map" ? "📍 Serviceability Hubs Across Bangalore" :
                section.type === "same_day_delivery_info" ? "🚀 2-Hour Same-Day Cake Delivery" :
                section.type === "midnight_delivery_info" ? "🌙 Midnight Surprise Delivery Slots" :
                "📍 We Deliver Fresh Cakes Across Bangalore";

              const defaultSubheading =
                section.type === "midnight_delivery_info" ? "Order before 8 PM for guaranteed delivery between 11:30 PM and 12:05 AM." :
                section.type === "same_day_delivery_info" ? "Order by 6 PM for same-day evening celebration delivery." :
                "Same-day & 2-hour express delivery available in all major clusters";

              const heading = config.heading || defaultHeading;
              const subheading = config.subheading || defaultSubheading;
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

            // ── 10. Text / SEO / Rich Content / Links Block ─────────────
            case "text_content":
            case "rich_text":
            case "seo_content":
            case "location_content":
            case "internal_links": {
              const heading = config.heading || (
                section.type === "location_content" ? "Local Cake Delivery Guide" :
                section.type === "internal_links" ? "Popular Categories & Collections" :
                "Artisanal Cake Delivery"
              );
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

            // ── 10b. Blog Grid, Blog Carousel & Featured Article ─────────
            case "blog_grid":
            case "blog_carousel":
            case "featured_article": {
              const heading = config.heading || (
                section.type === "featured_article" ? "Featured Story from Our Kitchen" :
                "The Sweet Gazette • Cake Trends & Baking Guides"
              );
              const subheading = config.subheading || "Tips, recipes, celebration ideas, and behind-the-scenes bakery stories";
              const isCarousel = section.type === "blog_carousel" || config.layout === "carousel";
              const isFeatured = section.type === "featured_article";

              const defaultArticles = [
                {
                  id: "b1",
                  title: "How to Choose the Perfect Cake Size for Your Party (Guest Calculation Guide)",
                  excerpt: "Never run short or waste cake again. Our master baker's easy formula for matching kilograms to party guests.",
                  author: "Chef Alexandre",
                  date: "Sep 2, 2026",
                  read_time: "4 min read",
                  image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80",
                  slug: "cake-size-party-guide",
                },
                {
                  id: "b2",
                  title: "Why Temperature-Controlled Chiller Vans Matter for Multi-Tier Cakes",
                  excerpt: "Learn how CakeToHome protects delicate ganache and royal floral fondants from Bangalore heat during transit.",
                  author: "Logistics Team",
                  date: "Aug 28, 2026",
                  read_time: "3 min read",
                  image: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=600&q=80",
                  slug: "chiller-van-delivery-logistics",
                },
                {
                  id: "b3",
                  title: "Top 7 Eggless Cake Flavors That Taste Even Richer Than Traditional Cakes",
                  excerpt: "Discover how Belgian cocoa, condensed dairy, and slow aeration create our signature fluffy eggless texture.",
                  author: "Pastry Guild",
                  date: "Aug 20, 2026",
                  read_time: "5 min read",
                  image: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=600&q=80",
                  slug: "top-eggless-cake-flavors",
                },
              ];

              const articles = (config.articles && config.articles.length > 0) ? config.articles : defaultArticles;

              if (isFeatured) {
                const article = articles[0];
                return (
                  <section key={sectionKey} className="w-full bg-ui-bg-subtle/50 p-6 sm:p-10 rounded-3xl border border-ui-border-base">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden shadow-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={article.image} alt={article.title} className="w-full h-full object-cover" loading="lazy" />
                        <span className="absolute top-3 left-3 px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold uppercase rounded-full">Featured Article</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs text-ui-fg-muted">
                          <span>{article.author}</span>
                          <span>•</span>
                          <span>{article.date}</span>
                          <span>•</span>
                          <span>{article.read_time}</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-ui-fg-base">{article.title}</h3>
                        <p className="text-sm text-ui-fg-muted leading-relaxed">{article.excerpt}</p>
                        <Link href={`/blog/${article.slug}`} className="text-xs font-bold text-rose-600 hover:text-rose-700 pt-2 flex items-center gap-1">
                          Read Full Article →
                        </Link>
                      </div>
                    </div>
                  </section>
                );
              }

              return (
                <section key={sectionKey} className="flex flex-col gap-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                    <div>
                      <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight text-ui-fg-base">
                        {heading}
                      </Heading>
                      {subheading && <Text className="text-xs sm:text-sm text-ui-fg-muted mt-1">{subheading}</Text>}
                    </div>
                    <Link href="/blog" className="text-xs font-bold text-rose-600 hover:text-rose-700">
                      View All Articles →
                    </Link>
                  </div>
                  <div className={`grid ${isCarousel ? "flex overflow-x-auto snap-x gap-4 pb-2" : "grid-cols-1 md:grid-cols-3 gap-6"}`}>
                    {articles.map((art: any, ai: number) => (
                      <article key={art.id || ai} className={`p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${isCarousel ? "min-w-[280px] max-w-[320px] snap-start" : ""}`}>
                        <div>
                          <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={art.image} alt={art.title} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-ui-fg-muted mb-1.5">
                            <span>{art.date}</span>
                            <span>•</span>
                            <span>{art.read_time}</span>
                          </div>
                          <h4 className="font-bold text-sm text-ui-fg-base line-clamp-2 leading-snug">{art.title}</h4>
                          <p className="text-xs text-ui-fg-muted line-clamp-2 mt-1">{art.excerpt}</p>
                        </div>
                        <Link href={`/blog/${art.slug}`} className="text-xs font-bold text-rose-600 hover:underline mt-3 block">
                          Read More →
                        </Link>
                      </article>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 10c. Related Content / Discovery Links ───────────────────
            case "related_categories_content":
            case "related_products_content": {
              const isCategory = section.type === "related_categories_content";
              const heading = config.heading || (isCategory ? "Explore Related Cake Categories" : "You May Also Like These Treats");
              const items = isCategory
                ? (allCategories.slice(0, 8).map((c: any) => ({ label: c.name, url: `/products?category=${c.slug || c.id}` })))
                : (allProducts.slice(0, 6).map((p: any) => ({ label: p.title || p.name, url: `/products/${p.slug || p.id}` })));

              return (
                <section key={sectionKey} className="p-6 bg-ui-bg-subtle/40 rounded-2xl border border-ui-border-base flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-ui-fg-base">{heading}</h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((it: any, ii: number) => (
                      <Link
                        key={ii}
                        href={it.url}
                        className="px-3 py-1.5 rounded-full bg-white dark:bg-ui-bg-base border border-ui-border-base text-xs font-semibold text-ui-fg-base hover:border-rose-400 hover:text-rose-600 transition-colors shadow-xs"
                      >
                        {it.label}
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 11. Call to Action Block ────────────────────────────────
            case "cta":
            case "shop_now_cta":
            case "free_delivery_banner":
            case "same_day_delivery_cta":
            case "midnight_delivery_cta":
            case "custom_cake_cta":
            case "corporate_orders_cta":
            case "whatsapp_cta":
            case "whatsapp_cta_lead":
            case "app_download": {
              const heading = config.heading || (
                section.type === "app_download" ? "📱 Download the CakeToHome Mobile App" :
                section.type === "free_delivery_banner" ? "🚚 Free Express Delivery" :
                section.type === "midnight_delivery_cta" ? "🌙 Midnight Cake Surprise Delivery" :
                section.type === "same_day_delivery_cta" ? "⚡ Same-Day Delivery in 2 Hours" :
                section.type === "custom_cake_cta" ? "🎨 Design Your Dream Cake" :
                section.type === "corporate_orders_cta" ? "🏢 Corporate Bulk Gifting & Events" :
                section.type === "whatsapp_cta" ? "💬 Order Directly on WhatsApp" :
                "Ready to Celebrate?"
              );
              const subheading = config.subheading || (
                section.type === "app_download" ? "Get ₹150 OFF your first order + live GPS cake delivery tracking." :
                section.type === "whatsapp_cta" ? "Chat directly with our master bakers for bespoke orders and instant quotes." :
                "Order handcrafted cakes baked fresh and delivered in 2 hours."
              );
              const ctaText = config.cta_text || (section.type === "app_download" ? "Get the App" : section.type === "whatsapp_cta" ? "Chat on WhatsApp" : "Order Now");
              const ctaUrl = config.cta_url || (section.type === "whatsapp_cta" ? "https://wa.me/919876543210" : "/products");
              const isWhatsapp = section.type === "whatsapp_cta" || config.style === "whatsapp";

              return (
                <section key={sectionKey} className={`w-full p-8 sm:p-12 rounded-3xl text-white text-center flex flex-col items-center gap-4 shadow-xl ${
                  isWhatsapp ? "bg-gradient-to-r from-emerald-600 to-teal-700" : "bg-gradient-to-r from-rose-600 to-pink-600"
                }`}>
                  {isWhatsapp && <MessageCircle className="w-10 h-10 text-white animate-bounce" />}
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

            // ── 12. Deal Banner / Flash Sale / Offers ────────────────────
            case "deal_banner":
            case "campaign_banner":
            case "limited_time_offer":
            case "flash_sale":
            case "coupon_banner": {
              const heading = config.heading || "⚡ Limited-Time Weekend Flash Sale";
              const subheading = config.subheading || "Enjoy flat 25% OFF on all gourmet truffle and velvet cakes";
              const couponCode = config.coupon_code || "CELEBRATE25";
              const discountText = config.discount_text || "FLAT 25% OFF";
              const ctaText = config.cta_text || "Claim Offer";
              const ctaUrl = config.cta_url || "/products";

              return (
                <section key={sectionKey} className="w-full p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-amber-500 via-rose-600 to-purple-700 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col gap-2 max-w-xl text-center md:text-left z-10">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-white/20 backdrop-blur-md uppercase tracking-wider text-white">
                        {discountText}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Limited Time
                      </span>
                    </div>
                    <Heading level="h2" className="text-2xl sm:text-3xl font-extrabold text-white">
                      {heading}
                    </Heading>
                    <Text className="text-sm text-white/90">
                      {subheading}
                    </Text>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 z-10">
                    {couponCode && (
                      <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20">
                        <Tag className="w-4 h-4 text-amber-300" />
                        <span className="font-mono font-bold text-sm tracking-wider">{couponCode}</span>
                      </div>
                    )}
                    <Link href={ctaUrl}>
                      <Button size="large" className="bg-white hover:bg-white/90 text-rose-600 font-extrabold px-6 py-2.5 rounded-xl shadow-lg border-none whitespace-nowrap">
                        {ctaText} →
                      </Button>
                    </Link>
                  </div>
                </section>
              );
            }

            // ── 13. Product Spotlight ───────────────────────────────────
            case "product_spotlight":
            case "product_spotlight_cta": {
              const heading = config.heading || "Chef's Signature Creation";
              const targetProduct = (config.product_id && allProducts.find((p: any) => (p.id || p.product_id) === config.product_id)) || allProducts[0];

              if (!targetProduct) return null;

              const title = targetProduct.title || targetProduct.name || "Artisan Cake";
              const price = targetProduct.price || targetProduct.base_price || 699;
              const originalPrice = targetProduct.original_price || price + 200;
              const image = targetProduct.thumbnail || targetProduct.image_url || targetProduct.images?.[0]?.url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
              const slug = targetProduct.slug || targetProduct.id;
              const desc = config.description || targetProduct.description || "Master chocolatier crafted layered cake with rich Belgian ganache and airy sponge.";

              return (
                <section key={sectionKey} className="w-full bg-ui-bg-subtle/50 p-6 sm:p-10 rounded-3xl border border-ui-border-base flex flex-col gap-6">
                  {heading && (
                    <div className="text-center max-w-xl mx-auto flex flex-col gap-1">
                      <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Spotlight</span>
                      <Heading level="h2" className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                        {heading}
                      </Heading>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
                    <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-lg border border-ui-border-base group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md">
                        Signature Recipe
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span>4.9 / 5.0</span>
                        <span className="text-ui-fg-muted font-normal">(184 verified reviews)</span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-ui-fg-base leading-tight">
                        {title}
                      </h3>
                      <p className="text-sm text-ui-fg-muted leading-relaxed">
                        {desc}
                      </p>
                      <div className="flex items-baseline gap-3 pt-1">
                        <span className="text-2xl sm:text-3xl font-black text-ui-fg-base">₹{price.toLocaleString()}</span>
                        {originalPrice > price && (
                          <span className="text-sm text-ui-fg-muted line-through">₹{originalPrice.toLocaleString()}</span>
                        )}
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                          Save ₹{(originalPrice - price).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs text-ui-fg-subtle">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ui-bg-base border">🌱 100% Eggless Option</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ui-bg-base border">⚡ 2-Hour Express Delivery</span>
                      </div>
                      <div className="pt-2">
                        <Link href={`/products/${slug}`}>
                          <Button variant="primary" size="large" className="rounded-xl px-8 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md">
                            <ShoppingBag className="w-4 h-4 mr-2" /> Order This Cake
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </section>
              );
            }

            // ── 14. Product Comparison Table ────────────────────────────
            case "comparison_table":
            case "product_comparison": {
              const heading = config.heading || "Compare Artisan Cakes";
              const compareProducts = (config.product_ids && config.product_ids.length > 0)
                ? config.product_ids.map((id: string) => allProducts.find((p: any) => (p.id || p.product_id) === id)).filter(Boolean)
                : allProducts.slice(0, 3);

              if (compareProducts.length < 2) {
                return <ProductComparisonTable heading={heading} subheading="Find the perfect cake for your guest count and budget" />;
              }

              return (
                <section key={sectionKey} className="w-full flex flex-col gap-6">
                  <div className="text-center max-w-xl mx-auto flex flex-col gap-1">
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    <Text className="text-xs sm:text-sm text-ui-fg-subtle">Find the perfect cake for your guest count and budget</Text>
                  </div>
                  <div className="overflow-x-auto border border-ui-border-base rounded-2xl bg-ui-bg-base shadow-sm">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-ui-border-base bg-ui-bg-subtle/50">
                          <th className="p-4 font-bold text-ui-fg-muted w-1/4">Feature</th>
                          {compareProducts.map((p: any) => (
                            <th key={p.id} className="p-4 font-bold text-center w-1/4">
                              <span className="line-clamp-1">{p.title}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui-border-base">
                        <tr>
                          <td className="p-4 font-semibold text-ui-fg-muted">Starting Price</td>
                          {compareProducts.map((p: any) => (
                            <td key={p.id} className="p-4 text-center font-black text-rose-600">
                              ₹{(p.price || p.base_price || 499).toLocaleString()}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-ui-fg-muted">Customer Rating</td>
                          {compareProducts.map((p: any) => (
                            <td key={p.id} className="p-4 text-center font-bold text-amber-500">
                              ★ {p.rating || "4.9"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-ui-fg-muted">Flavour Profile</td>
                          {compareProducts.map((p: any) => (
                            <td key={p.id} className="p-4 text-center text-ui-fg-muted">
                              {p.flavor || p.category || "Signature Recipe"}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-ui-fg-muted">Dietary Option</td>
                          {compareProducts.map((p: any) => (
                            <td key={p.id} className="p-4 text-center text-emerald-600 font-semibold">
                              ✓ Eggless Available
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-ui-fg-muted">Delivery Speed</td>
                          {compareProducts.map((p: any) => (
                            <td key={p.id} className="p-4 text-center text-ui-fg-base">
                              ⚡ Express 2-Hour
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-ui-fg-muted">Action</td>
                          {compareProducts.map((p: any) => (
                            <td key={p.id} className="p-4 text-center">
                              <Link href={`/products/${p.slug || p.id}`}>
                                <Button size="small" variant="primary" className="rounded-xl px-4 text-xs font-bold">
                                  Order Now
                                </Button>
                              </Link>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            }

            // ── 15. Category Explorers & Pill Filter Cloud ──────────────
            case "category_explorer":
            case "cake_type_explorer":
            case "flavor_explorer":
            case "weight_explorer":
            case "price_range_explorer":
            case "category_tiles": {
              const heading = config.heading || (
                section.type === "flavor_explorer" ? "Explore by Flavour" :
                section.type === "weight_explorer" ? "Shop by Cake Weight" :
                section.type === "price_range_explorer" ? "Shop by Price Range" :
                "Browse Cake Categories"
              );
              const items = allCategories.length > 0 ? allCategories : [
                { id: "c1", name: "Chocolate Cakes", slug: "chocolate" },
                { id: "c2", name: "Red Velvet", slug: "red-velvet" },
                { id: "c3", name: "Fruit Cakes", slug: "fruit-cakes" },
                { id: "c4", name: "Butterscotch", slug: "butterscotch" },
                { id: "c5", name: "Black Forest", slug: "black-forest" },
                { id: "c6", name: "Cheesecakes", slug: "cheesecakes" },
              ];

              return (
                <section key={sectionKey} className="w-full flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                    <Link href="/products" className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
                      View Catalog <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {items.map((cat: any) => (
                      <Link
                        key={cat.id}
                        href={`/products?category=${cat.slug || cat.id}`}
                        className="px-4 py-2 rounded-2xl bg-ui-bg-base border border-ui-border-base hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-2 group"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-500 group-hover:rotate-12 transition-transform" />
                        <span>{cat.name}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 16. Testimonials & Verified Reviews ─────────────────────
            case "testimonials":
            case "reviews":
            case "review_carousel": {
              const heading = config.heading || "Sweet Celebrations • Customer Reviews";
              const defaultReviews = [
                { name: "Priya Sharma", occasion: "1st Birthday • Koramangala", rating: 5, quote: "The Belgian chocolate truffle cake arrived right on time in pristine condition. All 25 guests were raving about how moist and rich it tasted!" },
                { name: "Rohan & Sneha", occasion: "5th Anniversary • Indiranagar", rating: 5, quote: "Ordered the Red Velvet Heart cake for midnight delivery. It was delivered at exactly 11:58 PM with candles and knife included. Amazing service!" },
                { name: "Vikram Mehta", occasion: "Corporate Milestone • Whitefield", rating: 5, quote: "CakeToHome handled our office delivery of 10 customized cakes seamlessly. Flawless presentation and fresh taste." },
              ];
              const reviewsList = (config.testimonials && config.testimonials.length > 0) ? config.testimonials : defaultReviews;

              return (
                <section key={sectionKey} className="w-full flex flex-col gap-6">
                  <div className="text-center max-w-xl mx-auto flex flex-col gap-1">
                    <div className="flex items-center justify-center gap-1 text-amber-500 text-xs font-bold">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="text-ui-fg-base ml-1">4.9 / 5.0 Rating</span>
                    </div>
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {reviewsList.map((rev: any, ri: number) => (
                      <div key={ri} className="p-6 rounded-2xl bg-ui-bg-base border border-ui-border-base flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-1 text-amber-400">
                            {Array.from({ length: rev.rating || 5 }).map((_, si) => (
                              <Star key={si} className="w-3.5 h-3.5 fill-amber-400" />
                            ))}
                          </div>
                          <p className="text-xs sm:text-sm text-ui-fg-muted leading-relaxed italic">
                            &ldquo;{rev.quote}&rdquo;
                          </p>
                        </div>
                        <div className="flex items-center gap-3 pt-2 border-t border-ui-border-base/50">
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                            {rev.name ? rev.name.charAt(0) : "C"}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-ui-fg-base">{rev.name || "Happy Customer"}</h4>
                            <p className="text-[10px] text-ui-fg-subtle">{rev.occasion || "Verified Buyer"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 17. Statistics Counter Strip ────────────────────────────
            case "statistics":
            case "rating_summary": {
              const defaultStats = [
                { value: "50,000+", label: "Cakes Delivered" },
                { value: "99.8%", label: "On-Time Delivery" },
                { value: "4.9 ★", label: "Average Rating" },
                { value: "2 Hours", label: "Express Doorstep Speed" },
              ];
              const statsList = (config.stats && config.stats.length > 0) ? config.stats : defaultStats;

              return (
                <section key={sectionKey} className="w-full py-8 px-6 bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 dark:from-rose-950/20 dark:via-pink-950/20 dark:to-amber-950/20 rounded-3xl border border-ui-border-base">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                    {statsList.map((st: any, idx: number) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-2xl sm:text-4xl font-black text-rose-600 tracking-tight">
                          {st.value}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-ui-fg-muted">
                          {st.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 18. Milestone Timeline ──────────────────────────────────
            case "timeline":
            case "bakery_timeline":
            case "quality_process": {
              const heading = config.heading || "Our Journey of Artisanal Baking";
              const defaultEvents = [
                { year: "2020", title: "The First Micro-Bakery", desc: "Started baking handcrafted Belgian chocolate cakes in a boutique kitchen in Indiranagar." },
                { year: "2022", title: "Express 2-Hour Delivery", desc: "Engineered shock-proof cake domes and cold-chain temperature control for pristine doorstep delivery." },
                { year: "2024", title: "50,000+ Celebrations", desc: "Expanded across all Bangalore clusters with zero preservatives and 100% fresh baking policy." },
              ];
              const events = (config.events && config.events.length > 0) ? config.events : defaultEvents;

              return (
                <section key={sectionKey} className="w-full flex flex-col gap-8 max-w-4xl mx-auto">
                  <div className="text-center flex flex-col gap-1">
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Heritage</span>
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                  </div>
                  <div className="flex flex-col gap-6 relative before:absolute before:left-4 md:before:left-1/2 before:top-2 before:bottom-2 before:w-0.5 before:bg-rose-200 dark:before:bg-rose-900">
                    {events.map((ev: any, ei: number) => (
                      <div key={ei} className="flex items-start gap-4 md:gap-8 relative">
                        <div className="w-8 h-8 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center shrink-0 z-10 shadow-md">
                          {ei + 1}
                        </div>
                        <div className="flex-1 p-5 rounded-2xl bg-ui-bg-base border border-ui-border-base shadow-sm">
                          <span className="text-xs font-black text-rose-600">{ev.year}</span>
                          <h4 className="font-bold text-sm text-ui-fg-base mt-0.5">{ev.title}</h4>
                          <p className="text-xs text-ui-fg-muted mt-1 leading-relaxed">{ev.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            // ── 19. Gallery & Video Gallery ─────────────────────────────
            case "gallery":
            case "video_gallery":
            case "image_gallery":
            case "kitchen_gallery": {
              const heading = config.heading || "Fresh from Our Kitchen Domes";
              const defaultImages = [
                { url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600", caption: "Belgian Truffle Drip" },
                { url: "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=600", caption: "Red Velvet Heart" },
                { url: "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=600", caption: "Berry Bliss Gateau" },
              ];
              const images = (config.images && config.images.length > 0) ? config.images : defaultImages;

              return (
                <section key={sectionKey} className="w-full flex flex-col gap-6">
                  {heading && (
                    <Heading level="h2" className="text-xl sm:text-2xl font-bold tracking-tight text-center" style={{ color: theme?.heading_color }}>
                      {heading}
                    </Heading>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((img: any, ii: number) => {
                      const imgUrl = typeof img === "string" ? img : img.url;
                      const caption = typeof img === "object" ? img.caption : "";
                      return (
                        <div key={ii} className="relative rounded-2xl overflow-hidden aspect-[4/3] group border border-ui-border-base shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imgUrl} alt={caption || "Cake Gallery"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                          {caption && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                              <span className="text-white text-xs font-bold">{caption}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            }

            // ── 20. Pull Quote ──────────────────────────────────────────
            case "quote": {
              const quoteText = config.text || "“A birthday without cake is just a meeting. We believe every cake should be a masterwork of flavour and love.”";
              const author = config.author || "Chef Alexandre";
              const role = config.role || "Master Patissier, CakeToHome";

              return (
                <section key={sectionKey} className="max-w-3xl mx-auto w-full p-8 rounded-3xl bg-ui-bg-subtle/50 border border-ui-border-base text-center flex flex-col items-center gap-4">
                  <QuoteIcon className="w-8 h-8 text-rose-400 rotate-180 opacity-60" />
                  <p className="text-base sm:text-xl font-serif italic text-ui-fg-base leading-relaxed">
                    {quoteText}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-xs sm:text-sm text-ui-fg-base">{author}</span>
                    <span className="text-[11px] text-ui-fg-muted">{role}</span>
                  </div>
                </section>
              );
            }

            // ── 21. Interactive Lead Generation Forms ───────────────────
            case "contact_form":
            case "newsletter":
            case "corporate_enquiry":
            case "custom_cake_enquiry":
            case "bulk_order_form":
            case "callback_request":
            case "event_cake_enquiry":
            case "whatsapp_cta_lead": {
              const heading = config.heading || (
                section.type === "newsletter" ? "Stay Sweet • Exclusive Offers & Flavors" :
                section.type === "corporate_enquiry" ? "Corporate Gifting & Bulk Order Enquiry" :
                section.type === "custom_cake_enquiry" ? "Custom Cake Design Request" :
                section.type === "callback_request" ? "Request a Callback from Our Chef" :
                "Get in Touch with Our Bakers"
              );
              const subheading = config.subheading || "Have a special celebration coming up? Our concierge responds within 15 minutes.";
              const submitText = config.submit_text || "Send Request";

              return (
                <InteractiveLeadForm
                  sectionKey={sectionKey}
                  sectionType={section.type}
                  heading={heading}
                  subheading={subheading}
                  submitText={submitText}
                  successMsg={config.success_message}
                  theme={theme}
                />
              );
            }

            // ── 22. Store Locator & Branch Finder ───────────────────────
            case "store_locator":
            case "branch_finder":
            case "branch_locations": {
              const heading = config.heading || (section.type === "branch_locations" ? "📍 Our Bakery Flagship Kitchens" : "📍 Find Our Nearest Bakery Hub");
              return <StoreBranchLocator heading={heading} />;
            }

            case "pincode_checker":
            case "city_selector": {
              const heading = config.heading || "📍 Check Delivery Serviceability & Speed";
              const subheading = config.subheading || "Enter your 6-digit Bangalore postal code for instant cutoff calculation";
              return <PincodeServiceabilityWidget heading={heading} subheading={subheading} theme={theme} />;
            }

            // ── 23. Social Links & Footer Preview ───────────────────────
            case "footer":
            case "footer_links":
            case "legal_links":
            case "social_links": {
              const heading = config.heading || "Connect With CakeToHome";
              return (
                <section key={sectionKey} className="w-full py-8 border-t border-ui-border-base text-center flex flex-col items-center gap-3 text-xs text-ui-fg-muted">
                  <span className="font-bold text-sm text-ui-fg-base">{heading}</span>
                  <div className="flex items-center gap-4">
                    <Link href="https://instagram.com" className="p-2 rounded-full bg-ui-bg-subtle hover:text-rose-600 transition-colors">Instagram</Link>
                    <Link href="https://wa.me/919876543210" className="p-2 rounded-full bg-ui-bg-subtle hover:text-emerald-600 transition-colors">WhatsApp</Link>
                    <Link href="https://facebook.com" className="p-2 rounded-full bg-ui-bg-subtle hover:text-blue-600 transition-colors">Facebook</Link>
                  </div>
                  <span className="text-[11px] text-ui-fg-subtle">© {new Date().getFullYear()} CakeToHome. Freshly Baked Artisanal Delights.</span>
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

        const isStickySection =
          section.type === "hero" ||
          section.type === "kitchen_story" ||
          section.type === "scroll_frame";

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
              {isStickySection ? (
                renderSectionContent()
              ) : (
                <SectionMotionWrapper animationConfig={config.animation}>
                  {renderSectionContent()}
                </SectionMotionWrapper>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
