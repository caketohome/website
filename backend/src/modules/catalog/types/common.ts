/**
 * Shared types for the Catalog module.
 */

// ── Product Meta ────────────────────────────────────────────────────────────

export interface ProductMetaInput {
    product_id: string;
    eggless?: boolean;
    sugar_free?: boolean;
    gluten_free?: boolean;
    vegan?: boolean;
    ingredients?: string | null;
    allergens?: string | null;
    nutritional_info?: Record<string, unknown> | string | null;
    shelf_life?: string | null;
    storage_instructions?: string | null;
    fssai_license?: string | null;
    video_url?: string | null;
    is_featured?: boolean;
    is_bestseller?: boolean;
    is_new_arrival?: boolean;
    sku?: string | null;
    barcode?: string | null;
    tags?: string | null;
    occasion?: string | null;
    brand?: string | null;
    cake_type?: string | null;
    cost_price?: number | null;
    mrp?: number | null;
    gst_rate?: number | null;
    tax_class?: string | null;
    add_ons_json?: Record<string, unknown> | string | null;
    variants_json?: Record<string, unknown> | string | null;
    customization_config_json?: Record<string, unknown> | string | null;
    seo_keywords?: string | null;
    canonical_url?: string | null;
    search_document?: string | null;
    meta?: Record<string, unknown> | string | null;
}

export interface ProductMetaUpdate extends Partial<Omit<ProductMetaInput, "product_id">> { }

// ── Reviews ─────────────────────────────────────────────────────────────────

export interface ReviewInput {
    product_id: string;
    customer_id?: string | null;
    customer_name?: string | null;
    rating: number;
    title?: string | null;
    body?: string | null;
    images?: string[] | null;
    verified_purchase?: boolean;
}

export interface ReviewModerationInput {
    status: "approved" | "rejected";
    reply?: string | null;
}

export interface ReviewAggregate {
    product_id: string;
    average_rating: number;
    total_reviews: number;
    rating_distribution: Record<number, number>;
}

// ── Wishlist ────────────────────────────────────────────────────────────────

export interface WishlistItemInput {
    customer_id: string;
    product_id: string;
}

// ── Stock Notifications ─────────────────────────────────────────────────────

export interface StockNotificationInput {
    product_id: string;
    variant_id?: string | null;
    customer_id?: string | null;
    email?: string | null;
    phone?: string | null;
}

// ── Subscriptions ───────────────────────────────────────────────────────────

export type SubscriptionFrequency = "weekly" | "fortnightly" | "monthly" | "custom";

export interface SubscriptionInput {
    customer_id: string;
    product_id: string;
    variant_id?: string | null;
    frequency?: SubscriptionFrequency;
    quantity?: number;
    next_date: Date | string;
    max_deliveries?: number | null;
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface SearchFilters {
    q?: string;
    category_id?: string | string[];
    shop_id?: string;
    min_price?: number;
    max_price?: number;
    eggless?: boolean;
    sugar_free?: boolean;
    gluten_free?: boolean;
    vegan?: boolean;
    is_featured?: boolean;
    is_bestseller?: boolean;
    is_new_arrival?: boolean;
    sort?: "relevance" | "price_asc" | "price_desc" | "newest" | "rating";
    limit?: number;
    offset?: number;
}

export interface SearchResult {
    product_id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    handle: string | null;
    price: number | null;
    rating: number;
    review_count: number;
    eggless: boolean;
    sugar_free: boolean;
    gluten_free: boolean;
    vegan: boolean;
    is_featured: boolean;
    is_bestseller: boolean;
    is_new_arrival: boolean;
}
