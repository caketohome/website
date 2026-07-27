import AIModuleService from "../service";
import aiEventCoordinator from "../../../subscribers/ai-event-coordinator";
import aiEmbeddingWorker from "../../../jobs/ai-embedding-worker";
import aiKnowledgeIndexWorker from "../../../jobs/ai-knowledge-index-worker";
import aiContextCacheWorker from "../../../jobs/ai-context-cache-worker";
import aiExecutionWorker from "../../../jobs/ai-execution-worker";
import aiForecastWorker from "../../../jobs/ai-forecast-worker";
import aiCleanupWorker from "../../../jobs/ai-cleanup-worker";

function createMockRagScope() {
  const knowledgeBases: any[] = [];
  const circuitBreakers: any[] = [];
  const requestLogs: any[] = [];
  const modelConfigs: any[] = [];
  const providerConfigs: any[] = [];
  const memoryStates: any[] = [];
  const promptRegistries: any[] = [];

  const service = Object.create(AIModuleService.prototype) as AIModuleService;

  const mocks: any = {
    listAiKnowledgeBases: jest.fn(async () => knowledgeBases),
    createAiKnowledgeBases: jest.fn(async (data: any) => {
      const created = { id: `aikb_${knowledgeBases.length + 1}`, ...data };
      knowledgeBases.push(created);
      return created;
    }),
    updateAiKnowledgeBases: jest.fn(async (args: any) => {
      const records = knowledgeBases.filter((k) =>
        Object.entries(args.selector).every(([key, value]) => k[key] === value)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    deleteAiKnowledgeBases: jest.fn(async (id: string) => {
      const idx = knowledgeBases.findIndex((k) => k.id === id);
      if (idx !== -1) knowledgeBases.splice(idx, 1);
    }),

    listAiCircuitBreakers: jest.fn(async (selector: any) => {
      return circuitBreakers.filter((cb) =>
        Object.entries(selector).every(([key, value]) => cb[key] === value)
      );
    }),
    createAiCircuitBreakers: jest.fn(async (data: any) => {
      const created = { id: `aicb_${circuitBreakers.length + 1}`, ...data };
      circuitBreakers.push(created);
      return created;
    }),
    updateAiCircuitBreakers: jest.fn(async (args: any) => {
      const records = circuitBreakers.filter((cb) =>
        Object.entries(args.selector).every(([key, value]) => cb[key] === value)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),

    listAiRequestLogs: jest.fn(async (selector: any) => {
      return requestLogs.filter((log) => {
        return Object.entries(selector).every(([key, value]) => {
          if (key === "created_at" && value && typeof value === "object") {
            const timeLimit = (value as any).$lt;
            return log.created_at < timeLimit;
          }
          if (key === "retry_count" && value && typeof value === "object") {
            const limit = (value as any).$lt;
            return log.retry_count < limit;
          }
          return log[key] === value;
        });
      });
    }),
    createAiRequestLogs: jest.fn(async (data: any) => {
      const created = { id: `ailog_${requestLogs.length + 1}`, created_at: new Date(), ...data };
      requestLogs.push(created);
      return created;
    }),
    updateAiRequestLogs: jest.fn(async (args: any) => {
      const records = requestLogs.filter((log) =>
        Object.entries(args.selector).every(([key, value]) => log[key] === value)
      );
      records.forEach((r) => Object.assign(r, args.data));
      return records;
    }),
    deleteAiRequestLogs: jest.fn(async (id: string) => {
      const idx = requestLogs.findIndex((log) => log.id === id);
      if (idx !== -1) requestLogs.splice(idx, 1);
    }),

    listAiModelConfigs: jest.fn(async () => modelConfigs),
    listAiProviderConfigs: jest.fn(async () => providerConfigs),

    listAiMemoryStates: jest.fn(async (selector: any) => {
      return memoryStates.filter((m) =>
        Object.entries(selector).every(([key, value]) => m[key] === value)
      );
    }),
    createAiMemoryStates: jest.fn(async (data: any) => {
      const created = { id: `aimem_${memoryStates.length + 1}`, ...data };
      memoryStates.push(created);
      return created;
    }),

    listAiPromptRegistries: jest.fn(async (selector: any) => {
      return promptRegistries.filter((p) =>
        Object.entries(selector).every(([key, value]) => p[key] === value)
      );
    }),
    createAiPromptRegistries: jest.fn(async (data: any) => {
      const created = { id: `aiprompt_${promptRegistries.length + 1}`, ...data };
      promptRegistries.push(created);
      return created;
    }),
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

  return { service, knowledgeBases, circuitBreakers, requestLogs, memoryStates, promptRegistries };
}

describe("Phase 17 — Enterprise AI Operating System Tests", () => {
  it("resolves indirect API secrets referencing environment variables", async () => {
    const { service } = createMockRagScope();

    process.env.TEST_API_KEY = "env_secret_123";
    const resolved = (service as any).resolveApiKey("env:TEST_API_KEY");
    expect(resolved).toBe("env_secret_123");

    const direct = (service as any).resolveApiKey("direct_secret_456");
    expect(direct).toBe("direct_secret_456");
  });

  it("handles Circuit Breaker transitions and logs failure rates", async () => {
    const { service, circuitBreakers } = createMockRagScope();

    await (service as any).recordProviderFailure("openai", new Error("Rate limit exceeded"));
    await (service as any).recordProviderFailure("openai", new Error("Rate limit exceeded"));
    await (service as any).recordProviderFailure("openai", new Error("Rate limit exceeded"));

    expect(circuitBreakers[0].state).toBe("open");
    expect(circuitBreakers[0].cooldown_until).not.toBeNull();

    const healthy = await (service as any).checkCircuitBreaker("openai");
    expect(healthy).toBe(false);

    circuitBreakers[0].cooldown_until = new Date(Date.now() - 1000);
    const allowCanary = await (service as any).checkCircuitBreaker("openai");
    expect(allowCanary).toBe(true);
    expect(circuitBreakers[0].state).toBe("half-open");
  });

  it("scores suggested actions based on risk, confidence and impact guidelines", async () => {
    const { service } = createMockRagScope();

    const dangerResult = await service.scoreSuggestion("Please drop all schemas and rollback transactions");
    expect(dangerResult.riskScore).toBeGreaterThan(0.7);

    const normalResult = await service.scoreSuggestion("Fetch analytics stats report");
    expect(normalResult.riskScore).toBeLessThan(0.3);
    expect(normalResult.confidenceScore).toBe(0.95);
  });

  it("executes chat requests in simulation mode without calling external networks", async () => {
    const { service } = createMockRagScope();

    const result = await service.complete({
      prompt: "Execute order analytics.",
      simulation: true,
    });

    expect(result.text).toContain("[SIMULATED RESPONSE]");
  });

  it("retrieves specialized long-term memory states and formats context", async () => {
    const { service } = createMockRagScope();

    await (service as any).createAiMemoryStates({
      memory_type: "customer",
      entity_id: "cust_1",
      content: "Customer prefers Gluten-Free Chocolate cake.",
    });

    const ctx = await service.buildPromptContext({
      systemPrompt: "Help customer",
      query: "Which cake should I buy?",
      entityId: "cust_1",
    });

    expect(ctx).toContain("Customer prefers Gluten-Free Chocolate cake.");
  });

  it("evaluates active versioned prompt templates and selects A/B groups", async () => {
    const { service } = createMockRagScope();

    await (service as any).createAiPromptRegistries({
      prompt_key: "marketing_pms",
      version: "1.0.1",
      template: "Template Group A for query {query}",
      ab_test_split: 0.5,
      ab_test_group: "A",
      is_active: true,
    });

    await (service as any).createAiPromptRegistries({
      prompt_key: "marketing_pms",
      version: "1.0.2",
      template: "Template Group B for query {query}",
      ab_test_split: 1.0,
      ab_test_group: "B",
      is_active: true,
    });

    // Hash matching A/B splits
    const groupAResponse = await service.getPromptTemplate("marketing_pms", "user_low_hash");
    expect(groupAResponse.group).toBeDefined();
  });

  it("validates tool schemas, enforces role permissions and execute workflows", async () => {
    const { service } = createMockRagScope();

    let rollbackCalled = false;
    // Register tool
    service.registerTool({
      name: "PaymentTool",
      description: "Approve cake transaction refunds",
      requiredPermissions: ["admin_only"],
      requiredModules: ["payment"],
      timeoutMs: 100,
      retryPolicy: { maxRetries: 1, backoffMs: 10 },
      rollbackSupport: true,
      simulationSupport: true,
      execute: async () => { return { refund: "success" }; },
      rollback: async () => { rollbackCalled = true; },
    });

    // Register agent
    service.registerAgent({
      name: "FinanceAgent",
      role: "Treasurer",
      capabilities: ["payment"],
      systemInstruction: "Handle cash flows",
    });

    // Run client context (should fail permission check)
    const clientFlowResult = await service.executeAIWorkflow("FinanceAgent", "Run payment calculation", {
      executionId: "exec_1",
      actorId: "usr_1",
      role: "customer",
    });
    expect(clientFlowResult.status).toBe("failed");
    expect(clientFlowResult.evaluations[0].error).toContain("Security Exception: Actor lacks required permission");

    // Run admin context (should pass)
    const adminFlowResult = await service.executeAIWorkflow("FinanceAgent", "Please trigger payment refund", {
      executionId: "exec_2",
      actorId: "admin_1",
      role: "admin",
    });
    expect(adminFlowResult.status).toBe("approved");
  });

  it("runs all context cache, forecast, execution and log cleanup workers successfully", async () => {
    const { service, requestLogs } = createMockRagScope();

    const mockContainer = {
      resolve: jest.fn(() => service),
    } as any;

    (service as any).cache.set("stale_key", { data: "abc", expiry: Date.now() - 1000 });
    await aiContextCacheWorker(mockContainer);
    expect((service as any).cache.has("stale_key")).toBe(false);

    const logSpy = jest.spyOn(console, "info");
    await aiForecastWorker(mockContainer);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Demand forecast recalculated"));

    await (service as any).createAiRequestLogs({
      provider: "ai-stub",
      model: "stub-model",
      status: "failed",
      retry_count: 0,
    });
    await aiExecutionWorker(mockContainer);
    expect(requestLogs[0].status).toBe("success");

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    requestLogs[0].created_at = oldDate;

    await aiCleanupWorker(mockContainer);
    expect(requestLogs.length).toBe(0);

    logSpy.mockRestore();
  });

  it("blocks requests matching content policy rules", async () => {
    const { service } = createMockRagScope();

    service.registerPolicy({
      id: "pol_1",
      name: "PII Protection",
      description: "Block requests containing sensitive PII patterns",
      scope: "global",
      rules: [
        {
          field: "prompt",
          operator: "regex",
          value: "\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b",
          action: "block",
          message: "Prompt contains credit card number pattern",
        },
      ],
      isActive: true,
      priority: 1,
    });

    const blocked = service.evaluateGovernance({
      prompt: "Process payment for card 4111-1111-1111-1111",
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.action).toBe("block");
    expect(blocked.reason).toContain("credit card number");

    const allowed = service.evaluateGovernance({
      prompt: "What cakes are on sale today?",
    });
    expect(allowed.allowed).toBe(true);
  });

  it("enforces rate limits per provider with burst allowance", async () => {
    const { service } = createMockRagScope();

    service.registerRateLimit({
      id: "rl_1",
      scope: "provider",
      scopeTarget: "openai",
      maxRequestsPerMinute: 3,
      maxRequestsPerHour: 100,
      maxRequestsPerDay: 1000,
      maxTokensPerMinute: 50000,
      maxTokensPerHour: 500000,
      burstAllowance: 1,
      isActive: true,
    });

    // 3 + 1 burst = 4 allowed
    for (let i = 0; i < 4; i++) {
      const result = service.evaluateGovernance({ prompt: "test", providerName: "openai" });
      expect(result.allowed).toBe(true);
    }

    // 5th request should be throttled
    const throttled = service.evaluateGovernance({ prompt: "test", providerName: "openai" });
    expect(throttled.allowed).toBe(false);
    expect(throttled.action).toBe("throttle");
  });

  it("blocks requests when cost budget hard limit is reached", async () => {
    const { service } = createMockRagScope();

    service.registerCostBudget({
      id: "budget_1",
      scope: "global",
      dailyBudgetUsd: 10.0,
      weeklyBudgetUsd: 50.0,
      monthlyBudgetUsd: 150.0,
      currentDailySpend: 0,
      currentWeeklySpend: 0,
      currentMonthlySpend: 0,
      alertThresholdPercent: 80,
      hardLimitEnabled: true,
      lastResetAt: new Date(),
    });

    // Spend up to 80%
    service.updateCostBudgetSpend("budget_1", 8.5);
    const warningResult = service.evaluateGovernance({ prompt: "test" });
    expect(warningResult.allowed).toBe(true);
    expect(warningResult.warnings.length).toBeGreaterThan(0);
    expect(warningResult.warnings[0]).toContain("85.0%");

    // Exhaust the budget
    service.updateCostBudgetSpend("budget_1", 2.0);
    const blockedResult = service.evaluateGovernance({ prompt: "test" });
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.reason).toContain("budget exhausted");

    // Reset and verify access restored
    service.resetCostBudget("budget_1", "daily");
    const restoredResult = service.evaluateGovernance({ prompt: "test" });
    expect(restoredResult.allowed).toBe(true);
  });

  it("enforces per-actor quotas and resets them", async () => {
    const { service } = createMockRagScope();

    service.registerQuota({
      id: "quota_1",
      entityType: "actor",
      entityId: "usr_analyst",
      maxRequestsPerDay: 5,
      maxTokensPerDay: 10000,
      currentRequestCount: 0,
      currentTokenCount: 0,
      resetAt: new Date(Date.now() + 86400000),
      isActive: true,
    });

    // Use 4 of 5 requests
    service.incrementQuotaUsage("usr_analyst", 4, 8000);
    const okResult = service.evaluateGovernance({ prompt: "test", actorId: "usr_analyst" });
    expect(okResult.allowed).toBe(true);

    // Use 5th request
    service.incrementQuotaUsage("usr_analyst", 1, 1000);
    const exceeded = service.evaluateGovernance({ prompt: "test", actorId: "usr_analyst" });
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.reason).toContain("Quota exceeded");

    // Reset
    service.resetQuota("usr_analyst");
    const restored = service.evaluateGovernance({ prompt: "test", actorId: "usr_analyst" });
    expect(restored.allowed).toBe(true);
  });

  it("generates usage dashboard snapshots from request logs", async () => {
    const { service } = createMockRagScope();

    // Create sample logs
    await (service as any).createAiRequestLogs({
      provider: "openai",
      model: "gpt-4o",
      status: "success",
      prompt_tokens: 100,
      completion_tokens: 200,
      cost: 0.05,
      latency_ms: 450,
      module: "chat",
    });
    await (service as any).createAiRequestLogs({
      provider: "openai",
      model: "gpt-4o",
      status: "failed",
      prompt_tokens: 50,
      completion_tokens: 0,
      cost: 0,
      latency_ms: 120,
      module: "chat",
    });

    const snapshot = await service.getUsageSnapshot(7);
    expect(snapshot.totalRequests).toBe(2);
    expect(snapshot.totalTokens).toBe(350);
    expect(snapshot.totalCostUsd).toBe(0.05);
    expect(snapshot.byProvider["openai"].requests).toBe(2);
    expect(snapshot.byModel["gpt-4o"].requests).toBe(2);
    expect(snapshot.byCapability["chat"].requests).toBe(2);
    expect(snapshot.errorRate).toBe(0.5);
    expect(snapshot.averageLatencyMs).toBe(285);
  });
});
