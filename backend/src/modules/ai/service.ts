import { MedusaService } from "@medusajs/utils";
import { 
  AiProviderConfig, 
  AiModelConfig, 
  AiRequestLog, 
  AiKnowledgeBase, 
  AiCircuitBreakerState, 
  AiMemoryState, 
  AiPromptRegistry 
} from "./models";
import { StubAIProvider } from "./providers/stub";
import type {
  AIProvider,
  AICompleteInput,
  AICompleteResult,
  AIForecastInput,
  AIForecastResult,
  AIClassifyInput,
  AIClassifyResult,
} from "./types/provider";
import type {
  AIPolicy,
  AIPolicyRule,
  AIRateLimitConfig,
  AICostBudget,
  AIQuota,
  AIUsageSnapshot,
  AIGovernanceEvaluation,
} from "./types/governance";

// --- Interfaces & Registries ---
export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
}

export interface KnowledgeSource {
  readonly name: string;
  queryKnowledge(query: string, limit: number): Promise<string[]>;
}

export interface Agent {
  name: string;
  role: string;
  capabilities: string[];
  systemInstruction: string;
}

export interface AgentTool {
  name: string;
  description: string;
  requiredPermissions: string[];
  requiredModules: string[];
  timeoutMs: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
  rollbackSupport: boolean;
  simulationSupport: boolean;
  execute(input: any, context: any): Promise<any>;
  rollback?(input: any, context: any): Promise<any>;
}

export interface WorkflowContext {
  executionId: string;
  actorId: string;
  role: string;
  companyId?: string;
  branchId?: string;
  isSimulated?: boolean;
}

// Stub implementation for Embedding
export class StubEmbeddingService implements EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 8 }, (_, i) => Math.sin(hash + i));
  }
}

class AIModuleService extends MedusaService({
  AiProviderConfig,
  AiModelConfig,
  AiRequestLog,
  AiKnowledgeBase,
  AiCircuitBreakerState,
  AiMemoryState,
  AiPromptRegistry,
}) {
  private providers: Map<string, AIProvider> = new Map();
  private embeddingService: EmbeddingService = new StubEmbeddingService();
  private knowledgeSources: Map<string, KnowledgeSource> = new Map();
  private toolsRegistry: Map<string, AgentTool> = new Map();
  private agentRegistry: Map<string, Agent> = new Map();
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  // --- Enterprise Governance ---
  private policies: AIPolicy[] = [];
  private rateLimits: AIRateLimitConfig[] = [];
  private costBudgets: AICostBudget[] = [];
  private quotas: AIQuota[] = [];
  private requestCounters: Map<string, { count: number; tokens: number; windowStart: number }> = new Map();

  constructor(...args: any[]) {
    super(...args);
    this.providers.set("ai-stub", new StubAIProvider());
  }

  // --- Registrations ---
  registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  registerEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
  }

  registerKnowledgeSource(source: KnowledgeSource): void {
    this.knowledgeSources.set(source.name, source);
  }

  registerTool(tool: AgentTool): void {
    this.toolsRegistry.set(tool.name, tool);
  }

  getTool(name: string): AgentTool | undefined {
    return this.toolsRegistry.get(name);
  }

  registerAgent(agent: Agent): void {
    this.agentRegistry.set(agent.name, agent);
  }

  getAgent(name: string): Agent | undefined {
    return this.agentRegistry.get(name);
  }

  // --- Secrets Indirection Resolver ---
  private resolveApiKey(secretRef: string | null): string {
    if (!secretRef) return "";
    if (secretRef.startsWith("env:")) {
      const envVarName = secretRef.substring(4);
      return process.env[envVarName] || "";
    }
    return secretRef;
  }

  // --- Circuit Breaker Logic ---
  private async checkCircuitBreaker(providerName: string): Promise<boolean> {
    const [state] = await (this as any).listAiCircuitBreakers({ provider_name: providerName });
    if (!state) return true;

    if (state.state === "open") {
      const now = new Date();
      if (state.cooldown_until && new Date(state.cooldown_until) > now) {
        console.warn(`[Circuit Breaker] Provider ${providerName} is OPEN. Bypassing request.`);
        return false;
      }
      await (this as any).updateAiCircuitBreakers({
        selector: { id: state.id },
        data: { state: "half-open" },
      });
      console.warn(`[Circuit Breaker] Provider ${providerName} is now HALF-OPEN. Attempting canary request.`);
    }
    return true;
  }

  private async recordProviderSuccess(providerName: string): Promise<void> {
    const [state] = await (this as any).listAiCircuitBreakers({ provider_name: providerName });
    if (state && state.state !== "closed") {
      await (this as any).updateAiCircuitBreakers({
        selector: { id: state.id },
        data: {
          state: "closed",
          failure_count: 0,
          last_failed_at: null,
          cooldown_until: null,
        },
      });
    }
  }

  private async recordProviderFailure(providerName: string, error: any): Promise<void> {
    const [state] = await (this as any).listAiCircuitBreakers({ provider_name: providerName });
    const maxFailures = 3;
    const cooldownMs = 30000;

    if (!state) {
      await (this as any).createAiCircuitBreakers({
        provider_name: providerName,
        state: "closed",
        failure_count: 1,
        last_failed_at: new Date(),
      });
      return;
    }

    const currentFailures = state.failure_count + 1;
    const shouldOpen = currentFailures >= maxFailures || state.state === "half-open";

    await (this as any).updateAiCircuitBreakers({
      selector: { id: state.id },
      data: {
        failure_count: currentFailures,
        last_failed_at: new Date(),
        state: shouldOpen ? "open" : state.state,
        cooldown_until: shouldOpen ? new Date(Date.now() + cooldownMs) : null,
      },
    });
  }

  // --- Context Builder with Budgeting & Memory Layer ---
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < Math.min(vecA.length, vecB.length); i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0.0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async searchKnowledgeBase(query: string, limit = 5): Promise<any[]> {
    const cacheKey = `kb_search_${query}_${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const queryVec = await this.embeddingService.generateEmbedding(query);
    const chunks = await (this as any).listAiKnowledgeBases({});
    
    const scored = chunks.map((chunk: any) => {
      const chunkVec = chunk.embedding as number[] | null;
      const score = chunkVec ? this.calculateCosineSimilarity(queryVec, chunkVec) : 0.0;
      return { chunk, score };
    });

    scored.sort((a: any, b: any) => b.score - a.score);
    const results = scored.slice(0, limit).map((s: any) => {
      s.chunk.retrieval_score = s.score;
      return s.chunk;
    });

    this.cache.set(cacheKey, {
      data: results,
      expiry: Date.now() + 60000,
    });

    return results;
  }

  // Retrieve memory context by type
  async getMemoryContext(entityId: string, type: "session" | "customer" | "business" | "analytics"): Promise<string> {
    const memories = await (this as any).listAiMemoryStates({
      entity_id: entityId,
      memory_type: type,
    });
    return memories.map((m: any) => m.content).join("\n");
  }

  async buildPromptContext(options: {
    systemPrompt: string;
    query: string;
    liveData?: string;
    history?: string;
    actorRole?: string;
    entityId?: string; // used for customer/session memory lookups
  }): Promise<string> {
    if (options.actorRole && options.actorRole !== "admin" && options.actorRole !== "owner") {
      options.liveData = options.liveData?.replace(/(wallet_balance|commission_rate|api_key):\s*[^\s,]+/g, "$1: [FILTERED]");
    }

    // Load specialized Customer Memory or Session Memory if present
    let extraMemoryText = "";
    if (options.entityId) {
      const custMem = await this.getMemoryContext(options.entityId, "customer");
      if (custMem) {
        extraMemoryText += `\nCustomer Profile Memory:\n${custMem}`;
      }
    }

    const systemBudget = 1000;
    const knowledgeBudget = 3500;
    const liveDataBudget = 3500;
    const historyBudget = 2000;

    const systemText = (options.systemPrompt + extraMemoryText).slice(0, systemBudget * 4);
    
    let knowledgeText = "";
    try {
      const chunks = await this.searchKnowledgeBase(options.query, 3);
      knowledgeText = chunks.map((c) => {
        return `[Source: ${c.source_module}, Version: ${c.document_version}, Score: ${c.retrieval_score?.toFixed(2)}]\n${c.content_chunk}`;
      }).join("\n---\n");
    } catch {
      knowledgeText = "[RAG retrieval unavailable]";
    }
    knowledgeText = knowledgeText.slice(0, knowledgeBudget * 4);

    const liveDataText = (options.liveData ?? "").slice(0, liveDataBudget * 4);
    const historyText = (options.history ?? "").slice(0, historyBudget * 4);

    return `System: ${systemText}\n\nKnowledge Base:\n${knowledgeText}\n\nLive Data:\n${liveDataText}\n\nHistory:\n${historyText}\n\nUser Query: ${options.query}`;
  }

  // --- Route Capability to Provider Config ---
  private async routeForCapability(capability: string): Promise<{ providerName: string; modelName: string }> {
    const [cfg] = await (this as any).listAiModelConfigs({
      capability,
      is_active: true,
    });

    if (!cfg) {
      return { providerName: "ai-stub", modelName: "stub-model" };
    }

    const [prov] = await (this as any).listAiProviderConfigs({
      provider_name: cfg.provider_name,
      is_enabled: true,
    });

    if (!prov) {
      return { providerName: "ai-stub", modelName: "stub-model" };
    }

    return { providerName: cfg.provider_name, modelName: cfg.model_name };
  }

  // --- Prompt Registry & A/B Testing ---
  async getPromptTemplate(key: string, userHash?: string): Promise<{ template: string; version: string; group: string }> {
    const prompts = await (this as any).listAiPromptRegistries({
      prompt_key: key,
      is_active: true,
    });

    if (prompts.length === 0) {
      return { template: "User query: {query}", version: "default", group: "A" };
    }

    // A/B test split selector
    if (prompts.length > 1 && userHash) {
      const charCodeSum = userHash.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const splitValue = (charCodeSum % 100) / 100;

      const sorted = [...prompts].sort((a, b) => a.ab_test_split - b.ab_test_split);
      for (const p of sorted) {
        if (splitValue <= p.ab_test_split) {
          return { template: p.template, version: p.version, group: p.ab_test_group };
        }
      }
    }

    return { template: prompts[0].template, version: prompts[0].version, group: prompts[0].ab_test_group };
  }

  // --- Suggestion Scorer & Simulation ---
  async scoreSuggestion(content: string): Promise<{
    confidenceScore: number;
    riskScore: number;
    impactScore: number;
  }> {
    const hasDangerKeywords = /delete|wipe|drop|refund|rollback|reset/i.test(content);
    const hasMetricsKeywords = /metrics|analytics|report|sync/i.test(content);
    
    return {
      confidenceScore: hasMetricsKeywords ? 0.95 : 0.85,
      riskScore: hasDangerKeywords ? 0.85 : 0.15,
      impactScore: hasDangerKeywords ? 0.90 : 0.30,
    };
  }

  // --- Agent Runtime & Execution Engine ---
  async runAgentPlanner(agentName: string, query: string, context: WorkflowContext): Promise<{
    steps: { toolName: string; input: any }[];
  }> {
    const agent = this.agentRegistry.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not registered in Agent Registry.`);
    }

    // Simple planner breaking down query into steps based on query keywords
    const steps: { toolName: string; input: any }[] = [];
    if (/payment|refund/i.test(query)) {
      steps.push({ toolName: "PaymentTool", input: { amount: 100 } });
    }
    if (/stock|inventory/i.test(query)) {
      steps.push({ toolName: "InventoryTool", input: { item: "Vanilla Cake", quantity: 2 } });
    }
    
    if (steps.length === 0) {
      steps.push({ toolName: "MockTool", input: { query } });
    }

    return { steps };
  }

  async executeTool(toolName: string, input: any, context: WorkflowContext): Promise<any> {
    const tool = this.toolsRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not resolved in Tool Registry.`);
    }

    // 1. Tool Permission check
    if (context.role !== "admin" && tool.requiredPermissions.includes("admin_only")) {
      throw new Error(`Security Exception: Actor lacks required permission for tool: ${toolName}`);
    }

    // 2. Simulation check
    if (context.isSimulated && tool.simulationSupport) {
      console.info(`[Agent Runtime] Simulating execution of tool: ${toolName}`);
      return { status: "simulated_success", output: { simulated: true } };
    }

    // 3. Execution wrapper with retries and timeout
    let retries = 0;
    const maxRetries = tool.retryPolicy.maxRetries;
    
    while (retries <= maxRetries) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout exceeded")), tool.timeoutMs)
        );
        const result = await Promise.race([
          tool.execute(input, context),
          timeoutPromise
        ]);
        return result;
      } catch (err: any) {
        retries++;
        if (retries > maxRetries) {
          // Trigger Rollback if supported
          if (tool.rollbackSupport && tool.rollback) {
            console.warn(`[Agent Runtime] Executing rollback for tool: ${toolName}`);
            await tool.rollback(input, context);
          }
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, tool.retryPolicy.backoffMs));
      }
    }
  }

  // --- AI Workflow Engine Engine ---
  async executeAIWorkflow(agentName: string, query: string, context: WorkflowContext): Promise<{
    suggestionId: string;
    status: "approved" | "awaiting_approval" | "simulated" | "failed";
    evaluations: any[];
  }> {
    console.info(`[AI Workflow Engine] Suggestion received for agent: ${agentName}`);
    
    // Evaluate suggestion scores
    const scores = await this.scoreSuggestion(query);
    const requiresApproval = scores.riskScore > 0.7;

    if (requiresApproval && context.role !== "admin") {
      console.warn("[AI Workflow Engine] Suggestion flagged for High Risk. Redirecting to human approval gate.");
      return {
        suggestionId: `sug_${Date.now()}`,
        status: "awaiting_approval",
        evaluations: [scores],
      };
    }

    // Process Planner steps
    const plan = await this.runAgentPlanner(agentName, query, context);
    const evaluations: any[] = [];

    for (const step of plan.steps) {
      try {
        const out = await this.executeTool(step.toolName, step.input, context);
        evaluations.push({ tool: step.toolName, status: "success", output: out });
      } catch (err: any) {
        evaluations.push({ tool: step.toolName, status: "failed", error: err.message });
        return {
          suggestionId: `sug_${Date.now()}`,
          status: "failed",
          evaluations,
        };
      }
    }

    return {
      suggestionId: `sug_${Date.now()}`,
      status: context.isSimulated ? "simulated" : "approved",
      evaluations,
    };
  }

  // --- Complete Completion handler ---
  async complete(
    input: AICompleteInput & {
      correlationId?: string;
      workflowId?: string;
      actorId?: string;
      module?: string;
      promptVersion?: string;
      simulation?: boolean;
    }
  ): Promise<AICompleteResult> {
    const start = performance.now();
    const { providerName, modelName } = await this.routeForCapability("chat");

    if (input.simulation) {
      console.info(`[Simulation Mode] Simulating response for query: ${input.prompt.substring(0, 50)}...`);
      return {
        text: `[SIMULATED RESPONSE] Simulated AI completion for prompt: ${input.prompt.substring(0, 30)}...`,
        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
      };
    }

    const isHealthy = await this.checkCircuitBreaker(providerName);
    const actualProvider = isHealthy ? (this.providers.get(providerName) || this.providers.get("ai-stub")!) : this.providers.get("ai-stub")!;
    const actualProviderName = isHealthy ? providerName : "ai-stub";

    try {
      const result = await actualProvider.complete(input);
      const latency = Math.round(performance.now() - start);

      if (isHealthy) {
        await this.recordProviderSuccess(providerName);
      }

      await (this as any).createAiRequestLogs({
        provider: actualProviderName,
        model: modelName,
        prompt_version: input.promptVersion ?? null,
        prompt_tokens: result.usage?.prompt_tokens ?? 0,
        completion_tokens: result.usage?.completion_tokens ?? 0,
        cost: 0,
        latency_ms: latency,
        correlation_id: input.correlationId ?? null,
        status: "success",
        workflow_id: input.workflowId ?? null,
        actor_id: input.actorId ?? null,
        module: input.module ?? "chat",
        retry_count: 0,
        fallback_provider: isHealthy ? null : "ai-stub",
        embedding_model: "stub-embedding",
        context_builder_version: "1.0.0",
        retrieved_documents: JSON.stringify([{ document_id: "rag_chunk" }]),
      });

      return result;
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      if (isHealthy) {
        await this.recordProviderFailure(providerName, err);
      }

      await (this as any).createAiRequestLogs({
        provider: actualProviderName,
        model: modelName,
        prompt_version: input.promptVersion ?? null,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost: 0,
        latency_ms: latency,
        correlation_id: input.correlationId ?? null,
        status: "failed",
        failure_reason: err.message,
        workflow_id: input.workflowId ?? null,
        actor_id: input.actorId ?? null,
        module: input.module ?? "chat",
        retry_count: 1,
        fallback_provider: "ai-stub",
        embedding_model: "stub-embedding",
        context_builder_version: "1.0.0",
        retrieved_documents: "[]",
      });

      const stub = this.providers.get("ai-stub")!;
      return stub.complete(input);
    }
  }

  async forecast(input: AIForecastInput): Promise<AIForecastResult> {
    const { providerName } = await this.routeForCapability("forecasting");
    const activeProvider = this.providers.get(providerName) || this.providers.get("ai-stub")!;
    try {
      return await activeProvider.forecast(input);
    } catch {
      return this.providers.get("ai-stub")!.forecast(input);
    }
  }

  async classify(input: AIClassifyInput): Promise<AIClassifyResult> {
    const { providerName } = await this.routeForCapability("classify");
    const activeProvider = this.providers.get(providerName) || this.providers.get("ai-stub")!;
    try {
      return await activeProvider.classify(input);
    } catch {
      return this.providers.get("ai-stub")!.classify(input);
    }
  }

  // =============================================
  // Enterprise Governance Engine
  // =============================================

  // --- Policy Management ---
  registerPolicy(policy: AIPolicy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => a.priority - b.priority);
  }

  removePolicy(policyId: string): void {
    this.policies = this.policies.filter((p) => p.id !== policyId);
  }

  listPolicies(): AIPolicy[] {
    return [...this.policies];
  }

  // --- Rate Limit Management ---
  registerRateLimit(config: AIRateLimitConfig): void {
    this.rateLimits.push(config);
  }

  removeRateLimit(configId: string): void {
    this.rateLimits = this.rateLimits.filter((r) => r.id !== configId);
  }

  // --- Cost Budget Management ---
  registerCostBudget(budget: AICostBudget): void {
    this.costBudgets.push(budget);
  }

  updateCostBudgetSpend(budgetId: string, costUsd: number): void {
    const budget = this.costBudgets.find((b) => b.id === budgetId);
    if (budget) {
      budget.currentDailySpend += costUsd;
      budget.currentWeeklySpend += costUsd;
      budget.currentMonthlySpend += costUsd;
    }
  }

  resetCostBudget(budgetId: string, period: "daily" | "weekly" | "monthly"): void {
    const budget = this.costBudgets.find((b) => b.id === budgetId);
    if (budget) {
      if (period === "daily") budget.currentDailySpend = 0;
      if (period === "weekly") budget.currentWeeklySpend = 0;
      if (period === "monthly") budget.currentMonthlySpend = 0;
      budget.lastResetAt = new Date();
    }
  }

  // --- Quota Management ---
  registerQuota(quota: AIQuota): void {
    this.quotas.push(quota);
  }

  incrementQuotaUsage(entityId: string, requests: number, tokens: number): void {
    const quota = this.quotas.find((q) => q.entityId === entityId && q.isActive);
    if (quota) {
      quota.currentRequestCount += requests;
      quota.currentTokenCount += tokens;
    }
  }

  resetQuota(entityId: string): void {
    const quota = this.quotas.find((q) => q.entityId === entityId);
    if (quota) {
      quota.currentRequestCount = 0;
      quota.currentTokenCount = 0;
      quota.resetAt = new Date(Date.now() + 86400000); // next day
    }
  }

  // --- Policy Evaluation Engine ---
  private evaluatePolicyRule(rule: AIPolicyRule, prompt: string): boolean {
    const target = prompt.toLowerCase();
    const ruleValue = typeof rule.value === "string" ? rule.value.toLowerCase() : rule.value;

    switch (rule.operator) {
      case "contains":
        return target.includes(ruleValue as string);
      case "not_contains":
        return !target.includes(ruleValue as string);
      case "equals":
        return target === ruleValue;
      case "regex":
        return new RegExp(ruleValue as string, "i").test(prompt);
      case "in":
        return Array.isArray(ruleValue) && ruleValue.some((v) => target.includes(v.toLowerCase()));
      default:
        return false;
    }
  }

  // --- Rate Limit Check ---
  private checkRateLimit(scope: string, scopeTarget: string): { allowed: boolean; reason?: string } {
    const limit = this.rateLimits.find(
      (r) => r.isActive && r.scope === scope && (!r.scopeTarget || r.scopeTarget === scopeTarget)
    );
    if (!limit) return { allowed: true };

    const counterKey = `${scope}:${scopeTarget}`;
    const now = Date.now();
    let counter = this.requestCounters.get(counterKey);

    if (!counter || now - counter.windowStart > 60000) {
      counter = { count: 0, tokens: 0, windowStart: now };
      this.requestCounters.set(counterKey, counter);
    }

    if (counter.count >= limit.maxRequestsPerMinute + limit.burstAllowance) {
      return {
        allowed: false,
        reason: `Rate limit exceeded for ${scope}:${scopeTarget}. Max ${limit.maxRequestsPerMinute}/min (burst: ${limit.burstAllowance})`,
      };
    }

    counter.count++;
    return { allowed: true };
  }

  // --- Cost Budget Check ---
  private checkCostBudget(scope: string, scopeTarget?: string): { allowed: boolean; reason?: string; warnings: string[] } {
    const warnings: string[] = [];
    const budget = this.costBudgets.find(
      (b) => b.scope === scope && (!b.scopeTarget || b.scopeTarget === scopeTarget)
    );
    if (!budget) return { allowed: true, warnings };

    const dailyPct = (budget.currentDailySpend / budget.dailyBudgetUsd) * 100;
    if (dailyPct >= budget.alertThresholdPercent) {
      warnings.push(`Daily AI spend at ${dailyPct.toFixed(1)}% of $${budget.dailyBudgetUsd} budget`);
    }

    if (budget.hardLimitEnabled && budget.currentDailySpend >= budget.dailyBudgetUsd) {
      return {
        allowed: false,
        reason: `Daily cost budget exhausted. Spent $${budget.currentDailySpend.toFixed(2)} of $${budget.dailyBudgetUsd} limit.`,
        warnings,
      };
    }

    return { allowed: true, warnings };
  }

  // --- Quota Check ---
  private checkQuota(entityId: string): { allowed: boolean; reason?: string } {
    const quota = this.quotas.find((q) => q.entityId === entityId && q.isActive);
    if (!quota) return { allowed: true };

    if (quota.currentRequestCount >= quota.maxRequestsPerDay) {
      return {
        allowed: false,
        reason: `Quota exceeded for entity ${entityId}. Used ${quota.currentRequestCount}/${quota.maxRequestsPerDay} requests today.`,
      };
    }

    return { allowed: true };
  }

  // --- Unified Governance Evaluation ---
  evaluateGovernance(options: {
    prompt: string;
    providerName?: string;
    modelName?: string;
    actorId?: string;
    estimatedCostUsd?: number;
  }): AIGovernanceEvaluation {
    const warnings: string[] = [];

    // 1. Evaluate policies
    for (const policy of this.policies) {
      if (!policy.isActive) continue;
      for (const rule of policy.rules) {
        if (this.evaluatePolicyRule(rule, options.prompt)) {
          if (rule.action === "block") {
            return {
              allowed: false,
              blockedBy: policy.name,
              reason: rule.message || `Blocked by policy: ${policy.name}`,
              action: "block",
              warnings,
            };
          }
          if (rule.action === "require_approval") {
            return {
              allowed: false,
              blockedBy: policy.name,
              reason: rule.message || `Requires approval per policy: ${policy.name}`,
              action: "require_approval",
              warnings,
            };
          }
          if (rule.action === "warn") {
            warnings.push(rule.message || `Warning from policy: ${policy.name}`);
          }
        }
      }
    }

    // 2. Check rate limits
    if (options.providerName) {
      const rlResult = this.checkRateLimit("provider", options.providerName);
      if (!rlResult.allowed) {
        return {
          allowed: false,
          blockedBy: `rate_limit:provider:${options.providerName}`,
          reason: rlResult.reason,
          action: "throttle",
          warnings,
        };
      }
    }

    if (options.actorId) {
      const actorRl = this.checkRateLimit("actor", options.actorId);
      if (!actorRl.allowed) {
        return {
          allowed: false,
          blockedBy: `rate_limit:actor:${options.actorId}`,
          reason: actorRl.reason,
          action: "throttle",
          warnings,
        };
      }
    }

    // 3. Check cost budgets
    const budgetResult = this.checkCostBudget("global");
    warnings.push(...budgetResult.warnings);
    if (!budgetResult.allowed) {
      return {
        allowed: false,
        blockedBy: "cost_budget:global",
        reason: budgetResult.reason,
        action: "block",
        warnings,
      };
    }

    // 4. Check quotas
    if (options.actorId) {
      const quotaResult = this.checkQuota(options.actorId);
      if (!quotaResult.allowed) {
        return {
          allowed: false,
          blockedBy: `quota:${options.actorId}`,
          reason: quotaResult.reason,
          action: "block",
          warnings,
        };
      }
    }

    return { allowed: true, warnings };
  }

  // --- Usage Dashboard Snapshot ---
  async getUsageSnapshot(periodDays: number = 7): Promise<AIUsageSnapshot> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);

    const logs = await (this as any).listAiRequestLogs({});
    const recentLogs = logs.filter((l: any) => !l.created_at || new Date(l.created_at) >= cutoff);

    const byProvider: Record<string, { requests: number; tokens: number; costUsd: number }> = {};
    const byModel: Record<string, { requests: number; tokens: number; costUsd: number }> = {};
    const byCapability: Record<string, { requests: number; tokens: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let errorCount = 0;

    for (const log of recentLogs) {
      const tokens = (log.prompt_tokens || 0) + (log.completion_tokens || 0);
      const cost = log.cost || 0;
      totalTokens += tokens;
      totalCost += cost;
      totalLatency += log.latency_ms || 0;
      if (log.status === "failed") errorCount++;

      // By provider
      if (!byProvider[log.provider]) byProvider[log.provider] = { requests: 0, tokens: 0, costUsd: 0 };
      byProvider[log.provider].requests++;
      byProvider[log.provider].tokens += tokens;
      byProvider[log.provider].costUsd += cost;

      // By model
      if (log.model) {
        if (!byModel[log.model]) byModel[log.model] = { requests: 0, tokens: 0, costUsd: 0 };
        byModel[log.model].requests++;
        byModel[log.model].tokens += tokens;
        byModel[log.model].costUsd += cost;
      }

      // By capability
      const cap = log.module || "unknown";
      if (!byCapability[cap]) byCapability[cap] = { requests: 0, tokens: 0 };
      byCapability[cap].requests++;
      byCapability[cap].tokens += tokens;
    }

    return {
      periodStart: cutoff,
      periodEnd: new Date(),
      totalRequests: recentLogs.length,
      totalTokens,
      totalCostUsd: totalCost,
      byProvider,
      byModel,
      byCapability,
      averageLatencyMs: recentLogs.length > 0 ? Math.round(totalLatency / recentLogs.length) : 0,
      errorRate: recentLogs.length > 0 ? errorCount / recentLogs.length : 0,
      cacheHitRate: 0, // placeholder for cache instrumentation
    };
  }
}

export default AIModuleService;
