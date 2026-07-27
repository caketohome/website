import { model } from "@medusajs/utils";

export const AiRequestLog = model.define("ai_request_log", {
  id: model.id({ prefix: "ailog" }).primaryKey(),
  provider: model.text(),
  model: model.text(),
  prompt_version: model.text().nullable(),
  prompt_tokens: model.number().default(0),
  completion_tokens: model.number().default(0),
  cost: model.number().default(0),
  latency_ms: model.number().default(0),
  correlation_id: model.text().nullable(),
  status: model.text().default("success"), // "success" | "failed"
  failure_reason: model.text().nullable(),
  // Expanded observability fields
  workflow_id: model.text().nullable(),
  actor_id: model.text().nullable(),
  module: model.text().nullable(),
  retry_count: model.number().default(0),
  fallback_provider: model.text().nullable(),
  embedding_model: model.text().nullable(),
  context_builder_version: model.text().default("1.0.0"),
  retrieved_documents: model.text().nullable(), // stores stringified JSON reference list
});
