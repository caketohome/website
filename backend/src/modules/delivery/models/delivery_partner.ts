import { model } from "@medusajs/utils";
import { DeliveryDeliveryPartner } from "./delivery-partner";

export const DeliveryPartner = model.define("delivery_partner", {
  id: model
    .id({
      prefix: "dlp",
    })
    .primaryKey(),
  first_name: model.text(),
  last_name: model.text(),
  email: model.text(),
  phone: model.text(),
  avatar_url: model.text().nullable(),
  deliveryDeliveryPartner: model.hasMany(() => DeliveryDeliveryPartner, {
    mappedBy: "delivery_partner"
  })
});
