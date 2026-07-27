import Service from "./service";
import { Module } from "@medusajs/utils";

export const CUSTOMER_MODULE = "customerModuleService";

export default Module(CUSTOMER_MODULE, {
    service: Service,
});
