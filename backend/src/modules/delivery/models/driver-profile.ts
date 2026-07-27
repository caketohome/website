import { model } from "@medusajs/utils";

export const DriverProfile = model.define("driver_profile", {
  id: model
    .id({
      prefix: "drvprof",
    })
    .primaryKey(),
  partner_id: model.text(),
  license_number: model.text(),
  vehicle_type: model.text().default("bike"), // "bike" | "car" | "van"
  vehicle_number: model.text(),
  is_verified: model.boolean().default(false),
  rating: model.text().default("5.0"),
});
