import { model } from "@medusajs/utils";

export const CustomerBlacklist = model.define("crm_customer_blacklist", {
  id: model
    .id({
      prefix: "crm_blist",
    })
    .primaryKey(),
  customer_id: model.text().unique().index(),
  is_blacklisted: model.boolean().default(true),
  reason: model.text().nullable(),
  blacklisted_at: model.dateTime(),
  blacklisted_by: model.text().nullable(), // admin actor ID
});
