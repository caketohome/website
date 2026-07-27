import Service from "./service";
import { Module } from "@medusajs/utils";

export const REWARDS_MODULE = "rewardsModuleService";

export default Module(REWARDS_MODULE, {
  service: Service,
});
