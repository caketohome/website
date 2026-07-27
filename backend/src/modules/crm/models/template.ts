import { model } from "@medusajs/utils";

export const EmailTemplate = model.define("crm_email_template", {
  id: model
    .id({
      prefix: "crm_tmpl",
    })
    .primaryKey(),
  name: model.text(),
  subject: model.text(),
  body: model.text(),
  language_code: model.text().default("en"),
  category: model.text().default("transactional"), // e.g. "transactional" | "marketing" | "abandoned_cart"
  is_active: model.boolean().default(true),
  version: model.number().default(1),
});
