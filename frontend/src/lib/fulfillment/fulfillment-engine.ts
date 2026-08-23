/**
 * CakeToHome Centralized Fulfillment Engine
 *
 * THE ONE canonical service for all order eligibility calculations.
 * Used by: Product pages, Cart validation, Checkout, Order API, Branch Manager dashboard,
 *          AI Concierge, and n8n event gateway.
 *
 * Configuration precedence (highest → lowest):
 *   1. Product-level fulfillment rules
 *   2. Branch-level overrides (BranchProductAvailability)
 *   3. Global fulfillment config (Settings)
 *
 * This module is PURE business logic — no React, no HTTP, no database imports.
 * It receives pre-fetched data and returns deterministic results.
 */

import {
  FulfillmentCheckInput,
  FulfillmentCheckResult,
  CartFulfillmentCheckInput,
  CartFulfillmentCheckResult,
  OrderAvailabilityInput,
  OrderAvailabilityResult,
  FulfillmentReason,
  ProductFulfillmentRules,
  BranchFulfillmentOverride,
  OperatingHoursEntry,
  HolidayEntry,
  GlobalFulfillmentConfig,
  DeliverySlot,
  DEFAULT_PRODUCT_FULFILLMENT,
  DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
  getNowInTimezone,
  compareTimeStrings,
  timeStringToMinutes,
  minutesToTimeString,
  formatTimeForDisplay,
  addDaysToDateString,
} from "./types";

// ── Data Provider Interface ─────────────────────────────────────────────────
// The engine doesn't know where data comes from. Callers inject a provider.

export interface FulfillmentDataProvider {
  getProductFulfillmentRules(productId: string): ProductFulfillmentRules | null;
  getBranchOverride(branchId: string, productId: string): BranchFulfillmentOverride | null;
  getOperatingHours(entityType: string, entityId: string): OperatingHoursEntry[];
  getHolidays(entityType?: string, entityId?: string, dateStr?: string): HolidayEntry[];
  getGlobalConfig(): GlobalFulfillmentConfig;
  getOnlineRiderCount(branchId?: string): number;
}

// ── Resolved Effective Configuration ────────────────────────────────────────

interface EffectiveConfig {
  instant_delivery_enabled: boolean;
  same_day_delivery_enabled: boolean;
  pre_order_enabled: boolean;
  minimum_lead_time_minutes: number;
  minimum_lead_time_days: number;
  corporate_order_cutoff_time: string; // Authoritative corporate deadline "HH:MM"
  order_cutoff_time: string;           // Effective cutoff (min of corporate & overrides)
  emergency_override_active: boolean;
  preparation_time_minutes: number;
  preparation_delay_enabled: boolean;
  preparation_delay_minutes: number;
  delivery_buffer_minutes: number;
  timezone: string;
}

// ── Core Engine ─────────────────────────────────────────────────────────────

export class FulfillmentEngine {
  /**
   * THE canonical eligibility check. Every surface calls this.
   */
  static calculateOrderEligibility(
    input: FulfillmentCheckInput,
    provider: FulfillmentDataProvider
  ): FulfillmentCheckResult {
    const globalConfig = provider.getGlobalConfig();
    const timezone = globalConfig.business_timezone || "Asia/Kolkata";

    // ── Step 1: Resolve effective configuration ───────────────────────
    const effectiveConfig = FulfillmentEngine.resolveEffectiveConfig(
      input.product_id,
      input.branch_id || null,
      globalConfig,
      provider
    );

    // ── Step 2: Get current time in authoritative business timezone ──
    const nowTz = getNowInTimezone(timezone, input.current_datetime);
    const currentTimeStr = nowTz.timeString;
    const currentDateStr = nowTz.dateString;
    const currentDayOfWeek = nowTz.dayOfWeek;
    const requestedDateStr = input.requested_delivery_date || currentDateStr;
    const isRequestingToday = requestedDateStr === currentDateStr;

    // ── Step 3: Check branch availability / stock status ──────────────
    if (input.branch_id) {
      const branchOverride = provider.getBranchOverride(input.branch_id, input.product_id);
      if (branchOverride) {
        if (branchOverride.status === "out_of_stock") {
          return FulfillmentEngine.buildResult(false, "OUT_OF_STOCK", {
            message: "This cake is currently out of stock at this branch.",
            corporate_cutoff_time: effectiveConfig.order_cutoff_time,
            emergency_override_active: effectiveConfig.emergency_override_active,
          });
        }
        if (branchOverride.status === "hidden") {
          return FulfillmentEngine.buildResult(false, "OUT_OF_STOCK", {
            message: "This product is not available at this branch.",
            corporate_cutoff_time: effectiveConfig.order_cutoff_time,
            emergency_override_active: effectiveConfig.emergency_override_active,
          });
        }
      }
    }

    // ── Step 4: Check holiday calendar ────────────────────────────────
    const holidays = [
      ...provider.getHolidays("organization", "global", requestedDateStr),
      ...(input.branch_id ? provider.getHolidays("branch", input.branch_id, requestedDateStr) : []),
      ...(input.city_id ? provider.getHolidays("city", input.city_id, requestedDateStr) : []),
    ];

    const fullDayHoliday = holidays.find((h) => h.is_full_day);
    if (fullDayHoliday) {
      // Find next available open date
      const nextDate = FulfillmentEngine.findNextOpenDate(
        requestedDateStr,
        input.branch_id || "global",
        provider,
        timezone,
        1
      );
      return FulfillmentEngine.buildResult(false, "HOLIDAY", {
        message: `Operations are closed for ${fullDayHoliday.name}. Earliest available delivery: ${nextDate ? nextDate : "next business day"}.`,
        next_available_date: nextDate,
        earliest_available_datetime: nextDate ? `${nextDate}T${effectiveConfig.order_cutoff_time || "09:00"}:00` : null,
        delivery_slots: [],
        corporate_cutoff_time: effectiveConfig.order_cutoff_time,
        emergency_override_active: effectiveConfig.emergency_override_active,
      });
    }

    // ── Step 5: Check operating hours ─────────────────────────────────
    const operatingHours = FulfillmentEngine.getEffectiveOperatingHours(
      input.branch_id || null,
      input.city_id || null,
      currentDayOfWeek,
      provider
    );

    if (operatingHours && !operatingHours.is_open && isRequestingToday) {
      const nextDate = FulfillmentEngine.findNextOpenDate(
        currentDateStr,
        input.branch_id || "global",
        provider,
        timezone,
        1
      );
      return FulfillmentEngine.buildResult(false, "OPERATIONS_CLOSED", {
        message: `We're closed today. Earliest available: ${nextDate || "next business day"}.`,
        next_available_date: nextDate,
        earliest_available_datetime: nextDate ? `${nextDate}T09:00:00` : null,
        corporate_cutoff_time: effectiveConfig.order_cutoff_time,
        emergency_override_active: effectiveConfig.emergency_override_active,
      });
    }

    // If requesting a future date, check if that day is open
    if (!isRequestingToday) {
      const requestedDate = new Date(requestedDateStr + "T00:00:00");
      const requestedDayOfWeek = requestedDate.getDay();
      const futureHours = FulfillmentEngine.getEffectiveOperatingHours(
        input.branch_id || null,
        input.city_id || null,
        requestedDayOfWeek,
        provider
      );
      if (futureHours && !futureHours.is_open) {
        const nextDate = FulfillmentEngine.findNextOpenDate(
          requestedDateStr,
          input.branch_id || "global",
          provider,
          timezone,
          1
        );
        return FulfillmentEngine.buildResult(false, "BRANCH_CLOSED", {
          message: `We're closed on ${new Date(requestedDateStr).toLocaleDateString("en-IN", { weekday: "long" })}. Please choose a different date.`,
          next_available_date: nextDate,
          corporate_cutoff_time: effectiveConfig.order_cutoff_time,
          emergency_override_active: effectiveConfig.emergency_override_active,
        });
      }
    }

    // ── Step 6: Calculate effective preparation time ──────────────────
    const basePrep = effectiveConfig.preparation_time_minutes;
    const delayMinutes = effectiveConfig.preparation_delay_enabled
      ? effectiveConfig.preparation_delay_minutes
      : 0;
    const effectivePrepMinutes = basePrep + delayMinutes;
    const totalFulfillmentMinutes = effectivePrepMinutes + effectiveConfig.delivery_buffer_minutes;

    // ── Step 7: Pre-order requirement check ───────────────────────────
    if (effectiveConfig.minimum_lead_time_days > 0) {
      const daysDiff = FulfillmentEngine.daysBetween(currentDateStr, requestedDateStr);
      if (daysDiff < effectiveConfig.minimum_lead_time_days || isRequestingToday) {
        const earliestDate = FulfillmentEngine.findNextOpenDate(
          currentDateStr,
          input.branch_id || "global",
          provider,
          timezone,
          effectiveConfig.minimum_lead_time_days
        ) || addDaysToDateString(currentDateStr, effectiveConfig.minimum_lead_time_days);

        return FulfillmentEngine.buildResult(false, "PRODUCT_REQUIRES_PREORDER", {
          message: `This cake requires ${effectiveConfig.minimum_lead_time_days} day${effectiveConfig.minimum_lead_time_days > 1 ? "s" : ""} advance notice. Earliest available: ${earliestDate}.`,
          requires_preorder: true,
          next_available_date: earliestDate,
          earliest_available_datetime: `${earliestDate}T${operatingHours?.opening_time || (operatingHours as any)?.open_time || "09:00"}:00`,
          preparation_minutes: basePrep,
          effective_preparation_minutes: effectivePrepMinutes,
          corporate_cutoff_time: effectiveConfig.order_cutoff_time,
          emergency_override_active: effectiveConfig.emergency_override_active,
        });
      }
    }

    if (effectiveConfig.minimum_lead_time_minutes > 0 && isRequestingToday) {
      const currentMinutes = timeStringToMinutes(currentTimeStr);
      const closeStr = operatingHours?.closing_time || (operatingHours as any)?.close_time || "22:00";
      const closingMinutes = timeStringToMinutes(closeStr);
      const remainingMinutes = closingMinutes - currentMinutes;

      if (remainingMinutes < effectiveConfig.minimum_lead_time_minutes) {
        const earliestDate = FulfillmentEngine.findNextOpenDate(
          currentDateStr,
          input.branch_id || "global",
          provider,
          timezone,
          1
        ) || addDaysToDateString(currentDateStr, 1);

        return FulfillmentEngine.buildResult(false, "PREPARATION_TIME_EXCEEDED", {
          message: `Not enough time remaining today. This cake needs ${effectiveConfig.minimum_lead_time_minutes} minutes preparation. Earliest: ${earliestDate}.`,
          requires_preorder: true,
          next_available_date: earliestDate,
          earliest_available_datetime: `${earliestDate}T${operatingHours?.opening_time || (operatingHours as any)?.open_time || "09:00"}:00`,
          preparation_minutes: basePrep,
          effective_preparation_minutes: effectivePrepMinutes,
          corporate_cutoff_time: effectiveConfig.order_cutoff_time,
          emergency_override_active: effectiveConfig.emergency_override_active,
        });
      }
    }

    // ── Step 8: Authoritative Corporate Same-day Cutoff & Eligibility ─
    if (isRequestingToday) {
      if (!effectiveConfig.same_day_delivery_enabled) {
        const nextDate = FulfillmentEngine.findNextOpenDate(
          currentDateStr,
          input.branch_id || "global",
          provider,
          timezone,
          1
        );
        return FulfillmentEngine.buildResult(false, "SAME_DAY_NOT_AVAILABLE", {
          message: "Same-day delivery is not available for this product. Please order at least 1 day in advance.",
          requires_preorder: true,
          next_available_date: nextDate,
          earliest_available_datetime: nextDate ? `${nextDate}T${operatingHours?.opening_time || (operatingHours as any)?.open_time || "09:00"}:00` : null,
          preparation_minutes: basePrep,
          effective_preparation_minutes: effectivePrepMinutes,
          corporate_cutoff_time: effectiveConfig.order_cutoff_time,
          emergency_override_active: effectiveConfig.emergency_override_active,
        });
      }

      // Cutoff Enforcement (At cutoff or after, same-day acceptance closes)
      const cutoffTime = effectiveConfig.order_cutoff_time;
      if (cutoffTime && compareTimeStrings(currentTimeStr, cutoffTime) >= 0) {
        const nextDate = FulfillmentEngine.findNextOpenDate(
          currentDateStr,
          input.branch_id || "global",
          provider,
          timezone,
          1
        );
        return FulfillmentEngine.buildResult(false, "SAME_DAY_CUTOFF_PASSED", {
          message: `Same-day ordering closed (cutoff: ${formatTimeForDisplay(cutoffTime)}). ${nextDate ? `Earliest: ${nextDate}.` : "Pre-order for the next available day."}`,
          cutoff_datetime: `${currentDateStr}T${cutoffTime}:00`,
          next_available_date: nextDate,
          earliest_available_datetime: nextDate ? `${nextDate}T${operatingHours?.opening_time || (operatingHours as any)?.open_time || "09:00"}:00` : null,
          requires_preorder: true,
          preparation_minutes: basePrep,
          effective_preparation_minutes: effectivePrepMinutes,
          corporate_cutoff_time: cutoffTime,
          emergency_override_active: effectiveConfig.emergency_override_active,
        });
      }
    }

    // ── Approaching Cutoff Calculation (within 45 minutes) ───────────
    let approachingCutoffMinutes: number | null = null;
    if (isRequestingToday && effectiveConfig.order_cutoff_time) {
      const currentMinutes = timeStringToMinutes(currentTimeStr);
      const cutoffMinutes = timeStringToMinutes(effectiveConfig.order_cutoff_time);
      const diff = cutoffMinutes - currentMinutes;
      if (diff > 0 && diff <= 45) {
        approachingCutoffMinutes = diff;
      }
    }

    // ── Step 9: Instant delivery check ────────────────────────────────
    const instantAvailable = Boolean(
      effectiveConfig.instant_delivery_enabled
      && isRequestingToday
      && operatingHours?.is_open !== false
      && effectivePrepMinutes <= 90
    );

    // ── Step 10: Time slot validation (if specific time requested) ────
    if (input.requested_delivery_time && isRequestingToday) {
      const requestedMinutes = timeStringToMinutes(input.requested_delivery_time);
      const currentMinutes = timeStringToMinutes(currentTimeStr);
      const earliestDeliveryMinutes = currentMinutes + totalFulfillmentMinutes;

      if (requestedMinutes < earliestDeliveryMinutes) {
        const earliestTime = minutesToTimeString(earliestDeliveryMinutes);
        return FulfillmentEngine.buildResult(false, "INVALID_TIME_SLOT", {
          message: `Earliest delivery today is ${formatTimeForDisplay(earliestTime)} (${effectivePrepMinutes} min preparation + ${effectiveConfig.delivery_buffer_minutes} min delivery).`,
          preparation_minutes: basePrep,
          effective_preparation_minutes: effectivePrepMinutes,
          instant_delivery_available: instantAvailable,
          corporate_cutoff_time: effectiveConfig.order_cutoff_time,
          emergency_override_active: effectiveConfig.emergency_override_active,
          approaching_cutoff_minutes: approachingCutoffMinutes,
        });
      }

      // Check against closing time
      const closeStr = operatingHours?.closing_time || (operatingHours as any)?.close_time || "22:00";
      const closingMinutes = timeStringToMinutes(closeStr);
      if (requestedMinutes > closingMinutes) {
        return FulfillmentEngine.buildResult(false, "INVALID_TIME_SLOT", {
          message: `Requested delivery time ${formatTimeForDisplay(input.requested_delivery_time)} is after our closing time (${formatTimeForDisplay(closeStr)}).`,
          corporate_cutoff_time: effectiveConfig.order_cutoff_time,
          emergency_override_active: effectiveConfig.emergency_override_active,
        });
      }
    }

    // ── Step 11: Rider availability check ─────────────────────────────
    const onlineRiders = provider.getOnlineRiderCount(input.branch_id);
    const deliveryAvailable = onlineRiders > 0 || !isRequestingToday;

    // ── Step 12: Compute earliest available datetime ──────────────────
    let earliestDatetime: string | null = null;
    if (isRequestingToday) {
      const currentMinutes = timeStringToMinutes(currentTimeStr);
      const earliestMinutes = currentMinutes + totalFulfillmentMinutes;
      const earliestTime = minutesToTimeString(Math.min(earliestMinutes, 24 * 60 - 1));
      earliestDatetime = `${currentDateStr}T${earliestTime}:00`;
    } else {
      earliestDatetime = `${requestedDateStr}T${operatingHours?.opening_time || (operatingHours as any)?.open_time || "09:00"}:00`;
    }

    // ── Step 13: Build success result ─────────────────────────────────
    let message = FulfillmentEngine.buildAvailabilityMessage(
      effectivePrepMinutes,
      effectiveConfig.delivery_buffer_minutes,
      instantAvailable,
      effectiveConfig.pre_order_enabled,
      effectiveConfig.minimum_lead_time_days,
      deliveryAvailable,
      delayMinutes
    );

    if (approachingCutoffMinutes !== null) {
      message = `⚡ Same-day ordering closes in ${approachingCutoffMinutes} min. ${message}`;
    }

    const successReason: FulfillmentReason = isRequestingToday
      ? "SAME_DAY_AVAILABLE"
      : (effectiveConfig.minimum_lead_time_days > 0 || effectiveConfig.pre_order_enabled
        ? "PRE_ORDER_AVAILABLE"
        : "AVAILABLE");

    return FulfillmentEngine.buildResult(true, successReason, {
      message,
      earliest_available_datetime: earliestDatetime,
      next_available_date: isRequestingToday ? currentDateStr : requestedDateStr,
      preparation_minutes: basePrep,
      effective_preparation_minutes: effectivePrepMinutes,
      cutoff_datetime: effectiveConfig.order_cutoff_time
        ? `${currentDateStr}T${effectiveConfig.order_cutoff_time}:00`
        : null,
      delivery_available: deliveryAvailable,
      requires_preorder: effectiveConfig.minimum_lead_time_days > 0,
      instant_delivery_available: instantAvailable,
      corporate_cutoff_time: effectiveConfig.order_cutoff_time,
      emergency_override_active: effectiveConfig.emergency_override_active,
      approaching_cutoff_minutes: approachingCutoffMinutes,
    });
  }

  /**
   * Multi-product cart eligibility check.
   * Uses the STRICTEST requirements across all items (max preparation, max lead time, strictest cutoff).
   */
  static calculateCartEligibility(
    input: CartFulfillmentCheckInput,
    provider: FulfillmentDataProvider
  ): CartFulfillmentCheckResult {
    const itemResults: CartFulfillmentCheckResult["items"] = [];
    let maxPrepMinutes = 0;
    let maxLeadTimeMinutes = 0;
    let anyRequiresPreorder = false;
    let allEligible = true;
    let latestEarliest: string | null = null;
    let furthestNextDate: string | null = null;
    let earliestCutoffTime: string | null = null;
    let minApproachingMinutes: number | null = null;
    let anyEmergencyOverride = false;

    for (const item of input.items) {
      const result = FulfillmentEngine.calculateOrderEligibility(
        {
          product_id: item.product_id,
          quantity: item.quantity,
          branch_id: input.branch_id,
          city_id: input.city_id,
          requested_delivery_date: input.requested_delivery_date,
          requested_delivery_time: input.requested_delivery_time,
          current_datetime: input.current_datetime,
        },
        provider
      );

      itemResults.push({
        product_id: item.product_id,
        eligible: result.eligible,
        reason: result.reason,
        message: result.message,
        preparation_minutes: result.effective_preparation_minutes,
      });

      if (!result.eligible) allEligible = false;
      if (result.effective_preparation_minutes > maxPrepMinutes) {
        maxPrepMinutes = result.effective_preparation_minutes;
      }
      if (result.requires_preorder) anyRequiresPreorder = true;
      if (result.emergency_override_active) anyEmergencyOverride = true;

      // Track the latest earliest_available_datetime
      if (result.earliest_available_datetime) {
        if (!latestEarliest || result.earliest_available_datetime > latestEarliest) {
          latestEarliest = result.earliest_available_datetime;
        }
      }

      // Track furthest next available date
      if (result.next_available_date) {
        if (!furthestNextDate || result.next_available_date > furthestNextDate) {
          furthestNextDate = result.next_available_date;
        }
      }

      // Track strictest cutoff
      if (result.corporate_cutoff_time) {
        if (!earliestCutoffTime || compareTimeStrings(result.corporate_cutoff_time, earliestCutoffTime) < 0) {
          earliestCutoffTime = result.corporate_cutoff_time;
        }
      }

      // Track approaching cutoff
      if (result.approaching_cutoff_minutes != null) {
        if (minApproachingMinutes == null || result.approaching_cutoff_minutes < minApproachingMinutes) {
          minApproachingMinutes = result.approaching_cutoff_minutes;
        }
      }
    }

    const globalConfig = provider.getGlobalConfig();
    const leadTimeDays = Math.max(
      ...input.items.map((item) => {
        const rules = provider.getProductFulfillmentRules(item.product_id);
        return rules?.minimum_lead_time_days || 0;
      })
    );
    maxLeadTimeMinutes = leadTimeDays * 24 * 60;

    let cartMessage = allEligible
      ? `All items available. Estimated preparation: ~${maxPrepMinutes} minutes.`
      : `Some items in your cart are not available for same-day delivery.`;

    if (!allEligible) {
      const cutoffItem = itemResults.find((i) => i.reason === "SAME_DAY_CUTOFF_PASSED");
      if (cutoffItem) {
        cartMessage = `Same-day ordering has closed for today. Next available delivery: ${furthestNextDate || "tomorrow"}.`;
      } else {
        const preorderItem = itemResults.find((i) => i.reason === "PRODUCT_REQUIRES_PREORDER");
        if (preorderItem) {
          cartMessage = `Items in your cart require advance preparation. Next available delivery: ${furthestNextDate || "tomorrow"}.`;
        }
      }
    }

    return {
      all_eligible: allEligible,
      effective_preparation_minutes: maxPrepMinutes,
      effective_lead_time_minutes: maxLeadTimeMinutes,
      earliest_available_datetime: latestEarliest,
      next_available_date: furthestNextDate,
      requires_preorder: anyRequiresPreorder,
      items: itemResults,
      delivery_slots: [],
      message: cartMessage,
      approaching_cutoff_minutes: minApproachingMinutes,
      corporate_cutoff_time: earliestCutoffTime || globalConfig.global_order_cutoff_time,
      emergency_override_active: anyEmergencyOverride,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve effective fulfillment config using strict cascading precedence:
   *   Corporate Cutoff & Emergency Override → Product rules → Branch override → Global defaults
   *
   * PRECEDENCE RULE:
   * 1. Product rules (highest priority)
   * 2. Branch override
   * 3. Global defaults
   * 4. Emergency Corporate Override (when active, sets absolute corporate ceiling)
   */
  static resolveEffectiveConfig(
    productId: string,
    branchId: string | null,
    globalConfig: GlobalFulfillmentConfig,
    provider: FulfillmentDataProvider
  ): EffectiveConfig {
    // 1. Authoritative Corporate Cutoff Determination
    let corporateCutoff = globalConfig.global_order_cutoff_time || "20:00";
    let isEmergencyActive = false;

    if (globalConfig.emergency_override_active) {
      const now = new Date();
      const startValid = !globalConfig.emergency_override_start_time || new Date(globalConfig.emergency_override_start_time) <= now;
      const endValid = !globalConfig.emergency_override_end_time || new Date(globalConfig.emergency_override_end_time) >= now;
      if (startValid && endValid && globalConfig.emergency_override_cutoff_time) {
        corporateCutoff = globalConfig.emergency_override_cutoff_time;
        isEmergencyActive = true;
      }
    }

    // 2. Base Configuration from Global Defaults
    const config: EffectiveConfig = {
      instant_delivery_enabled: globalConfig.global_instant_delivery_enabled,
      same_day_delivery_enabled: globalConfig.global_same_day_delivery_enabled,
      pre_order_enabled: false,
      minimum_lead_time_minutes: 0,
      minimum_lead_time_days: 0,
      corporate_order_cutoff_time: corporateCutoff,
      order_cutoff_time: corporateCutoff,
      emergency_override_active: isEmergencyActive,
      preparation_time_minutes: globalConfig.default_preparation_time_minutes,
      preparation_delay_enabled: globalConfig.global_preparation_delay_enabled,
      preparation_delay_minutes: globalConfig.global_preparation_delay_minutes,
      delivery_buffer_minutes: globalConfig.default_delivery_buffer_minutes,
      timezone: globalConfig.business_timezone || "Asia/Kolkata",
    };

    // 3. Layer 2: Branch Override (if available)
    if (branchId) {
      const branchOverride = provider.getBranchOverride(branchId, productId);
      if (branchOverride) {
        if (branchOverride.preparation_time_minutes != null) {
          config.preparation_time_minutes = branchOverride.preparation_time_minutes;
        }
        if (branchOverride.is_same_day_eligible === false) {
          config.same_day_delivery_enabled = false;
        }
        if (branchOverride.instant_delivery_enabled != null) {
          config.instant_delivery_enabled = branchOverride.instant_delivery_enabled;
        }
        if (branchOverride.order_cutoff_time != null) {
          config.order_cutoff_time = branchOverride.order_cutoff_time;
        }
        if (branchOverride.preparation_delay_enabled != null) {
          config.preparation_delay_enabled = branchOverride.preparation_delay_enabled;
        }
        if (branchOverride.preparation_delay_minutes != null) {
          config.preparation_delay_minutes = branchOverride.preparation_delay_minutes;
        }
      }
    }

    // 4. Layer 3: Product-level Rules (HIGHEST PRECEDENCE)
    const productRules = provider.getProductFulfillmentRules(productId);
    if (productRules) {
      config.instant_delivery_enabled = productRules.instant_delivery_enabled;
      config.same_day_delivery_enabled = productRules.same_day_delivery_enabled;
      config.pre_order_enabled = productRules.pre_order_enabled;
      config.minimum_lead_time_minutes = productRules.minimum_lead_time_minutes;
      config.minimum_lead_time_days = productRules.minimum_lead_time_days;

      if (productRules.order_cutoff_time) {
        config.order_cutoff_time = productRules.order_cutoff_time;
      }
      if (productRules.preparation_time_minutes != null) {
        config.preparation_time_minutes = productRules.preparation_time_minutes;
      }
      if (productRules.preparation_delay_enabled) {
        config.preparation_delay_enabled = true;
        config.preparation_delay_minutes = productRules.preparation_delay_minutes;
      }
      if (productRules.delivery_buffer_minutes != null) {
        config.delivery_buffer_minutes = productRules.delivery_buffer_minutes;
      }
    }

    return config;
  }

  /**
   * Get effective operating hours for a day, using precedence:
   *   Branch hours → City hours → Org-level hours
   */
  public static getEffectiveOperatingHours(
    branchId: string | null,
    cityId: string | null,
    dayOfWeek: number,
    provider: FulfillmentDataProvider
  ): OperatingHoursEntry | null {
    // Branch-level hours take precedence
    if (branchId) {
      const branchHours = provider.getOperatingHours("branch", branchId);
      const dayEntry = branchHours.find((h) => h.day_of_week === dayOfWeek);
      if (dayEntry) return dayEntry;
    }

    // City-level hours
    if (cityId) {
      const cityHours = provider.getOperatingHours("city", cityId);
      const dayEntry = cityHours.find((h) => h.day_of_week === dayOfWeek);
      if (dayEntry) return dayEntry;
    }

    // Organization-level (global) hours
    const orgHours = provider.getOperatingHours("organization", "global");
    const dayEntry = orgHours.find((h) => h.day_of_week === dayOfWeek);
    return dayEntry || null;
  }

  /**
   * Find the next open date after the given date, accounting for minimum advance days,
   * corporate holidays, branch holidays, and weekly operating hours.
   */
  public static findNextOpenDate(
    fromDateStr: string,
    branchIdOrGlobal: string,
    provider: FulfillmentDataProvider,
    timezone = "Asia/Kolkata",
    minAdvanceDays = 1
  ): string | null {
    for (let i = minAdvanceDays; i <= minAdvanceDays + 14; i++) {
      const candidateDate = addDaysToDateString(fromDateStr, i);
      const candidateDay = new Date(candidateDate + "T00:00:00").getDay();

      // Check holidays (global corporate + branch)
      const holidays = [
        ...provider.getHolidays("organization", "global", candidateDate),
        ...(branchIdOrGlobal !== "global" ? provider.getHolidays("branch", branchIdOrGlobal, candidateDate) : []),
      ];
      const fullDayHoliday = holidays.find((h) => h.is_full_day);
      if (fullDayHoliday) continue;

      // Check operating hours for candidate day of week
      const hours = FulfillmentEngine.getEffectiveOperatingHours(
        branchIdOrGlobal !== "global" ? branchIdOrGlobal : null,
        null,
        candidateDay,
        provider
      );

      if (!hours || hours.is_open) {
        return candidateDate;
      }
    }

    return null; // No open date found within 14 days
  }

  /**
   * Build a human-friendly availability message.
   */
  private static buildAvailabilityMessage(
    effectivePrepMinutes: number,
    deliveryBufferMinutes: number,
    instantAvailable: boolean,
    preOrderEnabled: boolean,
    leadTimeDays: number,
    deliveryAvailable: boolean,
    delayMinutes: number
  ): string {
    const parts: string[] = [];

    if (instantAvailable && effectivePrepMinutes <= 90) {
      parts.push(`⚡ Available for delivery in ~${effectivePrepMinutes + deliveryBufferMinutes} minutes`);
    } else if (effectivePrepMinutes <= 120) {
      parts.push(`🕒 Ready in ~${effectivePrepMinutes} minutes`);
    } else {
      const hours = Math.ceil(effectivePrepMinutes / 60);
      parts.push(`🕒 Preparation time: ~${hours} hour${hours > 1 ? "s" : ""}`);
    }

    if (delayMinutes > 0) {
      parts.push(`(includes ${delayMinutes} min preparation delay)`);
    }

    if (leadTimeDays > 0) {
      parts.push(`📅 Requires ${leadTimeDays} day${leadTimeDays > 1 ? "s" : ""} advance order`);
    }

    if (!deliveryAvailable) {
      parts.push("⚠️ No delivery riders currently available — delivery may be delayed");
    }

    return parts.join(". ") + ".";
  }

  /**
   * Days between two "YYYY-MM-DD" date strings.
   */
  private static daysBetween(fromStr: string, toStr: string): number {
    const from = new Date(fromStr + "T00:00:00");
    const to = new Date(toStr + "T00:00:00");
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * CANONICAL DOMAIN SERVICE: calculateOrderAvailability (Phase 2 Master Signature)
   * Evaluates single or multi-item order availability against strict corporate cutoff cascade.
   */
  static calculateOrderAvailability(
    input: OrderAvailabilityInput,
    provider: FulfillmentDataProvider
  ): OrderAvailabilityResult {
    const globalConfig = provider.getGlobalConfig();
    const timezone = globalConfig.business_timezone || "Asia/Kolkata";

    // Normalize input params
    const rawItems = input.productItems || input.items;
    const isMultiItem = Array.isArray(rawItems) && rawItems.length > 1;

    const branchId = input.branch_id || (typeof input.branch === "string" ? input.branch : input.branch?.id) || undefined;
    const cityId = input.city_id || (typeof input.city === "string" ? input.city : input.city?.id) || undefined;
    const requestedDate = input.requested_delivery_date || input.requestedDate || undefined;
    const requestedTime = input.requested_delivery_time || input.requestedTime || undefined;
    const currentDatetime = input.current_datetime
      ? new Date(input.current_datetime)
      : (input.currentBusinessTime ? new Date(input.currentBusinessTime) : undefined);

    let branchStatus: "AVAILABLE" | "OUT_OF_STOCK" | "CLOSED" | "PAUSED" = "AVAILABLE";
    let productStatus: "AVAILABLE" | "OUT_OF_STOCK" | "DISCONTINUED" = "AVAILABLE";

    if (isMultiItem) {
      const cartResult = FulfillmentEngine.calculateCartEligibility(
        {
          items: rawItems!.map((item: any) => ({
            product_id: item.product_id || item.id,
            quantity: item.quantity || 1,
          })),
          branch_id: branchId,
          city_id: cityId,
          requested_delivery_date: requestedDate,
          requested_delivery_time: requestedTime,
          current_datetime: currentDatetime,
        },
        provider
      );

      const strictestItem = cartResult.items.find((i) => !i.eligible) || cartResult.items[0];
      const primaryReason = strictestItem ? strictestItem.reason : (cartResult.all_eligible ? "AVAILABLE" : "OPERATIONS_CLOSED");

      return {
        eligible: cartResult.all_eligible,
        same_day_available: cartResult.all_eligible && !cartResult.requires_preorder,
        instant_delivery_available: cartResult.all_eligible && !cartResult.requires_preorder && cartResult.effective_preparation_minutes <= 90,
        pre_order_required: cartResult.requires_preorder,
        reason: primaryReason,
        next_available_date: cartResult.next_available_date || null,
        next_available_slot: cartResult.delivery_slots?.[0] || null,
        preparation_minutes: strictestItem?.preparation_minutes || cartResult.effective_preparation_minutes,
        preparation_delay_minutes: Math.max(0, cartResult.effective_preparation_minutes - (strictestItem?.preparation_minutes || cartResult.effective_preparation_minutes)),
        effective_preparation_minutes: cartResult.effective_preparation_minutes,
        corporate_cutoff: cartResult.corporate_cutoff_time || globalConfig.global_order_cutoff_time || "20:00",
        branch_status: branchStatus,
        product_status: productStatus,
        business_timezone: timezone,
        message: cartResult.message,
        delivery_slots: cartResult.delivery_slots || [],
        approaching_cutoff_minutes: cartResult.approaching_cutoff_minutes,
        emergency_override_active: cartResult.emergency_override_active,
      };
    }

    // Single item calculation
    const productId = input.product_id
      || (typeof input.product === "string" ? input.product : input.product?.id || input.product?.product_id)
      || (rawItems && rawItems[0] ? (rawItems[0].product_id || rawItems[0].id) : "prod_default");
    const quantity = (rawItems && rawItems[0]?.quantity) || 1;

    // Check branch override status
    if (branchId) {
      const branchOverride = provider.getBranchOverride(branchId, productId);
      if (branchOverride) {
        if (branchOverride.status === "out_of_stock") {
          branchStatus = "OUT_OF_STOCK";
          productStatus = "OUT_OF_STOCK";
        } else if (branchOverride.status === "hidden") {
          branchStatus = "CLOSED";
        }
      }
    }

    const singleResult = FulfillmentEngine.calculateOrderEligibility(
      {
        product_id: productId,
        quantity,
        branch_id: branchId,
        city_id: cityId,
        requested_delivery_date: requestedDate,
        requested_delivery_time: requestedTime,
        current_datetime: currentDatetime,
      },
      provider
    );

    return {
      eligible: singleResult.eligible,
      same_day_available: singleResult.eligible && (singleResult.reason === "SAME_DAY_AVAILABLE" || singleResult.reason === "AVAILABLE"),
      instant_delivery_available: singleResult.instant_delivery_available,
      pre_order_required: singleResult.requires_preorder,
      reason: singleResult.reason,
      next_available_date: singleResult.next_available_date || null,
      next_available_slot: singleResult.delivery_slots?.[0] || null,
      preparation_minutes: singleResult.preparation_minutes,
      preparation_delay_minutes: Math.max(0, singleResult.effective_preparation_minutes - singleResult.preparation_minutes),
      effective_preparation_minutes: singleResult.effective_preparation_minutes,
      corporate_cutoff: singleResult.corporate_cutoff_time || globalConfig.global_order_cutoff_time || "20:00",
      branch_status: branchStatus,
      product_status: productStatus,
      business_timezone: timezone,
      message: singleResult.message,
      delivery_slots: singleResult.delivery_slots || [],
      approaching_cutoff_minutes: singleResult.approaching_cutoff_minutes,
      emergency_override_active: singleResult.emergency_override_active,
    };
  }

  /**
   * Build a FulfillmentCheckResult with defaults.
   */
  private static buildResult(
    eligible: boolean,
    reason: FulfillmentReason,
    overrides: Partial<FulfillmentCheckResult> = {}
  ): FulfillmentCheckResult {
    return {
      eligible,
      reason,
      earliest_available_datetime: null,
      next_available_date: null,
      preparation_minutes: 0,
      effective_preparation_minutes: 0,
      cutoff_datetime: null,
      delivery_available: eligible,
      requires_preorder: false,
      instant_delivery_available: false,
      delivery_slots: [],
      message: "",
      approaching_cutoff_minutes: null,
      ...overrides,
    };
  }
}

// ── CANONICAL DOMAIN SERVICE ALIASES (Phase 2 Master Services) ──────────────

export const FulfillmentAvailabilityService = FulfillmentEngine;
export type FulfillmentAvailabilityService = typeof FulfillmentEngine;

export class OperationsHoursService {
  static getEffectiveHours = FulfillmentEngine.getEffectiveOperatingHours;
  static findNextOpen = FulfillmentEngine.findNextOpenDate;
}

export class BranchAvailabilityService {
  static getBranchOverride = (provider: FulfillmentDataProvider, branchId: string, productId: string) =>
    provider.getBranchOverride(branchId, productId);
}

export class ProductFulfillmentRulesService {
  static getRules = (provider: FulfillmentDataProvider, productId: string) =>
    provider.getProductFulfillmentRules(productId);
}

