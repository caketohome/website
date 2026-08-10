"use client";

import { useState, useEffect, useCallback } from "react";
import { Heading, Text, Input } from "@medusajs/ui";
import { searchProductsAction } from "@frontend/lib/actions/catalog";
import { type SearchFilters, type SearchResult } from "@frontend/lib/data/catalog-client";
import { ProductFilters, ActiveFilterChips } from "@frontend/components/store/catalog/product-filters";
import { ErrorComponent } from "@frontend/components/common/error-component";
import Link from "next/link";
import Image from "next/image";

export function ProductsCatalogClient() {
    const [q, setQ] = useState("");
    const [filters, setFilters] = useState<SearchFilters>({});
    const [results, setResults] = useState<SearchResult[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchResults = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await searchProductsAction({
                q: q || undefined,
                ...filters,
                limit: 48,
            });
            setResults(data?.results || []);
            setCount(data?.count || 0);
        } catch (e: any) {
            console.error("Failed to search products", e);
            setResults([]);
            setCount(0);
        } finally {
            setLoading(false);
        }
    }, [q, filters]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const timer = setTimeout(() => fetchResults(), 300);
        return () => clearTimeout(timer);
    }, [fetchResults]);

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                <div>
                    <Heading level="h1" className="text-2xl font-bold">All Gourmet Cakes & Sweets</Heading>
                    <Text className="text-ui-fg-subtle text-sm">
                        Browse our complete catalog of handcrafted cakes, pastries, eggless treats, and desserts.
                    </Text>
                </div>
                <div className="w-full md:w-72">
                    <Input
                        type="search"
                        placeholder="Search cakes by name..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4 border p-4 rounded-xl bg-ui-bg-subtle">
                    <Heading level="h2" className="text-sm font-bold border-b pb-2">Filters</Heading>
                    <ProductFilters filters={filters} onChange={setFilters} />
                </aside>

                <main className="flex-1 flex flex-col gap-4">
                    <ActiveFilterChips filters={filters} onChange={setFilters} />

                    {error ? (
                        <ErrorComponent title="Error loading products" message={error} reset={fetchResults} />
                    ) : loading ? (
                        <div className="flex items-center justify-center py-24 text-ui-fg-muted">
                            Loading catalog...
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-ui-bg-subtle">
                            <Text className="text-ui-fg-muted mb-2">No products matched your criteria.</Text>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <Text className="text-xs text-ui-fg-subtle">Showing {results.length} of {count} products</Text>
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
                                                    alt={`${r.title} — Handcrafted Gourmet Cake`}
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
                                                    <span className="text-xs text-yellow-500 font-bold">
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
