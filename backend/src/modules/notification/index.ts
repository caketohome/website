import Service from "./service";
import { Module } from "@medusajs/utils";

export const NOTIFICATION_MODULE = "notificationModuleService";

export default Module(NOTIFICATION_MODULE, {
    service: Service,
});
