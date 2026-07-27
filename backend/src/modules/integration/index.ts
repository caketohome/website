import Service from "./service";
import { Module } from "@medusajs/utils";

export const INTEGRATION_MODULE = "integrationModuleService";

export default Module(INTEGRATION_MODULE, {
    service: Service,
});
