import { model } from "@medusajs/utils";

export const AiModelConfig = model.define("ai_model_config", {
  id: model.id({ prefix: "aimod" }).primaryKey(),
  model_name: model.text().unique(), // e.g. "gpt-4o", "gemini-1.5-pro", "llama3"
  provider_name: model.text(), // reference string to provider
  capability: model.text(), // e.g. "chat", "vision", "embeddings", "reasoning", "forecasting"
  context_limit: model.number().default(4096),
  input_token_cost: model.number().default(0), // per 1M tokens in USD
  output_token_cost: model.number().default(0), // per 1M tokens in USD
  is_active: model.boolean().default(true),
});
