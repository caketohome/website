import { model } from "@medusajs/utils";

export const ABTest = model.define("crm_ab_test", {
  id: model
    .id({
      prefix: "crm_ab",
    })
    .primaryKey(),
  name: model.text(),
  test_type: model.text(), // "campaign" | "email" | "promotion"
  target_id: model.text(), // e.g. campaign_id, flow_id
  variant_a_id: model.text(),
  variant_b_id: model.text(),
  ratio_a: model.number().default(50),
  ratio_b: model.number().default(50),
  metrics_a: model.text().default('{"impressions":0,"conversions":0}'), // JSON serialized counts
  metrics_b: model.text().default('{"impressions":0,"conversions":0}'), // JSON serialized counts
  status: model.text().default("draft"), // "draft" | "active" | "completed"
  winner: model.text().nullable(), // "variant_a" | "variant_b"
  confidence_score: model.number().default(0), // calculated statistical confidence
});
