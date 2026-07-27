import { model } from "@medusajs/utils";
import { Branch } from "./branch";

export const BranchCapacity = model.define("branch_capacity", {
  id: model
    .id({
      prefix: "brcap",
    })
    .primaryKey(),
  max_cakes_per_hour: model.number().default(10),
  max_cakes_per_day: model.number().default(50),
  max_custom_cakes: model.number().default(5),
  max_designer_cakes: model.number().default(5),
  prep_buffer_hours: model.number().default(4),
  rush_cutoff_time: model.text().nullable(),
  blackout_dates: model.json().nullable(), // JSON array of dates
  version: model.number().default(1), // Optimistic concurrency version key
  branch: model.belongsTo(() => Branch, {
    mappedBy: "capacity",
  }),
});
