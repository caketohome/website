import { model } from "@medusajs/utils";

/**
 * ProductFulfillmentRules Model
 *
 * Product-level fulfillment configuration (global, not branch-scoped).
 * Defines delivery options, lead times, preparation times, cutoff times,
 * and preparation delay settings per product.
 *
 * This model takes HIGHEST PRECEDENCE in the fulfillment configuration cascade:
 *   Product rules → Branch override → Global defaults
 */
export const ProductFulfillmentRules = model.define("product_fulfillment_rules", {
  id: model
    .id({
      prefix: "pfr",
    })
    .primaryKey(),
  product_id: model.text().searchable(),
  instant_delivery_enabled: model.boolean().default(true),
  same_day_delivery_enabled: model.boolean().default(true),
  pre_order_enabled: model.boolean().default(false),
  minimum_lead_time_minutes: model.number().default(0),
  minimum_lead_time_days: model.number().default(0),
  order_cutoff_time: model.text().nullable(),           // "HH:MM"
  preparation_time_minutes: model.number().default(60),
  preparation_delay_enabled: model.boolean().default(false),
  preparation_delay_minutes: model.number().default(0),
  delivery_buffer_minutes: model.number().default(30),
  custom_delivery_rules: model.text().nullable(),       // JSON string
});
