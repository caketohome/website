import { model } from "@medusajs/utils";
import { Branch } from "./branch";

export const InventoryTransfer = model.define("inventory_transfer", {
  id: model
    .id({
      prefix: "invtr",
    })
    .primaryKey(),
  from_branch: model.belongsTo(() => Branch).nullable(),
  to_branch: model.belongsTo(() => Branch),
  product_id: model.text(),
  variant_id: model.text(),
  quantity: model.number(),
  status: model.text().default("pending"), // pending, shipped, completed, cancelled
  created_by: model.text(),
  metadata: model.json().nullable(),
});
