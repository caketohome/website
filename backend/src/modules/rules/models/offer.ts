import { model } from "@medusajs/utils";

/**
 * Unified offer/promotion entity. Powers coupons, promo codes, flash sales,
 * combos, BOGO, free delivery, free gift, bundles, category/product discounts,
 * wallet cashback, referral rewards, loyalty bonuses, birthday/anniversary/
 * festival campaigns, affiliate/influencer rewards, gamification rewards,
 * first-order offers, branch-specific offers, customer-segment offers,
 * and scheduled campaigns.
 *
 * All promotion logic across the entire platform flows through this single
 * model and the RulesModuleService evaluation engine.
 */
export const Offer = model.define("offer", {
    id: model
        .id({
            prefix: "ofr",
        })
        .primaryKey(),
    /** Human-readable name displayed in admin */
    name: model.text(),
    /** Coupon/promo code (unique, optional) */
    code: model.text().nullable(),
    /** Offer category — determines UI presentation and business semantics */
    type: model.text(),
    /** Lifecycle status */
    status: model.text().default("draft"),
    /** Higher priority wins when non-stackable offers conflict */
    priority: model.number().default(0),
    /** Activation date */
    starts_at: model.dateTime().nullable(),
    /** Expiration date */
    ends_at: model.dateTime().nullable(),
    /** Maximum total redemptions across all customers */
    usage_limit: model.number().nullable(),
    /** Maximum redemptions per individual customer */
    per_customer_limit: model.number().nullable(),
    /** Whether this offer can be combined with other offers */
    is_stackable: model.boolean().default(false),
    /** Whether this offer is visible to customers (e.g. in offer listings) */
    is_public: model.boolean().default(true),
    /** Admin-facing description / internal notes */
    description: model.text().nullable(),
    /** JSON-serialized OfferCondition[] — defines eligibility rules */
    conditions: model.text().nullable(),
    /** JSON-serialized OfferReward[] — defines what the customer receives */
    rewards: model.text().nullable(),
    /** JSON-serialized string[] — restrict to specific branch IDs */
    branch_ids: model.text().nullable(),
    /** JSON-serialized string[] — restrict to specific customer segments */
    customer_segments: model.text().nullable(),
    /** JSON-serialized Record<string, unknown> — freeform metadata */
    metadata: model.text().nullable(),
    /** Denormalized total redemption count (updated on each redemption) */
    total_redemptions: model.number().default(0),
});

/**
 * Tracks each redemption of an offer against a cart/order/customer.
 * Stores the computed reward values for audit and reporting.
 */
export const OfferRedemption = model.define("offer_redemption", {
    id: model
        .id({
            prefix: "ofrred",
        })
        .primaryKey(),
    offer_id: model.text(),
    customer_id: model.text().nullable(),
    order_id: model.text().nullable(),
    cart_id: model.text().nullable(),
    /** Discount amount applied to the cart */
    discount_amount: model.number().default(0),
    /** Cashback amount credited to wallet */
    cashback_amount: model.number().default(0),
    /** Loyalty points credited */
    loyalty_points: model.number().default(0),
    /** JSON-serialized metadata (reward details, context snapshot, etc.) */
    metadata: model.text().nullable(),
});
