import PaymentModuleService from "../service";
import ShopModuleService from "../../shop/service";

function createMockScope() {
  const paymentStore: any[] = [];
  const reservationsStore: any[] = [];
  const capacitiesStore: any[] = [
    { id: "brcap_1", branch_id: "br_gurgaon", max_cakes_per_hour: 10, max_cakes_per_day: 100, version: 1 }
  ];

  const paymentService = Object.create(PaymentModuleService.prototype) as PaymentModuleService;
  Object.assign(paymentService, {
    listPaymentTransactions: jest.fn(async (selector: any) => {
      return paymentStore.filter((t) =>
        Object.entries(selector).every(([k, v]) => t[k] === v)
      );
    }),
    createPaymentTransactions: jest.fn(async (data: any) => {
      const created = { id: `paytxn_${paymentStore.length + 1}`, status: "pending", ...data };
      paymentStore.push(created);
      return created;
    }),
    updatePaymentTransactions: jest.fn(async (args: any) => {
      const records = paymentStore.filter((t) =>
        Object.entries(args.selector).every(([k, v]) => t[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    createPaymentAuditTrails: jest.fn(async () => ({})),
  });
  (paymentService as any).providers = new Map();
  (paymentService as any).providers.set("cod", new (require("../service").CodPaymentProvider)());
  (paymentService as any).providers.set("test_mode", new (require("../service").MockPaymentProvider)());

  const shopService = Object.create(ShopModuleService.prototype) as ShopModuleService;
  Object.assign(shopService, {
    listBranchCapacities: jest.fn(async () => capacitiesStore),
    countSlotReservations: jest.fn(async () => reservationsStore.length),
    createSlotReservations: jest.fn(async (data: any) => {
      const created = { id: `slotres_${reservationsStore.length + 1}`, ...data };
      reservationsStore.push(created);
      return created;
    }),
    updateSlotReservations: jest.fn(async (args: any) => {
      const records = reservationsStore.filter((r) =>
        Object.entries(args.selector).every(([k, v]) => r[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listSlotReservations: jest.fn(async (selector: any) => {
      return reservationsStore.filter((r) =>
        Object.entries(selector).every(([k, v]) => r[k] === v)
      );
    }),
  });
  (shopService as any).locks = new Map();
  (shopService as any).acquireLock = async () => () => {};

  return { paymentService, shopService, paymentStore, reservationsStore, capacitiesStore };
}

describe("Phase 16 - Acceptance Stress & Latency Tests", () => {
  it("executes concurrent checkouts and measures response latency", async () => {
    const { paymentService } = createMockScope();

    const start = performance.now();
    const concurrentRequests = Array.from({ length: 50 }).map((_, i) =>
      paymentService.initiatePaymentSession({
        amount: 5000,
        currency: "inr",
        orderId: `ord_${i}`,
        branchId: "br_gurgaon",
        customerId: "cust_123",
        provider: "test_mode",
        idempotencyKey: `idem_key_${i}`,
      })
    );

    const results = await Promise.all(concurrentRequests);
    const end = performance.now();
    const duration = end - start;
    const avgLatency = duration / 50;

    console.log(`[ACCEPTANCE] 50 concurrent payment session initiations took: ${duration.toFixed(2)} ms`);
    console.log(`[ACCEPTANCE] Average Payment Latency: ${avgLatency.toFixed(2)} ms`);

    expect(results.length).toBe(50);
    expect(avgLatency).toBeLessThan(100); // Latency SLA target check
  });

  it("blocks duplicate transactions on concurrent payment session attempts using same key", async () => {
    const { paymentService, paymentStore } = createMockScope();

    const concurrentRequests = Array.from({ length: 20 }).map(() =>
      paymentService.initiatePaymentSession({
        amount: 5000,
        currency: "inr",
        orderId: "ord_100",
        branchId: "br_gurgaon",
        customerId: "cust_123",
        provider: "test_mode",
        idempotencyKey: "idem_key_same",
      })
    );

    const results = await Promise.all(concurrentRequests);
    expect(paymentStore.length).toBe(1);
    expect(results.every((r) => r.id === results[0].id)).toBe(true);
  });

  it("validates slot capacity checkout limits and checks exceptions under load", async () => {
    const { shopService, reservationsStore, capacitiesStore } = createMockScope();
    capacitiesStore[0].max_cakes_per_hour = 10;

    // Fill capacity up to 10 slots
    for (let i = 0; i < 10; i++) {
      reservationsStore.push({ id: `slot_${i}`, cart_id: `cart_${i}`, status: "reserved", slot_time: new Date() });
    }

    // Attempting 11th reservation must fail with limit exceptions
    await expect(
      shopService.reserveSlot("cart_failed", "br_gurgaon", new Date().toISOString())
    ).rejects.toThrow("Target capacity slot is fully booked.");
  });
});
