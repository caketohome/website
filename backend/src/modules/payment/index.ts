import Service from "./service";
import { Module } from "@medusajs/utils";

export const PAYMENT_MODULE = "paymentModuleService";

export default Module(PAYMENT_MODULE, {
  service: Service,
});
