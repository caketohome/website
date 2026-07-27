import RewardsModuleService from "../service";

function createMockService() {
  const service = Object.create(RewardsModuleService.prototype) as RewardsModuleService;

  const walletStore: any[] = [];
  const transactionStore: any[] = [];

  const mocks: any = {
    listWallets: jest.fn(async (selector: any) => {
      return walletStore.filter((w) =>
        Object.entries(selector).every(([k, v]) => w[k] === v)
      );
    }),
    createWallets: jest.fn(async (data: any[]) => {
      const created = data.map((w, idx) => ({
        id: `rw_wall_${walletStore.length + idx + 1}`,
        balance: 0,
        currency_code: "INR",
        ...w,
      }));
      walletStore.push(...created);
      return created;
    }),
    updateWallets: jest.fn(async (args: any) => {
      const records = walletStore.filter((w) =>
        Object.entries(args.selector).every(([k, v]) => w[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listWalletTransactions: jest.fn(async (selector: any) => {
      return transactionStore.filter((t) =>
        Object.entries(selector).every(([k, v]) => t[k] === v)
      );
    }),
    createWalletTransactions: jest.fn(async (data: any[]) => {
      const created = data.map((t, idx) => ({
        id: `rw_txn_${transactionStore.length + idx + 1}`,
        created_at: new Date(),
        ...t,
      }));
      transactionStore.push(...created);
      return created;
    }),
  };

  Object.assign(service, mocks);
  (service as any).locks = new Map();

  return { service, walletStore, transactionStore };
}

describe("Rewards Module - Wallet Unit Tests", () => {
  it("should get or create a wallet for a customer", async () => {
    const { service, walletStore } = createMockService();

    const wallet = await service.getOrCreateWallet("cust_123");
    expect(wallet.customer_id).toBe("cust_123");
    expect(wallet.balance).toBe(0);
    expect(walletStore.length).toBe(1);

    const sameWallet = await service.getOrCreateWallet("cust_123");
    expect(sameWallet.id).toBe(wallet.id);
    expect(walletStore.length).toBe(1);
  });

  it("should credit a customer wallet and record a credit transaction", async () => {
    const { service, walletStore, transactionStore } = createMockService();

    await service.getOrCreateWallet("cust_123");
    const result = await service.creditWallet("cust_123", 5000, "topup", "ref_1", "Manual top up");

    expect(result.wallet.balance).toBe(5000);
    expect(result.transaction.amount).toBe(5000);
    expect(result.transaction.type).toBe("credit");
    expect(result.transaction.reference_type).toBe("topup");
    expect(result.transaction.reference_id).toBe("ref_1");

    expect(walletStore[0].balance).toBe(5000);
    expect(transactionStore.length).toBe(1);
  });

  it("should fail to credit a wallet if the credit amount is not positive", async () => {
    const { service } = createMockService();

    await service.getOrCreateWallet("cust_123");
    await expect(service.creditWallet("cust_123", 0)).rejects.toThrow("CREDIT_AMOUNT_MUST_BE_POSITIVE");
    await expect(service.creditWallet("cust_123", -100)).rejects.toThrow("CREDIT_AMOUNT_MUST_BE_POSITIVE");
  });

  it("should debit a customer wallet and record a debit transaction", async () => {
    const { service, walletStore, transactionStore } = createMockService();

    await service.getOrCreateWallet("cust_123");
    await service.creditWallet("cust_123", 10000);

    const result = await service.debitWallet("cust_123", 4000, "order", "ord_1", "Order purchase");
    expect(result.wallet.balance).toBe(6000);
    expect(result.transaction.amount).toBe(-4000);
    expect(result.transaction.type).toBe("debit");

    expect(walletStore[0].balance).toBe(6000);
    expect(transactionStore.length).toBe(2); // 1 credit + 1 debit
  });

  it("should prevent debiting more than current balance", async () => {
    const { service } = createMockService();

    await service.getOrCreateWallet("cust_123");
    await service.creditWallet("cust_123", 3000);

    await expect(service.debitWallet("cust_123", 4000)).rejects.toThrow("INSUFFICIENT_WALLET_BALANCE");
  });

  it("should serialize concurrent debits using mutex locking", async () => {
    const { service, walletStore } = createMockService();

    await service.getOrCreateWallet("cust_123");
    await service.creditWallet("cust_123", 10000);

    // Trigger 3 parallel debits of 4000. Exactly 2 should succeed, 1 should fail.
    const promises = [
      service.debitWallet("cust_123", 4000),
      service.debitWallet("cust_123", 4000),
      service.debitWallet("cust_123", 4000),
    ];

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(1);
    expect(walletStore[0].balance).toBe(2000);
  });
});
