/**
 * Operational Closure Domain Service
 * Handles holiday scheduling, day-off calendar governance, timezone boundaries (Asia/Kolkata),
 * order acceptance gates, and impact surfacing for existing orders.
 */

import { dbTransaction } from "../db";
import { OperationalClosureRepository, OperationalClosureRow, ClosureImpactRow } from "../repositories/operational-closure.repository";
import type { AuthenticatedActor } from "./feature-flag.service";

export interface ScheduleClosureInput {
  entityType: "BRANCH" | "PARTNER" | "ORGANIZATION";
  entityId: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD (defaults to startDate)
  isFullDay?: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
  closureType?: "HOLIDAY" | "MAINTENANCE" | "PLANNED_CLOSURE" | "EMERGENCY";
  reason: string;
}

export class OperationalClosureService {
  /**
   * Schedule a closure or holiday with authorization and order impact detection
   */
  static async scheduleClosure(
    input: ScheduleClosureInput,
    actor: AuthenticatedActor
  ): Promise<{
    success: boolean;
    closure?: OperationalClosureRow;
    impactedOrdersCount?: number;
    error?: string;
  }> {
    // 1. Authorization checks
    if (input.entityType === "ORGANIZATION") {
      if (actor.role !== "SUPER_ADMIN") {
        return { success: false, error: "UNAUTHORIZED: Only Super Admin can create organization-wide closures." };
      }
    } else if (input.entityType === "BRANCH") {
      const isSuper = actor.role === "SUPER_ADMIN" || actor.role === "ADMIN";
      const isBranchMgr = actor.role === "BRANCH_MANAGER" && actor.branchId === input.entityId;
      if (!isSuper && !isBranchMgr) {
        return { success: false, error: "UNAUTHORIZED: Not authorized to schedule closures for this branch." };
      }
    } else if (input.entityType === "PARTNER") {
      const isSuper = actor.role === "SUPER_ADMIN";
      const isPartnerAdmin = (actor.role === "PARTNER_ADMIN" || actor.role === "PARTNER_OWNER") && actor.partnerId === input.entityId;
      if (!isSuper && !isPartnerAdmin) {
        return { success: false, error: "UNAUTHORIZED: Not authorized to schedule closures for this partner." };
      }
    }

    // 2. Date validations
    const startDate = input.startDate;
    const endDate = input.endDate || startDate;
    if (endDate < startDate) {
      return { success: false, error: "INVALID_DATES: End date cannot be before start date." };
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return { success: false, error: "INVALID_DATE_FORMAT: Dates must follow YYYY-MM-DD format." };
    }

    const closureId = `cls_${input.entityType.toLowerCase()}_${input.entityId}_${startDate}`;

    return dbTransaction(async (client) => {
      // 3. Save closure
      const closure = await OperationalClosureRepository.saveClosure({
        id: closureId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        start_date: startDate,
        end_date: endDate,
        is_full_day: input.isFullDay !== false,
        opening_time: input.openingTime,
        closing_time: input.closingTime,
        closure_type: input.closureType || "HOLIDAY",
        reason: input.reason,
        status: "SCHEDULED",
        actor_id: actor.userId,
        actor_role: actor.role || "ADMIN",
      }, client);

      // 4. Detect and record impacted existing orders (without cancelling them)
      let impactedCount = 0;
      if (input.entityType === "BRANCH" || input.entityType === "PARTNER") {
        const overlappingOrders = await OperationalClosureRepository.findOverlappingOrders(
          input.entityType,
          input.entityId,
          startDate,
          endDate,
          client
        );

        if (overlappingOrders.length > 0) {
          const impactList = overlappingOrders.map(o => ({
            order_id: o.id,
            delivery_date: o.delivery_date || startDate,
          }));
          impactedCount = await OperationalClosureRepository.recordImpactedOrders(closureId, impactList, client);
        }
      }

      return {
        success: true,
        closure,
        impactedOrdersCount: impactedCount,
      };
    });
  }

  /**
   * Cancel a scheduled closure
   */
  static async cancelClosure(
    closureId: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await OperationalClosureRepository.findById(closureId);
    if (!existing) {
      return { success: false, error: "Closure not found." };
    }

    // Check permissions
    if (existing.entity_type === "ORGANIZATION" && actor.role !== "SUPER_ADMIN") {
      return { success: false, error: "UNAUTHORIZED: Only Super Admin can cancel organization closures." };
    }
    if (existing.entity_type === "BRANCH") {
      const isSuper = actor.role === "SUPER_ADMIN" || actor.role === "ADMIN";
      const isBranchMgr = actor.role === "BRANCH_MANAGER" && actor.branchId === existing.entity_id;
      if (!isSuper && !isBranchMgr) {
        return { success: false, error: "UNAUTHORIZED: Not authorized to cancel closures for this branch." };
      }
    }
    if (existing.entity_type === "PARTNER") {
      const isSuper = actor.role === "SUPER_ADMIN";
      const isPartnerAdmin = (actor.role === "PARTNER_ADMIN" || actor.role === "PARTNER_OWNER") && actor.partnerId === existing.entity_id;
      if (!isSuper && !isPartnerAdmin) {
        return { success: false, error: "UNAUTHORIZED: Not authorized to cancel closures for this partner." };
      }
    }

    const cancelled = await OperationalClosureRepository.cancelClosure(closureId, actor.userId, actor.role || "ADMIN");
    return { success: cancelled };
  }

  /**
   * List closures
   */
  static async listClosures(filters: any = {}): Promise<OperationalClosureRow[]> {
    return OperationalClosureRepository.list(filters);
  }

  /**
   * Check if a new order can be accepted for a branch or partner on target date/time
   */
  static async validateFulfillmentAvailability(
    entityType: "BRANCH" | "PARTNER",
    entityId: string,
    targetDateStr: string,
    targetTime?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const check = await OperationalClosureRepository.isClosedOnDate(entityType, entityId, targetDateStr, targetTime);
    if (check.isClosed) {
      return {
        allowed: false,
        reason: `Location closed on ${targetDateStr}: ${check.reason || "Operational Closure"}`,
      };
    }
    return { allowed: true };
  }

  /**
   * List impacted orders for review by operations staff
   */
  static async listClosureImpacts(filters: any = {}): Promise<ClosureImpactRow[]> {
    return OperationalClosureRepository.listImpacts(filters);
  }
}
