import CrmModuleService from "../service";

describe("CRM Module - RFM scoring and segmentation Unit Tests", () => {
  let service: any;
  let orderModuleMock: any;

  beforeEach(() => {
    orderModuleMock = {
      listOrders: jest.fn().mockResolvedValue([]),
    };

    const dependencies = {
      orderModuleService: orderModuleMock,
    };

    service = new (CrmModuleService as any)(dependencies, {});

    // Stub MikroORM model helpers
    service.listCustomerRFMs = jest.fn().mockResolvedValue([]);
    service.createCustomerRFMs = jest.fn().mockResolvedValue([{ id: "rfm_1" }]);
    service.updateCustomerRFMs = jest.fn().mockResolvedValue([{ id: "rfm_1" }]);
  });

  const refDate = new Date("2026-07-18T00:00:00.000Z");

  test("Zero orders edge case", () => {
    const result = service.computeRFM("cust_1", [], undefined, refDate);
    expect(result.frequency_score).toBe(0);
    expect(result.monetary_score).toBe(0);
    expect(result.clv).toBe(0);
    expect(result.recency_score).toBe(999);
    expect(result.rfm_segment).toBe("New");
    expect(result.vip_tier).toBe("none");
  });

  test("New Customer - 1 completed order within 30 days boundary", () => {
    const orders = [
      {
        id: "o_1",
        status: "completed",
        total: 10000,
        created_at: new Date("2026-07-08T00:00:00.000Z"), // 10 days ago
      },
    ];
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.frequency_score).toBe(1);
    expect(result.recency_score).toBe(10);
    expect(result.rfm_segment).toBe("New");
    expect(result.vip_tier).toBe("none");
  });

  test("New Customer boundary condition: exactly 30 days ago", () => {
    const orders = [
      {
        id: "o_1",
        status: "completed",
        total: 10000,
        created_at: new Date("2026-06-18T00:00:00.000Z"), // 30 days ago
      },
    ];
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.frequency_score).toBe(1);
    expect(result.recency_score).toBe(30);
    expect(result.rfm_segment).toBe("New");
  });

  test("New Customer boundary condition: 31 days ago (falls to Loyal/default)", () => {
    const orders = [
      {
        id: "o_1",
        status: "completed",
        total: 10000,
        created_at: new Date("2026-06-17T00:00:00.000Z"), // 31 days ago
      },
    ];
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.frequency_score).toBe(1);
    expect(result.recency_score).toBe(31);
    expect(result.rfm_segment).toBe("Loyal");
  });

  test("Champion Customer - >= 5 orders, CLV >= ₹10,000 (1,000,000 paise), recency <= 30 days", () => {
    const orders = Array.from({ length: 5 }, (_, i) => ({
      id: `o_${i}`,
      status: "completed",
      total: 200000, // ₹2,000 per order
      created_at: new Date("2026-07-08T00:00:00.000Z"),
    }));
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.frequency_score).toBe(5);
    expect(result.monetary_score).toBe(1000000);
    expect(result.rfm_segment).toBe("Champions");
    expect(result.vip_tier).toBe("gold");
  });

  test("Loyal Customer - >= 3 orders, recency <= 90 days", () => {
    const orders = Array.from({ length: 3 }, (_, i) => ({
      id: `o_${i}`,
      status: "completed",
      total: 50000, // ₹500 per order
      created_at: new Date("2026-05-18T00:00:00.000Z"), // ~61 days ago
    }));
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.frequency_score).toBe(3);
    expect(result.recency_score).toBe(61);
    expect(result.rfm_segment).toBe("Loyal");
    expect(result.vip_tier).toBe("none");
  });

  test("Loyal Customer boundary condition: exactly 90 days ago", () => {
    const orders = Array.from({ length: 3 }, (_, i) => ({
      id: `o_${i}`,
      status: "completed",
      total: 50000,
      created_at: new Date("2026-04-19T00:00:00.000Z"), // 90 days ago
    }));
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.recency_score).toBe(90);
    expect(result.rfm_segment).toBe("Loyal");
  });

  test("At Risk Customer - recency > 90 days and <= 180 days", () => {
    const orders = [
      {
        id: "o_1",
        status: "completed",
        total: 10000,
        created_at: new Date("2026-04-18T00:00:00.000Z"), // 91 days ago
      },
    ];
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.recency_score).toBe(91);
    expect(result.rfm_segment).toBe("At Risk");
  });

  test("At Risk Customer boundary condition: exactly 180 days ago", () => {
    const orders = [
      {
        id: "o_1",
        status: "completed",
        total: 10000,
        created_at: new Date("2026-01-19T00:00:00.000Z"), // 180 days ago
      },
    ];
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.recency_score).toBe(180);
    expect(result.rfm_segment).toBe("At Risk");
  });

  test("Dormant Customer - recency > 180 days", () => {
    const orders = [
      {
        id: "o_1",
        status: "completed",
        total: 10000,
        created_at: new Date("2026-01-18T00:00:00.000Z"), // 181 days ago
      },
    ];
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.recency_score).toBe(181);
    expect(result.rfm_segment).toBe("Dormant");
  });

  test("VIP Tiers - Silver, Gold, Platinum", () => {
    // Silver: monetary >= 500,000 (₹5,000)
    const silverOrders = [{ id: "o_1", status: "completed", total: 500000 }];
    const silverResult = service.computeRFM("cust_s", silverOrders, undefined, refDate);
    expect(silverResult.vip_tier).toBe("silver");

    // Gold: monetary >= 1,000,000 (₹10,000)
    const goldOrders = [{ id: "o_1", status: "completed", total: 1000000 }];
    const goldResult = service.computeRFM("cust_g", goldOrders, undefined, refDate);
    expect(goldResult.vip_tier).toBe("gold");

    // Platinum: monetary >= 2,000,000 (₹20,000)
    const platOrders = [{ id: "o_1", status: "completed", total: 2000000 }];
    const platResult = service.computeRFM("cust_p", platOrders, undefined, refDate);
    expect(platResult.vip_tier).toBe("platinum");
  });

  test("Should ignore unpaid or cancelled orders", () => {
    const orders = [
      { id: "o_1", status: "canceled", total: 500000 },
      { id: "o_2", status: "pending", total: 500000 },
    ];
    const result = service.computeRFM("cust_1", orders, undefined, refDate);
    expect(result.frequency_score).toBe(0);
    expect(result.monetary_score).toBe(0);
  });

  test("CalculateAndSaveRFM persistence flow orchestration", async () => {
    const orders = [
      { id: "o_1", status: "completed", total: 100000, created_at: new Date() }
    ];
    orderModuleMock.listOrders.mockResolvedValue(orders);

    const saved = await service.calculateAndSaveRFM("cust_123");
    expect(orderModuleMock.listOrders).toHaveBeenCalledWith(
      { customer_id: "cust_123" },
      { select: ["id", "status", "total", "created_at"] }
    );
    expect(service.createCustomerRFMs).toHaveBeenCalled();
    expect(saved).toBeDefined();
  });
});
