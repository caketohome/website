import Service from "./service";
import { Module } from "@medusajs/utils";

export const CATALOG_MODULE = "catalogModuleService";

export default Module(CATALOG_MODULE, {
    service: Service,
});
