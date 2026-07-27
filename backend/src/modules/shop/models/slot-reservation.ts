import { model } from "@medusajs/utils";
import { Branch } from "./branch";

export const SlotReservation = model.define("slot_reservation", {
  id: model
    .id({
      prefix: "slotres",
    })
    .primaryKey(),
  cart_id: model.text(),
  slot_time: model.dateTime(),
  status: model.text().default("reserved"), // "reserved" | "confirmed" | "released"
  expires_at: model.dateTime(),
  branch: model.belongsTo(() => Branch, {
    mappedBy: "reservations",
  }),
});
