import { model } from "@medusajs/utils";

export const AiPromptRegistry = model.define("ai_prompt_registry", {
  id: model.id({ prefix: "aiprompt" }).primaryKey(),
  prompt_key: model.text(),
  version: model.text().default("1.0.0"),
  template: model.text(),
  ab_test_split: model.number().default(1.0), // 0 to 1 split target for A/B testing
  ab_test_group: model.text().default("A"), // "A" or "B"
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
});
