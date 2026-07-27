import Service from "./service";
import { Module } from "@medusajs/utils";

export const SUPPORT_MODULE = "supportModuleService";

export default Module(SUPPORT_MODULE, {
    service: Service,
});
