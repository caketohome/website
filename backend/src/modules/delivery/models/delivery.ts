import { model } from "@medusajs/utils";
import { DeliveryStatus } from "../types/common";
import { DeliveryDeliveryPartner } from "./delivery-partner";

export const Delivery = model.define("delivery", {
  id: model
    .id({
      prefix: "del",
    })
    .primaryKey(),
  transaction_id: model.text().nullable(),
  delivery_partner_id: model.text().nullable(),
  delivery_status: model.enum(DeliveryStatus).default(DeliveryStatus.PENDING),
  eta: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  delivery_date: model.text().nullable(),
  delivery_slot_id: model.text().nullable(),
  ordered_for_self: model.boolean().default(true),
  recipient_name: model.text().nullable(),
  recipient_phone: model.text().nullable(),
  recipient_alt_phone: model.text().nullable(),
  recipient_address: model.text().nullable(),
  recipient_pincode: model.text().nullable(),
  recipient_landmark: model.text().nullable(),
  delivery_instructions: model.text().nullable(),
  gift_wrap: model.boolean().default(false),
  greeting_card: model.boolean().default(false),
  gift_message: model.text().nullable(),
  anonymous_delivery: model.boolean().default(false),
  hide_invoice: model.boolean().default(true),
  occasion: model.text().nullable(),
  is_surprise_delivery: model.boolean().default(false),
  scheduled_delivery_at: model.dateTime().nullable(),
  scheduled_slot: model.text().nullable(),
  delivery_otp: model.text().nullable(),
  deliveryDeliveryPartner: model.hasMany(() => DeliveryDeliveryPartner, {
    mappedBy: "delivery"
  })
});
