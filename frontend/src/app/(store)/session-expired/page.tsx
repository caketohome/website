import React from "react";
import Link from "next/link";
import { Clock, RefreshCw, Home } from "lucide-react";
import { SeoMetadataBuilder } from "@frontend/lib/seo/metadata-builder";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    fallbackTitle: "Session Expired | CakeToHome",
    fallbackDescription: "Your secure session has expired. Please re-authenticate with your mobile number.",
    isPrivate: true,
  });
}

export default function SessionExpiredPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#0c0a09] text-neutral-100">
      <div className="max-w-md w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
          <Clock className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-3">
          Session Expired
        </h1>

        <p className="text-neutral-400 text-sm leading-relaxed mb-8">
          For your financial and personal data security, your authentication session has expired due to inactivity or token renewal limits.
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-navy hover:bg-brand-primary text-white font-medium text-sm transition-colors shadow-lg shadow-brand-gold-dark/20"
          >
            <RefreshCw className="w-4 h-4" /> Re-authenticate with Mobile OTP
          </Link>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 font-medium text-sm transition-colors border border-neutral-700/50"
          >
            <Home className="w-4 h-4" /> Return to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
