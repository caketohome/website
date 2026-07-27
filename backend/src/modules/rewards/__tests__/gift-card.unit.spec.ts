import RewardsModuleService from "../service";
import RewardsPaymentService from "../payment";

function createMockService() {
  const service = Object.create(RewardsModuleService.prototype) as RewardsModuleService;

  const giftCardStore: any[] = [];
  const transactionStore: any[] = [];

  const mocks: any = {
    listGiftCards: jest.fn(async (selector: any) => {
      return giftCardStore.filter((g) =>
        Object.entries(selector).every(([k, v]) => g[k] === v)
      );
    }),
    retrieveGiftCard: jest.fn(async (id: string) => {
      return giftCardStore.find((g) => g.id === id);
    }),
    createGiftCards: jest.fn(async (data: any[]) => {
      const created = data.map((g, idx) => ({
        id: `rw_gc_${giftCardStore.length + idx + 1}`,
        initial_balance: g.initial_balance,
        current_balance: g.current_balance,
        currency_code: g.currency_code || "INR",
        is_active: g.is_active ?? true,
        status: g.status || "active",
        expires_at: g.expires_at || null,
        code: g.code,
      }));
      giftCardStore.push(...created);
      return created;
    }),
    updateGiftCards: jest.fn(async (args: any) => {
      const records = giftCardStore.filter((g) =>
        Object.entries(args.selector).every(([k, v]) => g[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listGiftCardTransactions: jest.fn(async (selector: any) => {
      return transactionStore.filter((t) =>
        Object.entries(selector).every(([k, v]) => t[k] === v)
      );
    }),
    createGiftCardTransactions: jest.fn(async (data: any[]) => {
      const created = data.map((t, idx) => ({
        id: `rw_gctx_${transactionStore.length + idx + 1}`,
        created_at: new Date(),
        ...t,
      }));
      transactionStore.push(...created);
      return created;
    }),
  };

  Object.assign(service, mocks);
  (service as any).locks = new Map();

  return { service, giftCardStore, transactionStore };
}

describe("Rewards Module - Gift Cards Unit Tests", () => {
  it("should create, validate, and retrieve a gift card", async () => {
    const { service, giftCardStore } = createMockService();

    const [giftCard] = await service.createGiftCards([
      { code: "FREECAKE", initial_balance: 5000, current_balance: 5000 }
    ]);
    expect(giftCard.code).toBe("FREECAKE");
    expect(giftCardStore.length).toBe(1);

    const validated = await service.validateGiftCard("FREECAKE");
    expect(validated.id).toBe(giftCard.id);
    expect(validated.current_balance).toBe(5000);
  });

  it("should reject validation of disabled gift cards", async () => {
    const { service } = createMockService();
    await service.createGiftCards([
      { code: "DISABLED_CARD", initial_balance: 5000, current_balance: 5000, is_active: false, status: "disabled" }
    ]);

    await expect(service.validateGiftCard("DISABLED_CARD")).rejects.toThrow("GIFT_CARD_INACTIVE_OR_DISABLED");
  });

  it("should auto-expire and reject validation of expired gift cards", async () => {
    const { service, giftCardStore } = createMockService();
    const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
    await service.createGiftCards([
      { code: "EXPIRED_CARD", initial_balance: 5000, current_balance: 5000, expires_at: pastDate }
    ]);

    await expect(service.validateGiftCard("EXPIRED_CARD")).rejects.toThrow("GIFT_CARD_EXPIRED");
    expect(giftCardStore[0].status).toBe("expired");
    expect(giftCardStore[0].is_active).toBe(false);
  });

  it("should check currency codes during validation", async () => {
    const { service } = createMockService();
    await service.createGiftCards([
      { code: "USD_CARD", initial_balance: 1000, current_balance: 1000, currency_code: "USD" }
    ]);

    await expect(service.validateGiftCard("USD_CARD", "INR")).rejects.toThrow("GIFT_CARD_CURRENCY_MISMATCH");
  });

  it("should redeem partially and write transaction ledger entries", async () => {
    const { service, giftCardStore, transactionStore } = createMockService();
    await service.createGiftCards([
      { code: "PARTIAL_GC", initial_balance: 5000, current_balance: 5000 }
    ]);

    const res1 = await service.redeemGiftCard("PARTIAL_GC", 3000, "checkout", "ord_1");
    expect(res1.giftCard.current_balance).toBe(2000);
    expect(res1.transaction.amount).toBe(-3000);
    expect(res1.transaction.transaction_type).toBe("redeem");
    expect(giftCardStore[0].current_balance).toBe(2000);

    const res2 = await service.redeemGiftCard("PARTIAL_GC", 1500, "checkout", "ord_2");
    expect(res2.giftCard.current_balance).toBe(500);
    expect(res2.transaction.amount).toBe(-1500);

    expect(transactionStore.length).toBe(2);
  });

  it("should prevent duplicate redemptions using idempotency key", async () => {
    const { service, transactionStore } = createMockService();
    await service.createGiftCards([
      { code: "IDEM_GC", initial_balance: 5000, current_balance: 5000 }
    ]);

    const res1 = await service.redeemGiftCard("IDEM_GC", 2000, "checkout", "ord_1", "idempotency_123");
    expect(res1.giftCard.current_balance).toBe(3000);
    expect(transactionStore.length).toBe(1);

    const res2 = await service.redeemGiftCard("IDEM_GC", 2000, "checkout", "ord_1", "idempotency_123");
    expect(res2.duplicated).toBe(true);
    expect(res2.giftCard.current_balance).toBe(3000); // Balance unchanged
    expect(transactionStore.length).toBe(1); // No new transaction
  });

  it("should support refunds and write credit ledger entries", async () => {
    const { service, giftCardStore, transactionStore } = createMockService();
    await service.createGiftCards([
      { code: "REFUND_GC", initial_balance: 5000, current_balance: 2000 }
    ]);

    const result = await service.refundGiftCard("REFUND_GC", 1500, "refund", "ord_1", "idem_ref_1");
    expect(result.giftCard.current_balance).toBe(3500);
    expect(result.transaction.amount).toBe(1500);
    expect(result.transaction.transaction_type).toBe("refund");

    expect(giftCardStore[0].current_balance).toBe(3500);
    expect(transactionStore.length).toBe(1);
  });

  it("should serialize concurrent redemptions using mutex locking", async () => {
    const { service, giftCardStore } = createMockService();
    await service.createGiftCards([
      { code: "CONCUR_GC", initial_balance: 5000, current_balance: 5000 }
    ]);

    // Trigger 3 parallel redemptions of 2000. Exactly 2 should succeed, 1 should fail.
    const promises = [
      service.redeemGiftCard("CONCUR_GC", 2000),
      service.redeemGiftCard("CONCUR_GC", 2000),
      service.redeemGiftCard("CONCUR_GC", 2000),
    ];

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(1);
    expect(giftCardStore[0].current_balance).toBe(1000);
  });

  it("should evaluate split payment breakdown in RewardsPaymentService", async () => {
    const { service } = createMockService();
    const paymentService = new RewardsPaymentService({ rewardsModuleService: service });

    await service.createGiftCards([
      { code: "CARD_A", initial_balance: 3000, current_balance: 3000 },
      { code: "CARD_B", initial_balance: 5000, current_balance: 5000 },
    ]);

    // Total payable = 7000. CARD_A covers 3000, CARD_B covers 4000. Remaining payable = 0.
    const breakdown1 = await paymentService.processSplitPayment(["CARD_A", "CARD_B"], 7000, "INR");
    expect(breakdown1.total_applied).toBe(7000);
    expect(breakdown1.remaining_payable).toBe(0);
    expect(breakdown1.applied_gift_cards.length).toBe(2);
    expect(breakdown1.applied_gift_cards[0].amount).toBe(3000);
    expect(breakdown1.applied_gift_cards[1].amount).toBe(4000);

    // Total payable = 9000. CARD_A (3000) + CARD_B (5000) = 8000. Remaining = 1000.
    const breakdown2 = await paymentService.processSplitPayment(["CARD_A", "CARD_B"], 9000, "INR");
    expect(breakdown2.total_applied).toBe(8000);
    expect(breakdown2.remaining_payable).toBe(1000);
  });
});
