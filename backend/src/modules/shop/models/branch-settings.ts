import { model } from "@medusajs/utils";
import { Branch } from "./branch";

export const BranchSettings = model.define("branch_settings", {
  id: model
    .id({
      prefix: "brset",
    })
    .primaryKey(),
  delivery_radius_km: model.number().default(10),
  min_order_amount: model.number().default(0),
  free_delivery_threshold: model.number().nullable(),
  auto_allocation_enabled: model.boolean().default(true),
  allow_pickup: model.boolean().default(true),
  allow_delivery: model.boolean().default(true),
  branch: model.belongsTo(() => Branch, {
    mappedBy: "settings",
  }),
  metadata: model.json().nullable(),
});
