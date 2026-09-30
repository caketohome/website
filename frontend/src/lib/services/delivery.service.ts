import { BranchRepository } from "../repositories/branch.repository";
import { BranchDomain, DeliveryZoneDomain } from "../types/domain";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address?: string;
  pincode?: string;
  city?: string;
}

export interface DeliveryEligibilityResult {
  eligible: boolean;
  branch_id?: string;
  branch_name?: string;
  distance_km?: number;
  max_radius_km?: number;
  delivery_fee: number;
  estimated_minutes: number;
  allow_pickup: boolean;
  allow_delivery: boolean;
  message?: string;
}

export interface SlotAvailability {
  id: string;
  time_range: string;
  start_time: string;
  end_time: string;
  available: boolean;
  reason?: string;
  fee: number;
}

export class DeliveryService {
  /**
   * Calculate Haversine distance in KM between two coordinates
   */
  static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return DeliveryService.calculateDistanceKm(lat1, lon1, lat2, lon2);
  }

  /**
   * Get current business time in Asia/Kolkata timezone
   */
  static getBusinessDateTime(): { now: Date; dateStr: string; timeStr: string; hours: number; minutes: number } {
    const now = new Date();
    // Format to Asia/Kolkata
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const p: Record<string, string> = {};
    parts.forEach((part) => {
      p[part.type] = part.value;
    });

    const dateStr = `${p.year}-${p.month}-${p.day}`;
    const timeStr = `${p.hour}:${p.minute}`;
    const hours = parseInt(p.hour, 10);
    const minutes = parseInt(p.minute, 10);

    return { now, dateStr, timeStr, hours, minutes };
  }

  /**
   * Authoritative server-side delivery eligibility validation
   */
  static async validateDeliveryEligibility(
    customerLoc: LocationCoordinates,
    preferredBranchId?: string
  ): Promise<DeliveryEligibilityResult> {
    const branches = await BranchRepository.findAll();
    const activeBranches = branches.filter((b) => b.is_open && !b.is_archived);

    if (activeBranches.length === 0) {
      return {
        eligible: false,
        delivery_fee: 0,
        estimated_minutes: 0,
        allow_pickup: false,
        allow_delivery: false,
        message: "No bakery branches are currently operational.",
      };
    }

    let targetBranch: BranchDomain | null = null;
    let minDistance = Infinity;

    // If specific branch is requested, test it first
    if (preferredBranchId) {
      targetBranch = activeBranches.find((b) => b.id === preferredBranchId) || null;
    }

    // Otherwise find closest branch by GPS distance
    if (!targetBranch) {
      for (const branch of activeBranches) {
        const dist = DeliveryService.calculateDistanceKm(
          customerLoc.latitude,
          customerLoc.longitude,
          branch.latitude,
          branch.longitude
        );
        if (dist < minDistance) {
          minDistance = dist;
          targetBranch = branch;
        }
      }
    } else {
      minDistance = DeliveryService.calculateDistanceKm(
        customerLoc.latitude,
        customerLoc.longitude,
        targetBranch.latitude,
        targetBranch.longitude
      );
    }

    if (!targetBranch) {
      return {
        eligible: false,
        delivery_fee: 0,
        estimated_minutes: 0,
        allow_pickup: false,
        allow_delivery: false,
        message: "Unable to find nearest bakery branch.",
      };
    }

    const maxRadius = targetBranch.max_delivery_radius_km || 15;
    const fulfillmentRules = targetBranch.fulfillment_rules || { allow_pickup: true, allow_delivery: true };
    const allowPickup = fulfillmentRules.allow_pickup !== false;
    const allowDelivery = fulfillmentRules.allow_delivery !== false;

    // Check radius limit
    if (minDistance > maxRadius) {
      return {
        eligible: false,
        branch_id: targetBranch.id,
        branch_name: targetBranch.name,
        distance_km: minDistance,
        max_radius_km: maxRadius,
        delivery_fee: 0,
        estimated_minutes: 0,
        allow_pickup: allowPickup,
        allow_delivery: false,
        message: `Delivery location is ${minDistance} km away, which exceeds branch maximum delivery radius of ${maxRadius} km. ${allowPickup ? "Store Pickup is available." : ""}`,
      };
    }

    // Calculate delivery fee based on distance / delivery zones
    let fee = 49;
    if (minDistance > 5) fee += Math.ceil(minDistance - 5) * 10;
    const estimatedMins = Math.max(30, Math.round(minDistance * 4 + 20));

    return {
      eligible: allowDelivery,
      branch_id: targetBranch.id,
      branch_name: targetBranch.name,
      distance_km: minDistance,
      max_radius_km: maxRadius,
      delivery_fee: fee,
      estimated_minutes: estimatedMins,
      allow_pickup: allowPickup,
      allow_delivery: allowDelivery,
      message: "Eligible for delivery",
    };
  }

  /**
   * Check cutoff eligibility for a requested delivery date and mode
   */
  static isCutoffPassed(
    requestedDateStr: string,
    deliveryMode: "standard" | "express" | "midnight" | "pickup",
    branch?: BranchDomain | null
  ): { passed: boolean; cutoffTime: string; reason?: string } {
    const { dateStr: todayStr, hours, minutes } = DeliveryService.getBusinessDateTime();
    const currentTotalMins = hours * 60 + minutes;

    // If delivery is scheduled for future date (tomorrow or later), same-day cutoff does NOT apply
    if (requestedDateStr > todayStr) {
      return { passed: false, cutoffTime: "N/A" };
    }

    // If requested date is today:
    const rules = branch?.fulfillment_rules || {};
    let cutoffStr = "18:00"; // Default same-day cutoff 6:00 PM

    if (deliveryMode === "express") {
      cutoffStr = rules.express_cutoff || "19:00";
    } else if (deliveryMode === "midnight") {
      cutoffStr = rules.midnight_cutoff || "20:00";
    } else {
      cutoffStr = rules.same_day_cutoff || "18:00";
    }

    const [cutH, cutM] = cutoffStr.split(":").map(Number);
    const cutoffTotalMins = cutH * 60 + (cutM || 0);

    if (currentTotalMins >= cutoffTotalMins) {
      return {
        passed: true,
        cutoffTime: cutoffStr,
        reason: `Same-day ${deliveryMode} delivery cutoff (${cutoffStr}) has passed for today. Please select tomorrow or a future date.`,
      };
    }

    return { passed: false, cutoffTime: cutoffStr };
  }

  /**
   * Generate available delivery slots based on prep time, cutoff, and current server time
   */
  static generateAvailableSlots(
    requestedDateStr: string,
    deliveryMode: "standard" | "express" | "midnight" | "pickup",
    prepTimeMinutes: number = 120,
    branch?: BranchDomain | null
  ): SlotAvailability[] {
    const { dateStr: todayStr, hours: curH, minutes: curM } = DeliveryService.getBusinessDateTime();
    const isToday = requestedDateStr === todayStr;
    const curTotalMins = curH * 60 + curM;

    // Check same-day cutoff
    const cutoffCheck = DeliveryService.isCutoffPassed(requestedDateStr, deliveryMode, branch);
    if (isToday && cutoffCheck.passed) {
      return []; // No same-day slots available after cutoff
    }

    // Standard hourly slot schedule
    const standardSlots = [
      { id: "slot_09_11", time_range: "09:00 - 11:00", start: "09:00", end: "11:00", startMins: 9 * 60, fee: 0 },
      { id: "slot_11_13", time_range: "11:00 - 13:00", start: "11:00", end: "13:00", startMins: 11 * 60, fee: 0 },
      { id: "slot_13_15", time_range: "13:00 - 15:00", start: "13:00", end: "15:00", startMins: 13 * 60, fee: 0 },
      { id: "slot_15_17", time_range: "15:00 - 17:00", start: "15:00", end: "17:00", startMins: 15 * 60, fee: 0 },
      { id: "slot_17_19", time_range: "17:00 - 19:00", start: "17:00", end: "19:00", startMins: 17 * 60, fee: 0 },
      { id: "slot_19_21", time_range: "19:00 - 21:00", start: "19:00", end: "21:00", startMins: 19 * 60, fee: 0 },
    ];

    if (deliveryMode === "midnight") {
      const midnightSlot = {
        id: "slot_midnight",
        time_range: "23:00 - 23:59 (Midnight)",
        start_time: "23:00",
        end_time: "23:59",
        available: !isToday || (curTotalMins + prepTimeMinutes <= 23 * 60),
        reason: isToday && curTotalMins + prepTimeMinutes > 23 * 60 ? "Requires 2 hours preparation time" : undefined,
        fee: 149,
      };
      return [midnightSlot];
    }

    return standardSlots.map((s) => {
      let isAvailable = true;
      let reason: string | undefined;

      if (isToday) {
        // Must allow enough prep time before slot start
        if (curTotalMins + prepTimeMinutes > s.startMins) {
          isAvailable = false;
          reason = "Preparation time buffer exceeded for this slot";
        }
      }

      return {
        id: s.id,
        time_range: s.time_range,
        start_time: s.start,
        end_time: s.end,
        available: isAvailable,
        reason,
        fee: s.fee,
      };
    });
  }
}
