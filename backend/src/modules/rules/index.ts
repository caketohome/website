import Service from "./service";
import { Module } from "@medusajs/utils";

// Side-effect import: attaches the Phase 9.2 offer-type factory helpers
// (createFlashSaleOffer, createComboDiscountOffer, createComboOffer,
// createFreeDeliveryOffer, createBuyXGetYOffer, bulkGenerateCoupons) to the
// RulesModuleService prototype. This extends the existing engine without
// duplicating the Offer model or the evaluation logic.
import "./helpers";

export const RULES_MODULE = "rulesModuleService";

export default Module(RULES_MODULE, {
    service: Service,
});
