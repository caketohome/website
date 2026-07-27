import Service from "./service";
import { Module } from "@medusajs/utils";

export const ANALYTICS_MODULE = "analyticsModuleService";

export default Module(ANALYTICS_MODULE, {
    service: Service,
});
