/**
 * CakeToHome Fulfillment System — Shared Types
 *
 * Single source of truth for all fulfillment-related type definitions.
 * Used by: fulfillment-engine, delivery-slot-generator, API routes, UI components, AI concierge.
 */

// ── Fulfillment Reason Codes ────────────────────────────────────────────────

// ── Fulfillment Reason Codes ────────────────────────────────────────────────

export type FulfillmentReason =
  | "AVAILABLE"
  | "SAME_DAY_AVAILABLE"
  | "PRE_ORDER_AVAILABLE"
  | "SAME_DAY_NOT_AVAILABLE"
  | "SAME_DAY_DISABLED"
  | "OPERATIONS_CLOSED"
  | "SAME_DAY_CUTOFF_PASSED"
  | "CORPORATE_CUTOFF_PASSED"
  | "STORE_CLOSED"
  | "BRANCH_CLOSED"
  | "HOLIDAY"
  | "HOLIDAY_CLOSURE"
  | "PRODUCT_REQUIRES_PREORDER"
  | "PRODUCT_ADVANCE_ORDER_REQUIRED"
  | "PREPARATION_TIME_EXCEEDED"
  | "PRODUCT_PREP_TIME"
  | "INSTANT_DELIVERY_DISABLED"
  | "DELIVERY_UNAVAILABLE"
  | "DELIVERY_SLOT_UNAVAILABLE"
  | "CAPACITY_UNAVAILABLE"
  | "INVALID_TIME_SLOT"
  | "OUT_OF_STOCK"
  | "SLOT_CAPACITY_FULL"
  | "SPECIAL_DELIVERY_DISABLED"
  | "SPECIAL_CUTOFF_PASSED"
  | "PREORDER_REQUIRED"
  | "INVALID_DATE"
  | "INVALID_SLOT"
  | "STALE_CHECKOUT";

// ── Special Delivery Configurations ─────────────────────────────────────────

export interface LateNightDeliveryConfig {
  enabled: boolean;
  display_name: string;               // e.g. "Midnight Surprise Delivery"
  start_time: string;                 // "HH:MM" e.g. "23:30"
  end_time: string;                   // "HH:MM" e.g. "00:05" (crosses midnight)
  additional_charge: number;          // Surcharge in INR e.g. 199
  minimum_lead_time_minutes: number;  // e.g. 60
  required_prep_time_minutes: number; // e.g. 60
  subject_to_corporate_cutoff: boolean;// If true, strictly follows corporate cutoff; if false, uses special_order_cutoff
  special_order_cutoff: string | null;// "HH:MM" e.g. "21:30" when subject_to_corporate_cutoff is false
  allowed_days?: number[];            // 0-6 days (all if omitted)
}

export const DEFAULT_LATE_NIGHT_CONFIG: LateNightDeliveryConfig = {
  enabled: true,
  display_name: "Midnight Surprise Delivery",
  start_time: "23:30",
  end_time: "00:05",
  additional_charge: 199,
  minimum_lead_time_minutes: 60,
  required_prep_time_minutes: 60,
  subject_to_corporate_cutoff: true,  // Default follows corporate cutoff
  special_order_cutoff: null,
};

export interface ExpressDeliveryConfig {
  enabled: boolean;
  display_name: string;               // e.g. "Express 45-Min Delivery"
  start_time: string;                 // "HH:MM" e.g. "09:00"
  end_time: string;                   // "HH:MM" e.g. "21:00"
  surcharge: number;                  // e.g. 99
  minimum_lead_time_minutes: number;  // e.g. 45
  subject_to_corporate_cutoff: boolean;// If true, follows corporate cutoff
  special_order_cutoff: string | null;// "HH:MM" e.g. "18:00"
}

export const DEFAULT_EXPRESS_CONFIG: ExpressDeliveryConfig = {
  enabled: true,
  display_name: "Express 45-Min Delivery",
  start_time: "09:00",
  end_time: "21:00",
  surcharge: 99,
  minimum_lead_time_minutes: 45,
  subject_to_corporate_cutoff: true,
  special_order_cutoff: null,
};

// ── Product Fulfillment Rules ───────────────────────────────────────────────

export interface ProductFulfillmentRules {
  id?: string;
  product_id: string;
  instant_delivery_enabled: boolean;
  same_day_delivery_enabled: boolean;
  pre_order_enabled: boolean;
  minimum_lead_time_minutes: number;
  minimum_lead_time_days: number;
  order_cutoff_time: string | null;       // "HH:MM" format
  preparation_time_minutes: number;
  preparation_delay_enabled: boolean;
  preparation_delay_minutes: number;
  delivery_buffer_minutes: number;
  custom_delivery_rules: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_PRODUCT_FULFILLMENT: Omit<ProductFulfillmentRules, "product_id"> = {
  instant_delivery_enabled: true,
  same_day_delivery_enabled: true,
  pre_order_enabled: false,
  minimum_lead_time_minutes: 0,
  minimum_lead_time_days: 0,
  order_cutoff_time: null,
  preparation_time_minutes: 60,
  preparation_delay_enabled: false,
  preparation_delay_minutes: 0,
  delivery_buffer_minutes: 30,
  custom_delivery_rules: null,
};

// ── Branch Fulfillment Overrides ───────────────────────────────────────────

export interface BranchFulfillmentOverride {
  id?: string;
  branch_id: string;
  product_id: string;
  status: "available" | "out_of_stock" | "hidden";
  preparation_time_minutes: number | null;
  is_same_day_eligible: boolean;
  instant_delivery_enabled?: boolean;
  order_cutoff_time?: string | null;
  preparation_delay_enabled?: boolean;
  preparation_delay_minutes?: number;
  late_night_enabled?: boolean;
  late_night_surcharge?: number;
  late_night_cutoff_time?: string | null;
  express_enabled?: boolean;
  express_surcharge?: number;
}

// ── Operating Hours ─────────────────────────────────────────────────────────

export type OperatingHoursEntityType = "organization" | "branch" | "city";

export interface OperatingHoursEntry {
  id?: string;
  entity_type: OperatingHoursEntityType;
  entity_id: string;
  day_of_week: number;                   // 0 = Sunday, 6 = Saturday
  is_open: boolean;
  opening_time: string;                  // "HH:MM"
  closing_time: string;                  // "HH:MM"
  open_time?: string;                    // alias for compatibility
  close_time?: string;                   // alias for compatibility
  last_order_time: string | null;        // "HH:MM" — last time same-day orders are accepted
  timezone: string;                      // IANA timezone, e.g. "Asia/Kolkata"
  created_at?: string;
  updated_at?: string;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function createDefaultOperatingHours(
  entityType: OperatingHoursEntityType,
  entityId: string,
  timezone = "Asia/Kolkata"
): OperatingHoursEntry[] {
  return Array.from({ length: 7 }, (_, i) => ({
    entity_type: entityType,
    entity_id: entityId,
    day_of_week: i,
    is_open: true,
    opening_time: "09:00",
    closing_time: "22:00",
    open_time: "09:00",
    close_time: "22:00",
    last_order_time: "20:00",
    timezone,
  }));
}

// ── Holiday Calendar ────────────────────────────────────────────────────────

export interface HolidayEntry {
  id?: string;
  entity_type: OperatingHoursEntityType;
  entity_id: string;
  date: string;                          // "YYYY-MM-DD"
  name: string;
  is_full_day: boolean;
  opening_time: string | null;           // For partial holidays
  closing_time: string | null;
  open_time?: string | null;
  close_time?: string | null;
  reason?: string;
  created_at?: string;
  updated_at?: string;
}

// ── Rider Presence ──────────────────────────────────────────────────────────

export type RiderOnlineStatus = "ONLINE" | "OFFLINE" | "ON_BREAK";

export interface RiderPresenceRecord {
  id?: string;
  rider_id?: string;                     // compatibility alias
  partner_id?: string;
  online_status: RiderOnlineStatus;
  last_seen_at?: string;
  last_ping_at?: string;
  current_order_id?: string | null;
  hub_id?: string | null;
  branch_id?: string | null;
  city_id?: string | null;
  session_token?: string | null;
  went_online_at?: string | null;
  went_offline_at?: string | null;
  battery_level?: number;
  current_latitude?: number;
  current_longitude?: number;
  created_at?: string;
}

// ── Delivery Slots ──────────────────────────────────────────────────────────

export interface DeliverySlot {
  id: string;
  date: string;                          // "YYYY-MM-DD"
  start_time: string;                    // "HH:MM"
  end_time: string;                      // "HH:MM"
  label: string;                         // "10:00 AM - 12:00 PM"
  slot_name?: string;                    // e.g. "Morning Slot" or "🌙 Midnight Surprise Delivery"
  available: boolean;
  is_available?: boolean;
  status: "AVAILABLE" | "PAST_CUTOFF" | "FULL" | "CLOSED" | "PREP_TIME_EXCEEDED" | "DISABLED";
  reason_code?: FulfillmentReason;
  reason_message?: string;
  booked_count: number;
  remaining_capacity: number;
  max_capacity: number;
  extra_charge: number;
  extra_fee?: number;
  slot_type: "standard" | "express" | "midnight" | "pickup";
  is_express: boolean;
  is_midnight: boolean;
  requires_preorder?: boolean;
  cutoff?: string;                       // e.g. "18:00"
}

// ── Global Fulfillment Config (stored in Settings module) ───────────────────

export interface GlobalFulfillmentConfig {
  default_preparation_time_minutes: number;
  default_delivery_buffer_minutes: number;
  global_preparation_delay_enabled: boolean;
  global_preparation_delay_minutes: number;
  preparation_delay_reason?: string | null;
  global_order_cutoff_time: string;      // "HH:MM" e.g. "18:00"
  global_instant_delivery_enabled: boolean;
  global_same_day_delivery_enabled: boolean;
  business_timezone: string;             // "Asia/Kolkata"
  earliest_delivery_time?: string;       // "HH:MM" e.g. "09:00" or "10:00"
  latest_delivery_slot_start?: string;   // "HH:MM" e.g. "21:00"
  latest_delivery_slot_end?: string;     // "HH:MM" e.g. "22:00"
  late_night_delivery?: LateNightDeliveryConfig;
  express_delivery?: ExpressDeliveryConfig;
  // Authorized Emergency Corporate Cutoff Override
  emergency_override_active?: boolean;
  emergency_override_cutoff_time?: string; // e.g. "20:30"
  emergency_override_reason?: string | null;
  emergency_override_start_time?: string | null; // ISO timestamp
  emergency_override_end_time?: string | null;   // ISO timestamp
  emergency_override_authorized_by?: string | null;
  emergency_override_authorized_role?: "SUPER_ADMIN" | "OPERATIONS" | string | null;
  emergency_override_updated_at?: string | null;
}

export const DEFAULT_GLOBAL_FULFILLMENT_CONFIG: GlobalFulfillmentConfig = {
  default_preparation_time_minutes: 60,
  default_delivery_buffer_minutes: 30,
  global_preparation_delay_enabled: false,
  global_preparation_delay_minutes: 0,
  global_order_cutoff_time: "20:00",
  global_instant_delivery_enabled: true,
  global_same_day_delivery_enabled: true,
  business_timezone: "Asia/Kolkata",
  earliest_delivery_time: "09:00",
  latest_delivery_slot_start: "21:00",
  latest_delivery_slot_end: "22:00",
  late_night_delivery: { ...DEFAULT_LATE_NIGHT_CONFIG },
  express_delivery: { ...DEFAULT_EXPRESS_CONFIG },
  emergency_override_active: false,
  emergency_override_cutoff_time: "20:30",
  emergency_override_reason: null,
  emergency_override_start_time: null,
  emergency_override_end_time: null,
  emergency_override_authorized_by: null,
  emergency_override_authorized_role: null,
  emergency_override_updated_at: null,
};

// ── Eligibility Check Input/Output ──────────────────────────────────────────

export interface FulfillmentCheckInput {
  product_id: string;
  quantity?: number;
  branch_id?: string;
  city_id?: string;
  requested_delivery_date?: string;      // "YYYY-MM-DD"
  requested_delivery_time?: string;      // "HH:MM"
  current_datetime?: Date;               // Server-injected, never from client
}

export interface FulfillmentCheckResult {
  eligible: boolean;
  reason: FulfillmentReason;
  earliest_available_datetime: string | null;   // ISO string
  next_available_date?: string | null;           // "YYYY-MM-DD"
  preparation_minutes: number;
  effective_preparation_minutes: number;         // base + delay
  cutoff_datetime: string | null;                // ISO string
  delivery_available: boolean;
  requires_preorder: boolean;
  instant_delivery_available: boolean;
  delivery_slots: DeliverySlot[];
  message: string;                               // Human-readable explanation
  approaching_cutoff_minutes?: number | null;    // If < 45m from cutoff
  corporate_cutoff_time?: string;                // Effective corporate cutoff e.g. "20:00"
  emergency_override_active?: boolean;
}

// ── Multi-Product Cart Eligibility ──────────────────────────────────────────

export interface CartFulfillmentCheckInput {
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
  branch_id?: string;
  city_id?: string;
  requested_delivery_date?: string;
  requested_delivery_time?: string;
  current_datetime?: Date;
}

export interface CartFulfillmentCheckResult {
  all_eligible: boolean;
  effective_preparation_minutes: number;        // max across all items
  effective_lead_time_minutes: number;           // max across all items
  earliest_available_datetime: string | null;
  next_available_date?: string | null;
  requires_preorder: boolean;
  items: Array<{
    product_id: string;
    eligible: boolean;
    reason: FulfillmentReason;
    message: string;
    preparation_minutes: number;
  }>;
  delivery_slots: DeliverySlot[];
  message: string;
  approaching_cutoff_minutes?: number | null;
  corporate_cutoff_time?: string;
  emergency_override_active?: boolean;
}

// ── Canonical Domain Service: calculateOrderAvailability (Phase 2 Contract) ──

export interface OrderAvailabilityInput {
  product?: string | { id?: string; product_id?: string; [key: string]: any };
  product_id?: string;
  productItems?: Array<{ product_id: string; quantity?: number; [key: string]: any }>;
  items?: Array<{ product_id: string; quantity?: number; [key: string]: any }>;
  branch?: string | { id?: string; [key: string]: any };
  branch_id?: string;
  city?: string | { id?: string; [key: string]: any };
  city_id?: string;
  requestedDate?: string;
  requested_delivery_date?: string;
  requestedTime?: string;
  requested_delivery_time?: string;
  customer?: string | { id?: string; customer_uid?: string; [key: string]: any };
  customer_uid?: string;
  currentBusinessTime?: Date | string;
  current_datetime?: Date | string;
}

export interface OrderAvailabilityResult {
  eligible: boolean;
  same_day_available: boolean;
  instant_delivery_available: boolean;
  pre_order_required: boolean;
  reason: FulfillmentReason;
  next_available_date: string | null;
  next_available_slot: DeliverySlot | null;
  preparation_minutes: number;
  preparation_delay_minutes: number;
  effective_preparation_minutes: number;
  corporate_cutoff: string;
  branch_status: "AVAILABLE" | "OUT_OF_STOCK" | "CLOSED" | "PAUSED";
  product_status: "AVAILABLE" | "OUT_OF_STOCK" | "DISCONTINUED";
  business_timezone: string;
  message: string;
  delivery_slots: DeliverySlot[];
  approaching_cutoff_minutes?: number | null;
  emergency_override_active?: boolean;
}

// ── Order Fulfillment Decision Snapshot ─────────────────────────────────────

export interface OrderFulfillmentSnapshot {
  same_day_requested: boolean;
  same_day_allowed: boolean;
  corporate_cutoff: string;                     // "20:00" or override cutoff
  corporate_cutoff_timezone: string;            // "Asia/Kolkata"
  branch_open: boolean;
  product_advance_notice_minutes: number;
  product_preparation_minutes: number;
  preparation_delay_minutes: number;
  effective_ready_time: string | null;
  delivery_slot: string | Record<string, any> | null;
  availability_decision: "ALLOWED" | "REJECTED" | "PRE_ORDER_REQUIRED";
  availability_reason: string;
  emergency_override_applied: boolean;
  evaluated_at: string;
}

// ── OTP Records ─────────────────────────────────────────────────────────────

export interface OtpRecord {
  order_id: string;
  otp_type: "pickup" | "delivery";
  code: string;
  generated_at: string;
  expires_at: string;
  consumed: boolean;
  consumed_at: string | null;
  consumed_by: string | null;
  attempts: number;
  max_attempts: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse "HH:MM" string into { hours, minutes } numbers.
 */
export function parseTimeString(time: string | null | undefined): { hours: number; minutes: number } {
  if (!time || typeof time !== "string") return { hours: 0, minutes: 0 };
  const parts = time.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return { hours: isNaN(h) ? 0 : h, minutes: isNaN(m) ? 0 : m };
}

/**
 * Format hours/minutes as "HH:MM".
 */
export function formatTimeString(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Get current time components in a specific timezone.
 */
export function getNowInTimezone(timezone = "Asia/Kolkata", dateInput?: Date | string | null): {
  date: Date;
  hours: number;
  minutes: number;
  dayOfWeek: number;
  dateString: string;
  timeString: string;
} {
  const now = dateInput ? new Date(dateInput) : new Date();
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const year = Number(parts.find(p => p.type === "year")?.value || now.getFullYear());
  const month = Number(parts.find(p => p.type === "month")?.value || 1);
  const day = Number(parts.find(p => p.type === "day")?.value || 1);
  const hours = Number(parts.find(p => p.type === "hour")?.value || 0);
  const minutes = Number(parts.find(p => p.type === "minute")?.value || 0);

  // Get day of week in the target timezone
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const weekday = dayFormatter.format(now);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayMap[weekday] ?? now.getDay();

  return {
    date: now,
    hours,
    minutes,
    dayOfWeek,
    dateString: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    timeString: formatTimeString(hours, minutes),
  };
}

/**
 * Compare two "HH:MM" time strings. Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareTimeStrings(a: string, b: string): number {
  const pa = parseTimeString(a);
  const pb = parseTimeString(b);
  return (pa.hours * 60 + pa.minutes) - (pb.hours * 60 + pb.minutes);
}

/**
 * Convert "HH:MM" to total minutes since midnight.
 */
export function timeStringToMinutes(time: string | null | undefined): number {
  const { hours, minutes } = parseTimeString(time);
  return hours * 60 + minutes;
}

/**
 * Convert total minutes since midnight to "HH:MM".
 */
export function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return formatTimeString(h, m);
}

/**
 * Format "HH:MM" as "10:00 AM" for customer display.
 */
export function formatTimeForDisplay(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const { hours, minutes } = parseTimeString(timeStr);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Convert "HH:MM" to total minutes, supporting midnight crossing if end is less than start.
 */
export function timeStringToMinutesWithCrossing(time: string, referenceStartMinutes?: number): number {
  const mins = timeStringToMinutes(time);
  if (referenceStartMinutes !== undefined && mins < referenceStartMinutes) {
    return mins + 24 * 60; // Crosses to next calendar day
  }
  return mins;
}

/**
 * Add days to a "YYYY-MM-DD" date string and return "YYYY-MM-DD".
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

