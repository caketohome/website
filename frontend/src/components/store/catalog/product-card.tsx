"use client";

import type { SearchResult } from "@frontend/lib/data/catalog";
import { useFavorites } from "@/providers/favorites-provider";
import { trackProductView } from "@frontend/lib/data/analytics";
import { Heart } from "@medusajs/icons";
import { useState } from "react";
import Link from "next/link";

/**
 * Product card — reusable storefront product tile.
 *
 * Implements CakeToHome editorial design system:
 * - Entire product card is clickable to the product detail page via stretched link.
 * - Favorites/wishlist toggle sits at z-20 with stopPropagation so it doesn't trigger navigation.
 * - Zero nested interactive elements (no buttons inside anchors).
 * - Typography: Editorial serif title, readable sans-serif description, prominent bold price.
 * - Gold rating accent (#C29B38 / #D4AF37).
 */
export function ProductCard({ product }: { product: SearchResult }) {
    const { isFavorited, toggleFavorite } = useFavorites();
    const prodId = product.product_id || (product as any).id;
    const wished = isFavorited(prodId);
    const [loading, setLoading] = useState(false);

    const dietary: string[] = [];
    if (product.sugar_free) dietary.push("Sugar-Free");
    if (product.gluten_free) dietary.push("Gluten-Free");
    // Vegan remains dormant as per customer-facing storefront guidelines

    const merchandising: string[] = [];
    if (product.is_bestseller) merchandising.push("Bestseller");
    if (product.is_new_arrival) merchandising.push("New");
    if (product.is_featured) merchandising.push("Featured");

    async function handleToggleWishlist(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        try {
            await toggleFavorite(prodId, { title: product.title, handle: product.handle || undefined });
        } finally {
            setLoading(false);
        }
    }

    const productHref = product.handle ? `/products/${product.handle}` : `/products/${product.product_id}`;

    // Resolve safe local fallback image based on product flavor / title
    const resolveLocalFallback = () => {
        const titleLower = (product.title || "").toLowerCase();
        if (titleLower.includes("velvet")) return "/images/red-velvet-heart.jpg";
        if (titleLower.includes("truffle") || titleLower.includes("belgian")) return "/images/belgian-truffle.jpg";
        if (titleLower.includes("choco") || titleLower.includes("fudge")) return "/images/chocolate-cake.jpg";
        if (titleLower.includes("berry") || titleLower.includes("fruit")) return "/images/strawberry-cake.jpg";
        return "/images/default-cake.jpg";
    };

    const displayImage = product.thumbnail && !product.thumbnail.startsWith("http://localhost:3000/_")
        ? product.thumbnail
        : resolveLocalFallback();

    return (
        <div
            data-testid="product-card"
            data-product-id={prodId}
            className="group relative flex flex-col h-full justify-between p-4 sm:p-5 rounded-[22px] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 bg-white text-inherit border border-[#E2E8F0] hover:border-blue-200"
        >
            {/* Stretched Link: Makes entire card clickable without invalid nested HTML */}
            <Link
                href={productHref}
                onClick={() => trackProductView(product.product_id)}
                className="absolute inset-0 z-10 rounded-[22px] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
                aria-label={`View details for ${product.title}`}
            />

            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[16px] bg-[#F8FAFC] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={displayImage}
                    alt={product.title}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = resolveLocalFallback();
                    }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent pointer-events-none" />

                {/* Badges / Merchandising */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 pointer-events-none">
                    {merchandising.map((m) => (
                        <div
                            key={m}
                            className="bg-[#2563EB] text-white px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold shadow-xs"
                        >
                            {m}
                        </div>
                    ))}
                </div>

                {/* Wishlist Button: z-20 sits above the stretched link */}
                <div className="absolute top-3 left-3 z-20">
                    <button
                        type="button"
                        onClick={handleToggleWishlist}
                        disabled={loading}
                        aria-label={wished ? "Remove from Favorites" : "Add to Favorites"}
                        title={wished ? "Remove from Favorites" : "Add to Favorites"}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-xs ${
                            wished
                                ? "bg-blue-50 border border-blue-200 text-[#2563EB] hover:bg-blue-100"
                                : "bg-white/90 border border-slate-200 text-slate-600 hover:text-[#2563EB] hover:scale-105"
                        }`}
                    >
                        <Heart fill={wished ? "currentColor" : "none"} className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Category & Flavour Meta */}
            {(product.category || product.flavour) && (
                <div className="flex items-center justify-between gap-1 text-[11px] mt-3.5">
                    {product.category && (
                        <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-[#64748B] truncate max-w-[70%] font-semibold">
                            {product.category}
                        </span>
                    )}
                    {product.flavour && (
                        <span className="font-sans text-[10px] text-[#64748B] truncate ml-auto italic">
                            {product.flavour}
                        </span>
                    )}
                </div>
            )}

            {/* Title & Description with controlled heights for strict grid alignment */}
            <div className="flex flex-col gap-1 flex-1 mt-2">
                <h3 className="font-serif text-[18px] sm:text-[20px] font-semibold text-[#0F172A] leading-snug line-clamp-2 min-h-[3rem] group-hover:text-[#2563EB] transition-colors">
                    {product.title}
                </h3>

                {product.description && (
                    <p className="font-sans text-[#64748B] text-[12px] sm:text-[13px] leading-relaxed line-clamp-2 mt-0.5 min-h-[2.5rem]">
                        {product.description}
                    </p>
                )}
            </div>

            {dietary.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 mb-2.5">
                    {dietary.map((d) => (
                        <div
                            key={d}
                            className="bg-[#F1F5F9] border border-slate-200 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider text-slate-700 font-medium"
                        >
                            {d}
                        </div>
                    ))}
                </div>
            )}

            {/* Price & Non-interactive Action Hint */}
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-200/80 shrink-0">
                <div className="flex flex-col">
                    <span className="font-sans text-base sm:text-lg font-bold text-[#0F172A]">
                        {(() => {
                            const pVal = (product.price && product.price > 0)
                                ? product.price
                                : ((product as any).selling_price && (product as any).selling_price > 0)
                                    ? (product as any).selling_price
                                    : ((product as any).base_price && (product as any).base_price > 0)
                                        ? (product as any).base_price
                                        : 499;
                            return `₹${pVal.toFixed(0)}`;
                        })()}
                    </span>
                    {product.review_count > 0 && (
                        <span className="font-sans text-amber-500 text-[11px] flex items-center gap-1 font-semibold">
                            <span>★</span> <span>{product.rating.toFixed(1)}</span>
                            <span className="text-[#64748B] font-normal">({product.review_count})</span>
                        </span>
                    )}
                </div>

                {/* Non-interactive action hint */}
                <span className="font-sans text-xs font-semibold text-[#2563EB] flex items-center gap-1 group-hover:translate-x-1 group-hover:text-[#1D4ED8] transition-all">
                    View details <span aria-hidden="true">→</span>
                </span>
            </div>
        </div>
    );
}
