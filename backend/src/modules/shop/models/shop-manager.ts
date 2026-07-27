import { model } from "@medusajs/utils";
import { Shop } from "./shop";

export const ShopManager = model.define("shop_manager", {
  id: model
    .id({
      prefix: "shpmgr",
    })
    .primaryKey(),
  first_name: model.text(),
  last_name: model.text(),
  email: model.text(),
  avatar_url: model.text().nullable(),
  shop: model.belongsTo(() => Shop, {
    mappedBy: "admins",
  }),
});
