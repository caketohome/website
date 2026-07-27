import Service from "./service";
import { Module } from "@medusajs/utils";

// Side-effect import: attaches the Phase 9.2 Marketing Toolkit methods
// (popups, gamification, QR codes, newsletter, recovery jobs) to the
// MarketingModuleService prototype. This extends the existing engine without
// duplicating the Campaign model or the campaign lifecycle logic.
import "./toolkit";

export const MARKETING_MODULE = "marketingModuleService";

export default Module(MARKETING_MODULE, {
    service: Service,
});
