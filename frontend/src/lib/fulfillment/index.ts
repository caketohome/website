/**
 * CakeToHome Fulfillment System — Public API
 */

export {
  FulfillmentEngine,
  FulfillmentAvailabilityService,
  OperationsHoursService,
  BranchAvailabilityService,
  ProductFulfillmentRulesService,
} from "./fulfillment-engine";
export type { FulfillmentDataProvider } from "./fulfillment-engine";
export { DeliverySlotGenerator, DEFAULT_SLOT_CONFIG } from "./delivery-slot-generator";
export type { SlotGeneratorConfig } from "./delivery-slot-generator";

export type {
  FulfillmentReason,
  ProductFulfillmentRules,
  BranchFulfillmentOverride,
  OperatingHoursEntry,
  OperatingHoursEntityType,
  HolidayEntry,
  RiderOnlineStatus,
  RiderPresenceRecord,
  DeliverySlot,
  GlobalFulfillmentConfig,
  FulfillmentCheckInput,
  FulfillmentCheckResult,
  CartFulfillmentCheckInput,
  CartFulfillmentCheckResult,
  OrderAvailabilityInput,
  OrderAvailabilityResult,
  OtpRecord,
} from "./types";

export {
  DEFAULT_PRODUCT_FULFILLMENT,
  DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
  DAY_NAMES,
  createDefaultOperatingHours,
  parseTimeString,
  formatTimeString,
  getNowInTimezone,
  compareTimeStrings,
  timeStringToMinutes,
  minutesToTimeString,
  formatTimeForDisplay,
  addDaysToDateString,
} from "./types";

export {
  createApiEngineProvider,
  ensureFulfillmentStore,
  generateOtp,
  verifyOtp,
  getActiveOtp,
  cleanExpiredOtps,
} from "./api-engine-provider";
export type { FulfillmentStoreSlice } from "./api-engine-provider";
