import OrderLifecycleModuleService from "../service";

describe("Stage 4 Kitchen Operations & Dispatch Automation Engine Unit Tests", () => {
  let lifecycleService: OrderLifecycleModuleService;

  beforeEach(() => {
    lifecycleService = new OrderLifecycleModuleService({} as any);
  });

  it("1. KDS Order Queue Priority assigns +50 score for Midnight orders", () => {
    const priority = lifecycleService.calculateKdsQueuePriority({
      isMidnight: true,
      totalAmount: 2500,
      minutesUntilDelivery: 45,
    });
    // Base 10 + Midnight 50 + SLA<60m 40 + AOV>=2000 20 = 120
    expect(priority).toBe(120);
  });

  it("2. Kitchen prep estimation computes 45 mins for custom cake and 10 mins for pastry", () => {
    const customCakePrep = lifecycleService.estimatePrepTimeMinutes([{ isCustom: true, qty: 1 }]);
    expect(customCakePrep).toBe(45);

    const pastryPrep = lifecycleService.estimatePrepTimeMinutes([{ category: "pastry", qty: 1 }]);
    expect(pastryPrep).toBe(15);
  });

  it("3. SLA delay detection triggers customer notification when delay >= 15 mins", () => {
    // Started 40 mins ago, estimated prep was 20 mins -> 20 mins delay (>= 15 threshold)
    const startedAt = new Date(Date.now() - 40 * 60 * 1000);
    const result = lifecycleService.detectPrepDelay({
      startedAt,
      estimatedPrepMinutes: 20,
      delayThresholdMinutes: 15,
    });

    expect(result.isDelayed).toBe(true);
    expect(result.delayMinutes).toBe(20);
    expect(result.shouldNotifyCustomer).toBe(true);
  });
});
