import Service from "./service";
import { Module } from "@medusajs/utils";

export const CMS_MODULE = "cmsModuleService";

export default Module(CMS_MODULE, {
    service: Service,
});
