import { model } from "@medusajs/utils";

export const DriverLocation = model.define("driver_location", {
  id: model
    .id({
      prefix: "drvloc",
    })
    .primaryKey(),
  partner_id: model.text(),
  latitude: model.text(),
  longitude: model.text(),
  logged_at: model.dateTime().default(new Date()),
});
