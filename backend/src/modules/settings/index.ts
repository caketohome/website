import Service from "./service";
import { Module } from "@medusajs/utils";

export const SETTINGS_MODULE = "settingsModuleService";

export default Module(SETTINGS_MODULE, {
    service: Service,
});
