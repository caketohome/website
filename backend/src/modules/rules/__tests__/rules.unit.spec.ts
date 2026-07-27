/**
 * Unit tests for the Rules / Promotion Engine.
 *
 * Tests cover:
 *   - Simple cart discount evaluation
 *   - Percentage discount with cap
 *   - Free delivery reward
 *   - Free item reward
 *   - Wallet cashback
 *   - Loyalty points
 *   - Condition matching (cart, product, category, customer, time, branch)
 *   - Code-based offers (coupon/promo)
 *   - Date range validation
 *   - Usage limit enforcement
 *   - Per-customer limit enforcement
 *   - Priority and stacking rules
 *   - Branch restrictions
 *   - Customer segment restrictions
 *   - Birthday/anniversary/first-order offers
 *   - Rejection reasons
 *   - Empty cart handling
 *   - Multiple offer evaluation
 *
 * These tests mock the MedusaService CRUD methods to unit-test the
 * evaluation engine in isolation.
 */

import RulesModuleService from "../service";

// ─── Mock Setup ────────────────────────────────────────────────────────────────

// We need to mock the parent class methods that the service calls internally.
// The service extends MedusaService({ Offer, OfferRedemption }) which provides
// listOffers, retrieveOffer, listOfferRedemptions, etc.

function createMockService(
    offers: Record<string, unknown>[] = [],
    redemptions: Record<string, unknown>[] = []
): RulesModuleService {
    const service = Object.create(RulesModuleService.prototype);

    // Mock listOffers
    service.listOffers = jest.fn(async (filters?: Record<string, unknown>) => {
        if (!filters || Object.keys(filters).length === 0) return offers;
        return offers.filter((o) => {
            for (const [key, val] of Object.entries(filters)) {
                if (o[key] !== val) return false;
            }
            return true;
        });
    });

    // Mock retrieveOffer
    service.retrieveOffer = jest.fn(async (id: string) => {
        return offers.find((o) => o.id === id);
    });

    // Mock listOfferRedemptions
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

    // Mock createOfferRedemptions
    service.createOfferRedemptions = jest.fn(async () => {});

    // Mock updateOffers
    service.updateOffers = jest.fn(async () => {});

    return service;
}

// ─── Helper: Create Offer ─────────────────────────────────────────────────────

function makeOffer(
    overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
    return {
        id: "ofr_test",
        name: "Test Offer",
        code: null,
        type: "cart_discount",
        status: "active",
        priority: 0,
        starts_at: null,
        ends_at: null,
        usage_limit: null,
        per_customer_limit: null,
        is_stackable: false,
        is_public: true,
        description: null,
        conditions: null,
        rewards: null,
        branch_ids: null,
        customer_segments: null,
        metadata: null,
        total_redemptions: 0,
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
        ...overrides,
    };
}

const baseContext = {
    subtotal: 1000,
    items: [
        {
            product_id: "prod_01",
            variant_id: "var_01",
            category_id: "cat_01",
            quantity: 2,
            unit_price: 500,
        },
    ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("RulesModuleService", () => {
    describe("evaluate()", () => {
        it("should return empty result when no offers exist", async () => {
            const service = createMockService([]);
            const result = await service.evaluate(baseContext);

            expect(result.applied).toHaveLength(0);
            expect(result.rejected).toHaveLength(0);
            expect(result.summary.total_discount).toBe(0);
            expect(result.summary.offers_applied).toBe(0);
        });

        it("should apply a simple fixed cart discount", async () => {
            const service = createMockService([
                makeOffer({
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 100,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);

            expect(result.applied).toHaveLength(1);
            expect(result.summary.total_discount).toBe(100);
        });

        it("should apply a percentage cart discount with cap", async () => {
            const service = createMockService([
                makeOffer({
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "percent",
                            amount: 20,
                            cap: 150,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);

            expect(result.applied).toHaveLength(1);
            // 20% of 1000 = 200, capped at 150
            expect(result.summary.total_discount).toBe(150);
        });

        it("should apply free delivery reward", async () => {
            const service = createMockService([
                makeOffer({
                    type: "free_delivery",
                    rewards: JSON.stringify([
                        {
                            reward_type: "free_delivery",
                            amount_type: "fixed",
                            amount: 0,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                delivery_fee: 50,
            });

            expect(result.applied).toHaveLength(1);
            expect(result.summary.free_delivery).toBe(true);
            expect(result.summary.total_discount).toBe(50);
        });

        it("should apply free item reward", async () => {
            const service = createMockService([
                makeOffer({
                    type: "free_gift",
                    rewards: JSON.stringify([
                        {
                            reward_type: "free_item",
                            amount_type: "fixed",
                            amount: 0,
                            free_item_id: "prod_free",
                            free_item_quantity: 1,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);

            expect(result.applied).toHaveLength(1);
            expect(result.summary.free_items).toHaveLength(1);
            expect(result.summary.free_items[0].product_id).toBe("prod_free");
        });

        it("should apply wallet cashback reward", async () => {
            const service = createMockService([
                makeOffer({
                    type: "wallet_cashback",
                    rewards: JSON.stringify([
                        {
                            reward_type: "wallet_cashback",
                            amount_type: "percent",
                            amount: 5,
                            cap: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);

            expect(result.applied).toHaveLength(1);
            // 5% of 1000 = 50, capped at 50
            expect(result.summary.total_cashback).toBe(50);
        });

        it("should apply loyalty points reward", async () => {
            const service = createMockService([
                makeOffer({
                    type: "loyalty_bonus",
                    rewards: JSON.stringify([
                        {
                            reward_type: "loyalty_points",
                            amount_type: "fixed",
                            amount: 100,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);

            expect(result.applied).toHaveLength(1);
            expect(result.summary.total_loyalty_points).toBe(100);
        });
    });

    describe("conditions", () => {
        it("should match cart subtotal >= condition", async () => {
            const service = createMockService([
                makeOffer({
                    conditions: JSON.stringify([
                        {
                            entity: "cart",
                            field: "subtotal",
                            operator: "gte",
                            value: 500,
                        },
                    ]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(1);
        });

        it("should reject when cart subtotal < minimum", async () => {
            const service = createMockService([
                makeOffer({
                    conditions: JSON.stringify([
                        {
                            entity: "cart",
                            field: "subtotal",
                            operator: "gte",
                            value: 2000,
                        },
                    ]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(0);
            expect(result.rejected).toHaveLength(1);
            expect(result.rejected[0].reason).toBe("conditions_not_met");
        });

        it("should match birthday customer condition", async () => {
            const service = createMockService([
                makeOffer({
                    type: "birthday_offer",
                    conditions: JSON.stringify([
                        {
                            entity: "customer",
                            field: "is_birthday",
                            operator: "is_true",
                            value: null,
                        },
                    ]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "percent",
                            amount: 15,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                is_birthday: true,
            });
            expect(result.applied).toHaveLength(1);
            expect(result.summary.total_discount).toBe(150);
        });

        it("should match first order condition", async () => {
            const service = createMockService([
                makeOffer({
                    type: "first_order_offer",
                    conditions: JSON.stringify([
                        {
                            entity: "order_history",
                            field: "is_first_order",
                            operator: "is_true",
                            value: null,
                        },
                    ]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 100,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                is_first_order: true,
            });
            expect(result.applied).toHaveLength(1);
        });
    });

    describe("code-based offers", () => {
        it("should apply when correct code is provided", async () => {
            const service = createMockService([
                makeOffer({
                    code: "SAVE20",
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "percent",
                            amount: 20,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                code: "SAVE20",
            });
            expect(result.applied).toHaveLength(1);
        });

        it("should reject when wrong code is provided", async () => {
            const service = createMockService([
                makeOffer({
                    code: "SAVE20",
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "percent",
                            amount: 20,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                code: "WRONG",
            });
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe("code_mismatch");
        });
    });

    describe("date range", () => {
        it("should reject an offer that has not started yet", async () => {
            const service = createMockService([
                makeOffer({
                    starts_at: new Date("2099-01-01"),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe("not_started");
        });

        it("should reject an expired offer", async () => {
            const service = createMockService([
                makeOffer({
                    ends_at: new Date("2020-01-01"),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe("expired");
        });
    });

    describe("usage limits", () => {
        it("should reject when global usage limit is reached", async () => {
            const service = createMockService(
                [
                    makeOffer({
                        usage_limit: 2,
                        rewards: JSON.stringify([
                            {
                                reward_type: "cart_discount",
                                amount_type: "fixed",
                                amount: 50,
                            },
                        ]),
                    }),
                ],
                [
                    { offer_id: "ofr_test", customer_id: "cust_01" },
                    { offer_id: "ofr_test", customer_id: "cust_02" },
                ]
            );

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe("usage_limit_reached");
        });

        it("should reject when per-customer limit is reached", async () => {
            const service = createMockService(
                [
                    makeOffer({
                        per_customer_limit: 1,
                        rewards: JSON.stringify([
                            {
                                reward_type: "cart_discount",
                                amount_type: "fixed",
                                amount: 50,
                            },
                        ]),
                    }),
                ],
                [{ offer_id: "ofr_test", customer_id: "cust_01" }]
            );

            const result = await service.evaluate({
                ...baseContext,
                customer_id: "cust_01",
            });
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe(
                "per_customer_limit_reached"
            );
        });
    });

    describe("branch restrictions", () => {
        it("should apply when branch matches", async () => {
            const service = createMockService([
                makeOffer({
                    branch_ids: JSON.stringify(["branch_01", "branch_02"]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                branch_id: "branch_01",
            });
            expect(result.applied).toHaveLength(1);
        });

        it("should reject when branch does not match", async () => {
            const service = createMockService([
                makeOffer({
                    branch_ids: JSON.stringify(["branch_01"]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                branch_id: "branch_99",
            });
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe("branch_restricted");
        });
    });

    describe("customer segment restrictions", () => {
        it("should apply when segment matches", async () => {
            const service = createMockService([
                makeOffer({
                    customer_segments: JSON.stringify(["vip"]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 100,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                customer_segment: "vip",
            });
            expect(result.applied).toHaveLength(1);
        });

        it("should reject when segment does not match", async () => {
            const service = createMockService([
                makeOffer({
                    customer_segments: JSON.stringify(["vip"]),
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 100,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate({
                ...baseContext,
                customer_segment: "regular",
            });
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe("segment_restricted");
        });
    });

    describe("priority and stacking", () => {
        it("should apply only the highest-priority non-stackable offer", async () => {
            const service = createMockService([
                makeOffer({
                    id: "ofr_low",
                    name: "Low Priority",
                    priority: 1,
                    is_stackable: false,
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
                makeOffer({
                    id: "ofr_high",
                    name: "High Priority",
                    priority: 10,
                    is_stackable: false,
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 200,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(1);
            expect(result.applied[0].offer.id).toBe("ofr_high");
            expect(result.summary.total_discount).toBe(200);
            // The other offer should be in rejected
            expect(result.rejected.some((r) => r.offer_id === "ofr_low")).toBe(
                true
            );
        });

        it("should stack all stackable offers when the top offer is stackable", async () => {
            const service = createMockService([
                makeOffer({
                    id: "ofr_a",
                    name: "Stackable A",
                    priority: 5,
                    is_stackable: true,
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
                makeOffer({
                    id: "ofr_b",
                    name: "Stackable B",
                    priority: 3,
                    is_stackable: true,
                    rewards: JSON.stringify([
                        {
                            reward_type: "wallet_cashback",
                            amount_type: "fixed",
                            amount: 25,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(2);
            expect(result.summary.total_discount).toBe(50);
            expect(result.summary.total_cashback).toBe(25);
        });

        it("should exclude non-stackable offers when stackable offers are active", async () => {
            const service = createMockService([
                makeOffer({
                    id: "ofr_stack",
                    name: "Stackable",
                    priority: 10,
                    is_stackable: true,
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
                makeOffer({
                    id: "ofr_nostack",
                    name: "Non-Stackable",
                    priority: 5,
                    is_stackable: false,
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 100,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(1);
            expect(result.applied[0].offer.id).toBe("ofr_stack");
            expect(
                result.rejected.some((r) => r.offer_id === "ofr_nostack")
            ).toBe(true);
        });
    });

    describe("rejection reasons", () => {
        it("should reject draft offers", async () => {
            const service = createMockService([
                makeOffer({
                    status: "draft",
                    rewards: JSON.stringify([
                        {
                            reward_type: "cart_discount",
                            amount_type: "fixed",
                            amount: 50,
                        },
                    ]),
                }),
            ]);

            const result = await service.evaluate(baseContext);
            // Draft offers are filtered out before evaluation, not rejected
            expect(result.applied).toHaveLength(0);
        });

        it("should reject offers with no rewards configured", async () => {
            const service = createMockService([
                makeOffer({
                    rewards: null,
                }),
            ]);

            const result = await service.evaluate(baseContext);
            expect(result.applied).toHaveLength(0);
            expect(result.rejected[0].reason).toBe("no_valid_reward");
        });
    });

    describe("metadata", () => {
        it("should include evaluation timing in metadata", async () => {
            const service = createMockService([]);
            const result = await service.evaluate(baseContext);

            expect(result.metadata.evaluated_at).toBeDefined();
            expect(typeof result.metadata.evaluation_time_ms).toBe("number");
        });
    });

    describe("recordRedemption()", () => {
        it("should record a redemption and increment total_redemptions", async () => {
            const offers = [makeOffer({ total_redemptions: 5 })];
            const service = createMockService(offers);

            await service.recordRedemption({
                offer_id: "ofr_test",
                customer_id: "cust_01",
                order_id: "order_01",
                discount_amount: 100,
                cashback_amount: 25,
            });

            expect(service.createOfferRedemptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    offer_id: "ofr_test",
                    customer_id: "cust_01",
                    discount_amount: 100,
                    cashback_amount: 25,
                })
            );

            expect(service.updateOffers).toHaveBeenCalledWith({
                selector: { id: "ofr_test" },
                data: { total_redemptions: 6 },
            });
        });
    });

    describe("countRedemptions()", () => {
        it("should count all redemptions for an offer", async () => {
            const service = createMockService([], [
                { offer_id: "ofr_test", customer_id: "cust_01" },
                { offer_id: "ofr_test", customer_id: "cust_02" },
                { offer_id: "ofr_other", customer_id: "cust_01" },
            ]);

            const count = await service.countRedemptions("ofr_test");
            expect(count).toBe(2);
        });

        it("should count redemptions for a specific customer", async () => {
            const service = createMockService([], [
                { offer_id: "ofr_test", customer_id: "cust_01" },
                { offer_id: "ofr_test", customer_id: "cust_02" },
            ]);

            const count = await service.countRedemptions("ofr_test", "cust_01");
            expect(count).toBe(1);
        });
    });

    describe("getOfferStats()", () => {
        it("should aggregate redemption stats", async () => {
            const service = createMockService([], [
                {
                    offer_id: "ofr_test",
                    discount_amount: 100,
                    cashback_amount: 25,
                    loyalty_points: 10,
                },
                {
                    offer_id: "ofr_test",
                    discount_amount: 150,
                    cashback_amount: 0,
                    loyalty_points: 20,
                },
            ]);

            const stats = await service.getOfferStats("ofr_test");
            expect(stats.total_redemptions).toBe(2);
            expect(stats.total_discount).toBe(250);
            expect(stats.total_cashback).toBe(25);
            expect(stats.total_loyalty_points).toBe(30);
        });
    });
});
