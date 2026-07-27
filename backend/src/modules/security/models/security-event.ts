import { model } from "@medusajs/utils";

export const SecurityEvent = model.define("security_event", {
  id: model
    .id({
      prefix: "secevt",
    })
    .primaryKey(),
  ip_address: model.text().nullable(),
  user_id: model.text().nullable(),
  event_type: model.text(), // "failed_login" | "failed_2fa" | "locked_account" | "blocked_ip" | "permission_change"
  severity: model.text().default("low"), // "low" | "medium" | "high" | "critical"
  details: model.text().nullable(),
});
