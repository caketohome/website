import { model } from "@medusajs/utils";

export const ContactSubmission = model.define("contact_submission", {
  id: model
    .id({
      prefix: "consub",
    })
    .primaryKey(),
  name: model.text(),
  email: model.text(),
  phone: model.text(),
  subject: model.text(),
  message: model.text(),
  is_resolved: model.boolean().default(false),
});
