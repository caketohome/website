"use client";

import { useState, useEffect, useCallback } from "react";
import { Heading, Text } from "@medusajs/ui";
import { searchProductsAction } from "@frontend/lib/actions/catalog";
import { type SearchFilters, type SearchResult } from "@frontend/lib/data/catalog-client";
import { ProductFilters, ActiveFilterChips } from "@frontend/components/store/catalog/product-filters";
import Link from "next/link";
import Image from "next/image";

export function CategoryClientPage({ categorySlug }: { categorySlug?: string }) {
    const [filters, setFilters] = useState<SearchFilters>({});
    const [results, setResults] = useState<SearchResult[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [categoryId, setCategoryId] = useState<string>("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id") ?? categorySlug ?? "";
        setCategoryId(id);
        setFilters((f) => ({ ...f, category_id: id || undefined }));
    }, [categorySlug]);

    const fetchResults = useCallback(async () => {
        setLoading(true);
        try {
            const data = await searchProductsAction({ ...filters, limit: 48 });
            setResults(data.results || []);
            setCount(data.count || 0);
        } catch (e) {
            console.error("Failed to fetch category products", e);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const timer = setTimeout(() => fetchResults(), 300);
        return () => clearTimeout(timer);
    }, [fetchResults]);

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full px-4 py-8">
            <div className="flex flex-col gap-1">
                <Heading level="h1" className="text-2xl font-bold">Browse Cakes by Category</Heading>
                <Text className="text-ui-fg-subtle text-sm">
                    {categoryId ? `Showing products in ${categoryId}` : "Select a category to browse gourmet cakes"}
                </Text>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4 border p-4 rounded-xl bg-ui-bg-subtle">
                    <Heading level="h2" className="text-sm font-bold border-b pb-2">Filters</Heading>
                    <ProductFilters filters={filters} onChange={setFilters} />
                </aside>

                <main className="flex-1 flex flex-col gap-4">
                    <ActiveFilterChips filters={filters} onChange={setFilters} />

                    {loading ? (
                        <div className="flex items-center justify-center py-24 text-ui-fg-muted">Loading...</div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-ui-bg-subtle">
                            <Text className="text-ui-fg-muted mb-2">No products in this category.</Text>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <Text className="text-xs text-ui-fg-subtle">{count} products</Text>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((r) => (
                                    <Link
                                        key={r.product_id}
                                        href={`/products/${r.product_id}`}
                                        className="group border rounded-xl overflow-hidden bg-ui-bg-base hover:shadow-md transition flex flex-col h-full"
                                    >
                                        <div className="relative w-full h-48 bg-ui-bg-subtle">
                                            {r.thumbnail ? (
                                                <Image
                                                    src={r.thumbnail}
                                                    alt={`${r.title} — Order online from CakeToHome`}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                                    width={300}
                                                    height={192}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-4xl">🍰</div>
                                            )}
                                        </div>
                                        <div className="p-4 flex flex-col gap-1 flex-1 justify-between">
                                            <Heading level="h3" className="text-sm font-bold truncate">{r.title}</Heading>
                                            <Text className="text-xs text-ui-fg-subtle line-clamp-2">{r.description}</Text>
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t">
                                                <span className="text-sm font-extrabold">
                                                    {r.price ? `₹${r.price.toFixed(0)}` : "—"}
                                                </span>
                                                {r.review_count > 0 && (
                                                    <span className="text-xs text-brand-gold font-bold">
                                                        ⭐ {r.rating.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
