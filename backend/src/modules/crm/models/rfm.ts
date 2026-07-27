import { model } from "@medusajs/utils";

export const CustomerRFM = model.define("crm_customer_rfm", {
  id: model
    .id({
      prefix: "crm_rfm",
    })
    .primaryKey(),
  customer_id: model.text().unique().index(),
  recency_score: model.number().default(0), // days since last order
  frequency_score: model.number().default(0), // count of completed orders
  monetary_score: model.number().default(0), // total spent in cents/paise
  clv: model.number().default(0), // customer lifetime value
  rfm_segment: model.text().default("New"), // e.g. "Champions", "Loyal", "At Risk", "Dormant", "New"
  vip_tier: model.text().default("none"), // "none" | "bronze" | "silver" | "gold" | "platinum"
  last_calculated_at: model.dateTime(),
});
