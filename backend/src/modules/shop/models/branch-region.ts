import { model } from "@medusajs/utils";

export const BranchRegion = model.define("branch_region", {
  id: model
    .id({
      prefix: "breg",
    })
    .primaryKey(),
  name: model.text().searchable(),
  is_active: model.boolean().default(true),
});
