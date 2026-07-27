import { model } from "@medusajs/utils";

export const ChatSession = model.define("chat_session", {
  id: model
    .id({
      prefix: "chatsess",
    })
    .primaryKey(),
  customer_id: model.text().nullable(),
  status: model.text().default("active"), // "active" | "closed"
});
