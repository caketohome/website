import { model } from "@medusajs/utils";

/**
 * RiderPresence Model
 *
 * Tracks real-time online/offline status for delivery partners.
 * Used by the fulfillment engine to determine rider availability.
 * One row per rider, updated on login/logout/heartbeat.
 */
export const RiderPresence = model.define("rider_presence", {
  id: model
    .id({
      prefix: "rpres",
    })
    .primaryKey(),
  partner_id: model.text().searchable(),
  online_status: model.enum(["ONLINE", "OFFLINE", "ON_BREAK"]).default("OFFLINE"),
  last_seen_at: model.dateTime(),
  current_order_id: model.text().nullable(),
  hub_id: model.text().nullable(),
  branch_id: model.text().nullable(),
  city_id: model.text().nullable(),
  session_token: model.text().nullable(),
  went_online_at: model.dateTime().nullable(),
  went_offline_at: model.dateTime().nullable(),
});
