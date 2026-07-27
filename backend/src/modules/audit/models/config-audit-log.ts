import { model } from "@medusajs/utils";

/**
 * Tracks modifications to operational configurations (settings, rules, capacities, flags).
 */
export const ConfigAuditLog = model.define("config_audit_log", {
  id: model
    .id({
      prefix: "cfgaud",
    })
    .primaryKey(),
  config_key: model.text(),
  old_value: model.text().nullable(),
  new_value: model.text().nullable(),
  changed_by: model.text().nullable(), // Admin/Actor ID
  change_reason: model.text().nullable(),
  ip_address: model.text().nullable(),
  user_agent: model.text().nullable(),
  metadata: model.json().nullable(),
});
