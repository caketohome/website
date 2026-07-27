import { model } from "@medusajs/utils";

export const SupportTicket = model.define("support_ticket", {
  id: model
    .id({
      prefix: "ticket",
    })
    .primaryKey(),
  ticket_no: model.text(), // e.g. TKT-XXXX
  customer_id: model.text(),
  subject: model.text(),
  description: model.text(),
  priority: model.text().default("medium"), // "low" | "medium" | "high" | "critical"
  status: model.text().default("open"), // "open" | "in_progress" | "resolved" | "closed"
  assigned_to: model.text().nullable(), // staff ID
});
