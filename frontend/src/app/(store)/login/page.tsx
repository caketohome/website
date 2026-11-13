import { OtpLoginForm } from "@frontend/components/store/auth/otp-login-form";
import { SeoMetadataBuilder } from "@frontend/lib/seo/metadata-builder";
import type { Metadata } from "next";
import Link from "next/link";
import { CakeToHomeLogo } from "@frontend/components/common/logo";
import { Sparkles, Check, Star } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    fallbackTitle: "Customer Login & Account Access | CakeToHome",
    fallbackDescription: "Login to your CakeToHome account with seamless mobile verification. Order fresh handcrafted artisan cakes delivered fast.",
    isPrivate: true,
  });
}

export default function LoginPage() {
  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-[#0c0a09] text-neutral-100 flex flex-col justify-center flex-1 overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      <div className="w-full min-h-[calc(100vh-4rem)] flex-1 grid grid-cols-1 md:grid-cols-12 items-stretch">
        
        {/* ── LEFT HERO: LUXURY ARTISAN BAKERY SHOWCASE (Tablet 40% [5-col], Desktop 55% [7-col]) ── */}
        <div className="hidden md:flex md:col-span-5 lg:col-span-7 relative overflow-hidden flex-col justify-between p-6 md:p-8 lg:p-12 xl:p-16 border-r border-neutral-800/80 bg-neutral-950 min-h-[560px]">
          
          {/* Background Ambient Dessert Image */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-45 scale-100 transition-transform duration-1000"
            style={{
              backgroundImage: "url('https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1600&q=85')",
            }}
          />
          {/* Multi-layered Dark Chocolate & Amber Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a09] via-[#0c0a09]/70 to-[#0c0a09]/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0c0a09]/40 to-[#0c0a09]" />

          {/* Top: Brand Logo */}
          <div className="relative z-10 space-y-1">
            <CakeToHomeLogo
              variant="white"
              mode="full"
              height={52}
              href="/"
              priority
              className="py-1"
            />
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-widest pl-0.5">
              Artisan Patisserie &amp; Modern Bakery
            </p>
          </div>

          {/* Center: Value Proposition & Feature Cards */}
          <div className="relative z-10 space-y-5 lg:space-y-6 max-w-lg my-auto py-6 lg:py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Baked Fresh Daily on Order</span>
            </div>

            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black leading-[1.15] text-white tracking-tight">
              Fresh Cakes.<br />
              Handcrafted Moments.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-rose-400">
                Delivered Fast.
              </span>
            </h1>

            <p className="text-xs md:text-sm lg:text-base text-neutral-300 leading-relaxed font-normal">
              Premium artisan cakes baked fresh from scratch and delivered across Kerala with express 2-hour and scheduled slots.
            </p>

            {/* 3 Feature Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md text-xs font-bold text-neutral-200">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span>Same Day Delivery</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md text-xs font-bold text-neutral-200">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span>Fresh Ingredients</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-md text-xs font-bold text-neutral-200">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span>Handcrafted Daily</span>
              </div>
            </div>
          </div>

          {/* Bottom: Customer Rating */}
          <div className="relative z-10 pt-4 border-t border-neutral-800/80 flex items-center gap-3">
            <div className="flex items-center gap-1 text-amber-400 text-sm">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-xs font-medium text-neutral-300">
              Loved by 25,000+ happy families across Kerala
            </p>
          </div>
        </div>

        {/* ── RIGHT COLUMN: LUXURY LOGIN CARD (Tablet 60% [7-col], Desktop 45% [5-col], Mobile full) ── */}
        <div className="col-span-1 md:col-span-7 lg:col-span-5 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 bg-[#0c0a09] relative">
          
          {/* Mobile Top Brand Bar (Visible only on <md) */}
          <div className="md:hidden w-full max-w-[420px] flex flex-col items-center text-center mb-6 space-y-1">
            <CakeToHomeLogo
              variant="white"
              mode="full"
              height={44}
              href="/"
              priority
              className="py-1"
            />
            <p className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
              Fresh Cakes &bull; Delivered Fast
            </p>
          </div>

          {/* Centered Glass Login Card (max-w-[420px], p-6 sm:p-8, rounded-[24px]) */}
          <div className="w-full max-w-[420px] bg-neutral-900/90 border border-neutral-800/90 rounded-[24px] p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-2xl space-y-5">
            
            {/* Header */}
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto shadow-inner">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Welcome back to CakeToHome
              </h2>
              <p className="text-xs text-neutral-400 font-normal">
                Login to order your favourite cakes
              </p>
            </div>

            {/* OTP Form Component */}
            <OtpLoginForm />

            {/* Legal Footnote */}
            <p className="text-[11px] text-center text-neutral-500 pt-2 border-t border-neutral-800/60">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="underline hover:text-amber-400 transition-colors">Terms</Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-amber-400 transition-colors">Privacy Policy</Link>.
            </p>
          </div>

          {/* Quick Back to Store link */}
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-neutral-400 hover:text-amber-400 font-medium transition-colors">
              &larr; Back to cakes &amp; desserts
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
