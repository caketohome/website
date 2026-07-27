"use client";

import { useState } from "react";

/**
 * Social Sharing Buttons — Phase 9.2 storefront component.
 *
 * Renders share buttons for Facebook, Twitter/X, WhatsApp, Pinterest, and
 * a copy-link button. Pure client component — opens share URLs in a new
 * window and copies the current URL to the clipboard.
 */
export function SocialSharing({
    url,
    title,
    className = "",
}: {
    url?: string;
    title?: string;
    className?: string;
}) {
    const [copied, setCopied] = useState(false);

    const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    const shareTitle = title ?? "Check this out on CakeToHome!";
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(shareTitle);

    const share = (platform: string) => {
        const urls: Record<string, string> = {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
            whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
            pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
        };
        if (urls[platform]) {
            window.open(urls[platform], "_blank", "noopener,noreferrer,width=600,height=500");
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard may be unavailable; no-op.
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wide">
                Share
            </span>
            <button
                onClick={() => share("facebook")}
                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition"
                aria-label="Share on Facebook"
            >
                f
            </button>
            <button
                onClick={() => share("twitter")}
                className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition"
                aria-label="Share on Twitter/X"
            >
                𝕏
            </button>
            <button
                onClick={() => share("whatsapp")}
                className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition"
                aria-label="Share on WhatsApp"
            >
                ✆
            </button>
            <button
                onClick={() => share("pinterest")}
                className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition"
                aria-label="Share on Pinterest"
            >
                P
            </button>
            <button
                onClick={copyLink}
                className="px-2 h-8 rounded-full bg-ui-bg-subtle text-ui-fg-base text-xs font-semibold flex items-center justify-center hover:bg-ui-bg-subtle-hover transition"
                aria-label="Copy link"
            >
                {copied ? "Copied!" : "Copy link"}
            </button>
        </div>
    );
}
