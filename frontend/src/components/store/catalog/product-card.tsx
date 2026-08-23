"use client";

import type { SearchResult } from "@frontend/lib/data/catalog";
import { useFavorites } from "@/providers/favorites-provider";
import { trackProductView } from "@frontend/lib/data/analytics";
import { Heading, Text, Badge, IconButton } from "@medusajs/ui";
import { Heart } from "@medusajs/icons";
import { useState } from "react";
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
        e.stopPropagation();
        setLoading(true);
        try {
            await toggleFavorite(prodId, { title: product.title, handle: product.handle || undefined });
        } finally {
            setLoading(false);
        }
    }

    function navigate() {
        trackProductView(product.product_id);
        if (product.handle) {
            router.push(`/products/${product.handle}`);
        } else {
            router.push(`/products/${product.product_id}`);
        }
    }

    return (
        <div
            className="group relative flex flex-col gap-2 p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-ui-bg-base"
            onClick={navigate}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter") navigate();
            }}
        >
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-ui-bg-subtle">
                {product.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={product.thumbnail}
                        alt={product.title}
                        loading="lazy"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-ui-fg-subtle">
                        🎂
                    </div>
                )}
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                    {merchandising.map((m) => (
                        <Badge key={m} size="small" color="orange">
                            {m}
                        </Badge>
                    ))}
                </div>
                <div className="absolute top-2 left-2">
                    <IconButton
                        variant={wished ? "primary" : "transparent"}
                        size="small"
                        onClick={handleToggleWishlist}
                        disabled={loading}
                        aria-label={wished ? "Remove from Favorites" : "Add to Favorites"}
                        title={wished ? "Remove from Favorites" : "Add to Favorites"}
                        className={wished ? "text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100" : "bg-white/80 backdrop-blur hover:bg-white text-gray-700"}
                    >
                        <Heart fill={wished ? "currentColor" : "none"} className={wished ? "text-rose-600 w-4 h-4" : "w-4 h-4 text-gray-700"} />
                    </IconButton>
                </div>
            </div>

            {/* Category & Flavour Meta */}
            {(product.category || product.flavour) && (
                <div className="flex items-center justify-between gap-1 text-[11px]">
                    {product.category && (
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                const catSlug = product.category_slug || product.category?.toLowerCase().replace(/\s+/g, "-");
                                router.push(`/products?category=${catSlug}`);
                            }}
                            className="font-semibold tracking-wide text-rose-600 dark:text-rose-400 hover:underline cursor-pointer truncate max-w-[70%]"
                        >
                            {product.category}
                        </span>
                    )}
                    {product.flavour && (
                        <span className="text-slate-400 dark:text-slate-500 truncate ml-auto">
                            {product.flavour}
                        </span>
                    )}
                </div>
            )}

            <Heading level="h3" className="text-sm font-medium line-clamp-2">
                {product.title}
            </Heading>

            {product.description && (
                <Text className="text-ui-fg-subtle text-xs line-clamp-2">
                    {product.description}
                </Text>
            )}

            {dietary.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {dietary.map((d) => (
                        <Badge key={d} size="small" color="green">
                            {d}
                        </Badge>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-2">
                <Text className="font-semibold">
                    {product.price !== null
                        ? `₹${product.price.toFixed(0)}`
                        : "Price on request"}
                </Text>
                {product.review_count > 0 && (
                    <Text className="text-ui-fg-subtle text-xs">
                        ⭐ {product.rating.toFixed(1)} ({product.review_count})
                    </Text>
                )}
            </div>
        </div>
    );
}
