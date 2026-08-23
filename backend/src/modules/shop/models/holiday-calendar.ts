import { model } from "@medusajs/utils";

/**
 * HolidayCalendar Model
 *
 * Holiday/closure dates for organization, branch, or city.
 * Supports full-day closures and partial-day schedules.
 */
export const HolidayCalendar = model.define("holiday_calendar", {
  id: model
    .id({
      prefix: "hol",
    })
    .primaryKey(),
  entity_type: model.enum(["organization", "branch", "city"]).default("organization"),
  entity_id: model.text().searchable(),
  date: model.text().searchable(),                     // "YYYY-MM-DD"
  name: model.text(),
  is_full_day: model.boolean().default(true),
  opening_time: model.text().nullable(),               // For partial holidays "HH:MM"
  closing_time: model.text().nullable(),               // For partial holidays "HH:MM"
});
