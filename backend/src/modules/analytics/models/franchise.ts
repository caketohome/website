import { model } from "@medusajs/utils";

export const Franchise = model.define("analytics_franchise", {
  id: model
    .id({
      prefix: "fran",
    })
    .primaryKey(),
  shop_id: model.text(), // References Branch/Shop ID by reference
  franchisee_name: model.text(),
  agreement_details: model.text().nullable(),
  commission_rate: model.number(), // percentage, e.g. 5.5
  is_active: model.boolean().default(true),
  created_by: model.text().nullable(),
  metadata: model.json().nullable(),
});
