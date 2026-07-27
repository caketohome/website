import Service from "./service";
import { Module } from "@medusajs/utils";

export const WEBHOOK_MODULE = "webhookModuleService";

export default Module(WEBHOOK_MODULE, {
    service: Service,
});
