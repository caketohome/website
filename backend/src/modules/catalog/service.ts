import { MedusaService } from "@medusajs/utils";
import {
    ProductMeta,
    PimCategory,
    ProductReview,
    WishlistItem,
    StockNotification,
    Subscription,
    CakeOption,
    FlavorMaster,
    ShapeMaster,
    ProductFlavorMapping,
    ProductShapeMapping,
} from "./models";
import type {
    ProductMetaInput,
    ProductMetaUpdate,
    ReviewInput,
    ReviewModerationInput,
    ReviewAggregate,
    WishlistItemInput,
    StockNotificationInput,
    SubscriptionInput,
    SubscriptionFrequency,
    SearchFilters,
    SearchResult,
} from "./types/common";

function stringifyJson(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

function parseJsonField<T>(raw: unknown): T | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }
    return raw as T;
}

const FREQUENCY_DAYS: Record<SubscriptionFrequency, number> = {
    weekly: 7,
    fortnightly: 14,
    monthly: 30,
    custom: 30,
};


/**
 * Catalog module service — product discovery & evaluation for CakeToHome.
 *
 * Extends the Medusa core product catalog (never modifies it) with:
 *   - product_meta: cake-specific dietary/compliance/merchandising metadata
 *   - product_review: customer ratings + reviews with moderation
 *   - wishlist: saved products per customer (also serves "Saved Favorites")
 *   - stock_notification: "notify me when back in stock"
 *   - subscription: recurring product orders
 *   - search: full-text + faceted product search
 *
 * Integration points:
 *   - Settings Module (M1): feature flags (reviews, wishlist, subscriptions,
 *     product_videos, product_meta)
 *   - Analytics Module (M5): search queries, product views, add-to-cart,
 *     review submitted
 *   - Notification Module (M6): stock-restock + subscription notifications
 *   - Media Module (M10): review images, product videos
 *   - AI Module (M9): product description + SEO meta generation
 *
 * The Medusa core product entity is referenced by id (soft link); the core
 * catalog is queried via the framework query service where needed.
 */
class CatalogModuleService extends (MedusaService({
    ProductMeta,
    PimCategory,
    ProductReview,
    WishlistItem,
    StockNotification,
    Subscription,
    CakeOption,
    FlavorMaster,
    ShapeMaster,
    ProductFlavorMapping,
    ProductShapeMapping,
}) as any) {
    // ── Product Meta ─────────────────────────────────────────────────────

    async upsertProductMeta(input: ProductMetaInput) {
        const [existing] = (await this.listProductMetas({
            product_id: input.product_id,
        })) as unknown as Record<string, unknown>[];

        if (!input.hsn_code || input.hsn_code.trim() === "") {
            throw new Error("PIM Statutory Validation Error: HSN/SAC code is mandatory for product creation and cannot be empty.");
        }

        const data = {
            product_id: input.product_id,
            eggless: input.eggless ?? false,
            sugar_free: input.sugar_free ?? false,
            gluten_free: input.gluten_free ?? false,
            vegan: input.vegan ?? false,
            ingredients: input.ingredients ?? null,
            allergens: input.allergens ?? null,
            nutritional_info: stringifyJson(input.nutritional_info),
            shelf_life: input.shelf_life ?? null,
            storage_instructions: input.storage_instructions ?? null,
            fssai_license: input.fssai_license ?? null,
            video_url: input.video_url ?? null,
            is_featured: input.is_featured ?? false,
            is_bestseller: input.is_bestseller ?? false,
            is_new_arrival: input.is_new_arrival ?? false,
            sku: input.sku ?? null,
            barcode: input.barcode ?? null,
            tags: input.tags ?? null,
            occasion: input.occasion ?? null,
            brand: input.brand ?? null,
            cake_type: input.cake_type ?? null,
            cost_price: input.cost_price ?? null,
            mrp: input.mrp ?? null,
            gst_rate: input.gst_rate ?? 18,
            tax_class: input.tax_class ?? "Taxable",
            hsn_code: input.hsn_code.trim(),
            hsn_description: input.hsn_description ?? null,
            uqc: input.uqc ? input.uqc.trim().toUpperCase() : "NOS",
            cess_rate: input.cess_rate ?? 0,
            taxability: input.taxability ?? "Taxable",
            tax_inclusive: input.tax_inclusive !== false,
            add_ons_json: stringifyJson(input.add_ons_json),
            variants_json: stringifyJson(input.variants_json),
            customization_config_json: stringifyJson(input.customization_config_json),
            seo_keywords: input.seo_keywords ?? null,
            canonical_url: input.canonical_url ?? null,
            search_document: input.search_document ?? null,
            meta: stringifyJson(input.meta),
        };

        if (existing) {
            await this.updateProductMetas({
                selector: { id: existing.id as string },
                data,
            });
            return { id: existing.id, ...data };
        }

        const created = (await this.createProductMetas([data])) as unknown as Record<
            string,
            unknown
        >[];
        return created[0];
    }

    async updateProductMeta(productId: string, input: ProductMetaUpdate) {
        const [existing] = (await this.listProductMetas({
            product_id: productId,
        })) as unknown as Record<string, unknown>[];

        if (!existing) {
            // Upsert path: create with the provided fields.
            return this.upsertProductMeta({ product_id: productId, ...input });
        }

        const data: Record<string, unknown> = {};
        if (input.eggless !== undefined) data.eggless = input.eggless;
        if (input.sugar_free !== undefined) data.sugar_free = input.sugar_free;
        if (input.gluten_free !== undefined) data.gluten_free = input.gluten_free;
        if (input.vegan !== undefined) data.vegan = input.vegan;
        if (input.ingredients !== undefined) data.ingredients = input.ingredients;
        if (input.allergens !== undefined) data.allergens = input.allergens;
        if (input.nutritional_info !== undefined)
            data.nutritional_info = stringifyJson(input.nutritional_info);
        if (input.shelf_life !== undefined) data.shelf_life = input.shelf_life;
        if (input.storage_instructions !== undefined)
            data.storage_instructions = input.storage_instructions;
        if (input.fssai_license !== undefined) data.fssai_license = input.fssai_license;
        if (input.video_url !== undefined) data.video_url = input.video_url;
        if (input.is_featured !== undefined) data.is_featured = input.is_featured;
        if (input.is_bestseller !== undefined) data.is_bestseller = input.is_bestseller;
        if (input.is_new_arrival !== undefined) data.is_new_arrival = input.is_new_arrival;
        if (input.search_document !== undefined) data.search_document = input.search_document;
        if (input.meta !== undefined) data.meta = stringifyJson(input.meta);

        await this.updateProductMetas({
            selector: { id: existing.id as string },
            data,
        });
        return { id: existing.id, ...data };
    }

    async getProductMeta(productId: string) {
        const [meta] = (await this.listProductMetas({
            product_id: productId,
        })) as unknown as Record<string, unknown>[];
        if (!meta) return null;
        return {
            ...meta,
            nutritional_info: parseJsonField<Record<string, unknown>>(meta.nutritional_info),
            meta: parseJsonField<Record<string, unknown>>(meta.meta),
        };
    }

    async listProductMetaByProduct(productIds: string[]) {
        const metas = (await this.listProductMetas({})) as unknown as Record<string, unknown>[];
        return metas.filter((m) => productIds.includes(m.product_id as string));
    }

    async deleteProductMeta(productId: string) {
        const [existing] = (await this.listProductMetas({
            product_id: productId,
        })) as unknown as Record<string, unknown>[];
        if (existing) {
            await this.deleteProductMetas([existing.id as string]);
        }
    }

    // ── Reviews ─────────────────────────────────────────────────────────

    async createReview(input: ReviewInput) {
        if (input.rating < 1 || input.rating > 5) {
            throw new Error("Rating must be between 1 and 5.");
        }

        const created = (await this.createProductReviews([
            {
                product_id: input.product_id,
                customer_id: input.customer_id ?? null,
                customer_name: input.customer_name ?? null,
                rating: input.rating,
                title: input.title ?? null,
                body: input.body ?? null,
                images: stringifyJson(input.images),
                status: "pending",
                verified_purchase: input.verified_purchase ?? false,
            },
        ])) as unknown as Record<string, unknown>[];

        return created[0];
    }

    async listReviews(opts: {
        productId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    } = {}) {
        const filters: Record<string, unknown> = {};
        if (opts.productId) filters.product_id = opts.productId;
        if (opts.status) filters.status = opts.status;

        const reviews = (await this.listProductReviews(
            filters
        )) as unknown as Record<string, unknown>[];

        const start = opts.offset ?? 0;
        const end = start + (opts.limit ?? 50);
        return reviews.slice(start, end).map((r) => ({
            ...r,
            images: parseJsonField<string[]>(r.images),
        }));
    }

    async listApprovedReviews(productId: string) {
        const reviews = (await this.listProductReviews({
            product_id: productId,
            status: "approved",
        })) as unknown as Record<string, unknown>[];
        return reviews.map((r) => ({
            ...r,
            images: parseJsonField<string[]>(r.images),
        }));
    }

    async moderateReview(reviewId: string, input: ReviewModerationInput) {
        const data: Record<string, unknown> = { status: input.status };
        if (input.reply !== undefined) {
            data.reply = input.reply;
            data.replied_at = new Date();
        }
        await this.updateProductReviews({
            selector: { id: reviewId },
            data,
        });
        return { id: reviewId, ...data };
    }

    async deleteReview(reviewId: string) {
        await this.deleteProductReviews([reviewId]);
    }

    /**
     * Compute the aggregate rating for a product from approved reviews.
     */
    async getReviewAggregate(productId: string): Promise<ReviewAggregate> {
        const reviews = (await this.listProductReviews({
            product_id: productId,
            status: "approved",
        })) as unknown as Record<string, unknown>[];

        const total = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + (r.rating as number), 0);
        const average = total > 0 ? Number((sum / total).toFixed(2)) : 0;

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const r of reviews) {
            const rating = r.rating as number;
            if (distribution[rating] !== undefined) distribution[rating]++;
        }

        return {
            product_id: productId,
            average_rating: average,
            total_reviews: total,
            rating_distribution: distribution,
        };
    }

    // ── Wishlist ───────────────────────────────────────────────────────

    async listWishlist(customerId: string) {
        return this.listWishlistItems({ customer_id: customerId });
    }

    async addToWishlist(input: WishlistItemInput) {
        // Prevent duplicates: one wishlist row per (customer, product).
        const existing = (await this.listWishlistItems({
            customer_id: input.customer_id,
            product_id: input.product_id,
        })) as unknown as Record<string, unknown>[];
        if (existing.length > 0) return existing[0];

        const created = (await this.createWishlistItems([
            {
                customer_id: input.customer_id,
                product_id: input.product_id,
            },
        ])) as unknown as Record<string, unknown>[];
        return created[0];
    }

    async removeFromWishlist(customerId: string, productId: string) {
        const items = (await this.listWishlistItems({
            customer_id: customerId,
            product_id: productId,
        })) as unknown as Record<string, unknown>[];
        if (items.length > 0) {
            await this.deleteWishlistItems([items[0].id as string]);
        }
    }

    async isWishlisted(customerId: string, productId: string): Promise<boolean> {
        const items = (await this.listWishlistItems({
            customer_id: customerId,
            product_id: productId,
        })) as unknown as Record<string, unknown>[];
        return items.length > 0;
    }

    async clearWishlist(customerId: string) {
        const items = (await this.listWishlistItems({
            customer_id: customerId,
        })) as unknown as Record<string, unknown>[];
        if (items.length > 0) {
            await this.deleteWishlistItems(items.map((i) => i.id as string));
        }
    }

    // ── Stock Notifications ─────────────────────────────────────────────

    async createStockNotification(input: StockNotificationInput) {
        if (!input.customer_id && !input.email && !input.phone) {
            throw new Error("A customer_id, email, or phone is required for stock notifications.");
        }

        // Avoid duplicate pending notifications for the same product + contact.
        const filters: Record<string, unknown> = {
            product_id: input.product_id,
            status: "pending",
        };
        if (input.customer_id) filters.customer_id = input.customer_id;
        else if (input.email) filters.email = input.email;
        else if (input.phone) filters.phone = input.phone;

        const existing = (await this.listStockNotifications(
            filters
        )) as unknown as Record<string, unknown>[];
        if (existing.length > 0) return existing[0];

        const created = (await this.createStockNotifications([
            {
                product_id: input.product_id,
                variant_id: input.variant_id ?? null,
                customer_id: input.customer_id ?? null,
                email: input.email ?? null,
                phone: input.phone ?? null,
                status: "pending",
            },
        ])) as unknown as Record<string, unknown>[];
        return created[0];
    }


    /**
     * Mark pending stock notifications for a product as notified.
     * Called by the restock workflow (Phase 6) or an admin action.
     */
    async markStockNotified(productId: string) {
        const pending = (await this.listStockNotifications({
            product_id: productId,
            status: "pending",
        })) as unknown as Record<string, unknown>[];
        const now = new Date();
        for (const n of pending) {
            await this.updateStockNotifications({
                selector: { id: n.id as string },
                data: { status: "notified", notified_at: now },
            });
        }
        return pending.length;
    }

    // ── Subscriptions ───────────────────────────────────────────────────

    async createSubscription(input: SubscriptionInput) {
        const created = (await this.createSubscriptions([
            {
                customer_id: input.customer_id,
                product_id: input.product_id,
                variant_id: input.variant_id ?? null,
                frequency: input.frequency ?? "monthly",
                quantity: input.quantity ?? 1,
                next_date: new Date(input.next_date),
                status: "active",
                max_deliveries: input.max_deliveries ?? null,
                deliveries_count: 0,
            },
        ])) as unknown as Record<string, unknown>[];
        return created[0];
    }


    async updateSubscriptionStatus(id: string, status: string) {
        await this.updateSubscriptions({
            selector: { id },
            data: { status },
        });
        return { id, status };
    }

    async pauseSubscription(id: string) {
        return this.updateSubscriptionStatus(id, "paused");
    }

    async resumeSubscription(id: string) {
        return this.updateSubscriptionStatus(id, "active");
    }

    async cancelSubscription(id: string) {
        return this.updateSubscriptionStatus(id, "cancelled");
    }

    /**
     * Advance a subscription's next_date by its frequency after a delivery.
     * Returns the updated next_date.
     */
    async advanceSubscription(id: string) {
        const [sub] = (await this.listSubscriptions({ id })) as unknown as Record<
            string,
            unknown
        >[];
        if (!sub) return null;

        const frequency = sub.frequency as SubscriptionFrequency;
        const days = FREQUENCY_DAYS[frequency] ?? 30;
        const nextDate = new Date(sub.next_date as Date);
        nextDate.setDate(nextDate.getDate() + days);

        const deliveriesCount = (sub.deliveries_count as number) ?? 0;
        const maxDeliveries = sub.max_deliveries as number | null;

        const update: Record<string, unknown> = {
            next_date: nextDate,
            deliveries_count: deliveriesCount + 1,
        };

        // Auto-expire when the delivery cap is reached.
        if (maxDeliveries !== null && deliveriesCount + 1 >= maxDeliveries) {
            update.status = "expired";
        }

        await this.updateSubscriptions({ selector: { id }, data: update });
        return { id, ...update };
    }

    /**
     * Return subscriptions whose next_date has arrived and are still active.
     * Used by the scheduled job to create subscription orders.
     */
    async listDueSubscriptions(now: Date = new Date()) {
        const subs = (await this.listSubscriptions({
            status: "active",
        })) as unknown as Record<string, unknown>[];
        return subs.filter((s) => {
            const next = s.next_date as Date;
            return next.getTime() <= now.getTime();
        });
    }

    // ── Search ──────────────────────────────────────────────────────────

    /**
     * Full-text + faceted product search.
     *
     * The Medusa core product catalog is queried via the framework query
     * service (passed in the container as `query`). Product meta is joined
     * in-memory to apply dietary / merchandising filters and to enrich
     * results with ratings.
     *
     * This keeps the core catalog untouched while supporting CakeToHome's
     * cake-specific discovery needs.
     */
    async searchProducts(
        filters: SearchFilters,
        container: Record<string, unknown>
    ): Promise<{ results: SearchResult[]; count: number; offset: number; limit: number }> {
        const limit = filters.limit ?? 24;
        const offset = filters.offset ?? 0;

        const query = container["query"] as {
            graph: (q: {
                entity: string;
                filters?: Record<string, unknown>;
                fields?: string[];
            }) => Promise<{ data: Record<string, unknown>[] }>;
        } | undefined;

        // If the query service is unavailable, return empty (graceful).
        if (!query?.graph) {
            return { results: [], count: 0, offset, limit };
        }

        const productFilters: Record<string, unknown> = {};
        if (filters.shop_id) productFilters.shop = filters.shop_id;
        if (filters.category_id) {
            productFilters.categories = filters.category_id;
        }

        const { data: products } = await query.graph({
            entity: "product",
            filters: productFilters,
            fields: [
                "id",
                "title",
                "description",
                "thumbnail",
                "handle",
                "status",
                "variants.id",
                "variants.price_set.id",
            ],
        });

        // Only published products.
        let published = products.filter(
            (p) => (p.status as string) === "published" || p.status === undefined
        );

        // Text query: case-insensitive substring match on title + description.
        if (filters.q) {
            const q = filters.q.toLowerCase();
            published = published.filter((p) => {
                const title = ((p.title as string) ?? "").toLowerCase();
                const desc = ((p.description as string) ?? "").toLowerCase();
                return title.includes(q) || desc.includes(q);
            });
        }

        const productIds = published.map((p) => p.id as string);

        // Load product meta for dietary / merchandising filters + enrichment.
        const metas = await this.listProductMetaByProduct(productIds);
        const metaByProduct = new Map<string, Record<string, unknown>>();
        for (const m of metas) {
            metaByProduct.set(m.product_id as string, m);
        }

        // Apply dietary + merchandising filters.
        let filtered = published;
        const dietaryKeys: Array<keyof SearchFilters> = [
            "eggless",
            "sugar_free",
            "gluten_free",
            "vegan",
            "is_featured",
            "is_bestseller",
            "is_new_arrival",
        ];
        for (const key of dietaryKeys) {
            if (filters[key] === true) {
                filtered = filtered.filter((p) => {
                    const m = metaByProduct.get(p.id as string);
                    return m ? m[key] === true : false;
                });
            }
        }

        // Build enriched results with ratings + price.
        const enriched: SearchResult[] = [];
        for (const p of filtered) {
            const meta = metaByProduct.get(p.id as string) ?? {};
            const aggregate = await this.getReviewAggregate(p.id as string).catch(() => ({
                average_rating: 0,
                total_reviews: 0,
                rating_distribution: {},
            }));

            const price = extractPrice(p);

            enriched.push({
                product_id: p.id as string,
                title: (p.title as string) ?? "",
                description: (p.description as string) ?? null,
                thumbnail: (p.thumbnail as string) ?? null,
                handle: (p.handle as string) ?? null,
                price,
                rating: aggregate.average_rating,
                review_count: aggregate.total_reviews,
                eggless: (meta.eggless as boolean) ?? false,
                sugar_free: (meta.sugar_free as boolean) ?? false,
                gluten_free: (meta.gluten_free as boolean) ?? false,
                vegan: (meta.vegan as boolean) ?? false,
                is_featured: (meta.is_featured as boolean) ?? false,
                is_bestseller: (meta.is_bestseller as boolean) ?? false,
                is_new_arrival: (meta.is_new_arrival as boolean) ?? false,
            });
        }

        // Price filters.
        let priced = enriched;
        if (filters.min_price !== undefined) {
            priced = priced.filter((r) => r.price !== null && r.price >= filters.min_price!);
        }
        if (filters.max_price !== undefined) {
            priced = priced.filter((r) => r.price !== null && r.price <= filters.max_price!);
        }

        // Sorting.
        const sort = filters.sort ?? "relevance";
        const sorted = [...priced];
        switch (sort) {
            case "price_asc":
                sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
                break;
            case "price_desc":
                sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
                break;
            case "rating":
                sorted.sort((a, b) => b.rating - a.rating);
                break;
            case "newest":
                // New arrivals first, then the rest.
                sorted.sort((a, b) => Number(b.is_new_arrival) - Number(a.is_new_arrival));
                break;
            case "relevance":
            default:
                if (filters.q) {
                    const q = filters.q.toLowerCase();
                    sorted.sort((a, b) => {
                        const aTitle = a.title.toLowerCase().includes(q) ? 1 : 0;
                        const bTitle = b.title.toLowerCase().includes(q) ? 1 : 0;
                        return bTitle - aTitle;
                    });
                }
                break;
        }

        const count = sorted.length;
        const paged = sorted.slice(offset, offset + limit);

        return { results: paged, count, offset, limit };
    }

    // ── Cake Options ─────────────────────────────────────────────────────

    async upsertProductCakeOption(input: { product_id: string; option_type: string; values: string[]; price_delta?: number }) {
        const [existing] = await this.listCakeOptions({
            product_id: input.product_id,
            option_type: input.option_type,
        });

        const valuesStr = JSON.stringify(input.values);

        if (existing) {
            await this.updateCakeOptions({
                selector: { id: existing.id as string },
                data: {
                    values: valuesStr,
                    price_delta: input.price_delta ?? 0,
                },
            });
            return existing;
        }

        const created = await this.createCakeOptions({
            product_id: input.product_id,
            option_type: input.option_type,
            values: valuesStr,
            price_delta: input.price_delta ?? 0,
        });

        return created;
    }

    // ── Flavor & Shape Mappings ──────────────────────────────────────────────

    async saveProductFlavorMappings(productId: string, mappings: { flavor_id: string; price_override?: number; is_enabled?: boolean }[]) {
        // Clear existing mappings for product
        const existing = await (this as any).listProductFlavorMappings({ product_id: productId });
        if (existing.length > 0) {
            for (const item of existing) {
                await (this as any).deleteProductFlavorMappings(item.id);
            }
        }
        // Insert new mappings
        const createdList = [];
        for (const item of mappings) {
            const res = await (this as any).createProductFlavorMappings({
                product_id: productId,
                flavor_id: item.flavor_id,
                price_override: item.price_override ?? null,
                is_enabled: item.is_enabled ?? true,
            });
            createdList.push(res);
        }
        return createdList;
    }

    async saveProductShapeMappings(productId: string, mappings: { shape_id: string; price_override?: number; is_enabled?: boolean }[]) {
        // Clear existing mappings for product
        const existing = await (this as any).listProductShapeMappings({ product_id: productId });
        if (existing.length > 0) {
            for (const item of existing) {
                await (this as any).deleteProductShapeMappings(item.id);
            }
        }
        // Insert new mappings
        const createdList = [];
        for (const item of mappings) {
            const res = await (this as any).createProductShapeMappings({
                product_id: productId,
                shape_id: item.shape_id,
                price_override: item.price_override ?? null,
                is_enabled: item.is_enabled ?? true,
            });
            createdList.push(res);
        }
        return createdList;
    }

    async checkFlavorUsage(flavorId: string): Promise<number> {
        const mappings = await (this as any).listProductFlavorMappings({ flavor_id: flavorId });
        return mappings.length;
    }

    async checkShapeUsage(shapeId: string): Promise<number> {
        const mappings = await (this as any).listProductShapeMappings({ shape_id: shapeId });
        return mappings.length;
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Extract a representative price from a product's first variant price set.
 * The actual price resolution depends on the store context; here we read the
 * raw amount from the price set if present, otherwise null.
 */
function extractPrice(product: Record<string, unknown>): number | null {
    const variants = product.variants as Record<string, unknown>[] | undefined;
    if (!variants || variants.length === 0) return null;
    const priceSet = variants[0].price_set as Record<string, unknown> | undefined;
    if (!priceSet) return null;
    const prices = priceSet.prices as Record<string, unknown>[] | undefined;
    if (!prices || prices.length === 0) return null;
    const amount = prices[0].amount as number | undefined;
    return amount !== undefined ? amount / 100 : null;
}

export default CatalogModuleService;
