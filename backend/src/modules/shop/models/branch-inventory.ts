import { model } from "@medusajs/utils";
import { Branch } from "./branch";

export const BranchInventory = model.define("branch_inventory", {
  id: model
    .id({
      prefix: "brinv",
    })
    .primaryKey(),
  product_id: model.text().searchable(),
  variant_id: model.text().searchable(),
  quantity: model.number().default(0),
  reserved: model.number().default(0),
  branch: model.belongsTo(() => Branch, {
    mappedBy: "inventories",
  }),
});
