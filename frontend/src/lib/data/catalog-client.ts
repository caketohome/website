/**
 * Client-safe catalog helpers.
 *
 * This file re-exports types and pure client-side helpers (localStorage-based
 * comparison) that can safely be imported in "use client" components without
 * pulling in server-only dependencies (cookies, headers).
 */

// ── Types (re-exported from catalog.ts) ─────────────────────────────────────

export type {
    SearchResult,
    SearchResponse,
    SearchFilters,
    ProductMeta,
    ProductReview,
    ReviewAggregate,
    WishlistItem,
    StockNotification,
    Subscription,
} from "./catalog";

// ── Product Comparison (client-side, localStorage) ──────────────────────────

const COMPARE_KEY = "cth_compare";
const COMPARE_MAX = 4;

export function getCompareIds(): string[] {
    if (typeof window === "undefined") return [];
    try {
        return JSON.parse(localStorage.getItem(COMPARE_KEY) || "[]");
    } catch {
        return [];
    }
}

export function addToCompare(productId: string): string[] {
    if (typeof window === "undefined") return [];
    const ids = getCompareIds();
    if (!ids.includes(productId)) {
        ids.push(productId);
        if (ids.length > COMPARE_MAX) ids.shift();
    }
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
    return ids;
}

export function removeFromCompare(productId: string): string[] {
    if (typeof window === "undefined") return [];
    const ids = getCompareIds().filter((id) => id !== productId);
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
    return ids;
}

export function clearCompare(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(COMPARE_KEY);
}
