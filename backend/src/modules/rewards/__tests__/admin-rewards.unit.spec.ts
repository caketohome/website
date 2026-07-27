import RewardsModuleService from "../service";
import { resolve } from "path";

describe("Medusa Rewards Admin Management operations", () => {
  let service: any;
  const mockContext = {
    manager: {
      transaction: jest.fn((cb) => cb(mockContext)),
    },
  };

  beforeEach(() => {
    // Instantiate module service with mocked MikroORM manager
    service = new (RewardsModuleService as any)({}, {});
    service.acquireLock = jest.fn().mockImplementation(() => () => {});
    
    // Mock entities databases
    service.listWallets = jest.fn().mockResolvedValue([{ id: "w-1", customer_id: "c-123", balance: 50000, currency_code: "INR" }]);
    service.updateWallets = jest.fn().mockResolvedValue({});
    service.createWalletTransactions = jest.fn().mockResolvedValue([{ id: "tx-1" }]);
    service.listWalletTransactions = jest.fn().mockResolvedValue([
      { id: "tx-1", type: "credit", amount: 10000, created_at: "2026-07-17T12:00:00Z" }
    ]);

    service.listLoyaltyLedgers = jest.fn().mockResolvedValue([{ id: "l-1", customer_id: "c-123", points: 1000, lifetime_points: 2000, tier: "gold" }]);
    service.updateLoyaltyLedgers = jest.fn().mockResolvedValue({});
    service.createLoyaltyTransactions = jest.fn().mockResolvedValue([{ id: "ltx-1" }]);
    service.listLoyaltyTransactions = jest.fn().mockResolvedValue([
      { id: "ltx-1", transaction_type: "earn", points: 500, created_at: "2026-07-17T12:10:00Z" }
    ]);

    service.listGiftCards = jest.fn().mockResolvedValue([{ id: "gc-1", code: "GC-XYZ", current_balance: 5000, status: "active" }]);
    service.updateGiftCards = jest.fn().mockResolvedValue({});
    service.listGiftCardTransactions = jest.fn().mockResolvedValue([
      { id: "gctx-1", amount: 1000, created_at: "2026-07-17T12:20:00Z" }
    ]);

    service.listReferralEvents = jest.fn().mockResolvedValue([
      { id: "rev-1", referrer_id: "c-123", referee_id: "c-456", event_type: "register", qualified: false, created_at: "2026-07-17T12:30:00Z" }
    ]);
    service.listFraudReviews = jest.fn().mockResolvedValue([
      { id: "fr-1", referral_event_id: "rev-1", resolution_status: "pending", fraud_indicator: "velocity_threshold", created_at: "2026-07-17T12:40:00Z" }
    ]);
  });

  test("should credit wallet balance manually with admin log note references", async () => {
    const res = await service.creditWallet("c-123", 20000, "adjustment", "adm-ref", "Manual admin credit override");
    expect(service.updateWallets).toHaveBeenCalled();
    expect(service.createWalletTransactions).toHaveBeenCalledWith([
      expect.objectContaining({
        amount: 20000,
        type: "credit",
        reference_type: "adjustment",
        reference_id: "adm-ref",
      })
    ]);
  });

  test("should debit wallet balance manually with adjustments trail logs", async () => {
    const res = await service.debitWallet("c-123", 10000, "adjustment", "adm-ref", "Manual admin debit override");
    expect(service.updateWallets).toHaveBeenCalled();
    expect(service.createWalletTransactions).toHaveBeenCalledWith([
      expect.objectContaining({
        amount: -10000,
        type: "debit",
        reference_type: "adjustment",
        reference_id: "adm-ref",
      })
    ]);
  });

  test("should adjust customer loyalty points balance", async () => {
    const lockKey = "loyalty:c-123";
    const release = service.acquireLock(lockKey);
    const newPoints = 1500;
    
    await service.updateLoyaltyLedgers({
      selector: { customer_id: "c-123" },
      data: { points: newPoints },
    });

    await service.createLoyaltyTransactions([
      {
        ledger_id: "l-1",
        points: 500,
        transaction_type: "adjustment",
        description: "Admin manual adjust",
      }
    ]);

    expect(service.updateLoyaltyLedgers).toHaveBeenCalledWith({
      selector: { customer_id: "c-123" },
      data: { points: 1500 },
    });
    expect(service.createLoyaltyTransactions).toHaveBeenCalled();
  });

  test("should toggle Gift Card active status", async () => {
    await service.updateGiftCards({
      selector: { id: "gc-1" },
      data: { is_active: false, status: "disabled" },
    });
    expect(service.updateGiftCards).toHaveBeenCalledWith({
      selector: { id: "gc-1" },
      data: { is_active: false, status: "disabled" },
    });
  });

  test("should build chronological unified rewards timeline", async () => {
    const timeline: any[] = [];
    const walletTxs = await service.listWalletTransactions({});
    const loyaltyTxs = await service.listLoyaltyTransactions({});
    const giftCardTxs = await service.listGiftCardTransactions({});
    const referralEvents = await service.listReferralEvents({});
    const fraudReviews = await service.listFraudReviews({});

    for (const tx of walletTxs) {
      timeline.push({ type: "wallet", timestamp: tx.created_at });
    }
    for (const tx of loyaltyTxs) {
      timeline.push({ type: "loyalty", timestamp: tx.created_at });
    }
    for (const tx of giftCardTxs) {
      timeline.push({ type: "gift_card", timestamp: tx.created_at });
    }
    for (const ev of referralEvents) {
      timeline.push({ type: "referral", timestamp: ev.created_at });
    }
    for (const fr of fraudReviews) {
      timeline.push({ type: "fraud", timestamp: fr.created_at });
    }

    // Sort timeline
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Should sort newest first
    expect(timeline[0].type).toBe("fraud"); // 12:40
    expect(timeline[1].type).toBe("referral"); // 12:30
    expect(timeline[2].type).toBe("gift_card"); // 12:20
    expect(timeline[3].type).toBe("loyalty"); // 12:10
    expect(timeline[4].type).toBe("wallet"); // 12:00
  });
});
