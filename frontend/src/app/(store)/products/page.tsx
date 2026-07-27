"use client";

import { useState, useEffect, useCallback } from "react";
import { Heading, Text, Input } from "@medusajs/ui";
import { searchProductsAction } from "@frontend/lib/actions/catalog";
import { type SearchFilters, type SearchResult } from "@frontend/lib/data/catalog-client";
import { ProductFilters, ActiveFilterChips } from "@frontend/components/store/catalog/product-filters";
import { ErrorComponent } from "@frontend/components/common/error-component";
import Link from "next/link";
import Image from "next/image";

export default function ProductsCatalogPage() {
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
            setResults(data.results || []);
            setCount(data.count || 0);
        } catch (e: any) {
            console.error("Failed to fetch product catalog", e);
            setError(e.message || "Failed to load product catalog. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [q, filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchResults();
        }, 300); // debounce input changes
        return () => clearTimeout(timer);
    }, [fetchResults]);

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <Heading level="h1" className="text-3xl font-extrabold">Discover Premium Cakes</Heading>
                    <Text className="text-ui-fg-subtle text-sm">Order freshly baked custom cakes delivered straight to your home</Text>
                </div>

                <div className="relative w-full md:w-80">
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search chocolate, vanilla, red velvet..."
                        className="pl-8"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-fg-muted">
                        🍰
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Faceted Filters Sidebar */}
                <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4 border p-4 rounded-xl bg-ui-bg-subtle">
                    <Heading level="h2" className="text-sm font-bold border-b pb-2">Filter Catalog</Heading>
                    <ProductFilters filters={filters} onChange={setFilters} />
                </aside>

                {/* Catalog Grid */}
                <main className="flex-1 flex flex-col gap-4">
                    <ActiveFilterChips filters={filters} onChange={setFilters} />

                    {error && (
                        <ErrorComponent
                            title="Catalog Loading Error"
                            message={error}
                            onRetry={fetchResults}
                            onDismiss={() => setError(null)}
                        />
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-24 text-ui-fg-muted font-semibold">
                            Loading cakes...
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-ui-bg-subtle">
                            <Text className="text-ui-fg-muted mb-2">No matching cakes found.</Text>
                            <Text className="text-xs text-ui-fg-muted">Try adjusting your filters or search query.</Text>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <Text className="text-xs text-ui-fg-subtle">{count} cakes matching your criteria</Text>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((r) => (
                                    <Link key={r.product_id} href={`/products/${r.product_id}`} className="group border rounded-xl overflow-hidden bg-ui-bg-base hover:shadow-md transition flex flex-col h-full">
                                        <div className="relative w-full h-48 bg-ui-bg-subtle">
                                            {r.thumbnail ? (
                                                <Image
                                                    src={r.thumbnail}
                                                    alt={r.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                                    width={300}
                                                    height={192}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-4xl">🍰</div>
                                            )}
                                            {r.is_bestseller && (
                                                <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow">
                                                    Bestseller
                                                </span>
                                            )}
                                            {r.is_new_arrival && (
                                                <span className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow">
                                                    New
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-4 flex flex-col gap-2 flex-1 justify-between">
                                            <div className="flex flex-col gap-1">
                                                <Heading level="h3" className="text-sm font-bold group-hover:text-ui-fg-interactive transition truncate">{r.title}</Heading>
                                                <Text className="text-xs text-ui-fg-subtle line-clamp-2 leading-relaxed">{r.description}</Text>
                                            </div>
                                            <div className="flex justify-between items-center mt-3 pt-2 border-t">
                                                <span className="text-sm font-extrabold text-ui-fg-base">
                                                    {r.price ? `₹${r.price.toFixed(2)}` : "—"}
                                                </span>
                                                <span className="text-xs text-yellow-500 font-bold flex items-center gap-0.5">
                                                    {r.rating > 0 ? `${r.rating} ★` : "New"}
                                                </span>
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

