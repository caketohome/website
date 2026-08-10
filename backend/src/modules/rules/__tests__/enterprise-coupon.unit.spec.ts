import RulesModuleService from "../service";
import type { EvaluationContext } from "../types/common";

describe("Enterprise Coupon & Promotion Engine Unit Tests", () => {
    let service: any;
    let offerStore: any[];
    let redemptionStore: any[];
    let auditLogStore: any[];
    let dailyMetricStore: any[];

    beforeEach(() => {
        offerStore = [];
        redemptionStore = [];
        auditLogStore = [];
        dailyMetricStore = [];

        service = new (RulesModuleService as any)({}, {});

        // Mock Offer CRUD
        service.listOffers = jest.fn(async (sel: any) =>
            offerStore.filter((o) =>
                Object.entries(sel || {}).every(([k, v]) => o[k] === v)
            )
        );
        service.retrieveOffer = jest.fn(async (id: string) => {
            const found = offerStore.find((o) => o.id === id);
            if (!found) throw new Error(`Offer ${id} not found`);
            return found;
        });
        service.createOffers = jest.fn(async (arr: any[] | any) => {
            const toAdd = Array.isArray(arr) ? arr : [arr];
            const created = toAdd.map((o, idx) => ({
                id: o.id || `ofr_test_${offerStore.length + idx + 1}`,
                total_redemptions: 0,
                total_discount_given: 0,
                total_revenue_generated: 0,
                created_at: new Date(),
                updated_at: new Date(),
                ...o,
            }));
            offerStore.push(...created);
            return created;
        });
        service.updateOffers = jest.fn(async (args: any) => {
            const matches = offerStore.filter((o) =>
                Object.entries(args.selector).every(([k, v]) => o[k] === v)
            );
            matches.forEach((o) => Object.assign(o, args.data, { updated_at: new Date() }));
            return matches;
        });
        service.deleteOffers = jest.fn(async (ids: string[]) => {
            offerStore = offerStore.filter((o) => !ids.includes(o.id));
        });

        // Mock Redemptions
        service.listOfferRedemptions = jest.fn(async (sel: any) =>
            redemptionStore.filter((r) =>
                Object.entries(sel || {}).every(([k, v]) => r[k] === v)
            )
        );
        service.createOfferRedemptions = jest.fn(async (arr: any[]) => {
            const created = arr.map((r, idx) => ({
                id: `red_test_${redemptionStore.length + idx + 1}`,
                created_at: new Date(),
                ...r,
            }));
            redemptionStore.push(...created);
            return created;
        });

        // Mock Audit Logs
        service.listOfferAuditLogs = jest.fn(async (sel: any) =>
            auditLogStore.filter((l) =>
                Object.entries(sel || {}).every(([k, v]) => l[k] === v)
            )
        );
        service.createOfferAuditLogs = jest.fn(async (arr: any[]) => {
            const created = arr.map((l, idx) => ({
                id: `ofr_aud_test_${auditLogStore.length + idx + 1}`,
                created_at: new Date(),
                ...l,
            }));
            auditLogStore.push(...created);
            return created;
        });

        // Mock Daily Metrics
        service.listOfferDailyMetrics = jest.fn(async (sel: any) =>
            dailyMetricStore.filter((m) =>
                Object.entries(sel || {}).every(([k, v]) => m[k] === v)
            )
        );
        service.createOfferDailyMetrics = jest.fn(async (arr: any[]) => {
            const created = arr.map((m, idx) => ({
                id: `ofr_met_test_${dailyMetricStore.length + idx + 1}`,
                created_at: new Date(),
                ...m,
            }));
            dailyMetricStore.push(...created);
            return created;
        });
        service.updateOfferDailyMetrics = jest.fn(async (args: any) => {
            const matches = dailyMetricStore.filter((m) => m.id === args.selector.id);
            matches.forEach((m) => Object.assign(m, args.data));
            return matches;
        });
    });

    test("1. Successfully evaluates 50% discount with max cap limit", async () => {
        await service.createOffers({
            name: "Monsoon 50%",
            code: "CAKE50",
            type: "percentage",
            status: "active",
            min_order_value: 499,
            max_discount_value: 200,
            metadata: { discount_value: 50 },
        });

        const context: EvaluationContext = {
            subtotal: 1000,
            code: "CAKE50",
            items: [{ product_id: "prod_cake_01", quantity: 1, unit_price: 1000 }],
        };

        const result = await service.evaluate(context);
        expect(result.applied).toHaveLength(1);
        // 50% of 1000 is 500, but cap is 200
        expect(result.applied[0].discount_amount).toBe(200);
        expect(result.summary.total_discount).toBe(200);
    });

    test("2. Rejects coupon if cart subtotal is below minimum required order value", async () => {
        await service.createOffers({
            name: "Gourmet Flat 100",
            code: "CAKE100",
            type: "flat",
            status: "active",
            min_order_value: 599,
            metadata: { discount_value: 100 },
        });

        const context: EvaluationContext = {
            subtotal: 400, // below 599
            code: "CAKE100",
            items: [{ product_id: "prod_cupcake_01", quantity: 2, unit_price: 200 }],
        };

        const result = await service.evaluate(context);
        expect(result.applied).toHaveLength(0);
        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0].reason).toBe("min_order_not_met");
    });

    test("3. Rejects coupon if expired", async () => {
        await service.createOffers({
            name: "Expired Promo",
            code: "OLDPROMO",
            type: "percentage",
            status: "active",
            starts_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            ends_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // in past
            never_expires: false,
        });

        const context: EvaluationContext = {
            subtotal: 800,
            code: "OLDPROMO",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 800 }],
        };

        const result = await service.evaluate(context);
        expect(result.applied).toHaveLength(0);
        expect(result.rejected[0].reason).toBe("expired");
    });

    test("4. Rejects coupon if global usage limit has been reached", async () => {
        const [offer] = await service.createOffers({
            name: "Flash 50 Orders Only",
            code: "FLASH50",
            type: "flat",
            status: "active",
            usage_limit: 50,
            total_redemptions: 50, // reached cap
            metadata: { discount_value: 50 },
        });

        const context: EvaluationContext = {
            subtotal: 600,
            code: "FLASH50",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 600 }],
        };

        const result = await service.evaluate(context);
        expect(result.applied).toHaveLength(0);
        expect(result.rejected[0].reason).toBe("usage_limit_reached");
    });

    test("5. Rejects coupon if customer has exceeded per-customer limit", async () => {
        const [offer] = await service.createOffers({
            name: "One-Time Only Promo",
            code: "ONETIME",
            type: "flat",
            status: "active",
            per_customer_limit: 1,
            metadata: { discount_value: 50 },
        });

        // Insert existing redemption for customer
        await service.createOfferRedemptions([
            { offer_id: offer.id, customer_id: "cus_ananya_01", customer_phone: "+91 98765 43210" },
        ]);

        const context: EvaluationContext = {
            subtotal: 600,
            customer_id: "cus_ananya_01",
            code: "ONETIME",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 600 }],
        };

        const result = await service.evaluate(context);
        expect(result.applied).toHaveLength(0);
        expect(result.rejected[0].reason).toBe("per_customer_limit_reached");
    });

    test("6. Enforces branch restrictions (valid only at Kollam and Kottiyam)", async () => {
        await service.createOffers({
            name: "Kollam Special",
            code: "KOLLAM20",
            type: "percentage",
            status: "active",
            applicable_branches: ["br_kollam_01", "br_kottiyam_02"],
            metadata: { discount_value: 20 },
        });

        // Test with unauthorized branch (Bangalore)
        const rejectedContext: EvaluationContext = {
            subtotal: 700,
            branch_id: "br_bangalore_01",
            code: "KOLLAM20",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 700 }],
        };
        const rejectedRes = await service.evaluate(rejectedContext);
        expect(rejectedRes.applied).toHaveLength(0);
        expect(rejectedRes.rejected[0].reason).toBe("branch_restricted");

        // Test with authorized branch (Kollam)
        const allowedContext: EvaluationContext = {
            subtotal: 700,
            branch_id: "br_kollam_01",
            code: "KOLLAM20",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 700 }],
        };
        const allowedRes = await service.evaluate(allowedContext);
        expect(allowedRes.applied).toHaveLength(1);
    });

    test("7. Enforces pincode whitelist and blacklist rules", async () => {
        await service.createOffers({
            name: "Pincode Whitelist Offer",
            code: "PINCODE10",
            type: "flat",
            status: "active",
            applicable_pincodes: ["691001", "691002", "691003"],
            excluded_pincodes: ["691002"], // specifically blacklisted
            metadata: { discount_value: 50 },
        });

        // Test blacklisted pincode
        const blacklistedRes = await service.evaluate({
            subtotal: 500,
            pincode: "691002",
            code: "PINCODE10",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 500 }],
        });
        expect(blacklistedRes.rejected[0].reason).toBe("pincode_excluded");

        // Test whitelisted pincode
        const whitelistedRes = await service.evaluate({
            subtotal: 500,
            pincode: "691001",
            code: "PINCODE10",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 500 }],
        });
        expect(whitelistedRes.applied).toHaveLength(1);
    });

    test("8. Restricts exclusive VIP coupons to VIP tier customers", async () => {
        await service.createOffers({
            name: "VIP Platinum Club",
            code: "VIPCLUB",
            type: "percentage",
            status: "active",
            customer_eligibility: "vip",
            metadata: { discount_value: 20 },
        });

        // Guest / Regular user
        const regularRes = await service.evaluate({
            subtotal: 800,
            customer_tier: "regular",
            code: "VIPCLUB",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 800 }],
        });
        expect(regularRes.rejected[0].reason).toBe("customer_tier_restricted");

        // VIP member
        const vipRes = await service.evaluate({
            subtotal: 800,
            customer_tier: "vip",
            code: "VIPCLUB",
            items: [{ product_id: "prod_01", quantity: 1, unit_price: 800 }],
        });
        expect(vipRes.applied).toHaveLength(1);
    });

    test("9. Records redemptions, updates aggregates, and logs audit trail", async () => {
        const [offer] = await service.createOffers({
            name: "Redeemable Offer",
            code: "REDEEM10",
            type: "flat",
            status: "active",
            total_redemptions: 0,
            total_discount_given: 0,
            total_revenue_generated: 0,
            metadata: { discount_value: 50 },
        });

        await service.recordCouponRedemption(offer.id, {
            customer_id: "cus_101",
            customer_phone: "+91 98765 43210",
            order_id: "ord_999",
            order_number: "CTH-20260808-000999",
            branch_id: "br_kollam_01",
            branch_name: "Kollam Central",
            city: "Kollam",
            discount_amount: 50,
            order_total: 950,
            payment_method: "UPI",
        });

        expect(redemptionStore).toHaveLength(1);
        expect(redemptionStore[0].order_number).toBe("CTH-20260808-000999");

        const updatedOffer = await service.retrieveOffer(offer.id);
        expect(updatedOffer.total_redemptions).toBe(1);
        expect(updatedOffer.total_discount_given).toBe(50);
        expect(updatedOffer.total_revenue_generated).toBe(950);
    });

    test("10. Computes high-precision analytics summary with ROI and branch breakdown", async () => {
        await service.createOffers([
            { id: "ofr_1", name: "Promo 1", code: "P1", status: "active", total_redemptions: 10, total_discount_given: 1000, total_revenue_generated: 10000 },
            { id: "ofr_2", name: "Promo 2", code: "P2", status: "active", total_redemptions: 5, total_discount_given: 500, total_revenue_generated: 5000 },
        ]);

        await service.createOfferRedemptions([
            { offer_id: "ofr_1", branch_name: "Kollam Central", city: "Kollam", discount_amount: 100, order_total: 1000 },
            { offer_id: "ofr_2", branch_name: "Kochi Marine Drive", city: "Kochi", discount_amount: 100, order_total: 1000 },
        ]);

        const summary = await service.getCouponAnalyticsSummary();
        expect(summary.total_coupons).toBe(2);
        expect(summary.active_coupons).toBe(2);
        expect(summary.total_redemptions).toBe(2);
        expect(summary.total_revenue_generated).toBe(15000);
        expect(summary.total_discount_given).toBe(1500);
        expect(summary.roi_percentage).toBe(900); // (15000 - 1500) / 1500 * 100
        expect(summary.top_coupon?.code).toBe("P1");
    });
});
