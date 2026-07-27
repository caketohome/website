import Service from "./service";
import { Module } from "@medusajs/utils";

export const AUDIT_MODULE = "auditModuleService";

export default Module(AUDIT_MODULE, {
    service: Service,
});
