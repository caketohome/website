import ShopModule from "../modules/shop";
import DeliveryModule from "../modules/delivery";
import { defineLink } from "@medusajs/utils";

export default defineLink(
  ShopModule.linkable.shop, 
  {
    linkable: DeliveryModule.linkable.delivery,
    isList: true,
  }
);
