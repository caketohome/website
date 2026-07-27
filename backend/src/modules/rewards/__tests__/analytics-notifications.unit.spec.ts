import RewardsModuleService from "../service";

describe("Rewards Module - Analytics & Notifications Unit Tests", () => {
  let service: any;
  let analyticsMock: any;
  let notificationMock: any;
  let customerMock: any;

  beforeEach(() => {
    analyticsMock = {
      track: jest.fn().mockResolvedValue({}),
    };
    notificationMock = {
      sendByEvent: jest.fn().mockResolvedValue({ success: true }),
    };
    customerMock = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "c-123",
        phone: "9876543210",
        email: "cust@example.com",
      }),
    };

    const dependencies = {
      analyticsModuleService: analyticsMock,
      notificationModuleService: notificationMock,
      customerModuleService: customerMock,
    };

    service = new (RewardsModuleService as any)(dependencies, {});
    service.acquireLock = jest.fn().mockImplementation(() => () => {});

    // Stub MikroORM model helpers
    service.listWallets = jest.fn().mockResolvedValue([{ id: "w-1", customer_id: "c-123", balance: 50000, currency_code: "INR" }]);
    service.updateWallets = jest.fn().mockResolvedValue({});
    service.createWalletTransactions = jest.fn().mockResolvedValue([{ id: "tx-1" }]);

    service.listGiftCards = jest.fn().mockResolvedValue([{ id: "gc-1", code: "GC-XYZ", current_balance: 5000, is_active: true, status: "active", currency_code: "INR" }]);
    service.updateGiftCards = jest.fn().mockResolvedValue({});
    service.createGiftCardTransactions = jest.fn().mockResolvedValue([{ id: "gctx-1" }]);
    service.createGiftCards = jest.fn().mockResolvedValue([{ id: "gc-2", code: "REF-GC-XYZ" }]);

    service.retrieveReferralEvent = jest.fn().mockResolvedValue({
      id: "rev-1",
      referrer_id: "c-123",
      referee_id: "c-456",
      status: "qualified",
      referral_code_id: "rc-1",
    });
    service.listReferralPrograms = jest.fn().mockResolvedValue([{
      id: "p-1",
      reward_type: "wallet",
      reward_value: 50000,
      status: "active",
    }]);
    service.updateReferralEvents = jest.fn().mockResolvedValue({});
    service.retrieveReferralCode = jest.fn().mockResolvedValue({ id: "rc-1", usage_count: 0 });
    service.updateReferralCodes = jest.fn().mockResolvedValue({});
    service.emitEvent = jest.fn().mockResolvedValue({});
  });

  test("should track analytics and dispatch alerts when wallet is credited", async () => {
    await service.creditWallet("c-123", 10000, "adjustment", "ref-1", "Admin adjustment credit");

    expect(analyticsMock.track).toHaveBeenCalledWith({
      event_name: "wallet_credit",
      customer_id: "c-123",
      metadata: expect.objectContaining({
        amount: 100,
        reference_type: "adjustment",
      }),
    });

    expect(notificationMock.sendByEvent).toHaveBeenCalledWith(
      "wallet_credit",
      "sms",
      "9876543210",
      expect.objectContaining({
        amount: "100.00",
        balance: "600.00",
      })
    );

    // Also should verify WhatsApp delivery trigger
    expect(notificationMock.sendByEvent).toHaveBeenCalledWith(
      "wallet_credit",
      "whatsapp",
      "9876543210",
      expect.any(Object)
    );
  });

  test("should track analytics and dispatch alerts when wallet is debited", async () => {
    await service.debitWallet("c-123", 5000, "order", "ref-2", "Order checkout debit");

    expect(analyticsMock.track).toHaveBeenCalledWith({
      event_name: "wallet_debit",
      customer_id: "c-123",
      metadata: expect.objectContaining({
        amount: 50,
        reference_type: "order",
      }),
    });

    expect(notificationMock.sendByEvent).toHaveBeenCalledWith(
      "wallet_debit",
      "sms",
      "9876543210",
      expect.objectContaining({
        amount: "50.00",
        balance: "450.00",
      })
    );
  });

  test("should track analytics and dispatch alerts on gift card redemption", async () => {
    await service.redeemGiftCard("GC-XYZ", 1000, "order", "ord-1", null, "c-123");

    expect(analyticsMock.track).toHaveBeenCalledWith({
      event_name: "gift_card_redeemed",
      customer_id: "c-123",
      metadata: expect.objectContaining({
        code: "GC-XYZ",
        amount: 10,
      }),
    });

    expect(notificationMock.sendByEvent).toHaveBeenCalledWith(
      "gift_card_redeemed",
      "sms",
      "9876543210",
      expect.objectContaining({
        code: "GC-XYZ",
        amount: "10.00",
        balance: "40.00",
      })
    );
  });

  test("should track analytics and send alert on referral reward execution", async () => {
    await service.executeReward("rev-1");

    expect(analyticsMock.track).toHaveBeenCalledWith({
      event_name: "referral_reward_earned",
      customer_id: "c-123",
      metadata: expect.objectContaining({
        event_id: "rev-1",
        reward_type: "wallet",
        reward_value: 50000,
      }),
    });

    expect(notificationMock.sendByEvent).toHaveBeenCalledWith(
      "referral_reward_earned",
      "sms",
      "9876543210",
      expect.objectContaining({
        reward_type: "wallet",
        reward_value: 50000,
      })
    );
  });
});
