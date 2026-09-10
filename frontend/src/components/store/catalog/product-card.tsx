"use client";

import type { SearchResult } from "@frontend/lib/data/catalog";
import { useFavorites } from "@/providers/favorites-provider";
import { trackProductView } from "@frontend/lib/data/analytics";
import { Heading, Text, Badge, IconButton } from "@medusajs/ui";
import { Heart } from "@medusajs/icons";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Product card — reusable storefront product tile.
 *
 * Renders a search/catalog result with dietary badges, rating, price, and an
 * authoritative favorites/wishlist toggle. Clicking the card navigates to the product detail page.
 */
export function ProductCard({ product }: { product: SearchResult }) {
    const router = useRouter();
    const { isFavorited, toggleFavorite } = useFavorites();
    const prodId = product.product_id || (product as any).id;
    const wished = isFavorited(prodId);
    const [loading, setLoading] = useState(false);

    const dietary: string[] = [];
    if (product.sugar_free) dietary.push("Sugar-Free");
    if (product.gluten_free) dietary.push("Gluten-Free");
    if (product.vegan) dietary.push("Vegan");

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

    return (
        <Link
            href={productHref}
            data-testid="product-card"
            data-product-id={prodId}
            onClick={() => trackProductView(product.product_id)}
            className="group relative flex flex-col h-full justify-between p-4 sm:p-5 rounded-[22px] shadow-[0_10px_40px_rgba(20,32,64,0.2)] hover:shadow-[0_20px_50px_rgba(20,32,64,0.35)] hover:-translate-y-1.5 transition-all duration-300 cursor-pointer bg-[#FAF9F6] text-inherit no-underline border border-white/20"
        >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[16px] bg-obsidian-base shrink-0">
                {product.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={product.thumbnail}
                        alt={product.title}
                        loading="lazy"
                        className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-ui-fg-subtle">
                        <span className="text-4xl text-blush">♡</span>
                    </div>
                )}
                
                <div className="absolute inset-0 bg-rosegold/0 group-hover:bg-rosegold/[0.02] transition-colors duration-500 pointer-events-none" />

                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                    {merchandising.map((m) => (
                        <div key={m} className="bg-gradient-to-b from-navy-surface to-obsidian-base border border-navy-accent/50 backdrop-blur-md px-3 py-1 rounded-full text-[9px] uppercase tracking-widest text-pearl font-semibold shadow-sm">
                            {m}
                        </div>
                    ))}
                </div>
                <div className="absolute top-3 left-3">
                    <button
                        onClick={handleToggleWishlist}
                        disabled={loading}
                        aria-label={wished ? "Remove from Favorites" : "Add to Favorites"}
                        title={wished ? "Remove from Favorites" : "Add to Favorites"}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md shadow-sm ${wished ? "bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100" : "bg-gradient-to-b from-navy-surface to-obsidian-base border border-navy-accent/50 border border-navy-accent/60 text-pearl hover:bg-navy-surface hover:scale-105"}`}
                    >
                        <Heart fill={wished ? "currentColor" : "none"} className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Category & Flavour Meta */}
            {(product.category || product.flavour) && (
                <div className="flex items-center justify-between gap-1 text-[11px] mt-4">
                    {product.category && (
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                const catSlug = product.category_slug || product.category?.toLowerCase().replace(/\s+/g, "-");
                                router.push(`/products?category=${catSlug}`);
                            }}
                            className="font-sans text-[10px] uppercase tracking-[0.2em] text-[#606C88] hover:text-[#142040] transition-colors cursor-pointer truncate max-w-[70%] font-semibold"
                        >
                            {product.category}
                        </span>
                    )}
                    {product.flavour && (
                        <span className="font-sans text-[10px] text-[#606C88] truncate ml-auto italic">
                            {product.flavour}
                        </span>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-1 flex-1 mt-3">
                <Heading level="h3" className="font-serif text-[22px] font-medium text-[#142040] leading-tight line-clamp-2 min-h-[3rem]">
                    {product.title}
                </Heading>

                {product.description && (
                    <Text className="font-sans text-[#606C88] text-[13px] leading-relaxed line-clamp-2 mt-1 min-h-[2.5rem]">
                        {product.description}
                    </Text>
                )}
            </div>

            {dietary.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                    {dietary.map((d) => (
                        <div key={d} className="bg-white/80 border border-[#142040]/10 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider text-[#606C88] font-semibold shadow-sm">
                            {d}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#142040]/10 shrink-0">
                <Text className="font-sans text-lg font-semibold text-[#142040]">
                    {product.price !== null
                        ? `₹${product.price.toFixed(0)}`
                        : "Price on request"}
                </Text>
                {product.review_count > 0 && (
                    <Text className="font-sans text-[#606C88] text-xs flex items-center gap-1 font-medium">
                        <span className="text-[#C29B38]">★</span> <span className="text-[#C29B38] font-bold">{product.rating.toFixed(1)}</span> 
                        <span className="text-[#606C88]/70 ml-0.5">({product.review_count})</span>
                    </Text>
                )}
            </div>
        </Link>
    );
}
