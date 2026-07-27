/**
 * Unit tests for the Phase 9.2 Rules engine helpers — offer-type factories
 * (flash sale, combo discount, combo offer, free delivery, BOGO) and the
 * coupon bulk generator.
 *
 * These tests verify that each factory builds the canonical condition/reward
 * JSON shape and persists a standard M2 Offer row via createOffers(). They
 * also verify the existing evaluate() engine correctly evaluates the offers
 * produced by the factories (flash sale, BOGO, combo, free delivery).
 *
 * The MedusaService base class is mocked via Object.create + manual stubs,
 * mirroring the pattern used by the existing rules.unit.spec.ts.
 */

import RulesModuleService from "../service";
import "../helpers"; // attaches factory helpers to the prototype

// ─── Mock Setup ────────────────────────────────────────────────────────────────

function createMockService(
    offers: Record<string, unknown>[] = [],
    redemptions: Record<string, unknown>[] = []
): RulesModuleService {
    const service = Object.create(RulesModuleService.prototype) as any;

    service.listOffers = jest.fn(async (filters?: Record<string, unknown>) => {
        if (!filters || Object.keys(filters).length === 0) return offers;
        return offers.filter((o) => {
            for (const [key, val] of Object.entries(filters)) {
                if (o[key] !== val) return false;
            }
            return true;
        });
    });

    service.retrieveOffer = jest.fn(async (id: string) => {
        return offers.find((o) => o.id === id);
    });

    service.listOfferRedemptions = jest.fn(
        async (filters?: Record<string, unknown>) => {
            if (!filters) return redemptions;
            return redemptions.filter((r) => {
                for (const [key, val] of Object.entries(filters)) {
                    if (r[key] !== val) return false;
                }
                return true;
            });
        }
    );

    service.createOfferRedemptions = jest.fn(async () => {});
    service.updateOffers = jest.fn(async () => {});

    // createOffers mock — captures the data and returns a fake offer row.
    service.createOffers = jest.fn(async (data: any) => {
        const row = {
            id: `ofr_test_${offers.length + 1}`,
            total_redemptions: 0,
            created_at: new Date(),
            updated_at: new Date(),
            ...data,
        };
        offers.push(row);
        return row;
    });

    return service;
}

// ─── Factory tests ─────────────────────────────────────────────────────────────

describe("Rules engine helpers — offer-type factories", () => {
    describe("createFlashSaleOffer", () => {
        it("builds a flash sale offer with line_discount reward on target products", async () => {
            const service = createMockService();
            const offer = await service.createFlashSaleOffer({
                name: "Diwali Flash Sale",
                product_ids: ["prod_1", "prod_2"],
                discount_percent: 25,
                starts_at: "2026-10-01",
                ends_at: "2026-10-31",
            });

            expect(offer.type).toBe("flash_sale");
            expect(offer.status).toBe("scheduled");
            expect(offer.priority).toBe(100);
            expect(offer.is_stackable).toBe(false);
            expect(offer.is_public).toBe(true);

            const conditions = JSON.parse(offer.conditions);
            expect(conditions).toHaveLength(1);
            expect(conditions[0].entity).toBe("product");
            expect(conditions[0].field).toBe("id");
            expect(conditions[0].operator).toBe("in");
            expect(conditions[0].value).toEqual(["prod_1", "prod_2"]);

            const rewards = JSON.parse(offer.rewards);
            expect(rewards[0].reward_type).toBe("line_discount");
            expect(rewards[0].amount_type).toBe("percent");
            expect(rewards[0].amount).toBe(25);
            expect(rewards[0].target_ids).toEqual(["prod_1", "prod_2"]);
        });

        it("rejects flash sale with no products", async () => {
            const service = createMockService();
            await expect(
                service.createFlashSaleOffer({
                    name: "Bad",
                    product_ids: [],
                    discount_percent: 10,
                    starts_at: "2026-10-01",
                    ends_at: "2026-10-31",
                })
            ).rejects.toThrow("at least one product");
        });

        it("rejects flash sale with invalid discount percent", async () => {
            const service = createMockService();
            await expect(
                service.createFlashSaleOffer({
                    name: "Bad",
                    product_ids: ["prod_1"],
                    discount_percent: 150,
                    starts_at: "2026-10-01",
                    ends_at: "2026-10-31",
                })
            ).rejects.toThrow("between 0 and 100");
        });
    });

    describe("createComboDiscountOffer", () => {
        it("builds a combo discount with AND conditions across products", async () => {
            const service = createMockService();
            const offer = await service.createComboDiscountOffer({
                name: "Cake + Flowers Combo",
                product_ids: ["prod_cake", "prod_flowers"],
                discount_percent: 15,
            });

            expect(offer.type).toBe("combo");
            const conditions = JSON.parse(offer.conditions);
            expect(conditions).toHaveLength(2);
            expect(conditions[0].entity).toBe("product");
            expect(conditions[0].operator).toBe("eq");
            expect(conditions[1].value).toBe("prod_flowers");
        });

        it("rejects combo with fewer than 2 products", async () => {
            const service = createMockService();
            await expect(
                service.createComboDiscountOffer({
                    name: "Bad",
                    product_ids: ["prod_1"],
                    discount_percent: 10,
                })
            ).rejects.toThrow("at least 2 products");
        });

        it("rejects combo with no discount", async () => {
            const service = createMockService();
            await expect(
                service.createComboDiscountOffer({
                    name: "Bad",
                    product_ids: ["prod_1", "prod_2"],
                })
            ).rejects.toThrow("discount_percent or discount_fixed");
        });
    });

    describe("createComboOffer", () => {
        it("builds a combo offer with a free_item reward", async () => {
            const service = createMockService();
            const offer = await service.createComboOffer({
                name: "Buy Cake + Card → Get Chocolates Free",
                required_product_ids: ["prod_cake", "prod_card"],
                free_product_id: "prod_choc",
                free_quantity: 2,
            });

            expect(offer.type).toBe("combo");
            const rewards = JSON.parse(offer.rewards);
            expect(rewards[0].reward_type).toBe("free_item");
            expect(rewards[0].free_item_id).toBe("prod_choc");
            expect(rewards[0].free_item_quantity).toBe(2);
        });
    });

    describe("createFreeDeliveryOffer", () => {
        it("builds a free delivery offer with optional min subtotal condition", async () => {
            const service = createMockService();
            const offer = await service.createFreeDeliveryOffer({
                name: "Free Delivery over ₹500",
                min_subtotal: 500,
            });

            expect(offer.type).toBe("free_delivery");
            expect(offer.is_stackable).toBe(true);
            const conditions = JSON.parse(offer.conditions);
            expect(conditions[0].entity).toBe("cart");
            expect(conditions[0].field).toBe("subtotal");
            expect(conditions[0].operator).toBe("gte");
            expect(conditions[0].value).toBe(500);

            const rewards = JSON.parse(offer.rewards);
            expect(rewards[0].reward_type).toBe("free_delivery");
        });

        it("builds a free delivery offer with no min subtotal (no conditions)", async () => {
            const service = createMockService();
            const offer = await service.createFreeDeliveryOffer({
                name: "Always Free Delivery",
            });
            expect(offer.conditions).toBeNull();
        });
    });

    describe("createBuyXGetYOffer", () => {
        it("builds a BOGO offer with free_item reward when get_discount_percent=100", async () => {
            const service = createMockService();
            const offer = await service.createBuyXGetYOffer({
                name: "Buy 2 Get 1 Free",
                buy_product_id: "prod_cake",
                buy_quantity: 2,
                get_product_id: "prod_cupcake",
                get_quantity: 1,
            });

            expect(offer.type).toBe("buy_x_get_y");
            const conditions = JSON.parse(offer.conditions);
            expect(conditions).toHaveLength(2);
            expect(conditions[0].field).toBe("quantity");
            expect(conditions[0].operator).toBe("gte");
            expect(conditions[0].value).toEqual(["prod_cake", 2]);

            const rewards = JSON.parse(offer.rewards);
            expect(rewards[0].reward_type).toBe("free_item");
            expect(rewards[0].free_item_id).toBe("prod_cupcake");
            expect(rewards[0].free_item_quantity).toBe(1);
        });

        it("builds a BOGO offer with line_discount reward when get_discount_percent<100", async () => {
            const service = createMockService();
            const offer = await service.createBuyXGetYOffer({
                name: "Buy 2 Get 50% off 1",
                buy_product_id: "prod_cake",
                buy_quantity: 2,
                get_product_id: "prod_cupcake",
                get_quantity: 1,
                get_discount_percent: 50,
            });

            const rewards = JSON.parse(offer.rewards);
            expect(rewards[0].reward_type).toBe("line_discount");
            expect(rewards[0].amount).toBe(50);
            expect(rewards[0].target_ids).toEqual(["prod_cupcake"]);
        });

        it("rejects BOGO with invalid quantities", async () => {
            const service = createMockService();
            await expect(
                service.createBuyXGetYOffer({
                    name: "Bad",
                    buy_product_id: "p",
                    buy_quantity: 0,
                    get_product_id: "g",
                    get_quantity: 1,
                })
            ).rejects.toThrow("buy_quantity ≥ 1 and get_quantity ≥ 1");
        });
    });
});

// ─── Bulk coupon generator tests ──────────────────────────────────────────────

describe("Rules engine helpers — bulkGenerateCoupons", () => {
    it("generates N unique coupon codes backed by N Offer rows", async () => {
        const service = createMockService();
        const offers = await service.bulkGenerateCoupons({
            count: 5,
            prefix: "CAKE",
            name_prefix: "Diwali",
            type: "coupon",
            discount_percent: 10,
            usage_limit: 1,
        });

        expect(offers).toHaveLength(5);
        const codes = offers.map((o: any) => o.code);
        expect(new Set(codes).size).toBe(5); // all unique
        expect(codes.every((c: string) => c.startsWith("CAKE"))).toBe(true);
        expect(offers.every((o: any) => o.type === "coupon")).toBe(true);
        expect(offers.every((o: any) => o.is_public === false)).toBe(true); // coupons are code-gated
        expect(offers.every((o: any) => o.usage_limit === 1)).toBe(true);

        const rewards = JSON.parse(offers[0].rewards);
        expect(rewards[0].reward_type).toBe("cart_discount");
        expect(rewards[0].amount_type).toBe("percent");
        expect(rewards[0].amount).toBe(10);
    });

    it("rejects count outside 1..10000", async () => {
        const service = createMockService();
        await expect(
            service.bulkGenerateCoupons({
                count: 0,
                prefix: "X",
                name_prefix: "Y",
                type: "coupon",
                discount_percent: 10,
            })
        ).rejects.toThrow("between 1 and 10000");
    });

    it("rejects bulk generation with no discount", async () => {
        const service = createMockService();
        await expect(
            service.bulkGenerateCoupons({
                count: 10,
                prefix: "X",
                name_prefix: "Y",
                type: "coupon",
            })
        ).rejects.toThrow("discount_percent or discount_fixed");
    });
});

// ─── Evaluation integration tests ──────────────────────────────────────────────
// Verify the existing evaluate() engine correctly evaluates offers produced
// by the factories. This proves the factories integrate with the engine
// rather than introducing a second promotion path.

describe("Rules engine helpers — evaluate() integration", () => {
    it("evaluates a flash sale offer and applies the line discount", async () => {
        const service = createMockService();
        await service.createFlashSaleOffer({
            name: "Flash",
            product_ids: ["prod_1"],
            discount_percent: 30,
            starts_at: new Date(Date.now() - 60000).toISOString(),
            ends_at: new Date(Date.now() + 60000).toISOString(),
        });
        // Manually flip to active (factory sets status=scheduled)
        (service as any).listOffers = jest.fn(async () => {
            const all = (service as any).createOffers.mock.calls.map(
                (c: any[]) => c[0]
            );
            return all.map((o: any) => ({ ...o, status: "active" }));
        });

        const result = await service.evaluate({
            subtotal: 1000,
            items: [
                { product_id: "prod_1", variant_id: "v1", quantity: 1, unit_price: 1000 },
            ],
        });

        expect(result.applied).toHaveLength(1);
        expect(result.applied[0].discount_amount).toBe(300); // 30% of 1000
    });

    it("evaluates a free delivery offer and sets free_delivery=true", async () => {
        const service = createMockService();
        await service.createFreeDeliveryOffer({
            name: "Free Delivery",
            min_subtotal: 500,
        });
        (service as any).listOffers = jest.fn(async () => {
            const all = (service as any).createOffers.mock.calls.map(
                (c: any[]) => c[0]
            );
            return all.map((o: any) => ({ ...o, status: "active" }));
        });

        const result = await service.evaluate({
            subtotal: 1000,
            items: [
                { product_id: "p", variant_id: "v", quantity: 1, unit_price: 1000 },
            ],
            delivery_fee: 50,
        });

        expect(result.applied).toHaveLength(1);
        expect(result.applied[0].free_delivery).toBe(true);
        expect(result.summary.free_delivery).toBe(true);
    });

    it("evaluates a BOGO offer and grants the free item when buy quantity met", async () => {
        const service = createMockService();
        await service.createBuyXGetYOffer({
            name: "BOGO",
            buy_product_id: "prod_a",
            buy_quantity: 2,
            get_product_id: "prod_b",
            get_quantity: 1,
        });
        (service as any).listOffers = jest.fn(async () => {
            const all = (service as any).createOffers.mock.calls.map(
                (c: any[]) => c[0]
            );
            return all.map((o: any) => ({ ...o, status: "active" }));
        });

        const result = await service.evaluate({
            subtotal: 600,
            items: [
                { product_id: "prod_a", variant_id: "v1", quantity: 2, unit_price: 300 },
                { product_id: "prod_b", variant_id: "v2", quantity: 1, unit_price: 100 },
            ],
        });

        expect(result.applied).toHaveLength(1);
        expect(result.applied[0].free_items).toEqual([
            { product_id: "prod_b", quantity: 1 },
        ]);
    });

    it("does not apply BOGO when buy quantity not met", async () => {
        const service = createMockService();
        await service.createBuyXGetYOffer({
            name: "BOGO",
            buy_product_id: "prod_a",
            buy_quantity: 2,
            get_product_id: "prod_b",
            get_quantity: 1,
        });
        (service as any).listOffers = jest.fn(async () => {
            const all = (service as any).createOffers.mock.calls.map(
                (c: any[]) => c[0]
            );
            return all.map((o: any) => ({ ...o, status: "active" }));
        });

        const result = await service.evaluate({
            subtotal: 300,
            items: [
                { product_id: "prod_a", variant_id: "v1", quantity: 1, unit_price: 300 },
            ],
        });

        expect(result.applied).toHaveLength(0);
        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0].reason).toBe("conditions_not_met");
    });

    it("evaluates a combo discount offer and applies the discount", async () => {
        const service = createMockService();
        await service.createComboDiscountOffer({
            name: "Combo Promo",
            product_ids: ["prod_a", "prod_b"],
            discount_percent: 15,
        });
        (service as any).listOffers = jest.fn(async () => {
            const all = (service as any).createOffers.mock.calls.map(
                (c: any[]) => c[0]
            );
            return all.map((o: any) => ({ ...o, status: "active" }));
        });

        const result = await service.evaluate({
            subtotal: 500,
            items: [
                { product_id: "prod_a", variant_id: "v1", quantity: 1, unit_price: 300 },
                { product_id: "prod_b", variant_id: "v2", quantity: 1, unit_price: 200 },
            ],
        });

        expect(result.applied).toHaveLength(1);
        expect(result.applied[0].discount_amount).toBe(75); // 15% of 500
    });

    it("evaluates a combo offer (free gift) when required products are in cart", async () => {
        const service = createMockService();
        await service.createComboOffer({
            name: "Combo Free Gift",
            required_product_ids: ["prod_a", "prod_b"],
            free_product_id: "gift_c",
            free_quantity: 1,
        });
        (service as any).listOffers = jest.fn(async () => {
            const all = (service as any).createOffers.mock.calls.map(
                (c: any[]) => c[0]
            );
            return all.map((o: any) => ({ ...o, status: "active" }));
        });

        const result = await service.evaluate({
            subtotal: 500,
            items: [
                { product_id: "prod_a", variant_id: "v1", quantity: 1, unit_price: 300 },
                { product_id: "prod_b", variant_id: "v2", quantity: 1, unit_price: 200 },
            ],
        });

        expect(result.applied).toHaveLength(1);
        expect(result.applied[0].free_items).toEqual([
            { product_id: "gift_c", quantity: 1 },
        ]);
    });

    it("evaluates bulk generated coupons and applies the coupon discount when valid code is entered", async () => {
        const service = createMockService();
        const coupons = await service.bulkGenerateCoupons({
            count: 3,
            prefix: "TEST",
            name_prefix: "Test Bulk Coupon",
            type: "coupon",
            discount_percent: 20,
        });
        expect(coupons).toHaveLength(3);

        const targetCode = coupons[0].code;

        (service as any).listOffers = jest.fn(async () => {
            const all = (service as any).createOffers.mock.calls.map(
                (c: any[]) => c[0]
            );
            return all.map((o: any) => ({ ...o, status: "active" }));
        });

        const result = await service.evaluate({
            subtotal: 1000,
            items: [
                { product_id: "prod_x", variant_id: "vx", quantity: 1, unit_price: 1000 },
            ],
            code: targetCode,
        });

        expect(result.applied).toHaveLength(1);
        expect(result.applied[0].discount_amount).toBe(200); // 20% of 1000
    });
});
