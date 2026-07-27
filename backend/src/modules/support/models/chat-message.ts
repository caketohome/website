import { model } from "@medusajs/utils";

export const ChatMessage = model.define("chat_message", {
  id: model
    .id({
      prefix: "chatmsg",
    })
    .primaryKey(),
  session_id: model.text(),
  sender_type: model.text(), // "customer" | "agent"
  message: model.text(),
  sent_at: model.dateTime().default(new Date()),
});
