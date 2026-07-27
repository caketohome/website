import { Module } from "@medusajs/utils";
import SecurityModuleService from "./service";

export default Module("security", {
  service: SecurityModuleService,
});
