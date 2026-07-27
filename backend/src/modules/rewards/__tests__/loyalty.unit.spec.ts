import RewardsModuleService from "../service";

function createMockService() {
  const service = Object.create(RewardsModuleService.prototype) as RewardsModuleService;

  const ledgerStore: any[] = [];
  const transactionStore: any[] = [];
  const ruleStore: any[] = [];

  const mocks: any = {
    listLoyaltyLedgers: jest.fn(async (selector: any) => {
      return ledgerStore.filter((l) =>
        Object.entries(selector).every(([k, v]) => l[k] === v)
      );
    }),
    retrieveLoyaltyLedger: jest.fn(async (id: string) => {
      return ledgerStore.find((l) => l.id === id);
    }),
    createLoyaltyLedgers: jest.fn(async (data: any[]) => {
      const created = data.map((l, idx) => ({
        id: `rw_ll_${ledgerStore.length + idx + 1}`,
        points: l.points ?? 0,
        lifetime_points: l.lifetime_points ?? 0,
        tier: l.tier || "bronze",
        customer_id: l.customer_id,
      }));
      ledgerStore.push(...created);
      return created;
    }),
    updateLoyaltyLedgers: jest.fn(async (args: any) => {
      const records = ledgerStore.filter((l) =>
        Object.entries(args.selector).every(([k, v]) => l[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listLoyaltyTransactions: jest.fn(async (selector: any) => {
      return transactionStore.filter((t) => {
        return Object.entries(selector).every(([k, v]) => {
          if (k === "metadata" && v && typeof v === "object") {
            return t.metadata && Object.entries(v as object).every(([subK, subV]) => t.metadata[subK] === subV);
          }
          return t[k] === v;
        });
      });
    }),
    createLoyaltyTransactions: jest.fn(async (data: any[]) => {
      const created = data.map((t, idx) => ({
        id: `rw_ltx_${transactionStore.length + idx + 1}`,
        created_at: new Date(),
        ...t,
      }));
      transactionStore.push(...created);
      return created;
    }),
    listLoyaltyRules: jest.fn(async (selector: any) => {
      return ruleStore.filter((r) =>
        Object.entries(selector).every(([k, v]) => r[k] === v)
      );
    }),
    retrieveLoyaltyRule: jest.fn(async (id: string) => {
      return ruleStore.find((r) => r.id === id);
    }),
    createLoyaltyRules: jest.fn(async (data: any[]) => {
      const created = data.map((r, idx) => ({
        id: `rw_lr_${ruleStore.length + idx + 1}`,
        name: r.name,
        rule_type: r.rule_type || "ratio",
        value: r.value,
        min_spend: r.min_spend ?? 0,
        is_active: r.is_active ?? true,
      }));
      ruleStore.push(...created);
      return created;
    }),
  };

  Object.assign(service, mocks);
  (service as any).locks = new Map();

  return { service, ledgerStore, transactionStore, ruleStore };
}

describe("Rewards Module - Loyalty Program Unit Tests", () => {
  it("should get or create a loyalty ledger for a customer", async () => {
    const { service, ledgerStore } = createMockService();

    const ledger = await service.getOrCreateLoyaltyLedger("cust_123");
    expect(ledger.customer_id).toBe("cust_123");
    expect(ledger.points).toBe(0);
    expect(ledger.tier).toBe("bronze");
    expect(ledgerStore.length).toBe(1);

    const retrieved = await service.getOrCreateLoyaltyLedger("cust_123");
    expect(retrieved.id).toBe(ledger.id);
    expect(ledgerStore.length).toBe(1); // Not duplicated
  });

  it("should award points and progress customer tiers dynamically", async () => {
    const { service, ledgerStore, ruleStore, transactionStore } = createMockService();

    // Create rules: ratio (1 point per 10 spent) and flat fixed (50 points flat)
    await service.createLoyaltyRules([
      { name: "Ratio Rule", rule_type: "ratio", value: 0.1, min_spend: 100 },
      { name: "Fixed Rule", rule_type: "fixed", value: 50, min_spend: 0 },
    ]);

    // Spend 600 INR. Ratio rule gives 60 points, Fixed rule gives 50 points. Select Highest -> 60 points.
    const result1 = await service.earnLoyaltyPoints("cust_1", 600, "ord_1");
    expect(result1.pointsEarned).toBe(60);
    expect(ledgerStore[0].points).toBe(60);
    expect(ledgerStore[0].lifetime_points).toBe(60);
    expect(ledgerStore[0].tier).toBe("bronze");

    // Spend 10000 INR. Ratio rule gives 1000 points. Lifetime = 1060 points. Tier -> Silver.
    const result2 = await service.earnLoyaltyPoints("cust_1", 10000, "ord_2");
    expect(result2.pointsEarned).toBe(1000);
    expect(ledgerStore[0].points).toBe(1060);
    expect(ledgerStore[0].lifetime_points).toBe(1060);
    expect(ledgerStore[0].tier).toBe("silver");

    // Spend 90000 INR. Ratio rule gives 9000 points. Lifetime = 10060 points. Tier -> Platinum.
    await service.earnLoyaltyPoints("cust_1", 90000, "ord_3");
    expect(ledgerStore[0].points).toBe(10060);
    expect(ledgerStore[0].tier).toBe("platinum");

    expect(transactionStore.length).toBe(3);
    expect(transactionStore[0].transaction_type).toBe("earn");
  });

  it("should redeem loyalty points and leave lifetime points untouched", async () => {
    const { service, ledgerStore, transactionStore } = createMockService();
    
    // Setup ledger with 5000 points
    await service.createLoyaltyLedgers([
      { customer_id: "cust_red", points: 5000, lifetime_points: 5000, tier: "gold" }
    ]);

    const result = await service.redeemLoyaltyPoints("cust_red", 2000, "checkout", "ord_99");
    expect(result.ledger.points).toBe(3000);
    expect(result.ledger.lifetime_points).toBe(5000); // Unchanged
    expect(result.ledger.tier).toBe("gold"); // Tier preserved

    expect(transactionStore.length).toBe(1);
    expect(transactionStore[0].points).toBe(-2000);
    expect(transactionStore[0].transaction_type).toBe("redeem");
  });

  it("should prevent point over-redemption", async () => {
    const { service } = createMockService();
    await service.createLoyaltyLedgers([
      { customer_id: "cust_poor", points: 100, lifetime_points: 100 }
    ]);

    await expect(service.redeemLoyaltyPoints("cust_poor", 200)).rejects.toThrow("INSUFFICIENT_LOYALTY_POINTS");
  });

  it("should prevent duplicate redemptions using idempotency checks", async () => {
    const { service, transactionStore } = createMockService();
    await service.createLoyaltyLedgers([
      { customer_id: "cust_idem", points: 5000 }
    ]);

    const res1 = await service.redeemLoyaltyPoints("cust_idem", 1000, "checkout", "ord_1", "idem_key_1");
    expect(res1.ledger.points).toBe(4000);
    expect(transactionStore.length).toBe(1);

    const res2 = await service.redeemLoyaltyPoints("cust_idem", 1000, "checkout", "ord_1", "idem_key_1");
    expect(res2.duplicated).toBe(true);
    expect(res2.ledger.points).toBe(4000); // Balance remains 4000
    expect(transactionStore.length).toBe(1); // No duplicate transaction written
  });

  it("should adjust points manually and trigger tier updates on positive gains", async () => {
    const { service, ledgerStore, transactionStore } = createMockService();

    // Setup basic ledger
    await service.getOrCreateLoyaltyLedger("cust_adj");

    // Positive adjustment: 1500 points
    const res1 = await service.adjustLoyaltyPoints("cust_adj", 1500, "Bonus adjustment");
    expect(res1.ledger.points).toBe(1500);
    expect(res1.ledger.lifetime_points).toBe(1500);
    expect(res1.ledger.tier).toBe("silver");

    // Negative adjustment: -500 points
    const res2 = await service.adjustLoyaltyPoints("cust_adj", -500, "Debit adjustment");
    expect(res2.ledger.points).toBe(1000);
    expect(res2.ledger.lifetime_points).toBe(1500); // Lifetime points preserved
    expect(res2.ledger.tier).toBe("silver"); // Tier preserved

    expect(transactionStore.length).toBe(2);
    expect(transactionStore[0].points).toBe(1500);
    expect(transactionStore[1].points).toBe(-500);
  });

  it("should serialize concurrent points modifications with mutex locks", async () => {
    const { service, ledgerStore } = createMockService();
    await service.createLoyaltyLedgers([
      { customer_id: "cust_concur", points: 500 }
    ]);

    // Trigger 3 parallel redemptions of 200 points. Exactly 2 should succeed, 1 should fail.
    const promises = [
      service.redeemLoyaltyPoints("cust_concur", 200),
      service.redeemLoyaltyPoints("cust_concur", 200),
      service.redeemLoyaltyPoints("cust_concur", 200),
    ];

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(1);
    expect(ledgerStore[0].points).toBe(100);
  });
});
