import RewardsModuleService from "../service";

function createMockService() {
  const service = Object.create(RewardsModuleService.prototype) as RewardsModuleService;

  const programs: any[] = [];
  const codes: any[] = [];
  const events: any[] = [];
  const qualifications: any[] = [];
  const fraudReviews: any[] = [];
  const wallets: any[] = [];
  const loyaltyLedgers: any[] = [];
  const giftCards: any[] = [];

  const emittedEvents: any[] = [];

  const mocks: any = {
    // Event Bus mock
    container: {
      eventBusModuleService: {
        emit: jest.fn(async (event: any) => {
          emittedEvents.push(event);
        }),
      },
    },

    // Referral Program mocks
    listReferralPrograms: jest.fn(async (selector: any) => {
      return programs.filter((p) =>
        Object.entries(selector).every(([k, v]) => p[k] === v)
      );
    }),
    retrieveReferralProgram: jest.fn(async (id: string) => {
      return programs.find((p) => p.id === id);
    }),
    createReferralPrograms: jest.fn(async (data: any[]) => {
      const created = data.map((p, idx) => ({
        id: `rw_rp_${programs.length + idx + 1}`,
        ...p,
      }));
      programs.push(...created);
      return created;
    }),
    updateReferralPrograms: jest.fn(async (args: any) => {
      const records = programs.filter((p) =>
        Object.entries(args.selector).every(([k, v]) => p[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    deleteReferralPrograms: jest.fn(async (ids: string[]) => {
      for (const id of ids) {
        const idx = programs.findIndex((p) => p.id === id);
        if (idx >= 0) programs.splice(idx, 1);
      }
    }),

    // Referral Code mocks
    listReferralCodes: jest.fn(async (selector: any) => {
      return codes.filter((c) =>
        Object.entries(selector).every(([k, v]) => c[k] === v)
      );
    }),
    retrieveReferralCode: jest.fn(async (id: string) => {
      return codes.find((c) => c.id === id);
    }),
    createReferralCodes: jest.fn(async (data: any[]) => {
      const created = data.map((c, idx) => ({
        id: `rw_rc_${codes.length + idx + 1}`,
        ...c,
      }));
      codes.push(...created);
      return created;
    }),
    updateReferralCodes: jest.fn(async (args: any) => {
      const records = codes.filter((c) =>
        Object.entries(args.selector).every(([k, v]) => c[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),

    // Referral Event mocks
    listReferralEvents: jest.fn(async (selector: any) => {
      return events.filter((e) =>
        Object.entries(selector).every(([k, v]) => e[k] === v)
      );
    }),
    retrieveReferralEvent: jest.fn(async (id: string) => {
      return events.find((e) => e.id === id);
    }),
    createReferralEvents: jest.fn(async (data: any[]) => {
      const created = data.map((e, idx) => ({
        id: `rw_re_${events.length + idx + 1}`,
        ...e,
      }));
      events.push(...created);
      return created;
    }),
    updateReferralEvents: jest.fn(async (args: any) => {
      const records = events.filter((e) =>
        Object.entries(args.selector).every(([k, v]) => e[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),

    // Referral Qualification mocks
    listReferralQualifications: jest.fn(async (selector: any) => {
      return qualifications.filter((q) =>
        Object.entries(selector).every(([k, v]) => q[k] === v)
      );
    }),
    createReferralQualifications: jest.fn(async (data: any[]) => {
      const created = data.map((q, idx) => ({
        id: `rw_rq_${qualifications.length + idx + 1}`,
        ...q,
      }));
      qualifications.push(...created);
      return created;
    }),
    updateReferralQualifications: jest.fn(async (args: any) => {
      const records = qualifications.filter((q) =>
        Object.entries(args.selector).every(([k, v]) => q[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),

    // Fraud Review mocks
    listFraudReviews: jest.fn(async (selector: any) => {
      return fraudReviews.filter((f) =>
        Object.entries(selector).every(([k, v]) => f[k] === v)
      );
    }),
    createFraudReviews: jest.fn(async (data: any[]) => {
      const created = data.map((f, idx) => ({
        id: `rw_fr_${fraudReviews.length + idx + 1}`,
        created_at: new Date(),
        ...f,
      }));
      fraudReviews.push(...created);
      return created;
    }),
    updateFraudReviews: jest.fn(async (args: any) => {
      const records = fraudReviews.filter((f) =>
        Object.entries(args.selector).every(([k, v]) => f[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),

    // Reward Executor destination mocks
    creditWallet: jest.fn(async (customerId: string, amount: number) => {
      wallets.push({ customer_id: customerId, amount });
    }),
    adjustLoyaltyPoints: jest.fn(async (customerId: string, points: number) => {
      loyaltyLedgers.push({ customer_id: customerId, points });
    }),
    createGiftCards: jest.fn(async (data: any[]) => {
      giftCards.push(...data);
      return data;
    }),
  };

  Object.assign(service, mocks);
  (service as any).locks = new Map();

  return {
    service,
    programs,
    codes,
    events,
    qualifications,
    fraudReviews,
    wallets,
    loyaltyLedgers,
    giftCards,
    emittedEvents,
  };
}

describe("Rewards Module - Referral Flow Unit Tests", () => {
  it("should get or create a unique referral code for a customer", async () => {
    const { service, codes, emittedEvents } = createMockService();

    const ref = await service.getOrCreateReferralCode("cust_1");
    expect(ref.customer_id).toBe("cust_1");
    expect(ref.code).toMatch(/^REF-CUST_1-[A-Z0-9]{4}$/);
    expect(codes).toHaveLength(1);

    // Retrieve again should be idempotent
    const ref2 = await service.getOrCreateReferralCode("cust_1");
    expect(ref2.id).toBe(ref.id);
    expect(codes).toHaveLength(1);

    // Event should be emitted
    expect(emittedEvents.some((e) => e.name === "referral.created")).toBe(true);
  });

  it("should record clicks and signups while avoiding self-referrals and duplicate invites", async () => {
    const { service, events, emittedEvents } = createMockService();
    const code = await service.getOrCreateReferralCode("cust_referrer");

    // Click
    const clickEvent = await service.registerReferralClick(code.code, { ip: "192.168.1.1" });
    expect(clickEvent.event_type).toBe("click");
    expect(clickEvent.status).toBe("pending");
    expect(events).toHaveLength(1);
    expect(emittedEvents.some((e) => e.name === "referral.clicked")).toBe(true);

    // SignUp
    const signUpEvent = await service.registerReferralSignUp(code.code, "cust_referee");
    expect(signUpEvent.event_type).toBe("register");
    expect(signUpEvent.status).toBe("pending");
    expect(events).toHaveLength(2);
    expect(emittedEvents.some((e) => e.name === "referral.registered")).toBe(true);

    // Prevent self-referral
    await expect(service.registerReferralSignUp(code.code, "cust_referrer")).rejects.toThrow(
      "SELF_REFERRAL_FORBIDDEN"
    );

    // Prevent duplicate referrals for same customer
    await expect(service.registerReferralSignUp(code.code, "cust_referee")).rejects.toThrow(
      "CUSTOMER_ALREADY_REFERRED"
    );
  });

  it("should qualify referral using configurable rules and check order spends", async () => {
    const { service, programs } = createMockService();

    // Create a referral campaign program with min_spend = 1000
    await service.createReferralPrograms([
      {
        name: "Welcome referral",
        status: "active",
        reward_type: "wallet",
        reward_value: 200,
        qualification_rules: { min_spend: 1000 },
      },
    ]);

    const code = await service.getOrCreateReferralCode("cust_ref_A");
    const signUpEvent = await service.registerReferralSignUp(code.code, "cust_referee_B");

    // Evaluate qualification under min spend (e.g. 500)
    let qual = await service.evaluateReferralQualification(signUpEvent.id, { orderAmount: 500 });
    expect(qual.qualified).toBe(false);
    expect(qual.qualification_reason).toContain("below required minimum spend");

    // Evaluate qualification matching min spend (e.g. 1200)
    qual = await service.evaluateReferralQualification(signUpEvent.id, { orderAmount: 1200 });
    expect(qual.qualified).toBe(true);
    expect(qual.qualification_reason).toContain("Qualifications met");
  });

  it("should evaluate fraud risks, score IPs/Devices, and request manual reviews", async () => {
    const { service, fraudReviews } = createMockService();

    const code = await service.getOrCreateReferralCode("cust_ref_X");
    const signUpEvent = await service.registerReferralSignUp(code.code, "cust_referee_Y");

    // Clean signup
    let fraud = await service.evaluateFraudScore(signUpEvent.id, {
      ip: "1.2.3.4",
      referrerIp: "5.6.7.8",
      device: "iPhone",
      referrerDevice: "Android",
    });
    expect(fraud.fraud_score).toBe(0);
    expect(fraud.status).toBe("clean");
    expect(fraudReviews).toHaveLength(0);

    // Matching IP
    fraud = await service.evaluateFraudScore(signUpEvent.id, {
      ip: "1.2.3.4",
      referrerIp: "1.2.3.4",
      device: "iPhone",
      referrerDevice: "Android",
    });
    expect(fraud.fraud_score).toBe(50); // IP check triggers 50 risk
    expect(fraud.status).toBe("clean");

    // Duplicate email match (high score > 80)
    fraud = await service.evaluateFraudScore(signUpEvent.id, {
      ip: "1.2.3.4",
      referrerIp: "5.6.7.8",
      duplicateEmail: true,
    });
    expect(fraud.fraud_score).toBe(90);
    expect(fraud.status).toBe("flagged");
    expect(fraudReviews).toHaveLength(1);
    expect(fraudReviews[0].status).toBe("pending");
  });

  it("should execute rewards decision and invoke the reward executor", async () => {
    const { service, wallets, loyaltyLedgers, giftCards, emittedEvents } = createMockService();

    // 1. Setup Active Campaign for Wallet reward
    const [prog] = await service.createReferralPrograms([
      {
        name: "Wallet promo campaign",
        status: "active",
        reward_type: "wallet",
        reward_value: 500,
      },
    ]);

    const code = await service.getOrCreateReferralCode("cust_ref_W");
    const signUpEvent = await service.registerReferralSignUp(code.code, "cust_referee_W");

    // Qualify it
    await service.evaluateReferralQualification(signUpEvent.id, { orderAmount: 2000 });

    // Decide reward
    const decision = await service.executeRewardDecision(signUpEvent.id);
    expect(decision.rewarded).toBe(true);
    expect(decision.reward_type).toBe("wallet");
    expect(decision.reward_value).toBe(500);

    // Execute reward
    const res = await service.executeReward(signUpEvent.id);
    expect(res.success).toBe(true);
    expect(wallets).toHaveLength(1);
    expect(wallets[0].customer_id).toBe("cust_ref_W");
    expect(wallets[0].amount).toBe(500);

    // Verify emission of referral.reward_issued
    expect(emittedEvents.some((e) => e.name === "referral.reward_issued")).toBe(true);
  });
});
