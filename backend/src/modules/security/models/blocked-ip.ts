import { model } from "@medusajs/utils";

export const BlockedIp = model.define("security_blocked_ip", {
  id: model
    .id({
      prefix: "blkip",
    })
    .primaryKey(),
  ip_address: model.text().unique(),
  reason: model.text(),
  blocked_until: model.dateTime(),
});
