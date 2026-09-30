/**
 * CakeToHome ERP — COD Collection Control Service
 * Phase 4F Step 4.9: Cash on Delivery (COD) Collection Control & Delivery Rider Remittance
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. CASH COLLECTION POLICY (MODEL B):
 *    - Separate authoritative collection event (DELIVERY ≠ CASH COLLECTION ≠ BRANCH REMITTANCE).
 *    - Doorstep delivery marks delivery completion (State A.1).
 *    - Cash collection freezes immutable snapshot in order.metadata->'cod_custody_event' (State B).
 * 2. RIDER REMITTANCE POLICY (OPTION C + OPTION B):
 *    - Batch / Shift-Level Settlement.
 *    - FULL SHIFT SETTLEMENT REQUIRED (Option B).
 *    - Cash presented < Authoritative Custody => FAIL CLOSED (PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN).
 *    - Discrepancy creates controlled reconciliation exception (CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED).
 *    - Over-remittance => FAIL CLOSED (OVERPAYMENT_NOT_PERMITTED).
 * 3. EXACT SOURCE-LINKED ALLOCATION:
 *    - Authoritative Outstanding Custody = sum(settlement_lines) = Cash Presented = Posted Dr 1111 = Posted Cr 1122.
 *    - No silent FIFO, no arbitrary spreading.
 * 4. MULTI-STATE RECONCILIATION EQUATION:
 *    - GL 1122 = State A + State A.1 + State B + State C + State D.
 *    - State E (REMITTED_CLEARED) contributes zero to uncleared 1122.
 *    - Mathematical Discrepancy === 0.00.
 * 5. SEGREGATION OF DUTIES (SoD):
 *    - Teller/Cashier (remittedByStaffId) ≠ Supervisor (approvedBySupervisorId) ≠ GL Accountant (postedByGlAccountantId).
 * 6. ZERO DUPLICATE POSTING ENGINES:
 *    - Settlement reuses canonical CustomerReceiptService.postCodShiftSettlement & PostingService.postVoucher.
 */

import type { PoolClient } from "pg";
import { hasEffectivePermission } from "../staff-access-control";
import { CodCollectionRepository, CodCollectionError } from "../repositories/cod-collection.repository";
import { CustomerReceiptService } from "./customer-receipt.service";
import type {
  ConfirmCodCollectionParams,
  CodCustodySnapshot,
  RiderCodCustodySummary,
  PostCodShiftSettlementParams,
  CodShiftSettlementResult,
  CodReconciliationResult,
  CodExceptionItem,
} from "../types/accounting.types";

export class CodCollectionServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CodCollectionServiceError";
    this.code = code;
  }
}

export class CodCollectionService {
  /**
   * Confirms an authoritative COD cash collection event under Model B.
   * Freezes the immutable custody snapshot into the order metadata and status history.
   */
  static async confirmCodCollection(
    params: ConfirmCodCollectionParams,
    client?: PoolClient
  ): Promise<CodCustodySnapshot> {
    // 1. Permission and Role Validation
    if (params.actorContext) {
      const actorRole = (params.actorContext.role || "").toUpperCase();
      const hasPostPerm = hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");
      const hasDeliveryPerm = hasEffectivePermission(params.actorContext, "DELIVERY.UPDATE");
      const isRider = actorRole === "DELIVERY_PARTNER" || actorRole === "RIDER";
      const isSuperAdmin = actorRole === "SUPER_ADMIN" || params.actorContext.user_id === "admin_01";

      if (!hasPostPerm && !hasDeliveryPerm && !isRider && !isSuperAdmin) {
        throw new CodCollectionServiceError(
          "PERMISSION_DENIED",
          "User lacks required permissions (ACCOUNTING.POST or DELIVERY.UPDATE) to confirm cash collection."
        );
      }

      // Non-superadmin branch constraint
      if (!isSuperAdmin && !isRider) {
        const actorBranch = params.actorContext.branch_id || params.actorContext.branchId;
        if (!actorBranch) {
          throw new CodCollectionServiceError(
            "BRANCH_ACCESS_DENIED",
            "Non-super-admin user has no authorized branch assignment."
          );
        }
        if (params.branchId && params.branchId !== actorBranch) {
          throw new CodCollectionServiceError(
            "BRANCH_ACCESS_DENIED",
            `Cross-branch cash collection denied: Actor branch '${actorBranch}' cannot confirm collection for branch '${params.branchId}'.`
          );
        }
      }
    }

    try {
      return await CodCollectionRepository.confirmCodCollection({
        ...params,
        client: client || params.client,
      });
    } catch (err: any) {
      if (err instanceof CodCollectionError) {
        throw new CodCollectionServiceError(err.code, err.message);
      }
      throw err;
    }
  }

  /**
   * Retrieves the authoritative outstanding COD cash custody report for a delivery partner.
   */
  static async getRiderCustody(
    deliveryPartnerId: string,
    branchId?: string,
    actorContext?: { id?: string; userId?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown },
    client?: PoolClient
  ): Promise<RiderCodCustodySummary> {
    if (actorContext) {
      const actorRole = (actorContext.role || "").toUpperCase();
      const hasViewPerm = hasEffectivePermission(actorContext, "ACCOUNTING.VIEW");
      const hasFleetPerm = hasEffectivePermission(actorContext, "FLEET.VIEW");
      const isSelfRider = (actorRole === "DELIVERY_PARTNER" || actorRole === "RIDER") &&
        (actorContext.user_id === deliveryPartnerId || actorContext.id === deliveryPartnerId);
      const isSuperAdmin = actorRole === "SUPER_ADMIN" || actorContext.user_id === "admin_01";

      if (!hasViewPerm && !hasFleetPerm && !isSelfRider && !isSuperAdmin) {
        throw new CodCollectionServiceError(
          "PERMISSION_DENIED",
          "User lacks permission (ACCOUNTING.VIEW or FLEET.VIEW) to view rider COD custody."
        );
      }

      if (!isSuperAdmin && !isSelfRider) {
        const actorBranch = (actorContext.branch_id || actorContext.branchId) as string | undefined;
        if (!actorBranch) {
          throw new CodCollectionServiceError(
            "BRANCH_ACCESS_DENIED",
            "Non-super-admin user has no authorized branch assignment."
          );
        }
        if (branchId && branchId !== actorBranch) {
          throw new CodCollectionServiceError(
            "BRANCH_ACCESS_DENIED",
            `Cross-branch custody query denied: Actor branch '${actorBranch}' cannot inspect branch '${branchId}'.`
          );
        }
      }
    }

    return await CodCollectionRepository.getRiderOutstandingCustody(deliveryPartnerId, branchId, client);
  }

  /**
   * Posts a delivery rider shift batch settlement to the General Ledger.
   * Strictly enforces Option B (Full Shift Settlement Required) and 3-tier SoD.
   */
  static async postRiderShiftSettlement(
    params: PostCodShiftSettlementParams
  ): Promise<CodShiftSettlementResult> {
    const res = await CustomerReceiptService.postCodShiftSettlement(params);
    if (!res.success) {
      throw new CodCollectionServiceError(res.code || "SETTLEMENT_FAILED", res.error || "Shift settlement failed.");
    }
    return res.data;
  }

  /**
   * Computes the multi-state COD subledger reconciliation against GL Account 1122.
   * Enforces: GL 1122 = State A + State A.1 + State B + State C + State D.
   */
  static async getCodReconciliation(
    filters: {
      branchId?: string;
      asOfDate?: string;
      actorContext?: { id?: string; userId?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown };
    },
    client?: PoolClient
  ): Promise<CodReconciliationResult> {
    if (filters.actorContext) {
      const actorRole = (filters.actorContext.role || "").toUpperCase();
      const hasView = hasEffectivePermission(filters.actorContext, "ACCOUNTING.VIEW");
      const isSuperAdmin = actorRole === "SUPER_ADMIN" || filters.actorContext.user_id === "admin_01";

      if (!hasView && !isSuperAdmin) {
        throw new CodCollectionServiceError(
          "PERMISSION_DENIED",
          "User lacks ACCOUNTING.VIEW permission to view COD reconciliation."
        );
      }

      if (!isSuperAdmin) {
        const actorBranch = (filters.actorContext.branch_id || filters.actorContext.branchId) as string | undefined;
        if (!actorBranch) {
          throw new CodCollectionServiceError(
            "BRANCH_ACCESS_DENIED",
            "Non-super-admin user has no authorized branch assignment."
          );
        }
        if (filters.branchId && filters.branchId !== actorBranch) {
          throw new CodCollectionServiceError(
            "BRANCH_ACCESS_DENIED",
            `Cross-branch access denied: Actor branch '${actorBranch}' cannot inspect branch '${filters.branchId}'.`
          );
        }
      }
    }

    const subledger = await CodCollectionRepository.getCodSubledger(filters.branchId, client);
    const gl1122Balance = await CodCollectionRepository.getGl1122Balance(filters.branchId, client);
    const exceptions = await CodCollectionRepository.scanExceptions(filters.branchId, client);

    const discrepancy = Math.round((gl1122Balance - subledger.totalOperationalUnclearedControl) * 100) / 100;
    const isReconciled = Math.abs(discrepancy) < 0.005;

    if (!isReconciled) {
      exceptions.push({
        type: "GL_CONTROL_DISCREPANCY",
        severity: "CRITICAL",
        details: `Account 1122 GL balance (₹${gl1122Balance.toFixed(2)}) does not equal total operational subledger control (₹${subledger.totalOperationalUnclearedControl.toFixed(2)}). Discrepancy: ₹${discrepancy.toFixed(2)}.`,
      });
    }

    return {
      branchId: filters.branchId || "all",
      asOfDate: filters.asOfDate || new Date().toISOString(),
      stateA_preDeliveryUncollected: subledger.stateA_preDeliveryUncollected,
      stateA1_deliveredPendingCollection: subledger.stateA1_deliveredPendingCollection,
      stateB_identifiedRiderCustody: subledger.stateB_identifiedRiderCustody,
      stateC_unassignedDeliveredCod: subledger.stateC_unassignedDeliveredCod,
      stateD_otherValidUncleared: subledger.stateD_otherValidUncleared,
      stateE_remittedClearedTotal: subledger.stateE_remittedClearedTotal,
      totalOperationalUnclearedControl: subledger.totalOperationalUnclearedControl,
      gl1122Balance,
      discrepancy,
      isReconciled,
      exceptions,
    };
  }

  /**
   * Scans for all systematic COD control exceptions.
   */
  static async scanExceptions(
    branchId?: string,
    actorContext?: { id?: string; userId?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown },
    client?: PoolClient
  ): Promise<CodExceptionItem[]> {
    if (actorContext) {
      const hasView = hasEffectivePermission(actorContext, "ACCOUNTING.VIEW");
      const isSuperAdmin = (actorContext.role || "").toUpperCase() === "SUPER_ADMIN" || actorContext.user_id === "admin_01";
      if (!hasView && !isSuperAdmin) {
        throw new CodCollectionServiceError("PERMISSION_DENIED", "User lacks ACCOUNTING.VIEW permission.");
      }
    }
    return await CodCollectionRepository.scanExceptions(branchId, client);
  }
}
