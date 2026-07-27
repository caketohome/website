import { model } from "@medusajs/utils";

export const AiCircuitBreakerState = model.define("ai_circuit_breaker_state", {
  id: model.id({ prefix: "aicb" }).primaryKey(),
  provider_name: model.text().unique(),
  state: model.text().default("closed"), // "closed" | "open" | "half-open"
  failure_count: model.number().default(0),
  last_failed_at: model.dateTime().nullable(),
  cooldown_until: model.dateTime().nullable(),
});
