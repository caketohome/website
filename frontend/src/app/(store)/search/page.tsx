"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { Heading, Text, Input } from "@medusajs/ui";
import { searchProductsAction } from "@frontend/lib/actions/catalog";
import { type SearchFilters, type SearchResult } from "@frontend/lib/data/catalog-client";
import { ProductFilters, ActiveFilterChips } from "@frontend/components/store/catalog/product-filters";
import { ProductCard } from "@frontend/components/store/catalog/product-card";
import { trackSearch } from "@frontend/lib/data/analytics";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-24 text-ui-fg-muted">Loading search...</div>}>
            <SearchPageContent />
        </Suspense>
    );
}

function SearchPageContent() {
    const searchParams = useSearchParams();
    const initialQ = searchParams.get("search") ?? searchParams.get("q") ?? "";
    const [q, setQ] = useState(initialQ);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [results, setResults] = useState<SearchResult[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchResults = useCallback(async () => {
        setLoading(true);
        try {
            const data = await searchProductsAction({
                q: q || undefined,
                ...filters,
                limit: 48,
            });
            setResults(data.results || []);
            setCount(data.count || 0);
            if (q) trackSearch(q);
        } catch (e) {
            console.error("Failed to search products", e);
        } finally {
            setLoading(false);
        }
    }, [q, filters]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchResults();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchResults]);

    const [isListening, setIsListening] = useState(false);

    const startVoiceSearch = () => {
        if (typeof window === "undefined") return;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice search is not supported by your browser. Please type your search query.");
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = "en-IN";
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);

            recognition.onresult = (event: any) => {
                const speechResult = event.results[0][0].transcript;
                if (speechResult) {
                    setQ(speechResult);
                }
            };

            recognition.start();
        } catch (e) {
            setIsListening(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full px-4 py-8">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <Heading level="h1" className="text-2xl font-bold">Search Cakes & Gourmet Treats</Heading>
                    {isListening && (
                        <span className="text-xs font-bold text-[#D4AF37] animate-pulse flex items-center gap-1">
                            <span>🎙️</span> Listening to your voice...
                        </span>
                    )}
                </div>
                <div className="relative w-full md:w-96">
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search chocolate, vanilla, red velvet..."
                        className="pl-8 pr-9"
                        autoFocus
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-fg-muted">
                        🔍
                    </div>
                    <button
                        type="button"
                        onClick={startVoiceSearch}
                        aria-label="Voice Search"
                        title="Search by Voice"
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                            isListening ? "text-[#D4AF37] scale-110 animate-bounce" : "text-zinc-500 hover:text-[#D4AF37]"
                        }`}
                    >
                        🎙️
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4 border p-4 rounded-xl bg-ui-bg-subtle">
                    <Heading level="h2" className="text-sm font-bold border-b pb-2">Filters</Heading>
                    <ProductFilters filters={filters} onChange={setFilters} />
                </aside>

                <main className="flex-1 flex flex-col gap-4">
                    <ActiveFilterChips filters={filters} onChange={setFilters} />

                    {loading ? (
                        <div className="flex items-center justify-center py-24 text-ui-fg-muted">
                            Searching...
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-ui-bg-subtle">
                            <Text className="text-ui-fg-muted mb-2">No cakes found for &ldquo;{q}&rdquo;.</Text>
                            <Text className="text-xs text-ui-fg-muted">Try a different search term or adjust filters.</Text>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <Text className="text-xs text-ui-fg-subtle">
                                {count} result{count !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
                            </Text>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((r) => (
                                    <ProductCard key={r.product_id} product={r} />
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
