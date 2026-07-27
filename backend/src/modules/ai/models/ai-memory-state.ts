import { model } from "@medusajs/utils";

export const AiMemoryState = model.define("ai_memory_state", {
  id: model.id({ prefix: "aimem" }).primaryKey(),
  memory_type: model.text(), // "session" | "customer" | "business" | "analytics" | "knowledge"
  entity_id: model.text().nullable(), // customer_id, session_id etc.
  content: model.text(),
  company_id: model.text().nullable(),
  branch_id: model.text().nullable(),
  metadata: model.json().nullable(),
  last_accessed_at: model.dateTime().default(new Date()),
});
