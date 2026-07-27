import { model } from "@medusajs/utils";

export const City = model.define("city", {
  id: model
    .id({
      prefix: "city",
    })
    .primaryKey(),
  name: model.text().searchable(),
  state: model.text(),
  is_active: model.boolean().default(true),
});
