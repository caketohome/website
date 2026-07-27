import { model } from "@medusajs/utils";

export const CustomerNote = model.define("crm_customer_note", {
  id: model
    .id({
      prefix: "crm_note",
    })
    .primaryKey(),
  customer_id: model.text().index(),
  author_id: model.text().nullable(), // admin ID who wrote it
  body: model.text(),
});
