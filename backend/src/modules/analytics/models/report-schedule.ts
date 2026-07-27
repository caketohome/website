import { model } from "@medusajs/utils";

export const ReportSchedule = model.define("crm_report_schedule", {
  id: model
    .id({
      prefix: "repsch",
    })
    .primaryKey(),
  recipient_email: model.text(),
  report_type: model.text(), // e.g. "sales" | "retention" | "roi" | "staff"
  frequency: model.text(), // "daily" | "weekly" | "monthly"
  branch_id: model.text().nullable(),
  last_sent_at: model.dateTime().nullable(),
});
