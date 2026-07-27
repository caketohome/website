import { model } from "@medusajs/utils";

export const AutomationExecution = model.define("crm_automation_execution", {
  id: model
    .id({
      prefix: "crm_aexec",
    })
    .primaryKey(),
  flow_id: model.text(),
  customer_id: model.text(),
  current_step_id: model.text().nullable(),
  status: model.text().default("running"), // "running" | "completed" | "failed" | "delayed"
  next_execution_at: model.dateTime().nullable(),
  metadata: model.text().nullable(), // JSON-serialized variables / payload state
});

export const AutomationLog = model.define("crm_automation_log", {
  id: model
    .id({
      prefix: "crm_alog",
    })
    .primaryKey(),
  execution_id: model.text(),
  step_id: model.text(),
  step_type: model.text(), // "trigger" | "action" | "delay" | "condition"
  status: model.text(), // "success" | "failure"
  note: model.text().nullable(),
});
