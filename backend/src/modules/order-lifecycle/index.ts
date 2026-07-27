import Service from "./service";
import { Module } from "@medusajs/utils";

export const ORDER_LIFECYCLE_MODULE = "orderLifecycleModuleService";

export default Module(ORDER_LIFECYCLE_MODULE, {
    service: Service,
});
