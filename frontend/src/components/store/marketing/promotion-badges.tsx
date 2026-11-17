/**
 * Promotion Badges — Phase 9.2 storefront components.
 *
 * Small inline badges that surface offer/promotion metadata on product cards,
 * PDP, and cart lines. Server-renderable (no client JS). The badge label and
 * color come from the offer type — no business logic is duplicated from the
 * M2 Rules Engine; these are pure presentation helpers.
 */

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    flash_sale: { bg: "bg-red-600", text: "text-white", label: "⚡ Flash Sale" },
    combo: { bg: "bg-brand-primary", text: "text-white", label: "🎁 Combo" },
    buy_x_get_y: { bg: "bg-brand-gold", text: "text-white", label: "BOGO" },
    free_delivery: { bg: "bg-green-600", text: "text-white", label: "Free Delivery" },
    free_gift: { bg: "bg-brand-navy", text: "text-white", label: "Free Gift" },
    coupon: { bg: "bg-blue-600", text: "text-white", label: "Coupon" },
    promo_code: { bg: "bg-blue-600", text: "text-white", label: "Promo" },
    first_order_offer: { bg: "bg-brand-primary", text: "text-white", label: "First Order" },
    birthday_offer: { bg: "bg-brand-navy", text: "text-white", label: "🎂 Birthday" },
    festival_campaign: { bg: "bg-brand-gold", text: "text-white", label: "🎉 Festival" },
};

export function PromotionBadge({
    type,
    label,
    className = "",
}: {
    type: string;
    label?: string;
    className?: string;
}) {
    const style = BADGE_STYLES[type] ?? {
        bg: "bg-ui-fg-base",
        text: "text-ui-fg-on-inverted",
        label: type,
    };
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.text} ${className}`}
        >
            {label ?? style.label}
        </span>
    );
}

/**
 * Flash Sale badge — specialized for flash-sale offers with an optional
 * discount percentage and countdown end time.
 */
export function FlashSaleBadge({
    discountPercent,
    endsAt,
    className = "",
}: {
    discountPercent?: number;
    endsAt?: string | Date;
    className?: string;
}) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white ${className}`}
        >
            ⚡ Flash Sale
            {discountPercent !== undefined && ` • ${discountPercent}% off`}
            {endsAt && (
                <span className="font-mono text-[10px] opacity-90">
                    ends {new Date(endsAt).toLocaleDateString()}
                </span>
            )}
        </span>
    );
}
