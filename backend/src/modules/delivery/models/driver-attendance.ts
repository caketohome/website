import { model } from "@medusajs/utils";

export const DriverAttendance = model.define("driver_attendance", {
  id: model
    .id({
      prefix: "drvatt",
    })
    .primaryKey(),
  partner_id: model.text(),
  status: model.text().default("inactive"), // "active" | "inactive" | "on_break"
  checked_in_at: model.dateTime().nullable(),
  checked_out_at: model.dateTime().nullable(),
});
