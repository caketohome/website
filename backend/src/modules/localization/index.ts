import Service from "./service";
import { Module } from "@medusajs/utils";

export const LOCALIZATION_MODULE = "localizationModuleService";

export default Module(LOCALIZATION_MODULE, {
    service: Service,
});
