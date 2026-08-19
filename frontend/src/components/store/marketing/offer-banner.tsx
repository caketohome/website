import { CountdownTimer } from "./countdown-timer";
import { PromotionBadge } from "./promotion-badges";
import Link from "next/link";

/**
 * Offer Landing Banner — Phase 9.2 storefront component.
 *
 * A prominent banner for an active campaign/offer, shown on the homepage and
 * campaign landing pages. Renders headline, body, CTA, optional countdown,
 * and a promotion badge. Server-renderable.
 */
export function OfferBanner({
    title,
    subtitle,
    ctaLabel = "Shop Now",
    ctaUrl = "/campaigns",
    endsAt,
    offerType,
    imageUrl,
    className = "",
}: {
    title: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    endsAt?: string | Date | null;
    offerType?: string;
    imageUrl?: string | null;
    className?: string;
}) {
    return (
        <div
            className={`relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 md:p-8 ${className}`}
        >
            {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
            )}
            <div className="relative flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    {offerType && <PromotionBadge type={offerType} />}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
                {subtitle && (
                    <p className="text-sm md:text-base opacity-90 max-w-2xl">
                        {subtitle}
                    </p>
                )}
                <div className="flex items-center gap-4 mt-2">
                    <Link
                        href={ctaUrl}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-purple-700 font-semibold hover:bg-opacity-90 transition"
                    >
                        {ctaLabel}
                    </Link>
                    {endsAt && (
                        <CountdownTimer
                            endsAt={endsAt}
                            label="Ends in"
                            className="text-white"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
