/**
 * CakeToHome Delivery Slot Generator
 *
 * Generates valid, bookable delivery time slots based on:
 * - Branch operating hours
 * - Product preparation time + any preparation delay
 * - Order cutoff times
 * - Holiday calendar
 * - Existing slot bookings / capacity
 * - Express delivery / midnight delivery options
 *
 * Slots are generated for 1-7 days ahead. Each slot is a 2-hour window.
 */

import {
  DeliverySlot,
  OperatingHoursEntry,
  HolidayEntry,
  GlobalFulfillmentConfig,
  DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
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
  slot_duration_minutes: number;          // Default 120 (2 hours)
  slot_interval_minutes: number;          // Default 60 (1 hour between slot starts)
  max_slots_per_window: number;           // Default 5 orders per slot
  days_ahead: number;                     // Default 3 days
  express_delivery_enabled: boolean;      // Express slots (30 min windows)
  express_extra_charge: number;           // Extra charge for express
  midnight_delivery_enabled: boolean;     // 11 PM - 12 AM slots
  midnight_extra_charge: number;          // Extra charge for midnight
}

export const DEFAULT_SLOT_CONFIG: SlotGeneratorConfig = {
  slot_duration_minutes: 120,
  slot_interval_minutes: 60,
  max_slots_per_window: 5,
  days_ahead: 3,
  express_delivery_enabled: true,
  express_extra_charge: 99,
  midnight_delivery_enabled: true,
  midnight_extra_charge: 149,
};

// ── Slot Generator ──────────────────────────────────────────────────────────

export class DeliverySlotGenerator {
  /**
   * Generate delivery slots for a product at a branch.
   *
   * @param branchId - Target branch
   * @param effectivePrepMinutes - Total preparation time (base + delay)
   * @param deliveryBufferMinutes - Delivery transit buffer
   * @param provider - Data provider for operating hours, holidays, etc.
   * @param slotConfig - Slot generation configuration
   * @param existingBookings - Map of slot_id → current booking count
   */
  static generateSlots(
    branchId: string | null,
    effectivePrepMinutes: number,
    deliveryBufferMinutes: number,
    provider: FulfillmentDataProvider,
    slotConfig: SlotGeneratorConfig = DEFAULT_SLOT_CONFIG,
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
    let corporateCutoff = globalConfig.global_order_cutoff_time || "20:00";
    if (globalConfig.emergency_override_active) {
      const now = currentDatetime || new Date();
      const startValid = !globalConfig.emergency_override_start_time || new Date(globalConfig.emergency_override_start_time) <= now;
      const endValid = !globalConfig.emergency_override_end_time || new Date(globalConfig.emergency_override_end_time) >= now;
      if (startValid && endValid && globalConfig.emergency_override_cutoff_time) {
        corporateCutoff = globalConfig.emergency_override_cutoff_time;
      }
    }
    const cutoffMinutes = timeStringToMinutes(corporateCutoff);
    const isPastSameDayCutoff = currentTimeMinutes >= cutoffMinutes;
    const isSameDayEnabled = globalConfig.global_same_day_delivery_enabled !== false;

    const allSlots: DeliverySlot[] = [];

    for (let dayOffset = 0; dayOffset < slotConfig.days_ahead; dayOffset++) {
      const dateStr = addDaysToDateString(currentDateStr, dayOffset);
      const isToday = dayOffset === 0;

      // If today and same-day delivery is disabled or corporate cutoff passed, skip today's slots
      if (isToday && (!isSameDayEnabled || isPastSameDayCutoff)) {
        continue;
      }

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
      const effectiveOpen = partialHoliday
        ? timeStringToMinutes(partialHoliday.opening_time || (partialHoliday as any).open_time)
        : openMinutes;
      const effectiveClose = partialHoliday
        ? timeStringToMinutes(partialHoliday.closing_time || (partialHoliday as any).close_time)
        : closeMinutes;

      // Standard slots
      const standardSlots = DeliverySlotGenerator.generateWindowSlots(
        dateStr,
        effectiveOpen,
        effectiveClose,
        slotConfig.slot_duration_minutes,
        slotConfig.slot_interval_minutes,
        slotConfig.max_slots_per_window,
        isToday ? currentTimeMinutes + totalLeadMinutes : effectiveOpen,
        existingBookings,
        false,
        false,
        0
      );
      allSlots.push(...standardSlots);

      // Express slots (30-min windows during peak hours)
      if (slotConfig.express_delivery_enabled) {
        const expressStart = isToday
          ? Math.max(currentTimeMinutes + totalLeadMinutes, effectiveOpen)
          : effectiveOpen;
        const expressEnd = Math.min(effectiveClose, effectiveOpen + 8 * 60); // Express available for first 8 hours

        if (expressStart < expressEnd) {
          const expressSlots = DeliverySlotGenerator.generateWindowSlots(
            dateStr,
            expressStart,
            expressEnd,
            30,   // 30-minute express windows
            30,
            2,    // Lower capacity for express
            expressStart,
            existingBookings,
            true,
            false,
            slotConfig.express_extra_charge
          );
          allSlots.push(...expressSlots);
        }
      }

      // Midnight slots (23:00 - 00:00)
      if (slotConfig.midnight_delivery_enabled) {
        const midnightStart = 23 * 60;
        const midnightEnd = 24 * 60;
        const canGenerateMidnight = !isToday || (currentTimeMinutes + totalLeadMinutes < midnightStart);

        if (canGenerateMidnight) {
          const midnightSlots = DeliverySlotGenerator.generateWindowSlots(
            dateStr,
            midnightStart,
            midnightEnd,
            60,
            60,
            2,
            isToday ? Math.max(currentTimeMinutes + totalLeadMinutes, midnightStart) : midnightStart,
            existingBookings,
            false,
            true,
            slotConfig.midnight_extra_charge
          );
          allSlots.push(...midnightSlots);
        }
      }
    }

    return allSlots;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  private static generateWindowSlots(
    dateStr: string,
    startMinutes: number,
    endMinutes: number,
    slotDuration: number,
    slotInterval: number,
    maxCapacity: number,
    earliestMinutes: number,
    existingBookings: Map<string, number>,
    isExpress: boolean,
    isMidnight: boolean,
    extraCharge: number
  ): DeliverySlot[] {
    const slots: DeliverySlot[] = [];

    for (let slotStart = startMinutes; slotStart + slotDuration <= endMinutes; slotStart += slotInterval) {
      // Skip slots that start before the earliest possible delivery time
      if (slotStart < earliestMinutes) continue;

      const slotEnd = slotStart + slotDuration;
      const startTime = minutesToTimeString(slotStart);
      const endTime = minutesToTimeString(Math.min(slotEnd, 24 * 60 - 1));

      const slotId = `${dateStr}_${startTime}_${endTime}${isExpress ? "_express" : ""}${isMidnight ? "_midnight" : ""}`;
      const currentBookings = existingBookings.get(slotId) || 0;
      const remainingCapacity = Math.max(0, maxCapacity - currentBookings);

      const label = `${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}`;

      slots.push({
        id: slotId,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        label,
        available: remainingCapacity > 0,
        is_available: remainingCapacity > 0,
        booked_count: currentBookings,
        max_capacity: maxCapacity,
        remaining_capacity: remainingCapacity,
        extra_charge: extraCharge,
        slot_type: isMidnight ? "midnight" : (isExpress ? "express" : "standard"),
        is_express: isExpress,
        is_midnight: isMidnight,
      });
    }

    return slots;
  }

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
