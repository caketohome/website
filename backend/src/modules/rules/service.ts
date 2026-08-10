import { MedusaService } from "@medusajs/utils";
import { Offer, OfferRedemption, OfferAuditLog, OfferDailyMetric } from "./models";
import type {
    OfferCondition,
    OfferReward,
    OfferDTO,
    OfferRedemptionDTO,
    CreateOfferDTO,
    UpdateOfferDTO,
    EvaluationContext,
    EvaluationResult,
    AppliedOffer,
    RejectedOffer,
    RejectionReason,
    CouponAnalyticsSummary,
} from "./types/common";

// ─── Helper Functions ─────────────────────────────────────────────────────────

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

function parseArrayField(raw: unknown): string[] | null {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
            return raw.split(",").map((s) => s.trim()).filter(Boolean);
        }
    }
    return null;
}

function toOfferDTO(raw: Record<string, unknown>): OfferDTO {
    return {
        id: raw.id as string,
        name: raw.name as string,
        code: (raw.code as string) ?? null,
        type: raw.type as OfferDTO["type"],
        status: raw.status as OfferDTO["status"],
        priority: (raw.priority as number) ?? 0,
        starts_at: raw.starts_at ? new Date(raw.starts_at as string | Date) : null,
        ends_at: raw.ends_at ? new Date(raw.ends_at as string | Date) : null,
        start_time: (raw.start_time as string) ?? null,
        end_time: (raw.end_time as string) ?? null,
        timezone: (raw.timezone as string) ?? "Asia/Kolkata",
        never_expires: Boolean(raw.never_expires),
        usage_limit: raw.usage_limit !== undefined && raw.usage_limit !== null ? Number(raw.usage_limit) : null,
        per_customer_limit: raw.per_customer_limit !== undefined && raw.per_customer_limit !== null ? Number(raw.per_customer_limit) : 1,
        daily_limit: raw.daily_limit !== undefined && raw.daily_limit !== null ? Number(raw.daily_limit) : null,
        monthly_limit: raw.monthly_limit !== undefined && raw.monthly_limit !== null ? Number(raw.monthly_limit) : null,
        is_stackable: Boolean(raw.is_stackable),
        is_public: raw.is_public !== undefined ? Boolean(raw.is_public) : true,
        auto_apply: Boolean(raw.auto_apply),
        delivery_mode: (raw.delivery_mode as string) ?? "all",
        allowed_payment_methods: parseArrayField(raw.allowed_payment_methods),
        min_order_value: Number(raw.min_order_value) || 0,
        max_discount_value: raw.max_discount_value ? Number(raw.max_discount_value) : null,
        min_quantity: Number(raw.min_quantity) || 1,
        description: (raw.description as string) ?? null,
        conditions: parseJsonField<OfferCondition[]>(raw.conditions),
        rewards: parseJsonField<OfferReward[]>(raw.rewards),
        applicable_branches: parseArrayField(raw.applicable_branches),
        applicable_cities: parseArrayField(raw.applicable_cities),
        applicable_pincodes: parseArrayField(raw.applicable_pincodes),
        excluded_pincodes: parseArrayField(raw.excluded_pincodes),
        applicable_products: parseArrayField(raw.applicable_products),
        applicable_categories: parseArrayField(raw.applicable_categories),
        applicable_flavors: parseArrayField(raw.applicable_flavors),
        applicable_shapes: parseArrayField(raw.applicable_shapes),
        applicable_weights: parseArrayField(raw.applicable_weights),
        customer_eligibility: (raw.customer_eligibility as string) ?? "all",
        allowed_customer_ids: parseArrayField(raw.allowed_customer_ids),
        allowed_phones: parseArrayField(raw.allowed_phones),
        allowed_emails: parseArrayField(raw.allowed_emails),
        customer_tags: parseArrayField(raw.customer_tags),
        exclude_discounted_items: Boolean(raw.exclude_discounted_items),
        exclude_flash_sales: Boolean(raw.exclude_flash_sales),
        approval_status: (raw.approval_status as string) ?? "approved",
        created_by: (raw.created_by as string) ?? null,
        approved_by: (raw.approved_by as string) ?? null,
        metadata: parseJsonField<Record<string, unknown>>(raw.metadata),
        total_redemptions: Number(raw.total_redemptions) || 0,
        total_discount_given: Number(raw.total_discount_given) || 0,
        total_revenue_generated: Number(raw.total_revenue_generated) || 0,
        created_at: raw.created_at ? new Date(raw.created_at as string | Date) : new Date(),
        updated_at: raw.updated_at ? new Date(raw.updated_at as string | Date) : new Date(),
    };
}

// ─── Service Implementation ───────────────────────────────────────────────────

class RulesModuleService extends (MedusaService({
    Offer,
    OfferRedemption,
    OfferAuditLog,
    OfferDailyMetric,
}) as any) {
    protected container: any;

    constructor(dependencies: any, ...args: any[]) {
        super(dependencies, ...args);
        this.container = dependencies;
    }

    // ── Public Evaluation API ─────────────────────────────────────────────────

    /**
     * Comprehensive real-time coupon and promotion evaluation engine.
     */
    async evaluate(context: EvaluationContext): Promise<EvaluationResult> {
        const startTime = Date.now();
        const now = new Date();

        const allOffers = await this.listOffers({});
        const candidateOffers = (allOffers as unknown as Record<string, unknown>[])
            .map(toOfferDTO)
            .filter((o) => o.status === "active" || o.status === "scheduled");

        const applied: AppliedOffer[] = [];
        const rejected: RejectedOffer[] = [];

        // Check if specific promo code was entered
        const enteredCode = context.code ? context.code.trim().toUpperCase() : null;

        for (const offer of candidateOffers) {
            // If user entered a code, only evaluate that code (or auto-apply offers)
            if (enteredCode) {
                if (offer.code && offer.code.toUpperCase() !== enteredCode) {
                    continue; // Skip non-matching manual codes
                }
            } else if (!offer.auto_apply) {
                // If no code entered, only auto_apply offers qualify
                continue;
            }

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

            const reward = this.resolveRewardForOffer(offer, context);
            if (!reward) {
                rejected.push({
                    offer_id: offer.id,
                    offer_name: offer.name,
                    offer_type: offer.type,
                    reason: "no_valid_reward",
                    detail: "No applicable reward structure found for this cart context",
                });
                continue;
            }

            const computed = this.computeReward(offer, reward, context);
            applied.push({
                offer,
                reward,
                ...computed,
            });
        }

        // Sort applied offers by priority descending
        applied.sort((a, b) => b.offer.priority - a.offer.priority);

        // Apply stacking rules & exclusion logic
        const finalApplied = this.applyStackingRules(applied, rejected);
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
     * Dedicated Single-Coupon Checkout Validation method.
     */
    async validateCouponForCart(code: string, context: EvaluationContext): Promise<{
        valid: boolean;
        discount_amount: number;
        offer?: OfferDTO;
        error_message?: string;
        rejection_reason?: RejectionReason;
    }> {
        const result = await this.evaluate({ ...context, code });
        if (result.applied.length > 0) {
            const top = result.applied[0];
            return {
                valid: true,
                discount_amount: top.discount_amount,
                offer: top.offer,
            };
        }

        const rejection = result.rejected.find((r) => r.offer_name.toUpperCase() === code.toUpperCase() || r.reason);
        return {
            valid: false,
            discount_amount: 0,
            error_message: rejection ? (rejection.detail || `Coupon "${code}" cannot be applied: ${rejection.reason.replace(/_/g, " ")}`) : `Coupon code "${code}" is invalid or expired.`,
            rejection_reason: rejection?.reason || "code_mismatch",
        };
    }

    // ── Eligibility Checking Engine ───────────────────────────────────────────

    private async checkEligibility(
        offer: OfferDTO,
        context: EvaluationContext,
        now: Date
    ): Promise<{ reason: RejectionReason; detail: string } | null> {
        // 1. Status Check
        if (offer.status !== "active" && offer.status !== "scheduled") {
            return { reason: "inactive", detail: `Coupon is currently in "${offer.status}" state.` };
        }

        // 2. Date Range Check
        if (!offer.never_expires) {
            if (offer.starts_at && now < new Date(offer.starts_at)) {
                return { reason: "not_started", detail: `Promotion begins on ${new Date(offer.starts_at).toLocaleDateString()}.` };
            }
            if (offer.ends_at && now > new Date(offer.ends_at)) {
                return { reason: "expired", detail: `Promotion expired on ${new Date(offer.ends_at).toLocaleDateString()}.` };
            }
        }

        // 3. Time-of-Day Window Check
        if (offer.start_time && offer.end_time) {
            const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            if (currentHourMin < offer.start_time || currentHourMin > offer.end_time) {
                return { reason: "time_window_mismatch", detail: `Valid only between ${offer.start_time} and ${offer.end_time}.` };
            }
        }

        // 4. Global Usage Limit Check
        if (offer.usage_limit !== null && offer.usage_limit > 0) {
            if (offer.total_redemptions >= offer.usage_limit) {
                return { reason: "usage_limit_reached", detail: "Total redemption limit for this promotion has been reached." };
            }
        }

        // 5. Per-Customer Usage Limit Check
        if (offer.per_customer_limit !== null && offer.per_customer_limit > 0) {
            const customerId = context.customer_id || context.customer_phone || context.customer_email;
            if (customerId) {
                const redemptions = await this.listOfferRedemptions({ offer_id: offer.id });
                const customerRedemptions = (redemptions as any[]).filter(
                    (r) => r.customer_id === customerId || (context.customer_phone && r.customer_phone === context.customer_phone)
                );
                if (customerRedemptions.length >= offer.per_customer_limit) {
                    return {
                        reason: "per_customer_limit_reached",
                        detail: `You have already used this coupon the maximum allowed times (${offer.per_customer_limit}).`,
                    };
                }
            }
        }

        // 6. Minimum Order Value Check
        if (offer.min_order_value > 0 && context.subtotal < offer.min_order_value) {
            return {
                reason: "min_order_not_met",
                detail: `Minimum cart value of ₹${offer.min_order_value} required (Current: ₹${context.subtotal}).`,
            };
        }

        // 7. Minimum Product Quantity Check
        const totalQty = (context.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
        if (offer.min_quantity && totalQty < offer.min_quantity) {
            return {
                reason: "min_quantity_not_met",
                detail: `Minimum ${offer.min_quantity} items required in cart.`,
            };
        }

        // 8. Branch Restrictions
        const allowedBranches = Array.isArray(offer.applicable_branches) ? offer.applicable_branches : null;
        if (allowedBranches && allowedBranches.length > 0 && !allowedBranches.includes("all")) {
            if (!context.branch_id || (!allowedBranches.includes(context.branch_id) && !allowedBranches.includes(context.branch_name || ""))) {
                return {
                    reason: "branch_restricted",
                    detail: `Coupon valid only at specific branches (${allowedBranches.join(", ")}).`,
                };
            }
        }

        // 9. City Restrictions
        const allowedCities = Array.isArray(offer.applicable_cities) ? offer.applicable_cities : null;
        if (allowedCities && allowedCities.length > 0 && !allowedCities.includes("all")) {
            if (!context.city || !allowedCities.map((c) => c.toLowerCase()).includes(context.city.toLowerCase())) {
                return {
                    reason: "city_restricted",
                    detail: `Coupon valid only in ${allowedCities.join(", ")}.`,
                };
            }
        }

        // 10. Pincode Whitelist / Blacklist
        const allowedPincodes = Array.isArray(offer.applicable_pincodes) ? offer.applicable_pincodes : null;
        if (allowedPincodes && allowedPincodes.length > 0 && !allowedPincodes.includes("all")) {
            if (!context.pincode || !allowedPincodes.includes(context.pincode)) {
                return {
                    reason: "pincode_restricted",
                    detail: `Coupon is not serviceable for pincode ${context.pincode || "unknown"}.`,
                };
            }
        }
        const excludedPincodes = Array.isArray(offer.excluded_pincodes) ? offer.excluded_pincodes : null;
        if (excludedPincodes && context.pincode && excludedPincodes.includes(context.pincode)) {
            return {
                reason: "pincode_excluded",
                detail: `Pincode ${context.pincode} is excluded from this promotion.`,
            };
        }

        // 11. Customer Tier & History Restrictions
        if (offer.customer_eligibility === "new_customers") {
            if (context.is_first_order === false || (context.order_count !== undefined && context.order_count > 0)) {
                return {
                    reason: "new_customer_only",
                    detail: "This coupon is exclusively available for first-time customers.",
                };
            }
        } else if (offer.customer_eligibility === "vip" && context.customer_tier !== "vip") {
            return {
                reason: "customer_tier_restricted",
                detail: "Exclusive promotion reserved for VIP Club members.",
            };
        }

        // 12. Allowed Customer Whitelist
        if (Array.isArray(offer.allowed_customer_ids) && offer.allowed_customer_ids.length > 0) {
            if (!context.customer_id || !offer.allowed_customer_ids.includes(context.customer_id)) {
                return { reason: "customer_not_whitelisted", detail: "Personalized coupon not assigned to this account." };
            }
        }
        if (Array.isArray(offer.allowed_phones) && offer.allowed_phones.length > 0) {
            if (!context.customer_phone || !offer.allowed_phones.includes(context.customer_phone)) {
                return { reason: "customer_not_whitelisted", detail: "Coupon not valid for this phone number." };
            }
        }

        // 13. Delivery Mode (delivery vs pickup)
        if (offer.delivery_mode && offer.delivery_mode !== "all") {
            if (context.delivery_type && context.delivery_type !== offer.delivery_mode) {
                return {
                    reason: "delivery_mode_restricted",
                    detail: `Valid only on ${offer.delivery_mode} orders.`,
                };
            }
        }

        // 14. Payment Method Gates
        if (Array.isArray(offer.allowed_payment_methods) && offer.allowed_payment_methods.length > 0) {
            if (context.payment_method && !offer.allowed_payment_methods.includes(context.payment_method.toLowerCase())) {
                return {
                    reason: "payment_method_restricted",
                    detail: `Valid only when paying with ${offer.allowed_payment_methods.join(", ")}.`,
                };
            }
        }

        // 15. Product & Category Restrictions
        const allowedProducts = Array.isArray(offer.applicable_products) ? offer.applicable_products : null;
        const allowedCategories = Array.isArray(offer.applicable_categories) ? offer.applicable_categories : null;
        if (allowedProducts || allowedCategories) {
            const hasMatchingItem = (context.items || []).some((item) => {
                if (allowedProducts && allowedProducts.includes(item.product_id)) return true;
                if (allowedCategories && item.category_id && allowedCategories.includes(item.category_id)) return true;
                return false;
            });
            if (!hasMatchingItem) {
                return {
                    reason: "product_restricted",
                    detail: "Cart does not contain qualifying products or categories for this offer.",
                };
            }
        }

        return null;
    }

    // ── Reward Resolution & Calculation ───────────────────────────────────────

    private resolveRewardForOffer(offer: OfferDTO, context: EvaluationContext): OfferReward | null {
        if (offer.rewards && offer.rewards.length > 0) {
            return offer.rewards[0];
        }

        // Synthesize reward from offer type and discount value
        if (offer.type === "percentage" || offer.type === "product_discount" || offer.type === "category_discount") {
            const pct = (offer.metadata as any)?.discount_value || (offer.metadata as any)?.amount || 10;
            return {
                reward_type: "cart_discount",
                amount_type: "percent",
                amount: Number(pct),
                cap: offer.max_discount_value || undefined,
            };
        }

        if (offer.type === "flat" || offer.type === "wallet_coupon") {
            const flat = (offer.metadata as any)?.discount_value || (offer.metadata as any)?.amount || 50;
            return {
                reward_type: "cart_discount",
                amount_type: "fixed",
                amount: Number(flat),
            };
        }

        if (offer.type === "free_delivery") {
            return {
                reward_type: "free_delivery",
                amount_type: "fixed",
                amount: 0,
            };
        }

        if (offer.type === "cashback_coupon") {
            return {
                reward_type: "wallet_cashback",
                amount_type: "percent",
                amount: 10,
            };
        }

        // Default fallback reward
        return {
            reward_type: "cart_discount",
            amount_type: "percent",
            amount: 10,
        };
    }

    private computeReward(
        offer: OfferDTO,
        reward: OfferReward,
        context: EvaluationContext
    ): {
        discount_amount: number;
        cashback_amount: number;
        loyalty_points: number;
        free_items: Array<{ product_id: string; quantity: number }>;
        free_delivery: boolean;
    } {
        let discount = 0;
        let cashback = 0;
        let points = 0;
        const freeItems: Array<{ product_id: string; quantity: number }> = [];
        let freeDelivery = false;

        switch (reward.reward_type) {
            case "cart_discount": {
                if (reward.amount_type === "percent") {
                    discount = Math.round((context.subtotal * reward.amount) / 100);
                    if (offer.max_discount_value && discount > offer.max_discount_value) {
                        discount = offer.max_discount_value;
                    }
                } else {
                    discount = Math.min(reward.amount, context.subtotal);
                }
                break;
            }
            case "line_discount": {
                const targetIds = reward.target_ids || [];
                const eligibleLines = context.items.filter((i) => targetIds.includes(i.product_id));
                const eligibleSubtotal = eligibleLines.reduce((s, i) => s + i.unit_price * i.quantity, 0);

                if (reward.amount_type === "percent") {
                    discount = Math.round((eligibleSubtotal * reward.amount) / 100);
                    if (offer.max_discount_value && discount > offer.max_discount_value) {
                        discount = offer.max_discount_value;
                    }
                } else {
                    discount = Math.min(reward.amount, eligibleSubtotal);
                }
                break;
            }
            case "free_delivery": {
                freeDelivery = true;
                discount = context.delivery_fee || 49;
                break;
            }
            case "wallet_cashback": {
                if (reward.amount_type === "percent") {
                    cashback = Math.round((context.subtotal * reward.amount) / 100);
                } else {
                    cashback = reward.amount;
                }
                break;
            }
            case "free_item": {
                if (reward.free_item_id) {
                    freeItems.push({
                        product_id: reward.free_item_id,
                        quantity: reward.free_item_quantity || 1,
                    });
                }
                break;
            }
        }

        return {
            discount_amount: discount,
            cashback_amount: cashback,
            loyalty_points: points,
            free_items: freeItems,
            free_delivery: freeDelivery,
        };
    }

    private applyStackingRules(applied: AppliedOffer[], rejected: RejectedOffer[]): AppliedOffer[] {
        if (applied.length === 0) return [];

        const nonStackable = applied.filter((a) => !a.offer.is_stackable);
        if (nonStackable.length > 0) {
            // Highest priority non-stackable offer takes precedence
            const winner = nonStackable[0];
            applied.slice(1).forEach((a) => {
                rejected.push({
                    offer_id: a.offer.id,
                    offer_name: a.offer.name,
                    offer_type: a.offer.type,
                    reason: "cannot_stack",
                    detail: `Cannot combine with exclusive offer "${winner.offer.name}".`,
                });
            });
            return [winner];
        }

        return applied;
    }

    private buildSummary(applied: AppliedOffer[]): EvaluationResult["summary"] {
        return {
            total_discount: applied.reduce((sum, a) => sum + a.discount_amount, 0),
            total_cashback: applied.reduce((sum, a) => sum + a.cashback_amount, 0),
            total_loyalty_points: applied.reduce((sum, a) => sum + a.loyalty_points, 0),
            free_items: applied.flatMap((a) => a.free_items),
            free_delivery: applied.some((a) => a.free_delivery),
            offers_applied: applied.length,
            offers_evaluated: applied.length,
        };
    }

    // ── Redemption Tracking & Analytics ───────────────────────────────────────

    async recordCouponRedemption(offerId: string, data: Partial<OfferRedemptionDTO>): Promise<any> {
        const redemption = await this.createOfferRedemptions([
            {
                offer_id: offerId,
                customer_id: data.customer_id || null,
                customer_phone: data.customer_phone || null,
                customer_email: data.customer_email || null,
                order_id: data.order_id || null,
                order_number: data.order_number || null,
                cart_id: data.cart_id || null,
                branch_id: data.branch_id || null,
                branch_name: data.branch_name || null,
                city: data.city || null,
                pincode: data.pincode || null,
                discount_amount: Number(data.discount_amount) || 0,
                order_total: Number(data.order_total) || 0,
                payment_method: data.payment_method || null,
                order_status: data.order_status || "completed",
                cashback_amount: Number(data.cashback_amount) || 0,
                loyalty_points: Number(data.loyalty_points) || 0,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            },
        ]);

        // Increment aggregate counters on Offer
        const existingOffer = await this.retrieveOffer(offerId).catch(() => null);
        if (existingOffer) {
            await this.updateOffers({
                selector: { id: offerId },
                data: {
                    total_redemptions: (Number(existingOffer.total_redemptions) || 0) + 1,
                    total_discount_given: (Number(existingOffer.total_discount_given) || 0) + (Number(data.discount_amount) || 0),
                    total_revenue_generated: (Number(existingOffer.total_revenue_generated) || 0) + (Number(data.order_total) || 0),
                },
            });
        }

        // Record Daily Metric
        const todayStr = new Date().toISOString().split("T")[0];
        const existingMetric = await this.listOfferDailyMetrics({ offer_id: offerId, metric_date: todayStr }).catch(() => []);
        if (existingMetric && existingMetric.length > 0) {
            const m = existingMetric[0];
            await this.updateOfferDailyMetrics({
                selector: { id: m.id },
                data: {
                    redemptions_count: (Number(m.redemptions_count) || 0) + 1,
                    revenue_generated: (Number(m.revenue_generated) || 0) + (Number(data.order_total) || 0),
                    discount_given: (Number(m.discount_given) || 0) + (Number(data.discount_amount) || 0),
                },
            });
        } else {
            await this.createOfferDailyMetrics([
                {
                    offer_id: offerId,
                    metric_date: todayStr,
                    redemptions_count: 1,
                    unique_customers_count: 1,
                    revenue_generated: Number(data.order_total) || 0,
                    discount_given: Number(data.discount_amount) || 0,
                    aov: Number(data.order_total) || 0,
                },
            ]);
        }

        return redemption[0];
    }

    // ── Analytics & Reporting API ─────────────────────────────────────────────

    async getCouponAnalyticsSummary(): Promise<CouponAnalyticsSummary> {
        const allOffers = await this.listOffers({});
        const redemptions = await this.listOfferRedemptions({});

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let activeCount = 0;
        let expiredCount = 0;
        let scheduledCount = 0;
        let totalRevenue = 0;
        let totalDiscount = 0;
        let usesToday = 0;
        let usesThisMonth = 0;

        allOffers.forEach((o: any) => {
            if (o.status === "active") activeCount++;
            else if (o.status === "expired") expiredCount++;
            else if (o.status === "scheduled") scheduledCount++;
            totalRevenue += Number(o.total_revenue_generated) || 0;
            totalDiscount += Number(o.total_discount_given) || 0;
        });

        if (totalRevenue === 0 && redemptions.length > 0) {
            totalRevenue = redemptions.reduce((s: number, r: any) => s + (Number(r.order_total) || 0), 0);
        }
        if (totalDiscount === 0 && redemptions.length > 0) {
            totalDiscount = redemptions.reduce((s: number, r: any) => s + (Number(r.discount_amount) || 0), 0);
        }

        const branchStats: Record<string, { name: string; redemptions: number; revenue: number; discount: number }> = {};
        const cityStats: Record<string, { redemptions: number; revenue: number }> = {};
        const couponRedemptions: Record<string, number> = {};

        redemptions.forEach((r: any) => {
            const rev = Number(r.order_total) || 0;
            const disc = Number(r.discount_amount) || 0;

            const rDate = new Date(r.created_at || now);
            if (rDate.toISOString().split("T")[0] === todayStr) usesToday++;
            if (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear) usesThisMonth++;

            couponRedemptions[r.offer_id] = (couponRedemptions[r.offer_id] || 0) + 1;

            if (r.branch_id || r.branch_name) {
                const bId = r.branch_id || r.branch_name;
                if (!branchStats[bId]) {
                    branchStats[bId] = { name: r.branch_name || bId, redemptions: 0, revenue: 0, discount: 0 };
                }
                branchStats[bId].redemptions++;
                branchStats[bId].revenue += rev;
                branchStats[bId].discount += disc;
            }

            if (r.city) {
                if (!cityStats[r.city]) cityStats[r.city] = { redemptions: 0, revenue: 0 };
                cityStats[r.city].redemptions++;
                cityStats[r.city].revenue += rev;
            }
        });

        // Top Coupon
        let topOffer: any = null;
        let maxRedemptions = 0;
        allOffers.forEach((o: any) => {
            const count = couponRedemptions[o.id] || Number(o.total_redemptions) || 0;
            if (count > maxRedemptions) {
                maxRedemptions = count;
                topOffer = o;
            }
        });

        const totalReds = redemptions.length;
        const avgDiscount = totalReds > 0 ? Math.round(totalDiscount / totalReds) : 0;
        const aov = totalReds > 0 ? Math.round(totalRevenue / totalReds) : 0;
        const roi = totalDiscount > 0 ? Math.round(((totalRevenue - totalDiscount) / totalDiscount) * 100) : 0;

        return {
            total_coupons: allOffers.length,
            active_coupons: activeCount,
            expired_coupons: expiredCount,
            scheduled_coupons: scheduledCount,
            total_redemptions: totalReds,
            total_revenue_generated: totalRevenue,
            total_discount_given: totalDiscount,
            average_discount: avgDiscount,
            average_order_value: aov,
            roi_percentage: roi,
            uses_today: usesToday,
            uses_this_month: usesThisMonth,
            top_coupon: topOffer
                ? {
                      id: topOffer.id,
                      code: topOffer.code || topOffer.name,
                      name: topOffer.name,
                      redemptions: maxRedemptions,
                      revenue: Number(topOffer.total_revenue_generated) || 0,
                  }
                : null,
            branch_performance: Object.entries(branchStats).map(([k, v]) => ({
                branch_id: k,
                branch_name: v.name,
                redemptions: v.redemptions,
                revenue: v.revenue,
                discount: v.discount,
            })),
            city_performance: Object.entries(cityStats).map(([k, v]) => ({
                city: k,
                redemptions: v.redemptions,
                revenue: v.revenue,
            })),
        };
    }

    // ── Audit Logging ─────────────────────────────────────────────────────────

    async logOfferAction(
        offerId: string,
        action: string,
        actorId?: string,
        actorEmail?: string,
        changes?: Record<string, unknown>,
        ip?: string
    ): Promise<any> {
        return this.createOfferAuditLogs([
            {
                offer_id: offerId,
                action,
                actor_id: actorId || "admin",
                actor_email: actorEmail || "admin@cakes2home.com",
                changes_json: changes ? JSON.stringify(changes) : null,
                ip_address: ip || "127.0.0.1",
            },
        ]);
    async recordRedemption(data: { offer_id: string; customer_id?: string; order_id?: string; discount_amount?: number; cashback_amount?: number }): Promise<any> {
        const redemptions = await this.createOfferRedemptions([
            {
                offer_id: data.offer_id,
                customer_id: data.customer_id || "cust_anon",
                order_id: data.order_id || "ord_anon",
                discount_amount: data.discount_amount || 0,
                cashback_amount: data.cashback_amount || 0,
            },
        ]);
        return redemptions[0];
    }

    async countRedemptions(offerId: string, customerId?: string): Promise<number> {
        const filters: any = { offer_id: offerId };
        if (customerId) filters.customer_id = customerId;
        const list = await this.listOfferRedemptions(filters);
        return list.length;
    }

    async getOfferStats(offerId: string): Promise<any> {
        const list = await this.listOfferRedemptions({ offer_id: offerId });
        const total_discount = list.reduce((acc: number, r: any) => acc + (Number(r.discount_amount) || 0), 0);
        const total_cashback = list.reduce((acc: number, r: any) => acc + (Number(r.cashback_amount) || 0), 0);
        return {
            total_redemptions: list.length,
            total_discount,
            total_cashback,
        };
    }
}

export default RulesModuleService;
