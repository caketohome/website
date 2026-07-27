import { model } from "@medusajs/utils";

export const TicketMessage = model.define("ticket_message", {
  id: model
    .id({
      prefix: "tktmsg",
    })
    .primaryKey(),
  ticket_id: model.text(),
  sender_type: model.text(), // "customer" | "agent"
  message: model.text(),
});
