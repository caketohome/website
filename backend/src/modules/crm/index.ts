import Service from "./service";
import { Module } from "@medusajs/utils";

export const CRM_MODULE = "crmModuleService";

export default Module(CRM_MODULE, {
  service: Service,
});
