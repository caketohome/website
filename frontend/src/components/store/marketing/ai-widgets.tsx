/**
 * AI Recommendation Widgets — Phase 9.2 storefront placeholders.
 *
 * These are interface-only placeholders for the AI recommendation widgets
 * (Personalized Recommendations, Frequently Bought Together, Upselling,
 * Cross-selling, AI Product Recommendations). Full AI functionality belongs
 * to a later milestone (Phase 17 — AI Capabilities). The components render a
 * graceful "coming soon" state and expose typed props so the real AI engine
 * can be wired in later without changing call sites.
 *
 * The hooks below define the contract the future AI engine will implement.
 */

import { Text, Container, Heading } from "@medusajs/ui";
import { Link } from "next-view-transitions";

// ── Types (the contract the future AI engine will fill) ───────────────────────

export interface RecommendedProduct {
    product_id: string;
    handle: string;
    title: string;
    thumbnail?: string | null;
    price?: number;
    reason?: string; // e.g. "Customers who bought X also bought Y"
    score?: number; // confidence 0..1
}

export interface RecommendationContext {
    customer_id?: string;
    product_id?: string;
    cart_items?: Array<{ product_id: string; quantity: number }>;
    branch_id?: string;
    limit?: number;
}

// ── Placeholder hooks (interfaces only — no real AI yet) ──────────────────────

/**
 * Placeholder: fetch personalized recommendations for a customer.
 * Returns an empty array until the AI engine (Phase 17) is wired.
 */
export async function fetchPersonalizedRecommendations(
    _ctx: RecommendationContext
): Promise<RecommendedProduct[]> {
    // Deterministic fallback: returns empty when AI recommendation engine is not configured.
    // When AI module (M9) is enabled, this calls /store/ai/recommendations.
    return [];
}

/**
 * Placeholder: fetch "frequently bought together" for a product.
 */
export async function fetchFrequentlyBoughtTogether(
    _productId: string,
    _limit = 3
): Promise<RecommendedProduct[]> {
    // Deterministic fallback: returns empty when AI FBT engine is not configured.
    return [];
}

/**
 * Placeholder: fetch upsell candidates for a cart/product.
 */
export async function fetchUpsellCandidates(
    _ctx: RecommendationContext
): Promise<RecommendedProduct[]> {
    // Deterministic fallback: returns empty when AI upsell engine is not configured.
    return [];
}

/**
 * Placeholder: fetch cross-sell candidates for a cart/product.
 */
export async function fetchCrossSellCandidates(
    _ctx: RecommendationContext
): Promise<RecommendedProduct[]> {
    // Deterministic fallback: returns empty when AI cross-sell engine is not configured.
    return [];
}

// ── Placeholder UI components ──────────────────────────────────────────────────

function PlaceholderGrid({
    title,
    subtitle,
    icon,
}: {
    title: string;
    subtitle: string;
    icon: string;
}) {
    return (
        <Container className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <Heading level="h3">{title}</Heading>
            </div>
            <Text className="text-ui-fg-subtle text-sm">{subtitle}</Text>
            <div className="mt-2 px-3 py-2 rounded-lg bg-ui-bg-subtle text-ui-fg-subtle text-xs text-center">
                AI recommendations coming soon
            </div>
        </Container>
    );
}

export function PersonalizedRecommendations({
    customerId,
    limit = 4,
}: {
    customerId?: string;
    limit?: number;
}) {
    return (
        <PlaceholderGrid
            icon="✨"
            title="Recommended for You"
            subtitle="Personalized picks based on your taste and order history."
        />
    );
}

export function FrequentlyBoughtTogether({
    productId,
    limit = 3,
}: {
    productId: string;
    limit?: number;
}) {
    return (
        <PlaceholderGrid
            icon="🛒"
            title="Frequently Bought Together"
            subtitle="Customers who bought this cake also ordered these."
        />
    );
}

export function UpsellWidget({
    productId,
    cartItems,
    limit = 3,
}: {
    productId?: string;
    cartItems?: Array<{ product_id: string; quantity: number }>;
    limit?: number;
}) {
    return (
        <PlaceholderGrid
            icon="⬆️"
            title="Upgrade Your Order"
            subtitle="Premium add-ons and upgrades for your selection."
        />
    );
}

export function CrossSellWidget({
    productId,
    cartItems,
    limit = 3,
}: {
    productId?: string;
    cartItems?: Array<{ product_id: string; quantity: number }>;
    limit?: number;
}) {
    return (
        <PlaceholderGrid
            icon="🔄"
            title="You May Also Like"
            subtitle="Complementary picks to round out your order."
        />
    );
}

export function AIProductRecommendations({
    customerId,
    productId,
    limit = 4,
}: {
    customerId?: string;
    productId?: string;
    limit?: number;
}) {
    return (
        <PlaceholderGrid
            icon="🤖"
            title="AI Picks"
            subtitle="Smart recommendations powered by our AI engine (coming soon)."
        />
    );
}
