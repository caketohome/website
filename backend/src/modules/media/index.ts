import Service from "./service";
import { Module } from "@medusajs/utils";

export const MEDIA_MODULE = "mediaModuleService";

export default Module(MEDIA_MODULE, {
    service: Service,
});
