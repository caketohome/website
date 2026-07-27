import { model } from "@medusajs/utils";

export const ConnectorConfig = model.define("connector_config", {
  id: model.id({ prefix: "concfg" }).primaryKey(),
  name: model.text().unique(), // e.g. "meta", "google", "zoho", "shiprocket"
  is_enabled: model.boolean().default(false),
  test_mode: model.boolean().default(true),
  sandbox_mode: model.boolean().default(true),
  credentials: model.json().nullable(), // Encrypted or raw configs
  health_status: model.text().default("unknown"), // "healthy" | "unhealthy" | "unknown"
  last_health_check: model.dateTime().nullable(),
  config_version: model.text().default("1.0.0"),
  schema_version: model.text().default("1.0.0"),
  migration_version: model.text().default("1.0.0"),
  rollback_version: model.text().nullable(),
});
