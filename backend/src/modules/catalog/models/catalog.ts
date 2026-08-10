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
    sku: model.text().nullable(),
    barcode: model.text().nullable(),
    tags: model.text().nullable(),
    occasion: model.text().nullable(),
    brand: model.text().nullable(),
    cake_type: model.text().nullable(),
    cost_price: model.number().nullable(),
    mrp: model.number().nullable(),
    gst_rate: model.number().nullable(),
    tax_class: model.text().nullable(),
    hsn_code: model.text().nullable(),
    hsn_description: model.text().nullable(),
    uqc: model.text().nullable(),
    cess_rate: model.number().default(0),
    taxability: model.text().default("Taxable"),
    tax_inclusive: model.boolean().default(true),
    tax_configuration_id: model.text().nullable(),
    tax_configuration_code: model.text().nullable(),
    add_ons_json: model.text().nullable(),
    variants_json: model.text().nullable(),
    customization_config_json: model.text().nullable(),
    enable_flavor_selection: model.boolean().default(true),
    enable_shape_selection: model.boolean().default(true),
    seo_keywords: model.text().nullable(),
    canonical_url: model.text().nullable(),
    // Denormalized text used to build the search tsvector (title + description + tags).
    search_document: model.text().searchable(),
    // Arbitrary JSON extension point.
    meta: model.text().nullable(),
});

/**
 * PIM Category — Enterprise category tree for storefront and operations.
 */
export const PimCategory = model.define("pim_category", {
    id: model
        .id({
            prefix: "pcat",
        })
        .primaryKey(),
    name: model.text(),
    slug: model.text().searchable(),
    description: model.text().nullable(),
    parent_id: model.text().nullable(),
    image_url: model.text().nullable(),
    banner_url: model.text().nullable(),
    display_order: model.number().default(0),
    status: model.enum(["active", "archived", "draft"]).default("active"),
    visibility: model.text().default("public"),
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    og_image: model.text().nullable(),
    branch_ids: model.text().nullable(),
});

/**
 * Product review — customer-submitted rating + review for a product.
 */
export const ProductReview = model.define("product_review", {
    id: model
        .id({
            prefix: "prev",
        })
        .primaryKey(),
    product_id: model.text(),
    customer_id: model.text().nullable(),
    customer_name: model.text().nullable(),
    rating: model.number(),
    title: model.text().nullable(),
    body: model.text().nullable(),
    images: model.text().nullable(),
    status: model.text().default("pending"),
    reply: model.text().nullable(),
    replied_at: model.dateTime().nullable(),
    verified_purchase: model.boolean().default(false),
});

/**
 * Wishlist — a customer's saved products for later purchase.
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
    status: model.text().default("pending"),
    notified_at: model.dateTime().nullable(),
});

/**
 * Subscription — recurring product orders.
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
    frequency: model.text().default("monthly"),
    quantity: model.number().default(1),
    next_date: model.dateTime(),
    status: model.text().default("active"),
    max_deliveries: model.number().nullable(),
    deliveries_count: model.number().default(0),
});

/**
 * Cake option — customization options for a product.
 */
export const CakeOption = model.define("cake_option", {
    id: model
        .id({
            prefix: "ckopt",
        })
        .primaryKey(),
    product_id: model.text().searchable(),
    option_type: model.text(),
    values: model.text(),
    price_delta: model.number().default(0),
});

/**
 * Flavor Master — Enterprise Database-Driven Flavor Master.
 */
export const FlavorMaster = model.define("flavor_master", {
    id: model
        .id({
            prefix: "flv",
        })
        .primaryKey(),
    name: model.text().searchable(),
    display_name: model.text().nullable(),
    internal_code: model.text().nullable(),
    description: model.text().nullable(),
    image_url: model.text().nullable(),
    icon: model.text().nullable(),
    color: model.text().nullable(),
    extra_price: model.number().default(0),
    prep_time_minutes: model.number().default(0),
    sort_order: model.number().default(0),
    status: model.enum(["active", "archived"]).default("active"),
    is_enabled: model.boolean().default(true),
    available_online: model.boolean().default(true),
    available_in_store: model.boolean().default(true),
    available_for_pickup: model.boolean().default(true),
    available_for_delivery: model.boolean().default(true),
});

/**
 * Shape Master — Enterprise Database-Driven Shape Master.
 */
export const ShapeMaster = model.define("shape_master", {
    id: model
        .id({
            prefix: "shp",
        })
        .primaryKey(),
    name: model.text().searchable(),
    image_url: model.text().nullable(),
    preview_url: model.text().nullable(),
    description: model.text().nullable(),
    additional_price: model.number().default(0),
    max_weight: model.number().default(10),
    prep_time_minutes: model.number().default(0),
    sort_order: model.number().default(0),
    status: model.enum(["active", "archived"]).default("active"),
    is_enabled: model.boolean().default(true),
});

/**
 * Product Flavor Mapping — Product to Flavor Relationship.
 */
export const ProductFlavorMapping = model.define("product_flavor_mapping", {
    id: model
        .id({
            prefix: "pfm",
        })
        .primaryKey(),
    product_id: model.text().searchable(),
    flavor_id: model.text().searchable(),
    price_override: model.number().nullable(),
    is_enabled: model.boolean().default(true),
});

/**
 * Product Shape Mapping — Product to Shape Relationship.
 */
export const ProductShapeMapping = model.define("product_shape_mapping", {
    id: model
        .id({
            prefix: "psm",
        })
        .primaryKey(),
    product_id: model.text().searchable(),
    shape_id: model.text().searchable(),
    price_override: model.number().nullable(),
    is_enabled: model.boolean().default(true),
});

/**
 * Product weight price — product-specific pricing table row per weight size.
 */
export const ProductWeightPrice = model.define("product_weight_price", {
    id: model
        .id({
            prefix: "pwp",
        })
        .primaryKey(),
    product_id: model.text().searchable(),
    weight_id: model.text(),
    weight_name: model.text(),
    selling_price: model.number(),
    mrp: model.number().nullable(),
    cost_price: model.number().nullable(),
    prep_time_minutes: model.number().default(60),
    is_enabled: model.boolean().default(true),
});


