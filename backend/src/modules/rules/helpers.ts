import RulesModuleService from "./service";
import type { OfferCondition, OfferReward } from "./types/common";

/**
 * Phase 9 Milestone 9.2 — Offer-type factory helpers + coupon bulk generator.
 *
 * These are pure convenience builders that construct Offer rows for the common
 * promotion types (flash sale, combo discount, combo offer/free-gift, free
 * delivery, buy-X-get-Y) and a bulk coupon generator. They do NOT duplicate
 * the Offer model or the evaluation engine — they simply encode the canonical
 * condition/reward JSON shapes for each offer type so admin UIs, seeders, and
 * API routes can create offers without hand-crafting JSON.
 *
 * Every factory method calls `createOffers()` on the existing
 * RulesModuleService, reusing the exact same persistence + evaluation path as
 * every other offer on the platform. No second promotion engine is introduced.
 *
 * The helpers are attached to the RulesModuleService prototype at module-eval
 * time, so any resolved `rulesModuleService` instance gains these methods
 * without modifying the existing service.ts class body.
 */

// ── Flash Sale ──────────────────────────────────────────────────────────────
// A time-boxed, optionally stock-limited discount on one or more products.
// Conditions: product.id in [target product ids]. Reward: line_discount
// (percent) on the target products. The time window is enforced via
// starts_at/ends_at on the Offer itself.

async function createFlashSaleOffer(
    this: any,
    input: {
        name: string;
        code?: string;
        product_ids: string[];
        discount_percent: number;
        starts_at: Date | string;
        ends_at: Date | string;
        usage_limit?: number;
        per_customer_limit?: number;
        branch_ids?: string[];
        priority?: number;
        description?: string;
        metadata?: Record<string, unknown>;
    }
) {
    if (!input.product_ids.length) {
        throw new Error("Flash sale requires at least one product_id");
    }
    if (input.discount_percent < 0 || input.discount_percent > 100) {
        throw new Error("discount_percent must be between 0 and 100");
    }
    const conditions: OfferCondition[] = [
        {
            entity: "product",
            field: "id",
            operator: "in",
            value: input.product_ids,
            label: "Flash sale products",
        },
    ];
    const rewards: OfferReward[] = [
        {
            reward_type: "line_discount",
            amount_type: "percent",
            amount: input.discount_percent,
            target_ids: input.product_ids,
            label: "Flash sale discount",
        },
    ];
    return this.createOffers({
        name: input.name,
        code: input.code ?? null,
        type: "flash_sale",
        status: "scheduled",
        priority: input.priority ?? 100,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        usage_limit: input.usage_limit ?? null,
        per_customer_limit: input.per_customer_limit ?? null,
        is_stackable: false,
        is_public: true,
        description: input.description ?? null,
        conditions: JSON.stringify(conditions),
        rewards: JSON.stringify(rewards),
        branch_ids: input.branch_ids ? JSON.stringify(input.branch_ids) : null,
        metadata: input.metadata
            ? JSON.stringify({ ...input.metadata, factory: "flash_sale" })
            : JSON.stringify({ factory: "flash_sale" }),
        total_redemptions: 0,
    });
}

// ── Combo Discount ──────────────────────────────────────────────────────────
// "Buy products A + B together → discount on the bundle." Conditions require
// every listed product to be present in the cart (AND across multiple product
// conditions). Reward: line_discount (percent) on the bundle, or a flat
// cart_discount.

async function createComboDiscountOffer(
    this: any,
    input: {
        name: string;
        code?: string;
        product_ids: string[];
        discount_percent?: number;
        discount_fixed?: number;
        starts_at?: Date | string;
        ends_at?: Date | string;
        usage_limit?: number;
        per_customer_limit?: number;
        branch_ids?: string[];
        priority?: number;
        description?: string;
        metadata?: Record<string, unknown>;
    }
) {
    if (input.product_ids.length < 2) {
        throw new Error("Combo discount requires at least 2 products");
    }
    const conditions: OfferCondition[] = input.product_ids.map((pid) => ({
        entity: "product",
        field: "id",
        operator: "eq",
        value: pid,
        label: `Combo requires product ${pid}`,
    }));
    const rewards: OfferReward[] = [];
    if (input.discount_percent !== undefined) {
        rewards.push({
            reward_type: "line_discount",
            amount_type: "percent",
            amount: input.discount_percent,
            target_ids: input.product_ids,
            label: "Combo discount",
        });
    } else if (input.discount_fixed !== undefined) {
        rewards.push({
            reward_type: "cart_discount",
            amount_type: "fixed",
            amount: input.discount_fixed,
            label: "Combo flat discount",
        });
    } else {
        throw new Error(
            "Combo discount requires discount_percent or discount_fixed"
        );
    }
    return this.createOffers({
        name: input.name,
        code: input.code ?? null,
        type: "combo",
        status: input.starts_at ? "scheduled" : "active",
        priority: input.priority ?? 50,
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
        usage_limit: input.usage_limit ?? null,
        per_customer_limit: input.per_customer_limit ?? null,
        is_stackable: false,
        is_public: true,
        description: input.description ?? null,
        conditions: JSON.stringify(conditions),
        rewards: JSON.stringify(rewards),
        branch_ids: input.branch_ids ? JSON.stringify(input.branch_ids) : null,
        metadata: input.metadata
            ? JSON.stringify({ ...input.metadata, factory: "combo_discount" })
            : JSON.stringify({ factory: "combo_discount" }),
        total_redemptions: 0,
    });
}

// ── Combo Offer (free gift with combo) ──────────────────────────────────────
// "Buy products A + B → get product C free." Same AND-condition shape as combo
// discount, but the reward is a free_item.

async function createComboOffer(
    this: any,
    input: {
        name: string;
        code?: string;
        required_product_ids: string[];
        free_product_id: string;
        free_quantity?: number;
        starts_at?: Date | string;
        ends_at?: Date | string;
        usage_limit?: number;
        per_customer_limit?: number;
        branch_ids?: string[];
        priority?: number;
        description?: string;
        metadata?: Record<string, unknown>;
    }
) {
    if (input.required_product_ids.length < 2) {
        throw new Error("Combo offer requires at least 2 required products");
    }
    const conditions: OfferCondition[] = input.required_product_ids.map(
        (pid) => ({
            entity: "product",
            field: "id",
            operator: "eq",
            value: pid,
            label: `Combo requires product ${pid}`,
        })
    );
    const rewards: OfferReward[] = [
        {
            reward_type: "free_item",
            amount_type: "fixed",
            amount: 0,
            free_item_id: input.free_product_id,
            free_item_quantity: input.free_quantity ?? 1,
            label: "Combo free gift",
        },
    ];
    return this.createOffers({
        name: input.name,
        code: input.code ?? null,
        type: "combo",
        status: input.starts_at ? "scheduled" : "active",
        priority: input.priority ?? 50,
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
        usage_limit: input.usage_limit ?? null,
        per_customer_limit: input.per_customer_limit ?? null,
        is_stackable: false,
        is_public: true,
        description: input.description ?? null,
        conditions: JSON.stringify(conditions),
        rewards: JSON.stringify(rewards),
        branch_ids: input.branch_ids ? JSON.stringify(input.branch_ids) : null,
        metadata: input.metadata
            ? JSON.stringify({ ...input.metadata, factory: "combo_offer" })
            : JSON.stringify({ factory: "combo_offer" }),
        total_redemptions: 0,
    });
}

// ── Free Delivery ───────────────────────────────────────────────────────────
// Waive the delivery fee, optionally gated by a minimum cart subtotal.

async function createFreeDeliveryOffer(
    this: any,
    input: {
        name: string;
        code?: string;
        min_subtotal?: number;
        starts_at?: Date | string;
        ends_at?: Date | string;
        usage_limit?: number;
        per_customer_limit?: number;
        branch_ids?: string[];
        priority?: number;
        description?: string;
        metadata?: Record<string, unknown>;
    }
) {
    const conditions: OfferCondition[] = [];
    if (input.min_subtotal !== undefined) {
        conditions.push({
            entity: "cart",
            field: "subtotal",
            operator: "gte",
            value: input.min_subtotal,
            label: `Minimum subtotal ${input.min_subtotal}`,
        });
    }
    const rewards: OfferReward[] = [
        {
            reward_type: "free_delivery",
            amount_type: "fixed",
            amount: 0,
            label: "Free delivery",
        },
    ];
    return this.createOffers({
        name: input.name,
        code: input.code ?? null,
        type: "free_delivery",
        status: input.starts_at ? "scheduled" : "active",
        priority: input.priority ?? 20,
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
        usage_limit: input.usage_limit ?? null,
        per_customer_limit: input.per_customer_limit ?? null,
        is_stackable: true,
        is_public: true,
        description: input.description ?? null,
        conditions: conditions.length ? JSON.stringify(conditions) : null,
        rewards: JSON.stringify(rewards),
        branch_ids: input.branch_ids ? JSON.stringify(input.branch_ids) : null,
        metadata: input.metadata
            ? JSON.stringify({ ...input.metadata, factory: "free_delivery" })
            : JSON.stringify({ factory: "free_delivery" }),
        total_redemptions: 0,
    });
}

// ── Buy X Get Y (BOGO) ──────────────────────────────────────────────────────
// "Buy X units of product A → get Y units of product B free (or discounted)."
// Conditions: product A quantity ≥ X. Reward: free_item (Y units of B) when
// get_discount_percent is 100 (default), otherwise a line_discount on B.

async function createBuyXGetYOffer(
    this: any,
    input: {
        name: string;
        code?: string;
        buy_product_id: string;
        buy_quantity: number;
        get_product_id: string;
        get_quantity: number;
        get_discount_percent?: number; // 0..100; 100 = free (default)
        starts_at?: Date | string;
        ends_at?: Date | string;
        usage_limit?: number;
        per_customer_limit?: number;
        branch_ids?: string[];
        priority?: number;
        description?: string;
        metadata?: Record<string, unknown>;
    }
) {
    if (input.buy_quantity < 1 || input.get_quantity < 1) {
        throw new Error("BOGO requires buy_quantity ≥ 1 and get_quantity ≥ 1");
    }
    const conditions: OfferCondition[] = [
        {
            entity: "product",
            field: "quantity",
            operator: "gte",
            value: [input.buy_product_id, input.buy_quantity],
            label: `Buy ${input.buy_quantity} of ${input.buy_product_id}`,
        },
        {
            entity: "product",
            field: "id",
            operator: "eq",
            value: input.buy_product_id,
            label: `Buy product ${input.buy_product_id}`,
        },
    ];
    const getDiscount = input.get_discount_percent ?? 100;
    const rewards: OfferReward[] =
        getDiscount >= 100
            ? [
                  {
                      reward_type: "free_item",
                      amount_type: "fixed",
                      amount: 0,
                      free_item_id: input.get_product_id,
                      free_item_quantity: input.get_quantity,
                      label: `Get ${input.get_quantity} of ${input.get_product_id} free`,
                  },
              ]
            : [
                  {
                      reward_type: "line_discount",
                      amount_type: "percent",
                      amount: getDiscount,
                      target_ids: [input.get_product_id],
                      label: `Get ${getDiscount}% off ${input.get_product_id}`,
                  },
              ];
    return this.createOffers({
        name: input.name,
        code: input.code ?? null,
        type: "buy_x_get_y",
        status: input.starts_at ? "scheduled" : "active",
        priority: input.priority ?? 60,
        starts_at: input.starts_at ?? null,
        ends_at: input.ends_at ?? null,
        usage_limit: input.usage_limit ?? null,
        per_customer_limit: input.per_customer_limit ?? null,
        is_stackable: false,
        is_public: true,
        description: input.description ?? null,
        conditions: JSON.stringify(conditions),
        rewards: JSON.stringify(rewards),
        branch_ids: input.branch_ids ? JSON.stringify(input.branch_ids) : null,
        metadata: input.metadata
            ? JSON.stringify({ ...input.metadata, factory: "buy_x_get_y" })
            : JSON.stringify({ factory: "buy_x_get_y" }),
        total_redemptions: 0,
    });
}

// ── Coupon bulk generator ───────────────────────────────────────────────────
// Generate N unique coupon codes backed by N distinct Offer rows of a given
// type. Returns the created offers. Codes are uppercase alphanumeric with a
// configurable prefix. Used by the admin Coupon/Discount Engine UI for bulk
// coupon creation campaigns.

function generateCouponCode(prefix: string, length: number = 8): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${prefix}${out}`;
}

async function bulkGenerateCoupons(
    this: any,
    input: {
        count: number;
        prefix: string;
        name_prefix: string;
        type: "coupon" | "promo_code";
        discount_percent?: number;
        discount_fixed?: number;
        code_length?: number;
        starts_at?: Date | string;
        ends_at?: Date | string;
        usage_limit?: number;
        per_customer_limit?: number;
        is_stackable?: boolean;
        branch_ids?: string[];
        customer_segments?: string[];
        description?: string;
        metadata?: Record<string, unknown>;
    }
): Promise<any[]> {
    if (input.count < 1 || input.count > 10000) {
        throw new Error("bulkGenerateCoupons: count must be between 1 and 10000");
    }
    const created: any[] = [];
    const usedCodes = new Set<string>();

    const rewards: OfferReward[] = [];
    if (input.discount_percent !== undefined) {
        rewards.push({
            reward_type: "cart_discount",
            amount_type: "percent",
            amount: input.discount_percent,
            label: "Coupon discount",
        });
    } else if (input.discount_fixed !== undefined) {
        rewards.push({
            reward_type: "cart_discount",
            amount_type: "fixed",
            amount: input.discount_fixed,
            label: "Coupon discount",
        });
    } else {
        throw new Error(
            "bulkGenerateCoupons requires discount_percent or discount_fixed"
        );
    }

    for (let i = 0; i < input.count; i++) {
        let code = generateCouponCode(input.prefix, input.code_length ?? 8);
        let guard = 0;
        while (usedCodes.has(code) && guard < 100) {
            code = generateCouponCode(input.prefix, input.code_length ?? 8);
            guard++;
        }
        usedCodes.add(code);

        const offer = await this.createOffers({
            name: `${input.name_prefix} #${i + 1}`,
            code,
            type: input.type,
            status: input.starts_at ? "scheduled" : "active",
            priority: 10,
            starts_at: input.starts_at ?? null,
            ends_at: input.ends_at ?? null,
            usage_limit: input.usage_limit ?? 1,
            per_customer_limit: input.per_customer_limit ?? 1,
            is_stackable: input.is_stackable ?? false,
            is_public: false, // coupons are code-gated, not publicly listed
            description: input.description ?? null,
            conditions: null,
            rewards: JSON.stringify(rewards),
            branch_ids: input.branch_ids ? JSON.stringify(input.branch_ids) : null,
            customer_segments: input.customer_segments
                ? JSON.stringify(input.customer_segments)
                : null,
            metadata: input.metadata
                ? JSON.stringify({
                      ...input.metadata,
                      factory: "bulk_coupon",
                      batch_index: i + 1,
                  })
                : JSON.stringify({ factory: "bulk_coupon", batch_index: i + 1 }),
            total_redemptions: 0,
        });
        created.push(offer);
    }
    return created;
}

// ── Attach helpers to the service prototype ─────────────────────────────────

(RulesModuleService.prototype as any).createFlashSaleOffer = createFlashSaleOffer;
(RulesModuleService.prototype as any).createComboDiscountOffer = createComboDiscountOffer;
(RulesModuleService.prototype as any).createComboOffer = createComboOffer;
(RulesModuleService.prototype as any).createFreeDeliveryOffer = createFreeDeliveryOffer;
(RulesModuleService.prototype as any).createBuyXGetYOffer = createBuyXGetYOffer;
(RulesModuleService.prototype as any).bulkGenerateCoupons = bulkGenerateCoupons;

export {
    createFlashSaleOffer,
    createComboDiscountOffer,
    createComboOffer,
    createFreeDeliveryOffer,
    createBuyXGetYOffer,
    bulkGenerateCoupons,
    generateCouponCode,
};
