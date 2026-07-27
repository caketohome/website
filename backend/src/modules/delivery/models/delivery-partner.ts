import { model } from "@medusajs/utils";
import { Delivery } from "./delivery";
import { DeliveryPartner } from "./delivery_partner";

export const DeliveryDeliveryPartner = model.define("delivery_delivery_partner", {
  id: model
    .id({
      prefix: "delprt",
    })
    .primaryKey(),
  delivery: model.belongsTo(() => Delivery, {
    mappedBy: "deliveryDeliveryPartner"
  }),
  delivery_partner: model.belongsTo(() => DeliveryPartner, {
    mappedBy: "deliveryDeliveryPartner"
  })
});
