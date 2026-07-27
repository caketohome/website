import Service from "./service";
import { Module } from "@medusajs/utils";

export const SHOP_MODULE = "shopModuleService";

export default Module(SHOP_MODULE, {
  service: Service,
});
