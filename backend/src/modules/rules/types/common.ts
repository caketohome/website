import RulesModuleService from "../service";

// ─── Offer Types ───────────────────────────────────────────────────────────────
// Every promotion type the platform supports flows through this engine.

export type OfferType =
    | "percentage"
    | "flat"
    | "free_delivery"
    | "buy_x_get_y"
    | "buy_x_get_discount"
    | "free_product"
    | "free_addon"
    | "category_discount"
    | "product_discount"
    | "bundle_discount"
    | "first_order"
    | "birthday_coupon"
    | "anniversary_coupon"
    | "referral_coupon"
    | "wallet_coupon"
    | "cashback_coupon"
    | "coupon"
    | "promo_code"
    | "flash_sale"
    | "combo"
    | "festival_campaign";

export type OfferStatus =
    | "draft"
    | "pending_approval"
    | "approved"
    | "active"
    | "paused"
    | "scheduled"
    | "expired"
    | "archived"
    | "disabled";

// ─── Condition Types ───────────────────────────────────────────────────────────

export type ConditionEntity =
    | "cart"
    | "line"
    | "category"
    | "product"
    | "customer"
    | "customer_segment"
    | "branch"
    | "city"
    | "pincode"
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
    cap?: number;
    free_item_id?: string;
    free_item_quantity?: number;
    target_ids?: string[];
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
    start_time?: string | null;
    end_time?: string | null;
    timezone?: string;
    never_expires?: boolean;
    usage_limit: number | null;
    per_customer_limit: number | null;
    daily_limit?: number | null;
    monthly_limit?: number | null;
    is_stackable: boolean;
    is_public: boolean;
    auto_apply?: boolean;
    delivery_mode?: string;
    allowed_payment_methods?: string[] | null;
    min_order_value?: number;
    max_discount_value?: number | null;
    min_quantity?: number;
    description: string | null;
    conditions: OfferCondition[] | null;
    rewards: OfferReward[] | null;
    applicable_branches?: string[] | string | null;
    applicable_cities?: string[] | string | null;
    applicable_pincodes?: string[] | string | null;
    excluded_pincodes?: string[] | string | null;
    applicable_products?: string[] | null;
    applicable_categories?: string[] | null;
    applicable_flavors?: string[] | null;
    applicable_shapes?: string[] | null;
    applicable_weights?: string[] | null;
    customer_eligibility?: string;
    allowed_customer_ids?: string[] | null;
    allowed_phones?: string[] | null;
    allowed_emails?: string[] | null;
    customer_tags?: string[] | null;
    exclude_discounted_items?: boolean;
    exclude_flash_sales?: boolean;
    approval_status?: string;
    created_by?: string | null;
    approved_by?: string | null;
    branch_ids?: string[] | null;
    customer_segments?: string[] | null;
    metadata: Record<string, unknown> | null;
    total_redemptions: number;
    total_discount_given?: number;
    total_revenue_generated?: number;
    created_at: Date;
    updated_at: Date;
}

export interface OfferRedemptionDTO {
    id: string;
    offer_id: string;
    customer_id: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    order_id: string | null;
    order_number?: string | null;
    cart_id: string | null;
    branch_id?: string | null;
    branch_name?: string | null;
    city?: string | null;
    pincode?: string | null;
    discount_amount: number;
    order_total?: number;
    payment_method?: string | null;
    order_status?: string;
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
    starts_at?: Date | string;
    ends_at?: Date | string;
    start_time?: string;
    end_time?: string;
    timezone?: string;
    never_expires?: boolean;
    usage_limit?: number;
    per_customer_limit?: number;
    daily_limit?: number;
    monthly_limit?: number;
    is_stackable?: boolean;
    is_public?: boolean;
    auto_apply?: boolean;
    delivery_mode?: string;
    allowed_payment_methods?: string[];
    min_order_value?: number;
    max_discount_value?: number;
    min_quantity?: number;
    description?: string;
    conditions?: OfferCondition[];
    rewards?: OfferReward[];
    applicable_branches?: string[] | string;
    applicable_cities?: string[] | string;
    applicable_pincodes?: string[] | string;
    excluded_pincodes?: string[] | string;
    applicable_products?: string[];
    applicable_categories?: string[];
    applicable_flavors?: string[];
    applicable_shapes?: string[];
    applicable_weights?: string[];
    customer_eligibility?: string;
    allowed_customer_ids?: string[];
    allowed_phones?: string[];
    allowed_emails?: string[];
    customer_tags?: string[];
    exclude_discounted_items?: boolean;
    exclude_flash_sales?: boolean;
    approval_status?: string;
    created_by?: string;
    metadata?: Record<string, unknown>;
}

export interface UpdateOfferDTO extends Partial<CreateOfferDTO> {}

// ─── Evaluation Context ────────────────────────────────────────────────────────

export interface EvaluationContextItem {
    product_id: string;
    variant_id?: string;
    name?: string;
    category_id?: string;
    flavor?: string;
    shape?: string;
    weight?: string;
    brand?: string;
    quantity: number;
    unit_price: number;
    is_discounted?: boolean;
    is_flash_sale?: boolean;
    is_gift_card?: boolean;
    is_subscription?: boolean;
}

export interface EvaluationContext {
    cart_id?: string;
    customer_id?: string;
    customer_phone?: string;
    customer_email?: string;
    customer_tier?: string;
    customer_tags?: string[];
    branch_id?: string;
    branch_name?: string;
    city?: string;
    pincode?: string;
    subtotal: number;
    items: EvaluationContextItem[];
    customer_segment?: string;
    code?: string;
    applied_codes?: string[];
    delivery_fee?: number;
    payment_method?: string;
    delivery_type?: string; // delivery | pickup
    is_birthday?: boolean;
    is_anniversary?: boolean;
    is_referral?: boolean;
    is_loyalty_member?: boolean;
    is_first_order?: boolean;
    order_count?: number;
    total_spent?: number;
}

export type RejectionReason =
    | "inactive"
    | "not_started"
    | "expired"
    | "time_window_mismatch"
    | "usage_limit_reached"
    | "per_customer_limit_reached"
    | "daily_limit_reached"
    | "monthly_limit_reached"
    | "min_order_not_met"
    | "min_quantity_not_met"
    | "code_mismatch"
    | "branch_restricted"
    | "city_restricted"
    | "pincode_restricted"
    | "pincode_excluded"
    | "customer_tier_restricted"
    | "customer_not_whitelisted"
    | "new_customer_only"
    | "product_restricted"
    | "category_restricted"
    | "flavor_restricted"
    | "shape_restricted"
    | "weight_restricted"
    | "payment_method_restricted"
    | "delivery_mode_restricted"
    | "excluded_items_only"
    | "cannot_stack"
    | "conditions_not_met"
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
    applied: AppliedOffer[];
    rejected: RejectedOffer[];
    summary: {
        total_discount: number;
        total_cashback: number;
        total_loyalty_points: number;
        free_items: Array<{
            product_id: string;
            quantity: number;
        }>;
        free_delivery: boolean;
        offers_applied: number;
        offers_evaluated: number;
    };
    metadata: {
        evaluated_at: string;
        evaluation_time_ms: number;
        context_hash?: string;
    };
}

export interface CouponAnalyticsSummary {
    total_coupons: number;
    active_coupons: number;
    expired_coupons: number;
    scheduled_coupons: number;
    total_redemptions: number;
    total_revenue_generated: number;
    total_discount_given: number;
    average_discount: number;
    average_order_value: number;
    roi_percentage: number;
    uses_today: number;
    uses_this_month: number;
    top_coupon: {
        id: string;
        code: string;
        name: string;
        redemptions: number;
        revenue: number;
    } | null;
    branch_performance: Array<{
        branch_id: string;
        branch_name: string;
        redemptions: number;
        revenue: number;
        discount: number;
    }>;
    city_performance: Array<{
        city: string;
        redemptions: number;
        revenue: number;
    }>;
}

// ─── Module Declaration ────────────────────────────────────────────────────────

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        rulesModuleService: RulesModuleService;
    }
}
