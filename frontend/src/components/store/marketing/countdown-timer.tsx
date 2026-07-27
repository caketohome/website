"use client";

import { useEffect, useState } from "react";

/**
 * Countdown Timer — Phase 9.2 storefront component.
 *
 * Renders a live countdown to a target end time. Used on flash-sale banners,
 * campaign landing pages, and offer cards to create urgency. Pure client
 * component — no server state. Renders nothing if the target is in the past.
 */
export function CountdownTimer({
    endsAt,
    label,
    className = "",
}: {
    endsAt: string | Date;
    label?: string;
    className?: string;
}) {
    const target = new Date(endsAt).getTime();
    const [now, setNow] = useState(() => Date.now());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    if (!mounted) return null;

    const remaining = target - now;
    if (remaining <= 0) return null;

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {label && (
                <span className="text-xs font-semibold uppercase tracking-wide text-ui-fg-subtle">
                    {label}
                </span>
            )}
            <div className="flex gap-1 font-mono text-sm font-semibold">
                {days > 0 && (
                    <span className="px-2 py-1 rounded bg-ui-bg-base text-ui-fg-on-inverted">
                        {days}d
                    </span>
                )}
                <span className="px-2 py-1 rounded bg-ui-bg-base text-ui-fg-on-inverted">
                    {String(hours).padStart(2, "0")}h
                </span>
                <span className="px-2 py-1 rounded bg-ui-bg-base text-ui-fg-on-inverted">
                    {String(minutes).padStart(2, "0")}m
                </span>
                <span className="px-2 py-1 rounded bg-ui-bg-base text-ui-fg-on-inverted">
                    {String(seconds).padStart(2, "0")}s
                </span>
            </div>
        </div>
    );
}
