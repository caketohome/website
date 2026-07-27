import { model } from "@medusajs/utils";

/**
 * BranchProductAvailability Model
 * Controls 3 availability states per branch for shared master catalog items:
 *   - 'available': Normal purchase
 *   - 'out_of_stock': Card badge displayed, add-to-cart disabled
 *   - 'hidden': Product is completely filtered out from storefront for that branch
 */
export const BranchProductAvailability = model.define("branch_product_availability", {
  id: model
    .id({
      prefix: "bpa",
    })
    .primaryKey(),
  branch_id: model.text().searchable(),
  product_id: model.text().searchable(),
  status: model.enum(["available", "out_of_stock", "hidden"]).default("available"),
  preparation_time_minutes: model.number().nullable(),
  is_same_day_eligible: model.boolean().default(true),
});
