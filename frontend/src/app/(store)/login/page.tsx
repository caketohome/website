import { OtpLoginForm } from "@frontend/components/store/auth/otp-login-form";
import { SeoMetadataBuilder } from "@frontend/lib/seo/metadata-builder";
import type { Metadata } from "next";
import Link from "next/link";
import { CakeToHomeLogo } from "@frontend/components/common/logo";
import { Check } from "lucide-react";
import { CmsRepository } from "@frontend/lib/repositories/cms.repository";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    fallbackTitle: "Customer Login & Account Access | CakeToHome",
    fallbackDescription: "Login to your CakeToHome account with seamless mobile verification. Order fresh handcrafted artisan cakes delivered fast.",
    isPrivate: true,
  });
}

// Defaults until set in Admin -> CMS -> Page Configurator -> "login" page -> Login Page tab.
const DEFAULT_LOGIN = {
  image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1600&q=85",
  image_alt: "Freshly baked chocolate cake",
  headline: "Fresh cakes, handcrafted for your moments.",
  points: ["Baked fresh on order", "Same-day delivery slots", "Delivered across Kerala"],
};

async function getLoginContent() {
  try {
    const page = await CmsRepository.findPageBySlug("login");
    const lc: any = (page as any)?.login_config || {};
    const points = Array.isArray(lc.points) ? lc.points.map((x: any) => String(x).trim()).filter(Boolean) : [];
    return {
      image_url: lc.image_url || DEFAULT_LOGIN.image_url,
      image_alt: lc.image_alt || DEFAULT_LOGIN.image_alt,
      headline: lc.headline || DEFAULT_LOGIN.headline,
      points: points.length > 0 ? points : DEFAULT_LOGIN.points,
    };
  } catch {
    return DEFAULT_LOGIN;
  }
}

export default async function LoginPage() {
  const content = await getLoginContent();
  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-brand-warm-white text-brand-text flex flex-col flex-1 overflow-x-hidden">
      <div className="w-full flex-1 grid grid-cols-1 md:grid-cols-12 items-stretch">
        {/* Left: product photography (tablet/desktop only) */}
        <div className="hidden md:flex md:flex-col md:justify-end md:col-span-5 lg:col-span-6 relative overflow-hidden min-h-[560px] bg-brand-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.image_url}
            alt={content.image_alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative z-10 m-6 lg:m-10 max-w-md rounded-xl bg-white/95 p-5 lg:p-6 border border-brand-border shadow-sm">
            <p className="font-serif text-xl lg:text-2xl text-brand-navy leading-snug">
              {content.headline}
            </p>
            <ul className="mt-4 space-y-2">
              {content.points.map((p: string) => (
                <li key={p} className="flex items-center gap-2 text-sm text-brand-text">
                  <Check className="w-4 h-4 text-brand-gold shrink-0" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: login card */}
        <div className="col-span-1 md:col-span-7 lg:col-span-6 flex flex-col items-center justify-center px-4 py-10 sm:p-8 lg:p-12">
          <div className="w-full max-w-[420px] rounded-2xl bg-white border border-brand-border shadow-sm p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-3">
              <CakeToHomeLogo variant="navy" mode="full" height={48} href="/" priority className="mx-auto" />
              <div className="space-y-1">
                <h1 className="font-serif text-2xl font-semibold text-brand-navy tracking-tight">Welcome to CakeToHome</h1>
                <p className="text-sm text-brand-text-muted">Log in with your mobile number to order and track cakes.</p>
              </div>
            </div>

            <OtpLoginForm />

            <p className="text-xs text-center text-brand-text-muted pt-4 border-t border-brand-border">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="underline underline-offset-2 text-brand-primary hover:text-brand-navy">Terms</Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline underline-offset-2 text-brand-primary hover:text-brand-navy">Privacy Policy</Link>.
            </p>
          </div>

          <Link href="/" className="mt-6 text-sm text-brand-text-muted hover:text-brand-navy transition-colors">
            &larr; Back to cakes &amp; desserts
          </Link>
        </div>
      </div>
    </div>
  );
}
