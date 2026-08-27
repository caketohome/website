/**
 * CakeToHome Fulfillment Data Provider — ApiEngine Bridge
 *
 * Implements the FulfillmentDataProvider interface by reading from
 * the ApiEngine's persisted memory store. This is the bridge between
 * the pure fulfillment engine and the disk-backed data layer.
 *
 * Also handles seeding default operating hours and fulfillment config
 * on first access (lazy initialization).
 */

import type { FulfillmentDataProvider } from "./fulfillment-engine";
import type {
  ProductFulfillmentRules,
  BranchFulfillmentOverride,
  OperatingHoursEntry,
  HolidayEntry,
  GlobalFulfillmentConfig,
  RiderPresenceRecord,
  OtpRecord,
} from "./types";
import {
  DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
  createDefaultOperatingHours,
  DEFAULT_PRODUCT_FULFILLMENT,
} from "./types";

// ── Store Shape Extension ───────────────────────────────────────────────────

export interface FulfillmentStoreSlice {
  fulfillment_config: GlobalFulfillmentConfig;
  product_fulfillment_rules: ProductFulfillmentRules[];
  operating_hours: OperatingHoursEntry[];
  holidays: HolidayEntry[];
  rider_presence: RiderPresenceRecord[];
  otp_records: OtpRecord[];
}

// ── Store Accessor ──────────────────────────────────────────────────────────

/**
 * Ensure the fulfillment-related keys exist in the memory store.
 * Call this before any fulfillment operation.
 */
export function ensureFulfillmentStore(memoryStore: any): void {
  if (!memoryStore.fulfillment_config) {
    memoryStore.fulfillment_config = { ...DEFAULT_GLOBAL_FULFILLMENT_CONFIG };
  } else {
    memoryStore.fulfillment_config = {
      ...DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
      ...memoryStore.fulfillment_config,
      late_night_delivery: {
        ...DEFAULT_GLOBAL_FULFILLMENT_CONFIG.late_night_delivery,
        ...(memoryStore.fulfillment_config.late_night_delivery || {}),
      },
      express_delivery: {
        ...DEFAULT_GLOBAL_FULFILLMENT_CONFIG.express_delivery,
        ...(memoryStore.fulfillment_config.express_delivery || {}),
      },
    };
  }
  if (!Array.isArray(memoryStore.product_fulfillment_rules)) {
    memoryStore.product_fulfillment_rules = [];
  }
  if (!Array.isArray(memoryStore.operating_hours)) {
    // Seed default organization-level operating hours
    memoryStore.operating_hours = createDefaultOperatingHours("organization", "global", "Asia/Kolkata");
  }
  if (!Array.isArray(memoryStore.holidays)) {
    memoryStore.holidays = [];
  }
  if (!Array.isArray(memoryStore.rider_presence)) {
    memoryStore.rider_presence = [];
  }
  if (!Array.isArray(memoryStore.otp_records)) {
    memoryStore.otp_records = [];
  }
}

// ── ApiEngine Data Provider ─────────────────────────────────────────────────

/**
 * Creates a FulfillmentDataProvider that reads from the ApiEngine memory store.
 * This is the ONLY adapter between the fulfillment engine and persistence.
 */
export function createApiEngineProvider(memoryStore: any): FulfillmentDataProvider {
  ensureFulfillmentStore(memoryStore);

  return {
    getProductFulfillmentRules(productId: string): ProductFulfillmentRules | null {
      const rules = (memoryStore.product_fulfillment_rules || []).find(
        (r: ProductFulfillmentRules) => r.product_id === productId
      );
      return rules || null;
    },

    getBranchOverride(branchId: string, productId: string): BranchFulfillmentOverride | null {
      // Read from branch_product_availability which has been extended with fulfillment fields
      const bpa = (memoryStore.branch_product_availability || []).find(
        (b: any) => b.branch_id === branchId && b.product_id === productId
      );
      if (!bpa) return null;
      return {
        branch_id: bpa.branch_id,
        product_id: bpa.product_id,
        status: bpa.status || "available",
        preparation_time_minutes: bpa.preparation_time_minutes ?? null,
        is_same_day_eligible: bpa.is_same_day_eligible !== false,
        instant_delivery_enabled: bpa.instant_delivery_enabled,
        order_cutoff_time: bpa.order_cutoff_time ?? null,
        preparation_delay_enabled: bpa.preparation_delay_enabled,
        preparation_delay_minutes: bpa.preparation_delay_minutes,
      };
    },

    getOperatingHours(entityType: string, entityId: string): OperatingHoursEntry[] {
      return (memoryStore.operating_hours || []).filter(
        (h: OperatingHoursEntry) => h.entity_type === entityType && h.entity_id === entityId
      );
    },

    getHolidays(entityType?: string, entityId?: string, dateStr?: string): HolidayEntry[] {
      return (memoryStore.holidays || []).filter(
        (h: HolidayEntry) =>
          (!entityType || h.entity_type === entityType) &&
          (!entityId || h.entity_id === entityId) &&
          (!dateStr || h.date === dateStr)
      );
    },

    getGlobalConfig(): GlobalFulfillmentConfig {
      return memoryStore.fulfillment_config || DEFAULT_GLOBAL_FULFILLMENT_CONFIG;
    },

    getOnlineRiderCount(branchId?: string): number {
      const riders = memoryStore.rider_presence || [];
      if (branchId) {
        return riders.filter(
          (r: RiderPresenceRecord) => r.online_status === "ONLINE" && r.branch_id === branchId
        ).length;
      }
      // Also count riders from delivery_partners with ONLINE availability_status
      const partners = memoryStore.delivery_partners || [];
      const onlinePartners = partners.filter(
        (p: any) => p.availability_status === "ONLINE" || p.availability_status === "AVAILABLE"
      );
      const presenceOnline = riders.filter(
        (r: RiderPresenceRecord) => r.online_status === "ONLINE"
      );
      // Deduplicate: use the higher count
      return Math.max(onlinePartners.length, presenceOnline.length);
    },
  };
}

// ── OTP Management ──────────────────────────────────────────────────────────

const OTP_TTL_SECONDS = 300;   // 5 minutes
const OTP_MAX_ATTEMPTS = 5;

/**
 * Generate a new OTP for an order (pickup or delivery).
 * Returns the OTP code. Persists to the store.
 */
export function generateOtp(
  memoryStore: any,
  orderId: string,
  otpType: "pickup" | "delivery"
): string {
  ensureFulfillmentStore(memoryStore);

  // Invalidate any existing OTP for this order/type
  const existing = memoryStore.otp_records.findIndex(
    (r: OtpRecord) => r.order_id === orderId && r.otp_type === otpType && !r.consumed
  );
  if (existing >= 0) {
    memoryStore.otp_records.splice(existing, 1);
  }

  const code = String(Math.floor(1000 + Math.random() * 9000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);

  const record: OtpRecord = {
    order_id: orderId,
    otp_type: otpType,
    code,
    generated_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    consumed: false,
    consumed_at: null,
    consumed_by: null,
    attempts: 0,
    max_attempts: OTP_MAX_ATTEMPTS,
  };

  memoryStore.otp_records.push(record);
  return code;
}

/**
 * Verify an OTP code for an order.
 * Returns { valid, reason, record } — consumes the OTP if valid.
 */
export function verifyOtp(
  memoryStore: any,
  orderId: string,
  otpType: "pickup" | "delivery",
  inputCode: string,
  verifiedBy: string
): { valid: boolean; reason: string; record?: OtpRecord } {
  ensureFulfillmentStore(memoryStore);

  const record = (memoryStore.otp_records as OtpRecord[]).find(
    (r) => r.order_id === orderId && r.otp_type === otpType && !r.consumed
  );

  if (!record) {
    return { valid: false, reason: "No active OTP found for this order. Request a new one." };
  }

  // Check expiry
  if (new Date() > new Date(record.expires_at)) {
    return { valid: false, reason: `OTP expired at ${record.expires_at}. Request a new one.`, record };
  }

  // Check attempts
  if (record.attempts >= record.max_attempts) {
    return { valid: false, reason: `Maximum verification attempts (${record.max_attempts}) exceeded. Request a new OTP.`, record };
  }

  // Increment attempt counter
  record.attempts += 1;

  // Verify code
  if (inputCode.trim() !== record.code) {
    const remaining = record.max_attempts - record.attempts;
    return {
      valid: false,
      reason: `Invalid OTP code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      record,
    };
  }

  // ✅ Valid — consume OTP (single-use)
  record.consumed = true;
  record.consumed_at = new Date().toISOString();
  record.consumed_by = verifiedBy;

  return { valid: true, reason: "OTP verified successfully.", record };
}

/**
 * Get the current active (unconsumed, unexpired) OTP for an order.
 */
export function getActiveOtp(
  memoryStore: any,
  orderId: string,
  otpType: "pickup" | "delivery"
): OtpRecord | null {
  ensureFulfillmentStore(memoryStore);
  const now = new Date();
  return (memoryStore.otp_records as OtpRecord[]).find(
    (r) =>
      r.order_id === orderId &&
      r.otp_type === otpType &&
      !r.consumed &&
      new Date(r.expires_at) > now
  ) || null;
}

/**
 * Clean up expired OTP records (housekeeping).
 */
export function cleanExpiredOtps(memoryStore: any): number {
  ensureFulfillmentStore(memoryStore);
  const now = new Date();
  const before = memoryStore.otp_records.length;
  memoryStore.otp_records = memoryStore.otp_records.filter(
    (r: OtpRecord) => !r.consumed || new Date(r.expires_at) > now
  );
  return before - memoryStore.otp_records.length;
}
