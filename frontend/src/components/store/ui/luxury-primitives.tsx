"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export type SectionTheme = "navy" | "cream" | "white" | "slate" | "luxury-dark" | "soft-blue";

export interface BrandSectionWrapperProps {
  id?: string;
  theme?: SectionTheme | string;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
  paddingY?: "none" | "compact" | "normal" | "spacious" | "hero";
  fullWidth?: boolean;
}

export function BrandSectionWrapper({
  id,
  theme = "white",
  className = "",
  containerClassName = "",
  children,
  paddingY = "normal",
  fullWidth = false,
}: BrandSectionWrapperProps) {
  // Theme Backgrounds & Text Colors
  let bgStyles = "bg-[#FFFFFF] text-[#111827]";
  if (theme === "navy" || theme === "brand-primary") {
    bgStyles = "bg-[#1D2F5D] text-[#FAF9F6]";
  } else if (theme === "cream" || theme === "warm-cream") {
    bgStyles = "bg-[#FDFBF7] text-[#111827]";
  } else if (theme === "slate" || theme === "surface-muted") {
    bgStyles = "bg-[#F8FAFC] text-[#111827]";
  } else if (theme === "soft-blue") {
    bgStyles = "bg-[#F1F5F9] text-[#111827]";
  } else if (theme === "luxury-dark" || theme === "obsidian") {
    bgStyles = "bg-gradient-to-b from-[#0D152B] to-[#07090E] text-[#F4F5F8]";
  }

  // Vertical Spacing
  let py = "py-12 sm:py-16 lg:py-20";
  if (paddingY === "none") py = "py-0";
  else if (paddingY === "compact") py = "py-8 sm:py-10";
  else if (paddingY === "spacious") py = "py-16 sm:py-24 lg:py-28";
  else if (paddingY === "hero") py = "pt-6 pb-16 sm:pb-24";

  return (
    <section
      id={id}
      className={`w-full relative transition-colors duration-300 ${bgStyles} ${py} ${className}`}
    >
      <div
        className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${
          fullWidth ? "max-w-none px-0 sm:px-0 lg:px-0" : "max-w-7xl"
        } ${containerClassName}`}
      >
        {children}
      </div>
    </section>
  );
}

export interface BrandHeadingProps {
  level?: "h1" | "h2" | "h3";
  title?: string;
  highlight?: string;
  subtitle?: string;
  eyebrow?: string;
  eyebrowIcon?: React.ReactNode;
  align?: "left" | "center" | "right";
  isDark?: boolean;
  className?: string;
}

export function BrandHeading({
  level = "h2",
  title,
  highlight,
  subtitle,
  eyebrow,
  eyebrowIcon,
  align = "center",
  isDark = false,
  className = "",
}: BrandHeadingProps) {
  const alignClass =
    align === "center"
      ? "text-center items-center"
      : align === "right"
      ? "text-right items-end"
      : "text-left items-start";

  const Tag = level;

  return (
    <div className={`flex flex-col gap-2.5 max-w-3xl ${alignClass} ${align === "center" ? "mx-auto" : ""} mb-8 sm:mb-12 ${className}`}>
      {eyebrow && (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase ${
            isDark
              ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30"
              : "bg-[#1D2F5D]/10 text-[#1D2F5D] border border-[#1D2F5D]/20"
          }`}
        >
          {eyebrowIcon || <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />}
          {eyebrow}
        </span>
      )}

      {title && (
        <Tag
          className={`font-serif tracking-tight leading-[1.15] ${
            level === "h1"
              ? "text-3xl sm:text-4xl lg:text-5xl font-bold"
              : level === "h2"
              ? "text-2xl sm:text-3xl lg:text-4xl font-bold"
              : "text-xl sm:text-2xl font-semibold"
          } ${isDark ? "text-[#FAF9F6]" : "text-[#111827]"}`}
        >
          {title}{" "}
          {highlight && (
            <span className="italic font-normal bg-gradient-to-r from-[#D4AF37] to-[#E5C158] bg-clip-text text-transparent">
              {highlight}
            </span>
          )}
        </Tag>
      )}

      {subtitle && (
        <p
          className={`text-sm sm:text-base leading-relaxed ${
            isDark ? "text-[#FAF9F6]/75" : "text-[#64748B]"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "gold" | "ghost";
  href?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function BrandButton({
  variant = "primary",
  href,
  icon = <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />,
  children,
  className = "",
  ...props
}: BrandButtonProps) {
  let styleClasses = "btn-brand-primary";
  if (variant === "secondary") styleClasses = "btn-brand-secondary";
  else if (variant === "gold") styleClasses = "btn-brand-gold";
  else if (variant === "ghost")
    styleClasses = "inline-flex items-center text-sm font-semibold text-[#1D2F5D] hover:text-[#152347] transition-colors";

  if (href) {
    return (
      <Link href={href} className={`group ${styleClasses} ${className}`}>
        {children}
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" className={`group ${styleClasses} ${className}`} {...props}>
      {children}
      {icon}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   REUSABLE PRIMITIVES FOR THE 9 MANDATORY VISUAL STYLES
   ══════════════════════════════════════════════════════════════════ */

// 1. Glassmorphism Surface
export interface GlassSurfaceProps {
  variant?: "light" | "dark" | "gold";
  className?: string;
  children: React.ReactNode;
  id?: string;
}
export function GlassSurface({ variant = "light", className = "", children, id }: GlassSurfaceProps) {
  const vClass =
    variant === "dark"
      ? "glass-surface-dark"
      : variant === "gold"
      ? "glass-surface-gold"
      : "glass-surface-light";
  return (
    <div id={id} className={`rounded-2xl p-6 transition-all duration-300 ${vClass} ${className}`}>
      {children}
    </div>
  );
}

// 2. Modular Typography Semantic Component
export type ModularRole =
  | "display-xl"
  | "display-lg"
  | "display-md"
  | "heading-xl"
  | "heading-lg"
  | "heading-md"
  | "body-lg"
  | "body-md"
  | "body-sm"
  | "caption"
  | "eyebrow"
  | "price"
  | "price-compare"
  | "admin-metric";

export interface ModularTextProps {
  role?: ModularRole;
  as?: any;
  className?: string;
  children: React.ReactNode;
}
export function ModularText({ role = "body-md", as: Tag = "p", className = "", children }: ModularTextProps) {
  const roleClasses: Record<ModularRole, string> = {
    "display-xl": "type-display-xl",
    "display-lg": "type-display-lg",
    "display-md": "type-display-md",
    "heading-xl": "type-heading-xl",
    "heading-lg": "type-heading-lg",
    "heading-md": "type-heading-md",
    "body-lg": "type-body-lg text-ui-fg-muted",
    "body-md": "type-body-md text-ui-fg-base",
    "body-sm": "type-body-sm text-ui-fg-muted",
    caption: "type-caption text-ui-fg-subtle",
    eyebrow: "type-eyebrow text-[#D4AF37]",
    price: "type-price text-[#1D2F5D] dark:text-[#FAF9F6]",
    "price-compare": "type-price-compare text-ui-fg-muted",
    "admin-metric": "type-admin-metric text-ui-fg-base",
  };
  return <Tag className={`${roleClasses[role] || "type-body-md"} ${className}`}>{children}</Tag>;
}

// 3. Scrapbook Card (Occasion & Celebration Moments)
export interface ScrapbookCardProps {
  tape?: boolean;
  pin?: boolean;
  handwrittenNote?: string;
  className?: string;
  children: React.ReactNode;
}
export function ScrapbookCard({ tape = true, pin = false, handwrittenNote, className = "", children }: ScrapbookCardProps) {
  return (
    <div className={`relative scrapbook-polaroid ${tape ? "scrapbook-tape" : ""} ${className}`}>
      {pin && <div className="scrapbook-pin" />}
      {children}
      {handwrittenNote && (
        <div className="mt-3 pt-2 border-t border-dashed border-gray-200 text-center font-serif italic text-xs text-[#997A1E]">
          {handwrittenNote}
        </div>
      )}
    </div>
  );
}

// 4. Utilitarian Surrealism Precision Badge
export interface SurrealPrecisionProps {
  metric: string;
  value: string;
  status?: string;
  className?: string;
}
export function SurrealPrecisionBadge({ metric, value, status, className = "" }: SurrealPrecisionProps) {
  return (
    <span className={`surreal-precision-badge ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span className="opacity-75">{metric}:</span>
      <span className="font-bold text-[#FAF9F6]">{value}</span>
      {status && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-950/60 text-emerald-300">{status}</span>}
    </span>
  );
}

// 5. Coquette Romantic Card
export interface CoquetteCardProps {
  tag?: string;
  className?: string;
  children: React.ReactNode;
}
export function CoquetteCard({ tag, className = "", children }: CoquetteCardProps) {
  return (
    <div className={`p-6 coquette-blush-card relative overflow-hidden ${className}`}>
      {tag && (
        <div className="mb-3">
          <span className="coquette-ribbon-badge">
            🎀 {tag}
          </span>
        </div>
      )}
      {children}
      <div className="w-full h-1 mt-4 coquette-scallop-border" />
    </div>
  );
}

// 6. Tenebrism Spotlight Container
export interface TenebrismSpotlightProps {
  className?: string;
  children: React.ReactNode;
}
export function TenebrismSpotlight({ className = "", children }: TenebrismSpotlightProps) {
  return (
    <div className={`w-full py-16 px-4 sm:px-8 tenebrism-spotlight text-[#FAF9F6] ${className}`}>
      <div className="relative z-10 max-w-6xl mx-auto">{children}</div>
    </div>
  );
}

// 7. Japandi Card (Minimalist Warm Cream Wabi-Sabi)
export interface JapandiCardProps {
  className?: string;
  children: React.ReactNode;
}
export function JapandiCard({ className = "", children }: JapandiCardProps) {
  return (
    <div className={`p-8 japandi-card japandi-quiet-surface ${className}`}>
      {children}
    </div>
  );
}

// 8. Luxury Heading with Italicized Ampersand
export interface LuxuryHeadingProps {
  title: string;
  subtitle?: string;
  goldWord?: string;
  className?: string;
}
export function LuxuryHeading({ title, subtitle, goldWord, className = "" }: LuxuryHeadingProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ui-fg-base">
        {title.includes("&") ? (
          <>
            {title.split("&")[0]}
            <span className="luxury-ampersand">&</span>
            {title.split("&")[1]}
          </>
        ) : (
          title
        )}
        {goldWord && <span className="ml-2 italic font-normal luxury-gold-gradient-text">{goldWord}</span>}
      </h2>
      {subtitle && <p className="type-body-md text-ui-fg-muted max-w-2xl">{subtitle}</p>}
    </div>
  );
}

// 9. Anthropomorphic Baker Mood Indicator
export function BakerMoodBadge({ className = "" }: { className?: string }) {
  const currentHour = new Date().getHours();
  let greeting = "Morning Baker: Freshly Ovens Whisked";
  let icon = "🥐";
  if (currentHour >= 12 && currentHour < 17) {
    greeting = "Afternoon Confectioner: Decorating Signature Cakes";
    icon = "🎂";
  } else if (currentHour >= 17) {
    greeting = "Evening Patisserie: Express Deliveries in Motion";
    icon = "✨";
  }

  return (
    <div className={`baker-character-badge ${className}`}>
      <span className="text-sm heartbeat-pulse">{icon}</span>
      <span>{greeting}</span>
    </div>
  );
}
