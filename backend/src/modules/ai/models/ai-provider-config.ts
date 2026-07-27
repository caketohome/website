import { model } from "@medusajs/utils";

export const AiProviderConfig = model.define("ai_provider_config", {
  id: model.id({ prefix: "aiprov" }).primaryKey(),
  provider_name: model.text().unique(), // e.g. "openai", "vertex", "ollama", "custom"
  is_enabled: model.boolean().default(false),
  api_key: model.text().nullable(),
  base_url: model.text().nullable(),
  metadata: model.json().nullable(), // stores additional credentials / custom config
});
