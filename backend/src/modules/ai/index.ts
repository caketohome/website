import Service from "./service";
import { Module } from "@medusajs/utils";

export const AI_MODULE = "aiModuleService";

export default Module(AI_MODULE, {
    service: Service,
});
