import ShopModule from "../modules/shop";
import ProductModule from "@medusajs/product";
import { defineLink } from "@medusajs/utils";

export default defineLink(
  ShopModule.linkable.shop,
  {
    linkable: ProductModule.linkable.product,
    isList: true,
  }
);
