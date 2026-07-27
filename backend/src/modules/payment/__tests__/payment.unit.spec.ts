import PaymentModuleService from "../service";

function createMockService() {
  const service = Object.create(PaymentModuleService.prototype) as PaymentModuleService;
  const transactionsStore: any[] = [];
  const auditTrailsStore: any[] = [];

  const mocks: any = {
    listPaymentTransactions: jest.fn(async (selector: any) => {
      return transactionsStore.filter((t) =>
        Object.entries(selector).every(([k, v]) => t[k] === v)
      );
    }),
    createPaymentTransactions: jest.fn(async (data: any) => {
      const single = Array.isArray(data) ? data[0] : data;
      const created = {
        id: `paytxn_${transactionsStore.length + 1}`,
        status: "pending",
        settlement_status: "unsettled",
        ...single,
      };
      transactionsStore.push(created);
      return created;
    }),
    updatePaymentTransactions: jest.fn(async (args: any) => {
      const records = transactionsStore.filter((t) =>
        Object.entries(args.selector).every(([k, v]) => t[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    createPaymentAuditTrails: jest.fn(async (data: any) => {
      const single = Array.isArray(data) ? data[0] : data;
      const created = {
        id: `payaud_${auditTrailsStore.length + 1}`,
        ...single,
      };
      auditTrailsStore.push(created);
      return created;
    }),
  };

  Object.assign(service, mocks);
  (service as any).providers = new Map();
  (service as any).providers.set("cod", new (require("../service").CodPaymentProvider)());
  (service as any).providers.set("test_mode", new (require("../service").MockPaymentProvider)());

  return { service, transactionsStore, auditTrailsStore, mocks };
}

describe("PaymentModuleService", () => {
  it("should initiate payment session with correct provider", async () => {
    const { service, transactionsStore } = createMockService();

    const txn = await service.initiatePaymentSession({
      amount: 5000,
      currency: "inr",
      orderId: "ord_123",
      branchId: "br_1",
      customerId: "cust_123",
      provider: "cod",
      idempotencyKey: "idem_key_1",
    });

    expect(txn.amount).toBe(5000);
    expect(txn.status).toBe("pending");
    expect(txn.provider).toBe("cod");
    expect(transactionsStore.length).toBe(1);
  });

  it("should enforce idempotency when initiating session with identical key", async () => {
    const { service, transactionsStore } = createMockService();

    const first = await service.initiatePaymentSession({
      amount: 5000,
      currency: "inr",
      orderId: "ord_123",
      branchId: "br_1",
      customerId: "cust_123",
      provider: "cod",
      idempotencyKey: "idem_key_1",
    });

    const second = await service.initiatePaymentSession({
      amount: 5000,
      currency: "inr",
      orderId: "ord_123",
      branchId: "br_1",
      customerId: "cust_123",
      provider: "cod",
      idempotencyKey: "idem_key_1",
    });

    expect(first.id).toBe(second.id);
    expect(transactionsStore.length).toBe(1);
  });

  it("should capture active payment session", async () => {
    const { service, transactionsStore } = createMockService();

    const txn = await service.initiatePaymentSession({
      amount: 5000,
      currency: "inr",
      orderId: "ord_123",
      branchId: "br_1",
      customerId: "cust_123",
      provider: "test_mode",
    });

    const updated = await service.capturePaymentSession({
      transactionId: txn.id,
    });

    expect(updated[0].status).toBe("captured");
    expect(updated[0].settlement_status).toBe("settled");
  });

  it("should process payment refunds", async () => {
    const { service } = createMockService();

    const txn = await service.initiatePaymentSession({
      amount: 5000,
      currency: "inr",
      orderId: "ord_123",
      branchId: "br_1",
      customerId: "cust_123",
      provider: "test_mode",
    });

    const refunded = await service.refundPaymentSession({
      transactionId: txn.id,
      amount: 2500,
    });

    expect(refunded[0].status).toBe("partially_refunded");
  });
});
