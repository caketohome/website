import React from "react";
import Link from "next/link";
import { UserX, MessageCircle, Home } from "lucide-react";
import { SeoMetadataBuilder } from "@frontend/lib/seo/metadata-builder";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    fallbackTitle: "Account Suspended | CakeToHome",
    fallbackDescription: "This account has been suspended or is currently inactive. Contact support for assistance.",
    isPrivate: true,
  });
}

export default function AccountDisabledPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#0c0a09] text-neutral-100">
      <div className="max-w-md w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <UserX className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-3">
          Account Suspended
        </h1>

        <p className="text-neutral-400 text-sm leading-relaxed mb-8">
          This account is currently disabled or suspended by administrative policy. If you believe this is in error, please contact our support team.
        </p>

        <div className="space-y-3">
          <a
            href="https://wa.me/919988776655?text=Hello%20CakeToHome%20Support,%20my%20account%20appears%20suspended."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors shadow-lg shadow-emerald-900/20"
          >
            <MessageCircle className="w-4 h-4" /> Contact Customer Support
          </a>

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
