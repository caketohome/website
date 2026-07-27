import { model } from "@medusajs/utils";

export const Campaign = model.define("crm_campaign", {
  id: model
    .id({
      prefix: "crm_camp",
    })
    .primaryKey(),
  name: model.text(),
  reward_type: model.text().nullable(), // "offer" | "points" | "credit" (kept for backward compatibility)
  reward_value: model.number().nullable(), // (kept for backward compatibility)
  status: model.text().default("draft"), // "draft" | "active" | "archived"
  filters: model.json().nullable(), // (kept for backward compatibility)
  schedule_cron: model.text().nullable(), // (kept for backward compatibility)
  description: model.text().nullable(),
  campaign_type: model.text().default("offer"),
  audience: model.json().nullable(), // Stores JSON audience filter criteria
  created_by: model.text().nullable(),
  metadata: model.json().nullable(),
});

export const AutomationFlow = model.define("crm_automation_flow", {
  id: model
    .id({
      prefix: "crm_flow",
    })
    .primaryKey(),
  name: model.text(),
  trigger_type: model.text(), // "on_signup" | "on_abandon" | "on_birthday"
  steps: model.json().nullable(), // workflow step sequence JSON metadata
  is_active: model.boolean().default(false),
});
