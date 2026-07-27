import { model } from "@medusajs/utils";

export const IpWhitelist = model.define("security_ip_whitelist", {
  id: model
    .id({
      prefix: "ipwl",
    })
    .primaryKey(),
  ip_address: model.text(), // Individual IP or CIDR block
  description: model.text().nullable(),
  is_active: model.boolean().default(true),
});
