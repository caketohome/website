/**
 * CakeToHome Delivery Slot Generator
 *
 * Generates valid, bookable delivery time slots based on:
 * - Corporate same-day acceptance cutoff (hard operational ceiling)
 * - Branch operating hours & holiday calendar
 * - Product preparation time + buffer
 * - Delivery window limits (earliest / latest slot)
 * - Configurable Express delivery & Scheduled slots
 * - Existing slot bookings / capacity
 *
 * Slots are generated with explicit availability, status, and reason codes.
 */

import {
  DeliverySlot,
  OperatingHoursEntry,
  HolidayEntry,
  GlobalFulfillmentConfig,
  DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
  LateNightDeliveryConfig,
  ExpressDeliveryConfig,
  DEFAULT_LATE_NIGHT_CONFIG,
  DEFAULT_EXPRESS_CONFIG,
  FulfillmentReason,
  getNowInTimezone,
  timeStringToMinutes,
  minutesToTimeString,
  formatTimeForDisplay,
  addDaysToDateString,
  parseTimeString,
} from "./types";

import { FulfillmentDataProvider } from "./fulfillment-engine";

// ── Slot Configuration ──────────────────────────────────────────────────────

export interface SlotGeneratorConfig {
  slot_duration_minutes: number;          // Default 120 (2 hours) or 60 (1 hour)
  slot_interval_minutes: number;          // Default 60 (1 hour between slot starts)
  max_slots_per_window: number;           // Default 15 orders per slot
  days_ahead: number;                     // Default 3 days
  express_delivery?: ExpressDeliveryConfig;
  late_night_delivery?: LateNightDeliveryConfig;
  express_delivery_enabled?: boolean;     // legacy alias
  express_extra_charge?: number;          // legacy alias
  midnight_delivery_enabled?: boolean;    // legacy alias
  midnight_extra_charge?: number;         // legacy alias
  earliest_delivery_time?: string;        // "HH:MM"
  latest_delivery_slot_start?: string;    // "HH:MM"
  latest_delivery_slot_end?: string;      // "HH:MM"
}

export const DEFAULT_SLOT_CONFIG: SlotGeneratorConfig = {
  slot_duration_minutes: 60,
  slot_interval_minutes: 60,
  max_slots_per_window: 15,
  days_ahead: 3,
  express_delivery: { ...DEFAULT_EXPRESS_CONFIG },
  late_night_delivery: { ...DEFAULT_LATE_NIGHT_CONFIG },
  earliest_delivery_time: "09:00",
  latest_delivery_slot_start: "21:00",
  latest_delivery_slot_end: "22:00",
};

// ── Slot Generator ──────────────────────────────────────────────────────────

export class DeliverySlotGenerator {
  /**
   * Generate delivery slots for a product or cart at a branch.
   */
  static generateSlots(
    branchId: string | null,
    effectivePrepMinutes: number,
    deliveryBufferMinutes: number,
    provider: FulfillmentDataProvider,
    slotConfig: Partial<SlotGeneratorConfig> = {},
    existingBookings: Map<string, number> = new Map(),
    currentDatetime?: Date
  ): DeliverySlot[] {
    const globalConfig = provider.getGlobalConfig();
    const timezone = globalConfig.business_timezone || "Asia/Kolkata";
    const nowTz = getNowInTimezone(timezone, currentDatetime);
    const currentDateStr = nowTz.dateString;
    const currentTimeMinutes = timeStringToMinutes(nowTz.timeString);
    const totalLeadMinutes = effectivePrepMinutes + deliveryBufferMinutes;

    // Resolve Corporate Cutoff & Emergency Override
    let corporateCutoff = globalConfig.global_order_cutoff_time || "18:00";
    if (globalConfig.emergency_override_active) {
      const now = currentDatetime || new Date();
      const startValid = !globalConfig.emergency_override_start_time || new Date(globalConfig.emergency_override_start_time) <= now;
      const endValid = !globalConfig.emergency_override_end_time || new Date(globalConfig.emergency_override_end_time) >= now;
      if (startValid && endValid && globalConfig.emergency_override_cutoff_time) {
        corporateCutoff = globalConfig.emergency_override_cutoff_time;
      }
    }
    const corporateCutoffMinutes = timeStringToMinutes(corporateCutoff);
    const isPastCorporateCutoff = currentTimeMinutes >= corporateCutoffMinutes;
    const isSameDayEnabled = globalConfig.global_same_day_delivery_enabled !== false;

    // Resolve Late Night & Express Configuration - Midnight Delivery is disabled globally
    const lateNightConfig: LateNightDeliveryConfig = {
      ...DEFAULT_LATE_NIGHT_CONFIG,
      enabled: false,
      additional_charge: 0,
    };

    const globalExpress = (globalConfig.express_delivery as ExpressDeliveryConfig | undefined) || DEFAULT_EXPRESS_CONFIG;
    const expressConfig: ExpressDeliveryConfig = slotConfig.express_delivery || {
      ...DEFAULT_EXPRESS_CONFIG,
      ...globalExpress,
      enabled: slotConfig.express_delivery_enabled ?? globalExpress.enabled ?? DEFAULT_EXPRESS_CONFIG.enabled,
      surcharge: slotConfig.express_extra_charge ?? globalExpress.surcharge ?? DEFAULT_EXPRESS_CONFIG.surcharge,
    };

    const slotDuration = slotConfig.slot_duration_minutes || 60;
    const slotInterval = slotConfig.slot_interval_minutes || 60;
    const maxSlotsPerWindow = slotConfig.max_slots_per_window || 15;
    const daysAhead = slotConfig.days_ahead || 3;

    const earliestLimitMinutes = timeStringToMinutes(slotConfig.earliest_delivery_time || globalConfig.earliest_delivery_time || "09:00");
    const latestStartLimitMinutes = timeStringToMinutes(slotConfig.latest_delivery_slot_start || globalConfig.latest_delivery_slot_start || "21:00");
    const latestEndLimitMinutes = timeStringToMinutes(slotConfig.latest_delivery_slot_end || globalConfig.latest_delivery_slot_end || "22:00");

    const allSlots: DeliverySlot[] = [];

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const dateStr = addDaysToDateString(currentDateStr, dayOffset);
      const isToday = dayOffset === 0;

      // Check if this date is a full-day holiday
      const holidays = [
        ...provider.getHolidays("organization", "global", dateStr),
        ...(branchId ? provider.getHolidays("branch", branchId, dateStr) : []),
      ];
      const isFullDayHoliday = holidays.some((h) => h.is_full_day);
      if (isFullDayHoliday) continue;

      // Get operating hours for this day
      const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
      const hours = DeliverySlotGenerator.getEffectiveHours(branchId, dayOfWeek, provider);
      if (hours && !hours.is_open) continue;

      const openMinutes = hours
        ? timeStringToMinutes(hours.opening_time || (hours as any).open_time)
        : timeStringToMinutes("09:00");
      const closeMinutes = hours
        ? timeStringToMinutes(hours.closing_time || (hours as any).close_time)
        : timeStringToMinutes("22:00");

      // Partial holiday adjustments
      const partialHoliday = holidays.find(h => !h.is_full_day && (h.opening_time || (h as any).open_time) && (h.closing_time || (h as any).close_time));
      const effectiveOpen = Math.max(openMinutes, partialHoliday ? timeStringToMinutes(partialHoliday.opening_time || (partialHoliday as any).open_time) : openMinutes, earliestLimitMinutes);
      const effectiveClose = Math.min(closeMinutes, partialHoliday ? timeStringToMinutes(partialHoliday.closing_time || (partialHoliday as any).close_time) : closeMinutes, latestEndLimitMinutes);

      // ── Standard Slots ────────────────────────────────────────────────────
      for (let sMin = effectiveOpen; sMin + slotDuration <= effectiveClose && sMin <= latestStartLimitMinutes; sMin += slotInterval) {
        const eMin = sMin + slotDuration;
        const startTime = minutesToTimeString(sMin);
        const endTime = minutesToTimeString(Math.min(eMin, 24 * 60 - 1));
        const slotId = `SLOT_STANDARD_${dateStr}_${startTime.replace(":", "")}_${endTime.replace(":", "")}`;

        const booked = existingBookings.get(slotId) || 0;
        const remainingCapacity = Math.max(0, maxSlotsPerWindow - booked);

        let available = true;
        let status: DeliverySlot["status"] = "AVAILABLE";
        let reasonCode: FulfillmentReason = "AVAILABLE";
        let reasonMessage = "";

        if (isToday) {
          if (!isSameDayEnabled) {
            available = false;
            status = "DISABLED";
            reasonCode = "SAME_DAY_DISABLED";
            reasonMessage = "Same-day delivery is disabled";
          } else if (isPastCorporateCutoff) {
            available = false;
            status = "PAST_CUTOFF";
            reasonCode = "CORPORATE_CUTOFF_PASSED";
            reasonMessage = `Same-day ordering closed (cutoff: ${formatTimeForDisplay(corporateCutoff)})`;
          } else if (currentTimeMinutes + totalLeadMinutes > sMin) {
            available = false;
            status = "PREP_TIME_EXCEEDED";
            reasonCode = "PRODUCT_PREP_TIME";
            reasonMessage = `Requires ${effectivePrepMinutes}m prep + ${deliveryBufferMinutes}m transit`;
          }
        }

        if (available && remainingCapacity <= 0) {
          available = false;
          status = "FULL";
          reasonCode = "SLOT_CAPACITY_FULL";
          reasonMessage = "Slot fully booked";
        }

        const label = `${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}`;

        allSlots.push({
          id: slotId,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          label,
          slot_name: label,
          available,
          is_available: available,
          status,
          reason_code: reasonCode,
          reason_message: reasonMessage,
          booked_count: booked,
          max_capacity: maxSlotsPerWindow,
          remaining_capacity: remainingCapacity,
          extra_charge: 0,
          extra_fee: 0,
          slot_type: "standard",
          is_express: false,
          is_midnight: false,
          cutoff: isToday ? corporateCutoff : undefined,
        });
      }

      // ── Express Slots (Delivery Only) ─────────────────────────────────────
      if (expressConfig.enabled) {
        const isExpressAllowedForDate = isToday || (!expressConfig.same_day_only && (expressConfig.max_days_ahead === undefined || dayOffset <= (expressConfig.max_days_ahead || 0)));

        if (isExpressAllowedForDate) {
          const expStartMin = timeStringToMinutes(expressConfig.start_time || "09:00");
          const expEndMin = timeStringToMinutes(expressConfig.end_time || "21:00");
          const expLead = expressConfig.minimum_lead_time_minutes || 45;
          const expSlotId = `SLOT_EXPRESS_${dateStr}`;
          const expBooked = existingBookings.get(expSlotId) || 0;
          const expMax = expressConfig.max_capacity || 10;
          const expRemaining = Math.max(0, expMax - expBooked);

          let expAvailable = true;
          let expStatus: DeliverySlot["status"] = "AVAILABLE";
          let expReasonCode: FulfillmentReason = "AVAILABLE";
          let expReasonMsg = "";

          if (isToday) {
            const expCutoffMinutes = !expressConfig.subject_to_corporate_cutoff && expressConfig.special_order_cutoff
              ? timeStringToMinutes(expressConfig.special_order_cutoff)
              : corporateCutoffMinutes;

            if (currentTimeMinutes >= expCutoffMinutes) {
              expAvailable = false;
              expStatus = "PAST_CUTOFF";
              expReasonCode = expressConfig.subject_to_corporate_cutoff ? "CORPORATE_CUTOFF_PASSED" : "SPECIAL_CUTOFF_PASSED";
              expReasonMsg = `Express ordering closed for today`;
            } else if (currentTimeMinutes < expStartMin || currentTimeMinutes > expEndMin) {
              expAvailable = false;
              expStatus = "CLOSED";
              expReasonCode = "STORE_CLOSED";
              expReasonMsg = `Express available between ${formatTimeForDisplay(expressConfig.start_time)} - ${formatTimeForDisplay(expressConfig.end_time)}`;
            }
          }

          if (expAvailable && expRemaining <= 0) {
            expAvailable = false;
            expStatus = "FULL";
            expReasonCode = "SLOT_CAPACITY_FULL";
            expReasonMsg = "Express slots full";
          }

          allSlots.push({
            id: expSlotId,
            date: dateStr,
            start_time: isToday ? minutesToTimeString(currentTimeMinutes + 15) : (expressConfig.start_time || "09:00"),
            end_time: isToday ? minutesToTimeString(currentTimeMinutes + 15 + expLead) : (expressConfig.end_time || "21:00"),
            label: expressConfig.display_name || "⚡ Express 45-Min Delivery",
            slot_name: expressConfig.display_name || "⚡ Express 45-Min Delivery",
            available: expAvailable,
            is_available: expAvailable,
            status: expStatus,
            reason_code: expReasonCode,
            reason_message: expReasonMsg,
            booked_count: expBooked,
            max_capacity: expMax,
            remaining_capacity: expRemaining,
            extra_charge: expressConfig.surcharge,
            extra_fee: expressConfig.surcharge,
            slot_type: "express",
            is_express: true,
            is_midnight: false,
            cutoff: isToday ? (!expressConfig.subject_to_corporate_cutoff && expressConfig.special_order_cutoff ? expressConfig.special_order_cutoff : corporateCutoff) : undefined,
          });
        }
      }

      // Note: Midnight Delivery discontinued
    }

    return allSlots;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  private static getEffectiveHours(
    branchId: string | null,
    dayOfWeek: number,
    provider: FulfillmentDataProvider
  ): OperatingHoursEntry | null {
    if (branchId) {
      const branchHours = provider.getOperatingHours("branch", branchId);
      const entry = branchHours.find(h => h.day_of_week === dayOfWeek);
      if (entry) return entry;
    }

    const orgHours = provider.getOperatingHours("organization", "global");
    return orgHours.find(h => h.day_of_week === dayOfWeek) || null;
  }
}

