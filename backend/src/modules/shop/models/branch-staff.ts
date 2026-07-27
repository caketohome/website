import { model } from "@medusajs/utils";
import { Branch } from "./branch";

export const BranchStaff = model.define("branch_staff", {
  id: model
    .id({
      prefix: "brstf",
    })
    .primaryKey(),
  first_name: model.text(),
  last_name: model.text(),
  email: model.text().searchable(),
  phone: model.text(),
  role: model.text(), // roles: Branch Manager, Cashier, Delivery Manager, Delivery Staff, Customer Support, Inventory Manager
  is_active: model.boolean().default(true),
  branch: model.belongsTo(() => Branch, {
    mappedBy: "staff",
  }),
  metadata: model.json().nullable(),
});
