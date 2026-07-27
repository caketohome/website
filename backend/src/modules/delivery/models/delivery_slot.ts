import { model } from "@medusajs/utils";

export const DeliverySlot = model.define("delivery_slot", {
  id: model
    .id({
      prefix: "delslot",
    })
    .primaryKey(),
  branch_id: model.text().searchable(),
  slot_name: model.text(),
  start_time: model.text(), // HH:MM
  end_time: model.text(),   // HH:MM
  max_capacity: model.number().default(10),
  extra_charge: model.number().default(0),
});
