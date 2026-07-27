import { model } from "@medusajs/utils";

export const DeliveryZone = model.define("delivery_zone", {
  id: model
    .id({
      prefix: "delzone",
    })
    .primaryKey(),
  pincode: model.text().searchable(),
  branch_id: model.text().searchable(),
  manual_override_branch_id: model.text().nullable(),
  polygon_coordinates: model.text().nullable(),
  radius_km: model.number().nullable(),
  center_latitude: model.number().nullable(),
  center_longitude: model.number().nullable(),
  priority: model.number().default(1),
  delivery_fee: model.number().default(0),
  estimated_delivery_minutes: model.number().default(45),
  is_serviceable: model.boolean().default(true),
});
