import AIModuleService from "../service";
import IntegrationModuleService from "../../integration/service";

function createMockAiScope() {
  const providerConfigs: any[] = [];
  const modelConfigs: any[] = [];
  const requestLogs: any[] = [];

  const service = Object.create(AIModuleService.prototype) as AIModuleService;

  const mocks: any = {
    listAiProviderConfigs: jest.fn(async (selector: any) => {
      return providerConfigs.filter((p) =>
        Object.entries(selector).every(([k, v]) => p[k] === v)
      );
    }),
    createAiProviderConfigs: jest.fn(async (data: any) => {
      const created = { id: `aiprov_${providerConfigs.length + 1}`, ...data };
      providerConfigs.push(created);
      return created;
    }),
    updateAiProviderConfigs: jest.fn(async (args: any) => {
      const records = providerConfigs.filter((p) =>
        Object.entries(args.selector).every(([k, v]) => p[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    listAiModelConfigs: jest.fn(async (selector: any) => {
      return modelConfigs.filter((m) =>
        Object.entries(selector).every(([k, v]) => m[k] === v)
      );
    }),
    createAiModelConfigs: jest.fn(async (data: any) => {
      const created = { id: `aimod_${modelConfigs.length + 1}`, ...data };
      modelConfigs.push(created);
      return created;
    }),
    updateAiModelConfigs: jest.fn(async (args: any) => {
      const records = modelConfigs.filter((m) =>
        Object.entries(args.selector).every(([k, v]) => m[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    createAiRequestLogs: jest.fn(async (data: any) => {
      const created = { id: `ailog_${requestLogs.length + 1}`, ...data };
      requestLogs.push(created);
      return created;
    }),
    listAiRequestLogs: jest.fn(async () => requestLogs),
  };

  Object.assign(service, mocks);
  (service as any).providers = new Map();
  (service as any).providers.set("ai-stub", new (require("../providers/stub").StubAIProvider)());
  (service as any).embeddingService = new (require("../service").StubEmbeddingService)();
  (service as any).knowledgeSources = new Map();
  (service as any).toolsRegistry = new Map();
  (service as any).agentRegistry = new Map();
  (service as any).cache = new Map();
  (service as any).policies = [];
  (service as any).rateLimits = [];
  (service as any).costBudgets = [];
  (service as any).quotas = [];
  (service as any).requestCounters = new Map();

  // Add missing MedusaService mock methods used by service internals
  (service as any).listAiCircuitBreakers = jest.fn(async () => []);
  (service as any).createAiCircuitBreakers = jest.fn(async (data: any) => ({ id: `aicb_${Date.now()}`, ...data }));
  (service as any).updateAiCircuitBreakers = jest.fn(async () => []);
  (service as any).listAiKnowledgeBases = jest.fn(async () => []);
  (service as any).listAiMemoryStates = jest.fn(async () => []);
  (service as any).listAiPromptRegistries = jest.fn(async () => []);

  return { service, providerConfigs, modelConfigs, requestLogs };
}

function createMockIntegrationScope() {
  const configs: any[] = [];
  const service = Object.create(IntegrationModuleService.prototype) as IntegrationModuleService;

  const mocks: any = {
    listConnectorConfigs: jest.fn(async (selector: any) => {
      if (!selector) return configs;
      return configs.filter((c) =>
        Object.entries(selector).every(([k, v]) => c[k] === v)
      );
    }),
    createConnectorConfigs: jest.fn(async (data: any) => {
      const created = { id: `concfg_${configs.length + 1}`, ...data };
      configs.push(created);
      return created;
    }),
    updateConnectorConfigs: jest.fn(async (args: any) => {
      const records = configs.filter((c) =>
        Object.entries(args.selector).every(([k, v]) => c[k] === v)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
  };

  Object.assign(service, mocks);
  (service as any).connectors = new Map();

  return { service, configs };
}

describe("Phase 17.1 - AI Provider & Integration Hub Tests", () => {
  it("routes completion query to custom provider, falling back to stub if disabled", async () => {
    const { service, providerConfigs, modelConfigs, requestLogs } = createMockAiScope();

    // 1. Setup provider configs (disabled initially)
    await service.createAiProviderConfigs({
      provider_name: "custom_openai",
      is_enabled: false,
    });
    await service.createAiModelConfigs({
      model_name: "gpt-4o",
      provider_name: "custom_openai",
      capability: "chat",
      is_active: true,
    });

    // Run complete trigger (should route to stub because provider is disabled)
    const res = await service.complete({ prompt: "Translate: Hello" });
    expect(res.text).toContain("[CakeToHome AI stub]");
    expect(requestLogs[0].provider).toBe("ai-stub");

    // 2. Enable provider
    providerConfigs[0].is_enabled = true;
    
    // Register custom provider mock adapter
    const mockProvider = {
      identifier: "custom_openai",
      complete: jest.fn(async () => ({ text: "Translated: Namaste", usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } })),
      forecast: jest.fn(),
      classify: jest.fn(),
    };
    service.registerProvider("custom_openai", mockProvider);

    const resActive = await service.complete({ prompt: "Translate: Hello" });
    expect(resActive.text).toBe("Translated: Namaste");
    expect(requestLogs[1].provider).toBe("custom_openai");
    expect(requestLogs[1].status).toBe("success");
  });

  it("handles provider failure gracefully and redirects to stub fallback", async () => {
    const { service, providerConfigs, modelConfigs, requestLogs } = createMockAiScope();

    await service.createAiProviderConfigs({
      provider_name: "custom_fail",
      is_enabled: true,
    });
    await service.createAiModelConfigs({
      model_name: "fail-model",
      provider_name: "custom_fail",
      capability: "chat",
      is_active: true,
    });

    const mockFailProvider = {
      identifier: "custom_fail",
      complete: jest.fn(async () => {
        throw new Error("Provider rate limit reached.");
      }),
      forecast: jest.fn(),
      classify: jest.fn(),
    };
    service.registerProvider("custom_fail", mockFailProvider);

    const res = await service.complete({ prompt: "Test fail" });
    expect(res.text).toContain("[CakeToHome AI stub]");
    expect(requestLogs[0].status).toBe("failed");
    expect(requestLogs[0].failure_reason).toBe("Provider rate limit reached.");
  });

  it("manages connector configurations in Universal Integration Hub", async () => {
    const { service, configs } = createMockIntegrationScope();

    const mockConnector = {
      name: "meta_pixel",
      validateCredentials: jest.fn(async () => true),
      healthCheck: jest.fn(async () => true),
      sendEvent: jest.fn(async () => true),
    };
    service.registerConnector("meta_pixel", mockConnector);

    await service.createConnectorConfigs({
      name: "meta_pixel",
      is_enabled: true,
      credentials: { pixel_id: "12345" },
    });

    const isValid = await service.validateConnector("meta_pixel");
    expect(isValid).toBe(true);

    const isHealthy = await service.checkConnectorHealth("meta_pixel");
    expect(isHealthy).toBe(true);
    expect(configs[0].health_status).toBe("healthy");
  });
});
