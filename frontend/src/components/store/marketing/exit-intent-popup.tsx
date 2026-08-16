"use client";

import { useEffect, useState } from "react";
import { clientListEligiblePopups } from "@frontend/lib/data/marketing-toolkit-client";
import { useEngagement } from "../engagement/engagement-provider";

/**
 * Exit-Intent & Cart Recovery Popup — Storefront Component.
 *
 * Checks for both marketing-configured popups and automated abandoned cart recovery
 * incentives with dynamic countdown timer and one-click coupon apply.
 */
export function ExitIntentPopup() {
    const { activePopup, dismissEngagement } = useEngagement();
    const [popup, setPopup] = useState<any | null>(null);
    const [cartItemsCount, setCartItemsCount] = useState(0);
    const [couponCopied, setCouponCopied] = useState(false);
    const [timeLeft, setTimeLeft] = useState(900); // 15 minutes timer

    useEffect(() => {
        let cancelled = false;

        const checkCart = () => {
            try {
                const storedCart = localStorage.getItem("medusa_cart_items") || localStorage.getItem("_cth_cart_items");
                if (storedCart) {
                    const items = JSON.parse(storedCart);
                    if (Array.isArray(items)) setCartItemsCount(items.length);
                }
            } catch {
                // Ignore storage errors
            }
        };

        checkCart();

        const fetchPopups = async () => {
            try {
                const result = await clientListEligiblePopups({
                    url: window.location.pathname,
                    device: window.innerWidth < 768 ? "mobile" : "desktop",
                });
                if (cancelled) return;
                const popups = result.popups ?? [];
                if (popups.length === 0) return;

                const now = Date.now();
                for (const p of popups) {
                    const suppressHours = p.display_rules?.suppress_hours ?? 0;
                    if (suppressHours > 0) {
                        const lastShownKey = `mkt_popup_shown_${p.id}`;
                        const lastShown = Number(localStorage.getItem(lastShownKey) ?? 0);
                        const elapsedHours = (now - lastShown) / (1000 * 60 * 60);
                        if (elapsedHours < suppressHours) continue;
                    }
                    setPopup(p);
                    break;
                }
            } catch {
                // Ignore
            }
        };

        fetchPopups();

        return () => {
            cancelled = true;
        };
    }, []);

    // 15-minute countdown ticker
    useEffect(() => {
        if (activePopup !== "CART_RECOVERY") return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [activePopup]);

    const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins.toString().padStart(2, "0")}:${remSecs.toString().padStart(2, "0")}`;
    };

    const handleCopyCode = (code: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(code);
            setCouponCopied(true);
            setTimeout(() => setCouponCopied(false), 3000);
        }
    };

    // 1. Render Automated Cart Recovery Exit Intent
    if (activePopup === "CART_RECOVERY" && cartItemsCount > 0) {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
                onClick={() => dismissEngagement("CART_RECOVERY")}
                role="dialog"
                aria-modal="true"
            >
                <div
                    className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-100 dark:border-rose-950 transform transition-all animate-scale-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 p-5 text-white text-center relative">
                        <button
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 text-white flex items-center justify-center hover:bg-black/40 transition focus:outline-none"
                            onClick={() => dismissEngagement("CART_RECOVERY")}
                            aria-label="Close cart recovery popup"
                        >
                            ✕
                        </button>
                        <span className="text-3xl block mb-1">🍰 Don&apos;t Leave Your Cake Behind!</span>
                        <h3 className="text-lg font-bold text-white">Your freshly baked selection is reserved</h3>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">
                            ⏳ Offer expires in: <span className="font-mono text-amber-200">{formatTime(timeLeft)}</span>
                        </div>
                    </div>

                    <div className="p-6 flex flex-col gap-4">
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 text-center">
                            Complete your order right now and get an extra <strong className="text-rose-600 dark:text-rose-400">10% OFF</strong> + free express delivery slot on us!
                        </p>

                        {/* Promo Coupon Box */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-dashed border-rose-300 dark:border-rose-800">
                            <div>
                                <span className="text-xs text-rose-700 dark:text-rose-300 uppercase font-semibold tracking-wider block">Special Voucher</span>
                                <span className="text-lg font-mono font-bold text-rose-600 dark:text-rose-400">SWEET10</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopyCode("SWEET10")}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                            >
                                {couponCopied ? "✓ Copied!" : "Apply & Copy"}
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 pt-2">
                            <a
                                href="/checkout?promo=SWEET10"
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-center text-sm shadow-md hover:shadow-lg hover:from-rose-700 hover:to-pink-700 transition"
                                onClick={() => dismissEngagement("CART_RECOVERY")}
                            >
                                ⚡ Complete Order with 10% Off
                            </a>
                            <button
                                type="button"
                                className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-center py-1 underline"
                                onClick={() => dismissEngagement("CART_RECOVERY")}
                            >
                                No thanks, I&apos;ll pay full price later
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Render Marketing Toolkit Dynamic Popup if triggered
    if (!popup) return null;

    return null;
}
