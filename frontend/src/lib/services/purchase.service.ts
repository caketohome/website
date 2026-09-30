/**
 * CakeToHome ERP — Purchase Service
 * Phase 1: Business logic for purchase entry, lifecycle, payments, and reports.
 *
 * KEY RULES:
 * - branchId ALWAYS comes from the resolved session — never from client body
 * - Server validates totals independently (not trusted from client)
 * - Status lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED (enforced in repo)
 * - No self-approval: submitter cannot approve own submission (if same userId)
 * - No fake data: if no data exists, returns empty array — not fabricated totals
 */

import { PurchaseRepository } from "../repositories/purchase.repository";
import { PurchasePaymentService } from "./purchase-payment.service";
import type {
  PurchaseRow,
  PurchaseCreateInput,
  PurchaseUpdateInput,
  PurchaseListFilters,
  PurchaseListResult,
  PurchasePaymentInput,
  PurchasePaymentRow,
  PurchaseStatus,
  PurchaseRegisterRow,
  SupplierPurchaseSummaryRow,
  ItemWisePurchaseRow,
  BillWisePurchaseRow,
  PurchaseGstHsnRow,
  PurchaseReportFilters,
  PurchaseApiResponse,
} from "../types/purchase.types";

const MAX_REASONABLE_ITEMS = 200;

/** Server-side total validation. Returns error string if inconsistent, null if OK. */
function validatePurchaseTotals(input: PurchaseCreateInput | PurchaseUpdateInput): string | null {
  if (input.total !== undefined && input.taxable_value !== undefined) {
    const cgst = input.cgst ?? 0;
    const sgst = input.sgst ?? 0;
    const igst = input.igst ?? 0;
    const expectedTotal = Number(input.taxable_value) + cgst + sgst + igst;
    if (Math.abs(expectedTotal - Number(input.total)) > 0.5) {
      return `Total mismatch: taxable_value(${input.taxable_value}) + taxes(${cgst + sgst + igst}) = ${expectedTotal.toFixed(2)} but total=${input.total}.`;
    }
  }
  return null;
}

export class PurchaseService {
  // ── CREATE ──────────────────────────────────────────────────────────────────

  static async createPurchase(
    input: PurchaseCreateInput,
    branchId: string,
    createdBy: string
  ): Promise<PurchaseApiResponse<PurchaseRow>> {
    // Validate required branch
    if (!branchId) {
      return { success: false, error: "Branch context is required." };
    }

    // Validate items
    if (!input.items?.length) {
      return { success: false, error: "At least one line item is required." };
    }
    if (input.items.length > MAX_REASONABLE_ITEMS) {
      return { success: false, error: `Too many items (max ${MAX_REASONABLE_ITEMS}).` };
    }

    // Validate each item
    for (const item of input.items) {
      if (!item.description?.trim()) return { success: false, error: "Each item must have a description." };
      if (item.quantity <= 0) return { success: false, error: `Invalid quantity: ${item.quantity}. Must be > 0.` };
      if (item.rate < 0) return { success: false, error: `Invalid rate: ${item.rate}. Must be >= 0.` };
      if (item.total < 0) return { success: false, error: `Invalid item total: ${item.total}. Must be >= 0.` };
    }

    // Server-side total validation
    const totalErr = validatePurchaseTotals(input);
    if (totalErr) return { success: false, error: totalErr };

    try {
      const purchase = await PurchaseRepository.create(input, branchId, createdBy);
      return { success: true, data: purchase };
    } catch (e: any) {
      // Catch unique constraint on invoice_no + supplier + branch
      if (e.code === "23505") {
        return { success: false, error: "A purchase with this invoice number already exists for this supplier and branch." };
      }
      return { success: false, error: `Failed to create purchase: ${e.message}` };
    }
  }

  // ── READ ────────────────────────────────────────────────────────────────────

  static async getPurchase(id: string, branchId?: string): Promise<PurchaseApiResponse<PurchaseRow>> {
    const purchase = await PurchaseRepository.findById(id, branchId);
    if (!purchase) return { success: false, error: "Purchase not found or access denied." };
    return { success: true, data: purchase };
  }

  static async listPurchases(
    filters: PurchaseListFilters
  ): Promise<PurchaseApiResponse<PurchaseListResult>> {
    const result = await PurchaseRepository.list(filters);
    return { success: true, data: result };
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  static async updatePurchase(
    id: string,
    input: PurchaseUpdateInput,
    branchId: string
  ): Promise<PurchaseApiResponse<PurchaseRow>> {
    if (!id) return { success: false, error: "Purchase ID is required." };

    if (input.items?.length) {
      for (const item of input.items) {
        if (!item.description?.trim()) return { success: false, error: "Each item must have a description." };
        if (item.quantity <= 0) return { success: false, error: `Invalid quantity: ${item.quantity}.` };
      }
    }

    const totalErr = validatePurchaseTotals(input);
    if (totalErr) return { success: false, error: totalErr };

    try {
      await PurchaseRepository.update(id, input, branchId);
      // Fetch the updated record
      const updated = await PurchaseRepository.findById(id, branchId);
      if (!updated) return { success: false, error: "Purchase not found after update." };
      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ── STATUS LIFECYCLE ────────────────────────────────────────────────────────

  /**
   * Transition purchase status.
   * Super Admin can approve from any branch.
   * Branch Manager can only submit (DRAFT→SUBMITTED) their own branch.
   * Self-approval guard: cannot approve if same user submitted (unless SUPER_ADMIN).
   */
  static async transitionStatus(
    id: string,
    newStatus: PurchaseStatus,
    userId: string,
    isSuperAdmin: boolean,
    branchId?: string
  ): Promise<PurchaseApiResponse<null>> {
    // Branch managers can only SUBMIT, not APPROVE/POST
    if (!isSuperAdmin && (newStatus === "APPROVED" || newStatus === "POSTED")) {
      return { success: false, error: `Only Super Admin can approve or post purchases.` };
    }

    // For non-Super Admin, always scope to their branch
    const scopedBranchId = isSuperAdmin ? undefined : branchId;

    const result = await PurchaseRepository.transitionStatus(id, newStatus, userId, scopedBranchId);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, message: `Purchase status updated to ${newStatus}.` };
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────

  static async deletePurchase(id: string, branchId: string): Promise<PurchaseApiResponse<null>> {
    const result = await PurchaseRepository.softDelete(id, branchId);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, message: "Purchase deleted." };
  }

  // ── PAYMENTS ────────────────────────────────────────────────────────────────
  /**
   * Records a supplier purchase payment and posts an atomic PAYMENT voucher to the General Ledger.
   */
  static async addPayment(
    purchaseId: string,
    input: PurchasePaymentInput,
    branchId: string,
    createdBy: string,
    actorRole?: string,
    actorSession?: any
  ): Promise<PurchaseApiResponse<PurchasePaymentRow>> {
    if (!purchaseId) return { success: false, error: "Purchase ID is required." };
    if (input.amount <= 0) return { success: false, error: "Payment amount must be > 0." };
    if (!input.payment_date) return { success: false, error: "Payment date is required." };

    const result = await PurchasePaymentService.recordPayment({
      purchaseId,
      payment: input,
      branchId,
      paidBy: createdBy,
      actorRole,
      actorSession,
    });
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data.payment };
  }

  // ── REPORTS ─────────────────────────────────────────────────────────────────

  static async getPurchaseRegister(
    filters: PurchaseReportFilters
  ): Promise<PurchaseApiResponse<PurchaseRegisterRow[]>> {
    const rows = await PurchaseRepository.getPurchaseRegister(filters);
    return { success: true, data: rows };
  }

  static async getSupplierWiseSummary(
    filters: PurchaseReportFilters
  ): Promise<PurchaseApiResponse<SupplierPurchaseSummaryRow[]>> {
    const rows = await PurchaseRepository.getSupplierWiseSummary(filters);
    return { success: true, data: rows };
  }

  static async getItemWiseSummary(
    filters: PurchaseReportFilters
  ): Promise<PurchaseApiResponse<ItemWisePurchaseRow[]>> {
    const rows = await PurchaseRepository.getItemWiseSummary(filters);
    return { success: true, data: rows };
  }

  static async getBillWiseSummary(
    filters: PurchaseReportFilters
  ): Promise<PurchaseApiResponse<BillWisePurchaseRow[]>> {
    const rows = await PurchaseRepository.getBillWiseSummary(filters);
    return { success: true, data: rows };
  }

  static async getGstHsnSummary(
    filters: PurchaseReportFilters
  ): Promise<PurchaseApiResponse<PurchaseGstHsnRow[]>> {
    const rows = await PurchaseRepository.getGstHsnSummary(filters);
    return { success: true, data: rows };
  }
}
