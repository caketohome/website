import RulesModuleService from "../service";

// ─── Offer Types ───────────────────────────────────────────────────────────────
// Every promotion type the platform will ever support flows through this engine.

export type OfferType =
    | "coupon"
    | "promo_code"
    | "flash_sale"
    | "combo"
    | "buy_x_get_y"
    | "free_delivery"
    | "free_gift"
    | "bundle"
    | "category_discount"
    | "product_discount"
    | "cart_discount"
    | "wallet_cashback"
    | "referral_reward"
    | "loyalty_bonus"
    | "birthday_offer"
    | "anniversary_offer"
    | "festival_campaign"
    | "first_order_offer"
    | "affiliate_reward"
    | "influencer_reward"
    | "gamification_reward"
    | "branch_specific"
    | "customer_segment"
    | "scheduled_campaign";

export type OfferStatus = "draft" | "active" | "scheduled" | "expired" | "disabled";

// ─── Condition Types ───────────────────────────────────────────────────────────
// Flexible condition system — all rules are data-driven, never hardcoded.

export type ConditionEntity =
    | "cart"
    | "line"
    | "category"
    | "product"
    | "customer"
    | "customer_segment"
    | "branch"
    | "order_history"
    | "time"
    | "payment_method"
    | "delivery_type";

export type ConditionOperator =
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "not_in"
    | "contains"
    | "not_contains"
    | "between"
    | "is_true"
    | "is_false"
    | "exists"
    | "not_exists";

export interface OfferCondition {
    entity: ConditionEntity;
    field: string;
    operator: ConditionOperator;
    value: unknown;
    /** Optional label for admin display */
    label?: string;
}

// ─── Reward Types ──────────────────────────────────────────────────────────────

export type RewardType =
    | "cart_discount"
    | "line_discount"
    | "free_item"
    | "free_delivery"
    | "wallet_cashback"
    | "loyalty_points"
    | "referral_credit";

export type AmountType = "fixed" | "percent";

export interface OfferReward {
    reward_type: RewardType;
    amount_type: AmountType;
    amount: number;
    /** Maximum discount cap for percent-based rewards */
    cap?: number;
    /** Product ID for free_item rewards */
    free_item_id?: string;
    /** Quantity of free items to give */
    free_item_quantity?: number;
    /** Target product/category IDs for line_discount */
    target_ids?: string[];
    /** Optional label for admin display */
    label?: string;
}

// ─── Offer DTO ─────────────────────────────────────────────────────────────────

export interface OfferDTO {
    id: string;
    name: string;
    code: string | null;
    type: OfferType;
    status: OfferStatus;
    priority: number;
    starts_at: Date | null;
    ends_at: Date | null;
    usage_limit: number | null;
    per_customer_limit: number | null;
    is_stackable: boolean;
    is_public: boolean;
    description: string | null;
    conditions: OfferCondition[] | null;
    rewards: OfferReward[] | null;
    /** Restrict to specific branches. Null = all branches. */
    branch_ids: string[] | null;
    /** Restrict to specific customer segments. Null = all customers. */
    customer_segments: string[] | null;
    /** Freeform metadata for integrations (campaign ID, source, etc.) */
    metadata: Record<string, unknown> | null;
    total_redemptions: number;
    created_at: Date;
    updated_at: Date;
}

export interface OfferRedemptionDTO {
    id: string;
    offer_id: string;
    customer_id: string | null;
    order_id: string | null;
    cart_id: string | null;
    discount_amount: number;
    cashback_amount: number;
    loyalty_points: number;
    metadata: Record<string, unknown> | null;
    created_at: Date;
}

// ─── Create / Update DTOs ──────────────────────────────────────────────────────

export interface CreateOfferDTO {
    name: string;
    code?: string;
    type: OfferType;
    status?: OfferStatus;
    priority?: number;
    starts_at?: Date;
    ends_at?: Date;
    usage_limit?: number;
    per_customer_limit?: number;
    is_stackable?: boolean;
    is_public?: boolean;
    description?: string;
    conditions?: OfferCondition[];
    rewards?: OfferReward[];
    branch_ids?: string[];
    customer_segments?: string[];
    metadata?: Record<string, unknown>;
}

export interface UpdateOfferDTO {
    name?: string;
    code?: string;
    type?: OfferType;
    status?: OfferStatus;
    priority?: number;
    starts_at?: Date | null;
    ends_at?: Date | null;
    usage_limit?: number | null;
    per_customer_limit?: number | null;
    is_stackable?: boolean;
    is_public?: boolean;
    description?: string;
    conditions?: OfferCondition[];
    rewards?: OfferReward[];
    branch_ids?: string[] | null;
    customer_segments?: string[] | null;
    metadata?: Record<string, unknown> | null;
}

// ─── Evaluation Context ────────────────────────────────────────────────────────
// Passed by cart, checkout, CRM, referrals, loyalty — any module needing evaluation.

export interface EvaluationContextItem {
    product_id: string;
    variant_id: string;
    category_id?: string;
    quantity: number;
    unit_price: number;
}

export interface EvaluationContext {
    /** Cart identifier */
    cart_id?: string;
    /** Customer identifier */
    customer_id?: string;
    /** Branch identifier */
    branch_id?: string;
    /** Cart subtotal (before discounts) */
    subtotal: number;
    /** Cart line items */
    items: EvaluationContextItem[];
    /** Customer segment tag (e.g. "vip", "new", "loyal") */
    customer_segment?: string;
    /** Coupon/promo code entered by customer */
    code?: string;
    /** Delivery fee (for free_delivery reward calculation) */
    delivery_fee?: number;
    /** Payment method (e.g. "wallet", "upi", "card") */
    payment_method?: string;
    /** Delivery type (e.g. "standard", "express", "pickup") */
    delivery_type?: string;

    // Customer profile conditions
    /** True if today is the customer's birthday */
    is_birthday?: boolean;
    /** True if today is the customer's anniversary */
    is_anniversary?: boolean;
    /** True if this is a referred customer */
    is_referral?: boolean;
    /** True if the customer has a loyalty account */
    is_loyalty_member?: boolean;
    /** True if this is the customer's first order */
    is_first_order?: boolean;
    /** Customer's total historical order count */
    order_count?: number;
    /** Customer's total historical spending */
    total_spent?: number;
}

// ─── Evaluation Results ────────────────────────────────────────────────────────

export type RejectionReason =
    | "inactive"
    | "not_started"
    | "expired"
    | "usage_limit_reached"
    | "per_customer_limit_reached"
    | "code_mismatch"
    | "conditions_not_met"
    | "branch_restricted"
    | "segment_restricted"
    | "no_valid_reward"
    | "feature_disabled";

export interface AppliedOffer {
    offer: OfferDTO;
    reward: OfferReward;
    discount_amount: number;
    cashback_amount: number;
    loyalty_points: number;
    free_items: Array<{
        product_id: string;
        quantity: number;
    }>;
    free_delivery: boolean;
}

export interface RejectedOffer {
    offer_id: string;
    offer_name: string;
    offer_type: OfferType;
    reason: RejectionReason;
    detail?: string;
}

export interface EvaluationResult {
    /** All offers that were applied (respecting priority + stacking) */
    applied: AppliedOffer[];
    /** All offers that were evaluated but rejected, with reasons */
    rejected: RejectedOffer[];
    /** Summary values */
    summary: {
        /** Total cart discount amount */
        total_discount: number;
        /** Total wallet cashback to credit after order */
        total_cashback: number;
        /** Total loyalty points to credit after order */
        total_loyalty_points: number;
        /** Free items to add to cart */
        free_items: Array<{
            product_id: string;
            quantity: number;
        }>;
        /** Whether delivery fee is waived */
        free_delivery: boolean;
        /** Count of offers applied */
        offers_applied: number;
        /** Count of offers evaluated */
        offers_evaluated: number;
    };
    /** Execution metadata for debugging */
    metadata: {
        evaluated_at: string;
        evaluation_time_ms: number;
        context_hash?: string;
    };
}

// ─── Legacy Compat ─────────────────────────────────────────────────────────────
// Old EvaluationResult shape for backward compatibility with existing store API
// consumers. New consumers should use the full EvaluationResult.

export interface LegacyEvaluationResult {
    applicable: boolean;
    offer: OfferDTO;
    reward: OfferReward;
    discount_amount: number;
}

// ─── Module Declaration ────────────────────────────────────────────────────────

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        rulesModuleService: RulesModuleService;
    }
}
