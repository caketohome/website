import MarketingModuleService from "../service";

describe("HIGH-01 Coupon Stacking & Exclusion Engine Unit Tests", () => {
  let marketingService: MarketingModuleService;

  beforeEach(() => {
    marketingService = new MarketingModuleService({} as any);
  });

  it("1. Empty applied coupons allows exclusive coupon CAKE50", async () => {
    const result = await marketingService.validateCouponStacking([], "CAKE50");
    expect(result.valid).toBe(true);
  });

  it("2. Applying CAKE50 when SAVE10 is already applied is REJECTED", async () => {
    const result = await marketingService.validateCouponStacking(["SAVE10"], "CAKE50");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("cannot be combined");
  });

  it("3. Applying SECRET15 when CAKE50 is already applied is REJECTED", async () => {
    const result = await marketingService.validateCouponStacking(["CAKE50"], "SECRET15");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("cannot be combined");
  });

  it("4. Case-insensitive validation handles lowercase 'cake50'", async () => {
    const result = await marketingService.validateCouponStacking(["save10"], "cake50");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("cannot be combined");
  });

  it("5. Duplicate coupon application CAKE50 + CAKE50 is REJECTED", async () => {
    const result = await marketingService.validateCouponStacking(["CAKE50"], "CAKE50");
    expect(result.valid).toBe(false);
  });

  it("6. Non-exclusive coupons SAVE10 and FLAVOR5 can be stacked", async () => {
    const result = await marketingService.validateCouponStacking(["SAVE10"], "FLAVOR5");
    expect(result.valid).toBe(true);
  });

  it("7. Whitespace-only coupon input is REJECTED", async () => {
    const result = await marketingService.validateCouponStacking([], "   ");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("required");
  });
});
