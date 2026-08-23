import { model } from "@medusajs/utils";

/**
 * OperatingHours Model
 *
 * Weekly operating schedule for organization, branch, or city.
 * Each row represents a single day of the week for a specific entity.
 *
 * Precedence: Branch hours → City hours → Organization hours
 */
export const OperatingHours = model.define("operating_hours", {
  id: model
    .id({
      prefix: "oph",
    })
    .primaryKey(),
  entity_type: model.enum(["organization", "branch", "city"]).default("organization"),
  entity_id: model.text().searchable(),
  day_of_week: model.number().default(0),              // 0 = Sunday, 6 = Saturday
  is_open: model.boolean().default(true),
  opening_time: model.text().default("09:00"),          // "HH:MM"
  closing_time: model.text().default("22:00"),          // "HH:MM"
  last_order_time: model.text().nullable(),             // "HH:MM" — last same-day order time
  timezone: model.text().default("Asia/Kolkata"),
});
