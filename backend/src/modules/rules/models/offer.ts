import { model } from "@medusajs/utils";

/**
 * Enterprise Unified Offer, Coupon & Promotion model for CakeToHome.
 *
 * Supports all 16+ promotion types: Percentage, Fixed Amount, Free Delivery,
 * BOGO, Free Product/Add-on, Category/Product Discounts, First Order,
 * Birthday/Anniversary, Referral, Wallet, and Cashback Coupons.
 *
 * Enforces multi-tier restrictions (branch, city, pincode, product/category/flavor/shape/weight,
 * customer tier/history/tags/IDs), usage caps (global, per-customer, daily, monthly),
 * stacking rules, approval workflows, auto-apply, and payment method gates.
 */
export const Offer = model.define("offer", {
    id: model
        .id({
            prefix: "ofr",
        })
        .primaryKey(),
    /** Human-readable name displayed in admin */
    name: model.text(),
    /** Unique coupon/promo code (e.g. CAKE50) */
    code: model.text().nullable(),
    /** Offer category / type (percentage, flat, free_delivery, bogo, category, etc.) */
    type: model.text(),
    /** Status: draft | pending_approval | approved | active | paused | scheduled | expired | archived */
    status: model.text().default("active"),
    /** Priority weight for stacking conflict resolution */
    priority: model.number().default(0),
    /** Activation datetime */
    starts_at: model.dateTime().nullable(),
    /** Expiration datetime */
    ends_at: model.dateTime().nullable(),
    /** Daily time window start (HH:mm) */
    start_time: model.text().nullable(),
    /** Daily time window end (HH:mm) */
    end_time: model.text().nullable(),
    /** Timezone for schedule evaluations (e.g. "Asia/Kolkata") */
    timezone: model.text().default("Asia/Kolkata"),
    /** Flag to bypass expiry checks */
    never_expires: model.boolean().default(false),
    /** Global usage cap across all customers */
    usage_limit: model.number().nullable(),
    /** Max usage count per customer */
    per_customer_limit: model.number().default(1),
    /** Max redemptions allowed per day */
    daily_limit: model.number().nullable(),
    /** Max redemptions allowed per month */
    monthly_limit: model.number().nullable(),
    /** Whether this offer can combine with other stackable coupons */
    is_stackable: model.boolean().default(false),
    /** Whether this offer is visible in customer offer listings */
    is_public: model.boolean().default(true),
    /** Whether system should auto-apply this coupon if best qualifying */
    auto_apply: model.boolean().default(false),
    /** Delivery mode: all | delivery | pickup */
    delivery_mode: model.text().default("all"),
    /** Allowed payment methods JSON string: ["cash", "card", "upi", "wallet", "cod", "online"] */
    allowed_payment_methods: model.text().nullable(),
    /** Minimum cart order value required (in currency units or paise) */
    min_order_value: model.number().default(0),
    /** Maximum discount cap for percentage offers */
    max_discount_value: model.number().nullable(),
    /** Minimum product quantity in cart required */
    min_quantity: model.number().default(1),
    /** Admin-facing description / customer terms */
    description: model.text().nullable(),
    /** JSON string array of branch IDs or 'all' */
    applicable_branches: model.text().nullable(),
    /** JSON string array of city names or 'all' */
    applicable_cities: model.text().nullable(),
    /** JSON string array of included 6-digit pincodes */
    applicable_pincodes: model.text().nullable(),
    /** JSON string array of excluded 6-digit pincodes */
    excluded_pincodes: model.text().nullable(),
    /** JSON string array of applicable product IDs */
    applicable_products: model.text().nullable(),
    /** JSON string array of applicable category IDs */
    applicable_categories: model.text().nullable(),
    /** JSON string array of applicable flavors */
    applicable_flavors: model.text().nullable(),
    /** JSON string array of applicable cake shapes */
    applicable_shapes: model.text().nullable(),
    /** JSON string array of applicable weights (e.g. ["0.5 kg", "1.0 kg"]) */
    applicable_weights: model.text().nullable(),
    /** Customer eligibility: all | new_customers | returning | vip | wholesale | corporate | loyalty_tier */
    customer_eligibility: model.text().default("all"),
    /** JSON string array of specific allowed customer IDs */
    allowed_customer_ids: model.text().nullable(),
    /** JSON string array of specific allowed phone numbers */
    allowed_phones: model.text().nullable(),
    /** JSON string array of specific allowed email addresses */
    allowed_emails: model.text().nullable(),
    /** JSON string array of customer tags */
    customer_tags: model.text().nullable(),
    /** Exclude already discounted / promotional products from applying this coupon */
    exclude_discounted_items: model.boolean().default(false),
    /** Exclude flash sale items */
    exclude_flash_sales: model.boolean().default(false),
    /** Approval workflow status: draft | pending_approval | approved | published | rejected */
    approval_status: model.text().default("approved"),
    /** Admin actor who created the coupon */
    created_by: model.text().nullable(),
    /** Admin actor who approved the coupon */
    approved_by: model.text().nullable(),
    /** JSON-serialized OfferCondition[] */
    conditions: model.text().nullable(),
    /** JSON-serialized OfferReward[] */
    rewards: model.text().nullable(),
    /** JSON-serialized Record<string, unknown> freeform metadata */
    metadata: model.text().nullable(),
    /** Aggregate counter of total redemptions */
    total_redemptions: model.number().default(0),
    /** Aggregate total discount given in rupees */
    total_discount_given: model.number().default(0),
    /** Aggregate gross order revenue generated using this coupon */
    total_revenue_generated: model.number().default(0),
});

/**
 * Tracks every individual redemption of an offer against an order/customer.
 */
export const OfferRedemption = model.define("offer_redemption", {
    id: model
        .id({
            prefix: "red",
        })
        .primaryKey(),
    offer_id: model.text(),
    customer_id: model.text().nullable(),
    customer_phone: model.text().nullable(),
    customer_email: model.text().nullable(),
    order_id: model.text().nullable(),
    order_number: model.text().nullable(),
    cart_id: model.text().nullable(),
    branch_id: model.text().nullable(),
    branch_name: model.text().nullable(),
    city: model.text().nullable(),
    pincode: model.text().nullable(),
    discount_amount: model.number().default(0),
    order_total: model.number().default(0),
    payment_method: model.text().nullable(),
    order_status: model.text().default("completed"),
    cashback_amount: model.number().default(0),
    loyalty_points: model.number().default(0),
    metadata: model.text().nullable(),
});
