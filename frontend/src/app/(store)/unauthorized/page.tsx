import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, LogIn } from "lucide-react";
import { SeoMetadataBuilder } from "@frontend/lib/seo/metadata-builder";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    fallbackTitle: "Access Restricted | CakeToHome",
    fallbackDescription: "You do not have the required role or permissions to access this CakeToHome resource.",
    isPrivate: true,
  });
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#0c0a09] text-neutral-100">
      <div className="max-w-md w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-3">
          Access Restricted
        </h1>

        <p className="text-neutral-400 text-sm leading-relaxed mb-8">
          Your account does not possess the authorized role or branch permissions required to view this system resource.
        </p>

        <div className="space-y-3">
          <Link
            href="/account"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-navy hover:bg-brand-primary text-white font-medium text-sm transition-colors shadow-lg shadow-brand-gold-dark/20"
          >
            Go to Your Account
          </Link>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 font-medium text-sm transition-colors border border-neutral-700/50"
          >
            <Home className="w-4 h-4" /> Return to Storefront
          </Link>

          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-neutral-400 hover:text-brand-gold text-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" /> Sign in with different account
          </Link>
        </div>
      </div>
    </div>
  );
}
