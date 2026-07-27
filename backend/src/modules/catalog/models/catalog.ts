import { model } from "@medusajs/utils";

/**
 * Product meta — extended cake-specific attributes for a Medusa core product.
 *
 * CakeToHome does not manufacture cakes, but every product (cake) needs rich
 * metadata for discovery, dietary filtering, compliance, and storefront display.
 * This model is keyed by the Medusa core product id (soft link) so the core
 * product catalog is never modified — only extended.
 *
 * Fields:
 *   - eggless, sugar_free, gluten_free, vegan — dietary flags (filterable)
 *   - ingredients, allergens, nutritional_info, shelf_life, storage_instructions
 *   - fssai_license — FSSAI compliance display
 *   - video_url — product video (uploaded via Media Module M10)
 *   - is_featured, is_bestseller, is_new_arrival — merchandising flags
 *   - search_document — denormalized full-text search document (tsvector source)
 *   - meta — arbitrary JSON extension point for future attributes
 */
export const ProductMeta = model.define("product_meta", {
    id: model
        .id({
            prefix: "pmt",
        })
        .primaryKey(),
    // Soft link to Medusa core product (prod_...). One row per product.
    product_id: model.text().searchable(),
    eggless: model.boolean().default(false),
    sugar_free: model.boolean().default(false),
    gluten_free: model.boolean().default(false),
    vegan: model.boolean().default(false),
    ingredients: model.text().nullable(),
    allergens: model.text().nullable(),
    // JSON: { energy, protein, fat, carbs, ... } per serving
    nutritional_info: model.text().nullable(),
    shelf_life: model.text().nullable(),
    storage_instructions: model.text().nullable(),
    fssai_license: model.text().nullable(),
    video_url: model.text().nullable(),
    is_featured: model.boolean().default(false),
    is_bestseller: model.boolean().default(false),
    is_new_arrival: model.boolean().default(false),
    // Denormalized text used to build the search tsvector (title + description + tags).
    search_document: model.text().searchable(),
    // Arbitrary JSON extension point.
    meta: model.text().nullable(),
});

/**
 * Product review — customer-submitted rating + review for a product.
 *
 * Moderation workflow: reviews are created with status "pending", an admin
 * (or automated rules) approve/reject them. Only approved reviews are shown
 * on the storefront and counted toward the aggregate rating.
 *
 * A merchant reply is stored on the review itself (single reply per review).
 */
export const ProductReview = model.define("product_review", {
    id: model
        .id({
            prefix: "prev",
        })
        .primaryKey(),
    product_id: model.text(),
    // Soft link to the Medusa core customer (cus_...).
    customer_id: model.text().nullable(),
    // Denormalized customer display name (so reviews survive customer deletion).
    customer_name: model.text().nullable(),
    rating: model.number(),
    title: model.text().nullable(),
    body: model.text().nullable(),
    // JSON array of media URLs (uploaded via Media Module M10).
    images: model.text().nullable(),
    // pending | approved | rejected
    status: model.text().default("pending"),
    // Admin/merchant reply (single).
    reply: model.text().nullable(),
    replied_at: model.dateTime().nullable(),
    // Whether the review is from a verified purchaser.
    verified_purchase: model.boolean().default(false),
});

/**
 * Wishlist — a customer's saved products for later purchase.
 *
 * One wishlist per customer (enforced in the service). Items are individual
 * rows so they can be added/removed independently and tracked via analytics.
 * "Saved Favorites" is the same wishlist surfaced under a different label;
 * there is no separate favorites model (DRY).
 */
export const WishlistItem = model.define("wishlist_item", {
    id: model
        .id({
            prefix: "wish",
        })
        .primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
});

/**
 * Stock notification — "notify me when back in stock" subscription.
 *
 * Created by a customer (authenticated or guest by email/phone) for a product
 * (optionally a variant). The restock workflow (Phase 6) or an admin action
 * dispatches a notification via the Notification Module (M6) and deletes /
 * marks the notification as sent.
 */
export const StockNotification = model.define("stock_notification", {
    id: model
        .id({
            prefix: "stkn",
        })
        .primaryKey(),
    product_id: model.text(),
    variant_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    email: model.text().nullable(),
    phone: model.text().nullable(),
    // pending | notified
    status: model.text().default("pending"),
    notified_at: model.dateTime().nullable(),
});

/**
 * Subscription — recurring product orders.
 *
 * A customer subscribes to a product with a frequency (weekly, fortnightly,
 * monthly). A scheduled job (Medusa cron) creates orders on next_date and
 * advances next_date by the frequency. Status controls the lifecycle.
 */
export const Subscription = model.define("subscription", {
    id: model
        .id({
            prefix: "sub",
        })
        .primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
    variant_id: model.text().nullable(),
    // weekly | fortnightly | monthly | custom
    frequency: model.text().default("monthly"),
    quantity: model.number().default(1),
    // ISO date string of the next scheduled order creation.
    next_date: model.dateTime(),
    // active | paused | cancelled | expired
    status: model.text().default("active"),
    // Optional cap on total deliveries (null = unlimited).
    max_deliveries: model.number().nullable(),
    deliveries_count: model.number().default(0),
});

/**
 * Cake option — customization options (shape, message, eggless, premium wrapping, greeting card, candles, balloons) for a product.
 */
export const CakeOption = model.define("cake_option", {
    id: model
        .id({
            prefix: "ckopt",
        })
        .primaryKey(),
    product_id: model.text().searchable(),
    option_type: model.text(),
    // JSON: e.g. ["Round", "Square", "Heart"]
    values: model.text(),
    price_delta: model.number().default(0),
});

