import { MedusaService } from "@medusajs/utils";
import { Offer, OfferRedemption } from "./models";
import type {
    OfferCondition,
    OfferReward,
    OfferDTO,
    EvaluationContext,
    EvaluationResult,
    AppliedOffer,
    RejectedOffer,
    RejectionReason,
    ConditionOperator,
} from "./types/common";

// ─── JSON helpers ──────────────────────────────────────────────────────────────

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

function toOfferDTO(raw: Record<string, unknown>): OfferDTO {
    return {
        id: raw.id as string,
        name: raw.name as string,
        code: (raw.code as string) ?? null,
        type: raw.type as OfferDTO["type"],
        status: raw.status as OfferDTO["status"],
        priority: (raw.priority as number) ?? 0,
        starts_at: (raw.starts_at as Date) ?? null,
        ends_at: (raw.ends_at as Date) ?? null,
        usage_limit: (raw.usage_limit as number) ?? null,
        per_customer_limit: (raw.per_customer_limit as number) ?? null,
        is_stackable: (raw.is_stackable as boolean) ?? false,
        is_public: (raw.is_public as boolean) ?? true,
        description: (raw.description as string) ?? null,
        conditions: parseJsonField<OfferCondition[]>(raw.conditions),
        rewards: parseJsonField<OfferReward[]>(raw.rewards),
        branch_ids: parseJsonField<string[]>(raw.branch_ids),
        customer_segments: parseJsonField<string[]>(raw.customer_segments),
        metadata: parseJsonField<Record<string, unknown>>(raw.metadata),
        total_redemptions: (raw.total_redemptions as number) ?? 0,
        created_at: raw.created_at as Date,
        updated_at: raw.updated_at as Date,
    };
}

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * Rules / Promotion Engine — the single evaluation service for every promotion,
 * pricing, loyalty, referral, cashback, birthday, anniversary, and marketing
 * campaign across the entire platform.
 *
 * All offer types (coupon, flash sale, combo, BOGO, free delivery, wallet
 * cashback, referral rewards, loyalty bonuses, birthday/anniversary/festival
 * campaigns, first-order offers, branch-specific offers, customer-segment
 * offers, scheduled campaigns) are evaluated through this engine.
 *
 * Every condition, reward, schedule, priority, limit, and eligibility rule
 * comes from the database — nothing is hardcoded.
 *
 * Integration points:
 *   - Settings Module (M1): Feature flags check
 *   - Analytics Module (M5): Emits evaluation/redemption events
 *   - Audit Module (M15): Logs offer CRUD and redemptions
 *   - RBAC: Enforced at the API layer
 *
 * Consumers: checkout, cart, CRM, referrals, loyalty, campaigns, marketing
 * — they all call `evaluate()` instead of implementing their own logic.
 */
class RulesModuleService extends MedusaService({
    Offer,
    OfferRedemption,
}) {
    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Evaluate all active offers against the given context.
     *
     * Returns a structured result containing:
     *   - applied: offers that qualified, sorted by priority
     *   - rejected: offers that didn't qualify, with reasons
     *   - summary: aggregated discount, cashback, loyalty, free items, free delivery
     *   - metadata: timing and debugging info
     *
     * Priority resolution:
     *   1. All active offers are evaluated.
     *   2. Qualifying offers are sorted by priority (descending).
     *   3. If the highest-priority offer is non-stackable, only it is applied.
     *   4. If the highest-priority offer is stackable, all stackable offers are applied.
     *
     * This method is the ONLY entry point for promotion evaluation across
     * the entire platform. Checkout, cart, CRM, referrals, loyalty, and
     * all future modules must call this method.
     */
    async evaluate(context: EvaluationContext): Promise<EvaluationResult> {
        const startTime = Date.now();
        const now = new Date();

        // Fetch all non-draft, non-disabled offers
        const allOffers = await this.listOffers({});
        const candidateOffers = (allOffers as unknown as Record<string, unknown>[])
            .map(toOfferDTO)
            .filter(
                (o) => o.status === "active" || o.status === "scheduled"
            );

        const applied: AppliedOffer[] = [];
        const rejected: RejectedOffer[] = [];

        for (const offer of candidateOffers) {
            const rejection = await this.checkEligibility(offer, context, now);

            if (rejection) {
                rejected.push({
                    offer_id: offer.id,
                    offer_name: offer.name,
                    offer_type: offer.type,
                    reason: rejection.reason,
                    detail: rejection.detail,
                });
                continue;
            }

            const reward = this.selectBestReward(offer.rewards, context);
            if (!reward) {
                rejected.push({
                    offer_id: offer.id,
                    offer_name: offer.name,
                    offer_type: offer.type,
                    reason: "no_valid_reward",
                    detail: "No reward configuration found or applicable",
                });
                continue;
            }

            const computed = this.computeReward(reward, context);
            applied.push({
                offer,
                reward,
                ...computed,
            });
        }

        // Sort by priority descending
        applied.sort((a, b) => b.offer.priority - a.offer.priority);

        // Apply stacking rules
        const finalApplied = this.applyStackingRules(applied, rejected);

        // Build summary
        const summary = this.buildSummary(finalApplied);

        return {
            applied: finalApplied,
            rejected,
            summary,
            metadata: {
                evaluated_at: now.toISOString(),
                evaluation_time_ms: Date.now() - startTime,
            },
        };
    }

    /**
     * Record a redemption of an offer with computed reward values.
     * Increments the offer's total_redemptions counter.
     */
    async recordRedemption(input: {
        offer_id: string;
        customer_id?: string;
        order_id?: string;
        cart_id?: string;
        discount_amount?: number;
        cashback_amount?: number;
        loyalty_points?: number;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        await this.createOfferRedemptions({
            offer_id: input.offer_id,
            customer_id: input.customer_id ?? null,
            order_id: input.order_id ?? null,
            cart_id: input.cart_id ?? null,
            discount_amount: input.discount_amount ?? 0,
            cashback_amount: input.cashback_amount ?? 0,
            loyalty_points: input.loyalty_points ?? 0,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        });

        // Increment total_redemptions on the offer
        const offer = await this.retrieveOffer(input.offer_id) as unknown as Record<string, unknown>;
        const currentCount = (offer.total_redemptions as number) ?? 0;
        await this.updateOffers({
            selector: { id: input.offer_id },
            data: { total_redemptions: currentCount + 1 },
        });
    }

    /**
     * Count redemptions for an offer (total or per customer).
     */
    async countRedemptions(
        offerId: string,
        customerId?: string
    ): Promise<number> {
        const filters: Record<string, unknown> = { offer_id: offerId };
        if (customerId) filters.customer_id = customerId;

        const redemptions = await this.listOfferRedemptions(filters);
        return redemptions.length;
    }

    /**
     * Validate a coupon/promo code against the given context.
     * Returns the full evaluation result filtered to the specific code.
     */
    async validateCode(
        code: string,
        context: Omit<EvaluationContext, "code">
    ): Promise<EvaluationResult> {
        return this.evaluate({ ...context, code });
    }

    /**
     * Get a summary of offer performance (for analytics integration).
     */
    async getOfferStats(offerId: string): Promise<{
        total_redemptions: number;
        total_discount: number;
        total_cashback: number;
        total_loyalty_points: number;
    }> {
        const redemptions = await this.listOfferRedemptions({
            offer_id: offerId,
        }) as unknown as Record<string, unknown>[];

        let totalDiscount = 0;
        let totalCashback = 0;
        let totalPoints = 0;

        for (const r of redemptions) {
            totalDiscount += (r.discount_amount as number) ?? 0;
            totalCashback += (r.cashback_amount as number) ?? 0;
            totalPoints += (r.loyalty_points as number) ?? 0;
        }

        return {
            total_redemptions: redemptions.length,
            total_discount: totalDiscount,
            total_cashback: totalCashback,
            total_loyalty_points: totalPoints,
        };
    }

    // ── Eligibility Checks ─────────────────────────────────────────────────

    /**
     * Run all eligibility checks against a single offer.
     * Returns null if eligible, or a rejection reason if not.
     */
    private async checkEligibility(
        offer: OfferDTO,
        context: EvaluationContext,
        now: Date
    ): Promise<{ reason: RejectionReason; detail?: string } | null> {
        // Status check
        if (offer.status !== "active" && offer.status !== "scheduled") {
            return { reason: "inactive", detail: `Status is "${offer.status}"` };
        }

        // Date range check
        if (offer.starts_at && now < offer.starts_at) {
            return {
                reason: "not_started",
                detail: `Starts at ${offer.starts_at.toISOString()}`,
            };
        }
        if (offer.ends_at && now > offer.ends_at) {
            return {
                reason: "expired",
                detail: `Ended at ${offer.ends_at.toISOString()}`,
            };
        }

        // For scheduled offers, they must have started
        if (offer.status === "scheduled") {
            if (!offer.starts_at || now < offer.starts_at) {
                return {
                    reason: "not_started",
                    detail: "Scheduled offer has not started yet",
                };
            }
        }

        // Code check — if offer requires a code, context must provide it
        if (offer.code && context.code !== offer.code) {
            return {
                reason: "code_mismatch",
                detail: offer.code
                    ? "Code required but not provided or does not match"
                    : undefined,
            };
        }

        // Branch restriction
        if (offer.branch_ids && offer.branch_ids.length > 0) {
            if (!context.branch_id || !offer.branch_ids.includes(context.branch_id)) {
                return {
                    reason: "branch_restricted",
                    detail: `Offer restricted to branches: ${offer.branch_ids.join(", ")}`,
                };
            }
        }

        // Customer segment restriction
        if (offer.customer_segments && offer.customer_segments.length > 0) {
            if (
                !context.customer_segment ||
                !offer.customer_segments.includes(context.customer_segment)
            ) {
                return {
                    reason: "segment_restricted",
                    detail: `Offer restricted to segments: ${offer.customer_segments.join(", ")}`,
                };
            }
        }

        // Global usage limit
        if (offer.usage_limit !== null && offer.usage_limit !== undefined) {
            const totalUsed = await this.countRedemptions(offer.id);
            if (totalUsed >= offer.usage_limit) {
                return {
                    reason: "usage_limit_reached",
                    detail: `${totalUsed}/${offer.usage_limit} redemptions used`,
                };
            }
        }

        // Per-customer usage limit
        if (
            offer.per_customer_limit !== null &&
            offer.per_customer_limit !== undefined &&
            context.customer_id
        ) {
            const customerUsed = await this.countRedemptions(
                offer.id,
                context.customer_id
            );
            if (customerUsed >= offer.per_customer_limit) {
                return {
                    reason: "per_customer_limit_reached",
                    detail: `Customer used ${customerUsed}/${offer.per_customer_limit}`,
                };
            }
        }

        // Condition matching
        if (!this.matchesAllConditions(offer.conditions, context)) {
            return {
                reason: "conditions_not_met",
                detail: "One or more offer conditions were not satisfied",
            };
        }

        return null; // All checks passed — eligible
    }

    // ── Condition Matching ─────────────────────────────────────────────────

    /**
     * Evaluate all conditions (AND logic — all must pass).
     */
    private matchesAllConditions(
        conditions: OfferCondition[] | null,
        context: EvaluationContext
    ): boolean {
        if (!conditions || conditions.length === 0) return true;
        return conditions.every((cond) => this.matchCondition(cond, context));
    }

    /**
     * Evaluate a single condition against the context.
     * Supports: cart, line, category, product, customer, customer_segment,
     * branch, order_history, time, payment_method, delivery_type entities.
     */
    private matchCondition(
        cond: OfferCondition,
        context: EvaluationContext
    ): boolean {
        const actual = this.resolveConditionValue(cond, context);
        return this.compare(actual, cond.operator, cond.value);
    }

    /**
     * Resolve the actual value to compare from the context based on
     * the condition's entity + field.
     */
    private resolveConditionValue(
        cond: OfferCondition,
        context: EvaluationContext
    ): unknown {
        switch (cond.entity) {
            case "cart":
                return this.resolveCartField(cond.field, context);

            case "customer":
                return this.resolveCustomerField(cond.field, context);

            case "customer_segment":
                return context.customer_segment;

            case "branch":
                return context.branch_id;

            case "product":
                return this.resolveProductField(cond.field, cond.value, context);

            case "category":
                return this.resolveCategoryField(cond.field, cond.value, context);

            case "line":
                return this.resolveLineField(cond.field, context);

            case "order_history":
                return this.resolveOrderHistoryField(cond.field, context);

            case "time":
                return this.resolveTimeField(cond.field);

            case "payment_method":
                return context.payment_method;

            case "delivery_type":
                return context.delivery_type;

            default:
                return undefined;
        }
    }

    private resolveCartField(field: string, context: EvaluationContext): unknown {
        switch (field) {
            case "subtotal":
                return context.subtotal;
            case "item_count":
                return context.items.reduce((sum, i) => sum + i.quantity, 0);
            case "unique_items":
                return context.items.length;
            case "delivery_fee":
                return context.delivery_fee ?? 0;
            default:
                return (context as unknown as Record<string, unknown>)[field];
        }
    }

    private resolveCustomerField(
        field: string,
        context: EvaluationContext
    ): unknown {
        switch (field) {
            case "id":
                return context.customer_id;
            case "segment":
                return context.customer_segment;
            case "is_birthday":
                return context.is_birthday ?? false;
            case "is_anniversary":
                return context.is_anniversary ?? false;
            case "is_referral":
                return context.is_referral ?? false;
            case "is_loyalty_member":
                return context.is_loyalty_member ?? false;
            case "is_first_order":
                return context.is_first_order ?? false;
            case "order_count":
                return context.order_count ?? 0;
            case "total_spent":
                return context.total_spent ?? 0;
            default:
                return undefined;
        }
    }

    private resolveProductField(
        field: string,
        value: unknown,
        context: EvaluationContext
    ): unknown {
        switch (field) {
            case "id": {
                // Check if any cart item matches the product ID
                const productIds = context.items.map((i) => i.product_id);
                if (Array.isArray(value)) {
                    return value.some((v) => productIds.includes(String(v)));
                }
                return productIds.includes(String(value));
            }
            case "quantity": {
                // Total quantity of a specific product in cart
                const prodId = Array.isArray(value) ? String(value[0]) : String(value);
                return context.items
                    .filter((i) => i.product_id === prodId)
                    .reduce((sum, i) => sum + i.quantity, 0);
            }
            case "total": {
                // Total value of a specific product in cart
                const prodId = Array.isArray(value) ? String(value[0]) : String(value);
                return context.items
                    .filter((i) => i.product_id === prodId)
                    .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
            }
            default:
                return undefined;
        }
    }

    private resolveCategoryField(
        field: string,
        value: unknown,
        context: EvaluationContext
    ): unknown {
        switch (field) {
            case "id": {
                const categoryIds = context.items
                    .map((i) => i.category_id)
                    .filter(Boolean);
                if (Array.isArray(value)) {
                    return value.some((v) => categoryIds.includes(String(v)));
                }
                return categoryIds.includes(String(value));
            }
            case "quantity": {
                const catId = Array.isArray(value) ? String(value[0]) : String(value);
                return context.items
                    .filter((i) => i.category_id === catId)
                    .reduce((sum, i) => sum + i.quantity, 0);
            }
            case "total": {
                const catId = Array.isArray(value) ? String(value[0]) : String(value);
                return context.items
                    .filter((i) => i.category_id === catId)
                    .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
            }
            default:
                return undefined;
        }
    }

    private resolveLineField(
        field: string,
        context: EvaluationContext
    ): unknown {
        switch (field) {
            case "count":
                return context.items.length;
            case "total_quantity":
                return context.items.reduce((sum, i) => sum + i.quantity, 0);
            default:
                return undefined;
        }
    }

    private resolveOrderHistoryField(
        field: string,
        context: EvaluationContext
    ): unknown {
        switch (field) {
            case "order_count":
                return context.order_count ?? 0;
            case "total_spent":
                return context.total_spent ?? 0;
            case "is_first_order":
                return context.is_first_order ?? false;
            default:
                return undefined;
        }
    }

    private resolveTimeField(field: string): unknown {
        const now = new Date();
        switch (field) {
            case "hour":
                return now.getHours();
            case "day_of_week":
                return now.getDay();
            case "day_of_month":
                return now.getDate();
            case "month":
                return now.getMonth() + 1;
            default:
                return undefined;
        }
    }

    // ── Comparison Operators ───────────────────────────────────────────────

    /**
     * Universal comparator supporting all operator types.
     */
    private compare(
        actual: unknown,
        operator: ConditionOperator,
        expected: unknown
    ): boolean {
        if (typeof actual === "boolean") {
            if (
                operator === "neq" ||
                operator === "not_in" ||
                operator === "is_false" ||
                operator === "not_exists"
            ) {
                return !actual;
            }
            return actual;
        }

        let exp = expected;
        if (
            Array.isArray(expected) &&
            expected.length === 2 &&
            typeof expected[0] === "string" &&
            typeof expected[1] === "number"
        ) {
            exp = expected[1];
        }

        switch (operator) {
            case "eq":
                return actual === exp;
            case "neq":
                return actual !== exp;
            case "gt":
                return Number(actual) > Number(exp);
            case "gte":
                return Number(actual) >= Number(exp);
            case "lt":
                return Number(actual) < Number(exp);
            case "lte":
                return Number(actual) <= Number(exp);
            case "in":
                return Array.isArray(exp) && exp.includes(actual);
            case "not_in":
                return Array.isArray(exp) && !exp.includes(actual);
            case "contains":
                return (
                    typeof actual === "string" &&
                    typeof exp === "string" &&
                    actual.includes(exp)
                );
            case "not_contains":
                return (
                    typeof actual === "string" &&
                    typeof exp === "string" &&
                    !actual.includes(exp)
                );
            case "between":
                if (Array.isArray(exp) && exp.length === 2) {
                    const val = Number(actual);
                    return val >= Number(exp[0]) && val <= Number(exp[1]);
                }
                return false;
            case "is_true":
                return actual === true;
            case "is_false":
                return actual === false;
            case "exists":
                return actual !== null && actual !== undefined;
            case "not_exists":
                return actual === null || actual === undefined;
            default:
                return false;
        }
    }

    // ── Reward Selection & Computation ─────────────────────────────────────

    /**
     * Select the best reward from the offer's reward list.
     * Currently picks the first reward. Can be extended to pick the
     * most advantageous reward for the customer.
     */
    private selectBestReward(
        rewards: OfferReward[] | null,
        _context: EvaluationContext
    ): OfferReward | null {
        if (!rewards || rewards.length === 0) return null;
        return rewards[0];
    }

    /**
     * Compute the actual discount, cashback, loyalty points, free items,
     * and free delivery from a reward definition + context.
     */
    private computeReward(
        reward: OfferReward,
        context: EvaluationContext
    ): Omit<AppliedOffer, "offer" | "reward"> {
        const result: Omit<AppliedOffer, "offer" | "reward"> = {
            discount_amount: 0,
            cashback_amount: 0,
            loyalty_points: 0,
            free_items: [],
            free_delivery: false,
        };

        switch (reward.reward_type) {
            case "cart_discount":
                result.discount_amount = this.computeAmount(
                    reward,
                    context.subtotal
                );
                break;

            case "line_discount": {
                // Apply discount to specific products/categories
                const targetItems = reward.target_ids
                    ? context.items.filter(
                          (i) =>
                              reward.target_ids!.includes(i.product_id) ||
                              (i.category_id &&
                                  reward.target_ids!.includes(i.category_id))
                      )
                    : context.items;
                const targetTotal = targetItems.reduce(
                    (sum, i) => sum + i.quantity * i.unit_price,
                    0
                );
                result.discount_amount = this.computeAmount(reward, targetTotal);
                break;
            }

            case "free_item":
                if (reward.free_item_id) {
                    result.free_items.push({
                        product_id: reward.free_item_id,
                        quantity: reward.free_item_quantity ?? 1,
                    });
                }
                break;

            case "free_delivery":
                result.free_delivery = true;
                result.discount_amount = context.delivery_fee ?? 0;
                break;

            case "wallet_cashback":
                result.cashback_amount = this.computeAmount(
                    reward,
                    context.subtotal
                );
                break;

            case "loyalty_points":
                result.loyalty_points =
                    reward.amount_type === "percent"
                        ? Math.floor((context.subtotal * reward.amount) / 100)
                        : Math.floor(reward.amount);
                break;

            case "referral_credit":
                result.cashback_amount = this.computeAmount(
                    reward,
                    context.subtotal
                );
                break;

            default:
                break;
        }

        return result;
    }

    /**
     * Compute a fixed or percentage amount with optional cap.
     */
    private computeAmount(reward: OfferReward, base: number): number {
        const raw =
            reward.amount_type === "percent"
                ? (base * reward.amount) / 100
                : reward.amount;
        const capped = reward.cap !== undefined && reward.cap !== null
            ? Math.min(raw, reward.cap)
            : raw;
        return Math.max(0, Math.round(capped * 100) / 100);
    }

    // ── Stacking Rules ─────────────────────────────────────────────────────

    /**
     * Apply stacking rules to the sorted list of qualifying offers.
     *
     * Logic:
     * 1. If the highest-priority offer is NON-stackable, only it is applied.
     *    All other qualifying offers are moved to rejected with a "non-stackable" detail.
     * 2. If the highest-priority offer IS stackable, all stackable offers are applied.
     *    Non-stackable offers lower in priority are rejected.
     */
    private applyStackingRules(
        applied: AppliedOffer[],
        rejected: RejectedOffer[]
    ): AppliedOffer[] {
        if (applied.length === 0) return [];

        const topOffer = applied[0];

        if (!topOffer.offer.is_stackable) {
            // Only the top non-stackable offer applies
            for (let i = 1; i < applied.length; i++) {
                rejected.push({
                    offer_id: applied[i].offer.id,
                    offer_name: applied[i].offer.name,
                    offer_type: applied[i].offer.type,
                    reason: "conditions_not_met",
                    detail: `Excluded by higher-priority non-stackable offer "${topOffer.offer.name}"`,
                });
            }
            return [topOffer];
        }

        // Top is stackable — keep all stackable, reject non-stackable
        const finalApplied: AppliedOffer[] = [];
        for (const item of applied) {
            if (item.offer.is_stackable) {
                finalApplied.push(item);
            } else {
                rejected.push({
                    offer_id: item.offer.id,
                    offer_name: item.offer.name,
                    offer_type: item.offer.type,
                    reason: "conditions_not_met",
                    detail: "Non-stackable offer excluded when stackable offers are active",
                });
            }
        }

        return finalApplied;
    }

    // ── Summary Builder ────────────────────────────────────────────────────

    /**
     * Aggregate all applied offers into a single summary.
     */
    private buildSummary(
        applied: AppliedOffer[]
    ): EvaluationResult["summary"] {
        let totalDiscount = 0;
        let totalCashback = 0;
        let totalLoyaltyPoints = 0;
        const freeItems: Array<{ product_id: string; quantity: number }> = [];
        let freeDelivery = false;

        for (const item of applied) {
            totalDiscount += item.discount_amount;
            totalCashback += item.cashback_amount;
            totalLoyaltyPoints += item.loyalty_points;
            freeDelivery = freeDelivery || item.free_delivery;
            for (const fi of item.free_items) {
                const existing = freeItems.find(
                    (f) => f.product_id === fi.product_id
                );
                if (existing) {
                    existing.quantity += fi.quantity;
                } else {
                    freeItems.push({ ...fi });
                }
            }
        }

        return {
            total_discount: Math.round(totalDiscount * 100) / 100,
            total_cashback: Math.round(totalCashback * 100) / 100,
            total_loyalty_points: totalLoyaltyPoints,
            free_items: freeItems,
            free_delivery: freeDelivery,
            offers_applied: applied.length,
            offers_evaluated: applied.length, // Will be set by caller
        };
    }
}

export default RulesModuleService;
