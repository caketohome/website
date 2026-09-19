"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Button, Container } from "@medusajs/ui";
import {
    getCompareIds,
    addToCompare,
    removeFromCompare,
    clearCompare,
    type SearchResult,
} from "@frontend/lib/data/catalog-client";
import { searchProductsAction, getCompareProductsAction } from "@frontend/lib/actions/catalog";
import Link from "next/link";
import Image from "next/image";

/**
 * Product Comparison page — description-only comparison of up to 4 products.
 *
 * The comparison set is stored client-side (localStorage) via the catalog
 * data helpers. This page loads the full product details for each id in the
 * set and renders a side-by-side comparison table.
 */
export default function ComparePage() {
    const [ids, setIds] = useState<string[]>([]);
    const [products, setProducts] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setIds(getCompareIds());
    }, []);

    useEffect(() => {
        async function loadProducts() {
            if (ids.length === 0) {
                setProducts([]);
                return;
            }
            setLoading(true);
            try {
                // Batch fetch all comparison products in a single database query (N queries -> 1 query)
                const results = await getCompareProductsAction(ids);
                setProducts(results);
            } catch {
                setProducts([]);
            } finally {
                setLoading(false);
            }
        }
        loadProducts();
    }, [ids]);

    function handleRemove(id: string) {
        const next = removeFromCompare(id);
        setIds(next);
    }

    function handleClear() {
        clearCompare();
        setIds([]);
    }

    const rows: Array<{ label: string; render: (p: SearchResult) => React.ReactNode }> = [
        { label: "Price", render: (p) => (p.price ? `₹${p.price.toFixed(0)}` : "—") },
        { label: "Rating", render: (p) => (p.review_count > 0 ? `⭐ ${p.rating.toFixed(1)} (${p.review_count})` : "New") },
        { label: "Sugar-Free", render: (p) => (p.sugar_free ? "✅" : "—") },
        { label: "Gluten-Free", render: (p) => (p.gluten_free ? "✅" : "—") },
        { label: "Bestseller", render: (p) => (p.is_bestseller ? "✅" : "—") },
        { label: "New Arrival", render: (p) => (p.is_new_arrival ? "✅" : "—") },
        { label: "Description", render: (p) => p.description ?? "—" },
    ];

    return (
        <Container className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <Heading level="h1" className="text-2xl font-bold">Compare Cakes</Heading>
                {ids.length > 0 && (
                    <Button variant="danger" size="small" onClick={handleClear}>
                        Clear All
                    </Button>
                )}
            </div>

            {loading ? (
                <Text className="text-ui-fg-muted">Loading comparison...</Text>
            ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-ui-bg-subtle">
                    <Text className="text-ui-fg-muted mb-2">No products selected for comparison.</Text>
                    <Text className="text-xs text-ui-fg-muted">
                        Add products to compare from the catalog or product pages (up to 4).
                    </Text>
                    <Link href="/products" className="mt-4">
                        <Button variant="secondary" size="small">Browse Cakes</Button>
                    </Link>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left p-3 border-b w-40">Attribute</th>
                                {products.map((p) => (
                                    <th key={p.product_id} className="text-left p-3 border-b min-w-48">
                                        <div className="flex flex-col gap-2">
                                            <Link href={`/products/${p.product_id}`} className="hover:text-ui-fg-interactive">
                                                <div className="relative w-full h-32 rounded-lg overflow-hidden bg-ui-bg-subtle">
                                                    {p.thumbnail ? (
                                                        <Image
                                                            src={p.thumbnail}
                                                            alt={p.title}
                                                            fill
                                                            className="object-cover"
                                                            sizes="200px"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-3xl">🍰</div>
                                                    )}
                                                </div>
                                                <Text className="font-semibold text-sm mt-2 block">{p.title}</Text>
                                            </Link>
                                            <Button
                                                variant="transparent"
                                                size="small"
                                                onClick={() => handleRemove(p.product_id)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.label} className="border-b">
                                    <td className="p-3 font-semibold text-sm text-ui-fg-subtle">{row.label}</td>
                                    {products.map((p) => (
                                        <td key={p.product_id} className="p-3 text-sm">
                                            {row.render(p)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Container>
    );
}
