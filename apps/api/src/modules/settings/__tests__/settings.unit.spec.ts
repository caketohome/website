import { SettingsService } from "../settings.service";

describe("SettingsService Unit Tests", () => {
  let service: SettingsService;

  beforeEach(() => {
    service = new SettingsService();
  });

  it("should return default feature flags", async () => {
    const flags = await service.getFeatureFlags();
    expect(flags.customer_accounts).toBe(true);
    expect(flags.cms).toBe(true);
    expect(flags.kds_pipeline).toBe(true);
  });

  it("should check if feature is enabled accurately", async () => {
    const isEnabled = await service.isFeatureEnabled("customer_accounts");
    expect(isEnabled).toBe(true);
  });

  it("should upsert custom settings and retrieve parsed values", async () => {
    await service.setSetting({
      group: "general",
      key: "store_name",
      value: "CakeToHome Flagship Bakery",
    });

    const value = await service.getValue("general", "store_name");
    expect(value).toBe("CakeToHome Flagship Bakery");
  });
});
