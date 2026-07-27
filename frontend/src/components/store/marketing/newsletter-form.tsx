"use client";

import { useState } from "react";
import { clientSubscribeNewsletter } from "@frontend/lib/data/marketing-toolkit-client";

/**
 * Newsletter Subscription Form — Phase 9.2 storefront component.
 *
 * Extends (does not replace) the existing /api/subscribe SSE delivery stream.
 * This form posts to /store/marketing/newsletter/subscribe, which stores the
 * subscriber in the marketing_newsletter_subscriber table for the admin
 * newsletter dashboard.
 */
export function NewsletterForm({
    source = "footer",
    className = "",
}: {
    source?: "footer" | "popup" | "checkout";
    className?: string;
}) {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
        "idle"
    );
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setStatus("error");
            setMessage("Please enter your email.");
            return;
        }
        setStatus("loading");
        setMessage(null);
        try {
            const result = await clientSubscribeNewsletter({
                email,
                phone: phone || undefined,
                source,
            });
            if (result.subscriber) {
                setStatus("success");
                setMessage("Subscribed! Watch your inbox for sweet deals.");
                setEmail("");
                setPhone("");
            } else {
                setStatus("error");
                setMessage(result.message ?? "Subscription failed.");
            }
        } catch {
            setStatus("error");
            setMessage("Subscription failed. Please try again.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col gap-2 ${className}`}>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-ui-border-base text-sm"
                    required
                />
                <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-ui-border-base text-sm sm:w-40"
                />
                <button
                    type="submit"
                    disabled={status === "loading"}
                    className="px-4 py-2 rounded-lg bg-ui-fg-interactive text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                >
                    {status === "loading" ? "Subscribing…" : "Subscribe"}
                </button>
            </div>
            {message && (
                <p
                    className={`text-xs ${
                        status === "success"
                            ? "text-green-600"
                            : "text-red-600"
                    }`}
                >
                    {message}
                </p>
            )}
        </form>
    );
}
