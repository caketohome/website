"use client";

import { useEffect, useState } from "react";
import { clientListEligiblePopups } from "@frontend/lib/data/marketing-toolkit-client";

/**
 * Exit-Intent Popup — Phase 9.2 storefront component.
 *
 * Fetches active popups eligible for the current page context from
 * /store/marketing/popups, then shows the first eligible popup when the
 * visitor exhibits exit-intent behavior (mouse leaves the top of the
 * viewport). Respects the popup's suppress_hours via localStorage.
 *
 * Renders nothing if no eligible popups, the feature flag is off, or the
 * visitor has already seen the popup within the suppress window.
 */
export function ExitIntentPopup() {
    const [popup, setPopup] = useState<any | null>(null);
    const [visible, setVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchPopups = async () => {
            try {
                const result = await clientListEligiblePopups({
                    url: window.location.pathname,
                    device:
                        window.innerWidth < 768 ? "mobile" : "desktop",
                });
                if (cancelled) return;
                const popups = result.popups ?? [];
                if (popups.length === 0) return;

                // Pick the first eligible popup that isn't suppressed.
                const now = Date.now();
                for (const p of popups) {
                    const suppressHours =
                        p.display_rules?.suppress_hours ?? 0;
                    if (suppressHours > 0) {
                        const lastShownKey = `mkt_popup_shown_${p.id}`;
                        const lastShown = Number(
                            localStorage.getItem(lastShownKey) ?? 0
                        );
                        const elapsedHours =
                            (now - lastShown) / (1000 * 60 * 60);
                        if (elapsedHours < suppressHours) continue;
                    }
                    setPopup(p);
                    break;
                }
            } catch {
                // Feature flag off or network error — no popup.
            }
        };

        fetchPopups();

        return () => {
            cancelled = true;
        };
    }, []);

    // Exit-intent detection (desktop): mouse leaves the top of the viewport.
    // Mobile: no exit-intent; popups with trigger=entry/scroll/time_delay show
    // via their own logic (this component focuses on exit_intent).
    useEffect(() => {
        if (!popup || popup.trigger !== "exit_intent") return;

        const handleMouseOut = (e: MouseEvent) => {
            if (e.clientY <= 0 && !dismissed) {
                setVisible(true);
                localStorage.setItem(
                    `mkt_popup_shown_${popup.id}`,
                    String(Date.now())
                );
            }
        };

        document.addEventListener("mouseout", handleMouseOut);
        return () => document.removeEventListener("mouseout", handleMouseOut);
    }, [popup, dismissed]);

    // Non-exit-intent triggers: show immediately for entry, after delay for
    // time_delay, on scroll for scroll.
    useEffect(() => {
        if (!popup || popup.trigger === "exit_intent") return;

        if (popup.trigger === "entry") {
            setVisible(true);
            localStorage.setItem(
                `mkt_popup_shown_${popup.id}`,
                String(Date.now())
            );
        } else if (popup.trigger === "time_delay") {
            const delay = (popup.display_rules?.delay_seconds ?? 10) * 1000;
            const t = setTimeout(() => {
                setVisible(true);
                localStorage.setItem(
                    `mkt_popup_shown_${popup.id}`,
                    String(Date.now())
                );
            }, delay);
            return () => clearTimeout(t);
        } else if (popup.trigger === "scroll") {
            const pct = popup.display_rules?.scroll_percentage ?? 50;
            const handleScroll = () => {
                const scrolled =
                    (window.scrollY /
                        (document.body.scrollHeight - window.innerHeight)) *
                    100;
                if (scrolled >= pct && !dismissed) {
                    setVisible(true);
                    localStorage.setItem(
                        `mkt_popup_shown_${popup.id}`,
                        String(Date.now())
                    );
                    window.removeEventListener("scroll", handleScroll);
                }
            };
            window.addEventListener("scroll", handleScroll);
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [popup, dismissed]);

    if (!popup || !visible || dismissed) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
            onClick={() => setDismissed(true)}
        >
            <div
                className="relative bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white bg-opacity-80 text-gray-600 flex items-center justify-center hover:bg-opacity-100 z-10"
                    onClick={() => setDismissed(true)}
                    aria-label="Close popup"
                >
                    ✕
                </button>
                {popup.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={popup.image_url}
                        alt=""
                        className="w-full h-40 object-cover"
                    />
                )}
                <div className="p-6 flex flex-col gap-3">
                    {popup.headline && (
                        <h2 className="text-xl font-bold text-ui-fg-base">
                            {popup.headline}
                        </h2>
                    )}
                    {popup.body && (
                        <p className="text-sm text-ui-fg-subtle">{popup.body}</p>
                    )}
                    {popup.offer_code && (
                        <div className="px-3 py-2 rounded-lg bg-ui-bg-subtle border border-dashed border-ui-border-base text-center">
                            <span className="text-xs text-ui-fg-subtle uppercase tracking-wide">
                                Your code
                            </span>
                            <div className="text-lg font-mono font-bold text-ui-fg-interactive">
                                {popup.offer_code}
                            </div>
                        </div>
                    )}
                    {popup.cta_url && popup.cta_label && (
                        <a
                            href={popup.cta_url}
                            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-ui-fg-interactive text-white font-semibold hover:opacity-90 transition"
                            onClick={() => setDismissed(true)}
                        >
                            {popup.cta_label}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
