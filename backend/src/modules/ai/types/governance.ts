/**
 * Enterprise AI Governance Types
 * Defines policies, rate limits, cost budgets, and quotas
 * for production AI provider management.
 */

export interface AIPolicy {
  id: string;
  name: string;
  description: string;
  scope: "global" | "provider" | "model" | "agent" | "tool";
  scopeTarget?: string; // provider_name, model_name, agent_name, tool_name
  rules: AIPolicyRule[];
  isActive: boolean;
  priority: number; // lower = higher priority
}

export interface AIPolicyRule {
  field: string; // e.g. "prompt", "temperature", "max_tokens", "category"
  operator: "contains" | "not_contains" | "equals" | "gt" | "lt" | "regex" | "in";
  value: string | number | string[];
  action: "block" | "warn" | "require_approval" | "log" | "throttle";
  message?: string;
}

export interface AIRateLimitConfig {
  id: string;
  scope: "global" | "provider" | "model" | "actor" | "branch";
  scopeTarget?: string;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  maxTokensPerMinute: number;
  maxTokensPerHour: number;
  burstAllowance: number; // extra requests allowed in burst
  isActive: boolean;
}

export interface AICostBudget {
  id: string;
  scope: "global" | "provider" | "model" | "branch" | "department";
  scopeTarget?: string;
  dailyBudgetUsd: number;
  weeklyBudgetUsd: number;
  monthlyBudgetUsd: number;
  currentDailySpend: number;
  currentWeeklySpend: number;
  currentMonthlySpend: number;
  alertThresholdPercent: number; // e.g. 80 = alert at 80% usage
  hardLimitEnabled: boolean; // if true, block requests when budget exceeded
  lastResetAt: Date;
}

export interface AIQuota {
  id: string;
  entityType: "actor" | "branch" | "department" | "agent";
  entityId: string;
  maxRequestsPerDay: number;
  maxTokensPerDay: number;
  currentRequestCount: number;
  currentTokenCount: number;
  resetAt: Date; // next reset timestamp
  isActive: boolean;
}

export interface AIUsageSnapshot {
  periodStart: Date;
  periodEnd: Date;
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  byProvider: Record<string, { requests: number; tokens: number; costUsd: number }>;
  byModel: Record<string, { requests: number; tokens: number; costUsd: number }>;
  byCapability: Record<string, { requests: number; tokens: number }>;
  averageLatencyMs: number;
  errorRate: number;
  cacheHitRate: number;
}

export interface AIGovernanceEvaluation {
  allowed: boolean;
  blockedBy?: string; // policy name, rate limit id, budget id, or quota id
  reason?: string;
  action?: "block" | "warn" | "require_approval" | "log" | "throttle";
  warnings: string[];
}
