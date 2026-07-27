import { model } from "@medusajs/utils";
import { Branch } from "./branch";

export const BranchPrice = model.define("branch_price", {
  id: model
    .id({
      prefix: "brprc",
    })
    .primaryKey(),
  variant_id: model.text().searchable(),
  price: model.number(),
  compare_at_price: model.number().nullable(),
  branch: model.belongsTo(() => Branch, {
    mappedBy: "prices",
  }),
});
