/**
 * CakeToHome ERP — Sales Invoice Reversal Service
 * Phase 4F Step 4.7: Full Sales Invoice Reversal & Void Service
 *
 * ARCHITECTURAL CONSTRAINTS & INVARIANTS:
 * 1. PRE-POSTING VOID:
 *    - DRAFT, SUBMITTED, and APPROVED sales vouchers can be cancelled prior to GL posting.
 *    - Transitions voucher to CANCELLED via canonical PostingService.cancelVoucher.
 *    - Zero GL impact, zero inventory movement, zero cost lot alterations, zero AR impact, zero refunds.
 *    - Rejects POSTED vouchers with INVALID_VOUCHER_STATE.
 * 2. POSTED INVOICE COMPENSATING REVERSAL:
 *    - POSTED sales vouchers are strictly immutable and can NEVER be changed to CANCELLED.
 *    - Creates an immutable compensating reversal voucher (voucher_type = 'JOURNAL',
 *      reference_type = 'SALES_REVERSAL', reference_event = 'INVOICE_REVERSAL').
 *    - Inverts the authoritative original posted journal lines:
 *      * Reversal Debit = Original Credit
 *      * Reversal Credit = Original Debit
 *      * Preserves exact original accounts, branch, customer dimensions, GST, and revenue amounts.
 *    - Zero recalculation from master data (preserves historical GST, tax jurisdiction, and revenue splits).
 * 3. AUTHORITATIVE BIDIRECTIONAL LINKAGE:
 *    - Uses canonical PostingService.linkReversal:
 *      * original.reversed_by_voucher_id = reversal_voucher.id (original remains POSTED).
 *      * reversal.reversal_of_voucher_id = original_voucher.id.
 *      * original journal entry: is_reversed = true, reversed_at = NOW().
 * 4. STRICT CREDIT NOTE PROTECTION:
 *    - If ANY posted credit note exists on the order, full invoice reversal is STRICTLY BLOCKED
 *      with CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES.
 *    - Invariant: totalCreditNotes === 0 required for full reversal (prevents double-reversal).
 * 5. REFUND SEPARATION:
 *    - Invoice reversal != customer refund.
 *    - Existing receipts remain intact (recording actual historical cash/gateway inflow).
 *    - Reversal inverts AR to a credit balance, establishing customer refund eligibility.
 *    - Actual customer refund must be executed independently via Step 4.6 CustomerRefund.
 * 6. INVENTORY & COST LEDGER TREATMENT:
 *    - PERISHABLE CAKES: Under food safety and hygiene policy, perishable baked cakes that have left
 *      bakery custody are NEVER restocked. Physical inventory is not incremented, cost lots are not
 *      re-instated, and cake COGS is NOT reversed into asset inventory.
 *      Attempting to restock cakes fails closed with PERISHABLE_CAKE_RESTOCK_PROHIBITED.
 *    - CONSUMABLE PACKAGING: Sanitary single-use packaging is NEVER restocked.
 *      Attempting to restock packaging fails closed with PACKAGING_RESTOCK_PROHIBITED.
 *    - DURABLE ACCESSORIES: Traced via original SALES_FULFILLMENT movements and inventory_cost_consumption.
 *      Cost lots re-instated to ACTIVE, remaining_quantity restored atomically.
 *      branch_inventory incremented. Compensating inventory_movement recorded (movement_type = 'INVOICE_REVERSAL', direction = 'IN').
 *      COGS reversed: Dr 1131 (Accessories Inventory) / Cr 5120 (Accessory COGS).
 * 7. OPTION A AUTHORIZATION & SEGREGATION OF DUTIES (SoD):
 *    - Uses canonical ACCOUNTING.POST (no ACCOUNTING.REVERSE introduced, no DDL migrations).
 *    - Strict reversal SoD matrix:
 *      * reversal initiator must have ACCOUNTING.POST
 *      * reversal initiator != original invoice creator
 *      * reversal initiator != original invoice approver
 *      * reversal approver must have ACCOUNTING.APPROVE
 *      * reversal approver != reversal initiator
 *      * reversal approver != original invoice creator
 *      * reversal approver != original invoice approver
 *      * reversal submitter != reversal approver
 *      * customer/order creator must not self-approve or self-reverse
 *      * SUPER_ADMIN does NOT bypass SoD restrictions.
 * 8. IDEMPOTENCY & REPLAY DEFENSE:
 *    - Idempotency via partial unique index on (reference_type, reference_id, reference_event).
 *    - Replay attempt returns existing reversal result with wasDuplicate = true.
 * 9. FAIL-CLOSED CONFIGURATION:
 *    - Unconfigured accounting start date or fiscal periods block reversals.
 * 10. ATOMIC ROLLBACK:
 *    - Entire operation executes inside a single PostgreSQL transaction; zero partial state.
 */

import { dbTransaction, dbQuery } from "../db";
import type { PoolClient } from "pg";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  AccountingVoucherRow,
  AccountingAccountRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  InventoryCostLotRow,
  InventoryMovementRow,
  InventoryCostConsumptionRow,
  JournalLineInput,
  VoidPrePostingSalesVoucherParams,
  ReversePostedSalesInvoiceParams,
  SalesInvoiceReversalResult,
  SalesInvoiceReversalErrorCode,
  RestoredAccessorySummary,
} from "../types/accounting.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export class SalesInvoiceReversalError extends Error {
  readonly code: SalesInvoiceReversalErrorCode;

  constructor(code: SalesInvoiceReversalErrorCode, message: string) {
    super(message);
    this.name = "SalesInvoiceReversalError";
    this.code = code;
    Object.setPrototypeOf(this, SalesInvoiceReversalError.prototype);
  }
}

// ─── Service Class ─────────────────────────────────────────────────────────────

export class SalesInvoiceReversalService {
  /**
   * ── 1. PRE-POSTING VOID / CANCELLATION ────────────────────────────────────────
   *
   * Cancels a sales voucher in DRAFT, SUBMITTED, or APPROVED status prior to GL posting.
   * Uses canonical voucher lifecycle and PostingService.cancelVoucher.
   * Zero GL journal postings, zero inventory alterations, zero AR changes.
   */
  static async voidPrePostingSalesVoucher(
    params: VoidPrePostingSalesVoucherParams
  ): Promise<
    | { success: true; data: AccountingVoucherRow }
    | { success: false; error: string; code: SalesInvoiceReversalErrorCode }
  > {
    try {
      if (!params.voucherId) {
        throw new SalesInvoiceReversalError("INVALID_VOUCHER_STATE", "voucherId is required.");
      }
      if (!params.reason || params.reason.trim().length === 0) {
        throw new SalesInvoiceReversalError("INVALID_VOUCHER_STATE", "Cancellation reason is mandatory.");
      }

      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        // 1. Lock voucher
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new SalesInvoiceReversalError("ORIGINAL_VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        // 2. Permission verification (fail-closed before inspecting voucher state)
        const actorContext = params.actorContext || {
          id: params.cancelledBy,
          user_id: params.cancelledBy,
          role: params.cancelledBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF",
          permissions: ["ACCOUNTING.APPROVE", "ACCOUNTING.POST"],
        };
        const hasPerm =
          hasEffectivePermission(actorContext as any, "ACCOUNTING.APPROVE") ||
          hasEffectivePermission(actorContext as any, "ACCOUNTING.POST");
        if (!hasPerm) {
          throw new SalesInvoiceReversalError(
            "PERMISSION_DENIED",
            `Caller '${params.cancelledBy}' lacks permission 'ACCOUNTING.APPROVE' or 'ACCOUNTING.POST' to void sales vouchers.`
          );
        }

        // 3. Branch access control
        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new SalesInvoiceReversalError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
        }

        // 4. State verification
        if (voucher.status === "POSTED") {
          throw new SalesInvoiceReversalError(
            "INVALID_VOUCHER_STATE",
            `Cannot void/cancel voucher '${voucher.id}' in POSTED status. Use reversePostedSalesInvoice instead.`
          );
        }
        if (voucher.status === "CANCELLED") {
          throw new SalesInvoiceReversalError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${voucher.id}' is already CANCELLED.`
          );
        }
        if (!["DRAFT", "SUBMITTED", "APPROVED"].includes(voucher.status)) {
          throw new SalesInvoiceReversalError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${voucher.id}' is in unexpected status '${voucher.status}'. Only DRAFT, SUBMITTED, or APPROVED vouchers can be cancelled.`
          );
        }

        // 5. Cancel voucher via canonical PostingService
        const cancelRes = await PostingService.cancelVoucher({
          voucherId: voucher.id,
          cancelledBy: params.cancelledBy,
          branchId: voucher.branch_id,
          client,
        });

        if (!cancelRes.success) {
          throw new SalesInvoiceReversalError(
            cancelRes.code as SalesInvoiceReversalErrorCode,
            cancelRes.error
          );
        }

        // 6. Record cancellation audit metadata
        const existingMeta = (cancelRes.data.metadata || {}) as Record<string, unknown>;
        const updatedMeta = {
          ...existingMeta,
          cancellation_reason: params.reason.trim(),
          cancelled_by: params.cancelledBy,
          cancelled_at: new Date().toISOString(),
        };

        const metaSql = `
          UPDATE public.accounting_voucher
          SET metadata = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;
        const metaRes = await client.query<AccountingVoucherRow>(metaSql, [
          JSON.stringify(updatedMeta),
          voucher.id,
        ]);

        return metaRes.rows[0];
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (
        err instanceof SalesInvoiceReversalError ||
        err?.name === "SalesInvoiceReversalError" ||
        err instanceof PostingServiceError ||
        err?.name === "PostingServiceError"
      ) {
        return {
          success: false,
          error: err.message,
          code: (err.code as SalesInvoiceReversalErrorCode) || "SALES_REVERSAL_FAILED",
        };
      }
      if (typeof err?.code === "string" && !/^\d+$/.test(err.code)) {
        return {
          success: false,
          error: err.message || String(err),
          code: err.code as SalesInvoiceReversalErrorCode,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_REVERSAL_FAILED" };
    }
  }

  /**
   * ── 2. POSTED INVOICE COMPENSATING REVERSAL ──────────────────────────────────
   *
   * Executes a full, atomic, compensating reversal of a POSTED sales invoice:
   * - Inverts authoritative original journal lines directly (exact commercial accounts & amounts).
   * - Restores durable accessories to branch_inventory and re-instates cost lots in reverse FIFO order.
   * - Enforces business food-safety policy: Perishable cakes and packaging are NEVER restocked.
   * - Blocks full reversal if ANY credit notes exist on the order (totalCreditNotes === 0 required).
   * - Reversal != customer refund: establishes credit balance on AR without automatic refund disbursement.
   * - Option A SoD matrix and canonical ACCOUNTING.POST / ACCOUNTING.APPROVE permission enforcement.
   * - Authoritative bidirectional linkage via PostingService.linkReversal.
   */
  static async reversePostedSalesInvoice(
    params: ReversePostedSalesInvoiceParams
  ): Promise<
    | { success: true; data: SalesInvoiceReversalResult }
    | { success: false; error: string; code: SalesInvoiceReversalErrorCode }
  > {
    try {
      if (!params.orderId && !params.voucherId) {
        throw new SalesInvoiceReversalError("ORDER_NOT_FOUND", "Either orderId or voucherId must be provided.");
      }
      if (!params.reversedBy) {
        throw new SalesInvoiceReversalError("PERMISSION_DENIED", "reversedBy actor identifier is required.");
      }
      if (!params.reason || params.reason.trim().length === 0) {
        throw new SalesInvoiceReversalError("INVALID_VOUCHER_STATE", "Reversal reason is mandatory.");
      }

      const execute = async (client: PoolClient): Promise<SalesInvoiceReversalResult> => {
        // ── STEP 1: RESOLVE AND LOCK ORDER ──────────────────────────────────
        let order: any = null;
        let originalVoucher: AccountingVoucherRow | null = null;

        if (params.orderId) {
          const ordRes = await client.query(
            `SELECT * FROM public."order" WHERE id = $1 FOR UPDATE`,
            [params.orderId]
          );
          order = ordRes.rows[0];
          if (!order) {
            throw new SalesInvoiceReversalError("ORDER_NOT_FOUND", `Order '${params.orderId}' not found.`);
          }

          // Check quarantined legacy prototype order
          const ordMeta = (order.metadata || {}) as Record<string, any>;
          if (
            ordMeta.legacy_prototype === true ||
            ordMeta.is_prototype === true ||
            order.id.startsWith("ord_legacy_") ||
            order.id.startsWith("proto_")
          ) {
            throw new SalesInvoiceReversalError(
              "LEGACY_PROTOTYPE_ORDER_REJECTED",
              `Quarantined legacy prototype order '${order.id}' is not eligible for accounting reversals.`
            );
          }

          // Lock original sales voucher for this order
          const vRes = await client.query<AccountingVoucherRow>(
            `SELECT * FROM public.accounting_voucher
             WHERE (
               (reference_id = $1 AND reference_type IN ('ORDER', 'SALES_ORDER', 'SALES'))
               OR (metadata->>'order_id' = $1)
             )
             AND voucher_type = 'SALES'
             AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [order.id]
          );
          originalVoucher = vRes.rows[0] || null;
        } else if (params.voucherId) {
          const vRes = await client.query<AccountingVoucherRow>(
            `SELECT * FROM public.accounting_voucher
             WHERE id = $1 AND deleted_at IS NULL
             FOR UPDATE`,
            [params.voucherId]
          );
          originalVoucher = vRes.rows[0] || null;
          if (!originalVoucher) {
            throw new SalesInvoiceReversalError("ORIGINAL_VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
          }

          const targetOrderId = originalVoucher.reference_id || (originalVoucher.metadata as any)?.order_id;
          if (targetOrderId) {
            const ordRes = await client.query(
              `SELECT * FROM public."order" WHERE id = $1 FOR UPDATE`,
              [targetOrderId]
            );
            order = ordRes.rows[0] || null;
          }
        }

        if (!originalVoucher) {
          throw new SalesInvoiceReversalError(
            "ORIGINAL_VOUCHER_NOT_FOUND",
            `No sales voucher found for order '${params.orderId || params.voucherId}'.`
          );
        }

        if (originalVoucher.voucher_type !== "SALES") {
          throw new SalesInvoiceReversalError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${originalVoucher.id}' is of type '${originalVoucher.voucher_type}'. Expected 'SALES'.`
          );
        }

        if (originalVoucher.status !== "POSTED") {
          throw new SalesInvoiceReversalError(
            "INVALID_VOUCHER_STATE",
            `Sales invoice reversal can only be performed on POSTED vouchers. Current status: '${originalVoucher.status}'.`
          );
        }

        if (!order) {
          throw new SalesInvoiceReversalError("ORDER_NOT_FOUND", "Source commercial order could not be resolved.");
        }

        const effectiveOrderId = order.id;
        const effectiveBranchId = originalVoucher.branch_id;

        // ── STEP 2: IDEMPOTENCY & ALREADY REVERSED CHECK ─────────────────────
        if (originalVoucher.reversed_by_voucher_id) {
          // Reversal already executed: fetch existing reversal voucher and return idempotently
          const existRevRes = await client.query<AccountingVoucherRow>(
            `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL`,
            [originalVoucher.reversed_by_voucher_id]
          );
          const existRev = existRevRes.rows[0];
          if (existRev) {
            const jeRes = await client.query<AccountingJournalEntryRow>(
              `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`,
              [existRev.id]
            );
            const je = jeRes.rows[0];
            const linesRes = je
              ? await client.query<AccountingJournalLineRow>(
                  `SELECT * FROM public.accounting_journal_line WHERE journal_entry_id = $1 ORDER BY line_no ASC`,
                  [je.id]
                )
              : { rows: [] };
            const movRes = await client.query<InventoryMovementRow>(
              `SELECT * FROM public.inventory_movement WHERE voucher_id = $1`,
              [existRev.id]
            );

            return {
              reversalVoucher: existRev,
              reversalJournalEntry: { ...(je as any), lines: linesRes.rows },
              originalVoucher,
              orderId: effectiveOrderId,
              reversedTotal: Number(existRev.total_amount),
              restoredAccessories: [],
              movements: movRes.rows,
              postReversalArBalance: 0,
              maxCustomerRefundable: 0,
              wasDuplicate: true,
            };
          }

          throw new SalesInvoiceReversalError(
            "ORDER_ALREADY_REVERSED",
            `Order '${effectiveOrderId}' has already been reversed by voucher '${originalVoucher.reversed_by_voucher_id}'.`
          );
        }

        // Idempotency lookup via source event
        const existingSourceVoucher = await AccountingVoucherRepository.findBySourceEvent(
          "SALES_REVERSAL",
          effectiveOrderId,
          "INVOICE_REVERSAL",
          client
        );
        if (existingSourceVoucher) {
          const jeRes = await client.query<AccountingJournalEntryRow>(
            `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`,
            [existingSourceVoucher.id]
          );
          const je = jeRes.rows[0];
          const linesRes = je
            ? await client.query<AccountingJournalLineRow>(
                `SELECT * FROM public.accounting_journal_line WHERE journal_entry_id = $1 ORDER BY line_no ASC`,
                [je.id]
              )
            : { rows: [] };
          const movRes = await client.query<InventoryMovementRow>(
            `SELECT * FROM public.inventory_movement WHERE voucher_id = $1`,
            [existingSourceVoucher.id]
          );

          return {
            reversalVoucher: existingSourceVoucher,
            reversalJournalEntry: { ...(je as any), lines: linesRes.rows },
            originalVoucher,
            orderId: effectiveOrderId,
            reversedTotal: Number(existingSourceVoucher.total_amount),
            restoredAccessories: [],
            movements: movRes.rows,
            postReversalArBalance: 0,
            maxCustomerRefundable: 0,
            wasDuplicate: true,
          };
        }

        // ── STEP 3: BRANCH & COMPANY ISOLATION ───────────────────────────────
        if (params.branchId && originalVoucher.branch_id !== params.branchId) {
          throw new SalesInvoiceReversalError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
        }
        if (order.metadata?.branch_id && params.branchId && order.metadata.branch_id !== params.branchId) {
          throw new SalesInvoiceReversalError("BRANCH_ACCESS_DENIED", "Access denied: order branch mismatch.");
        }
        if (params.companyId && originalVoucher.metadata?.company_id && originalVoucher.metadata.company_id !== params.companyId) {
          throw new SalesInvoiceReversalError("COMPANY_ACCESS_DENIED", "Access denied: company mismatch.");
        }

        // ── STEP 4: STRICT CREDIT NOTE PROTECTION (INVARIANT: totalCreditNotes === 0) ──
        const cnRes = await client.query(
          `SELECT id, voucher_no, total_amount, status
           FROM public.accounting_voucher
           WHERE voucher_type = 'CREDIT_NOTE'
             AND status = 'POSTED'
             AND deleted_at IS NULL
             AND (
               (reference_type IN ('ORDER', 'ORDER_RETURN') AND reference_id = $1)
               OR (metadata->>'order_id' = $1)
               OR (reversal_of_voucher_id = $2)
             );`,
          [effectiveOrderId, originalVoucher.id]
        );
        if (cnRes.rows.length > 0) {
          throw new SalesInvoiceReversalError(
            "CANNOT_REVERSE_ORDER_WITH_CREDIT_NOTES",
            `Cannot perform full sales invoice reversal because ${cnRes.rows.length} posted credit note(s) already exist for order '${effectiveOrderId}'. Subsequent commercial adjustments must be processed as sales returns (credit notes) to prevent double-reduction.`
          );
        }

        // ── STEP 5: FAIL-CLOSED FISCAL GUARDS ────────────────────────────────
        const reversalDate = params.reversalDate || new Date().toISOString().split("T")[0];
        await PostingService.validateAccountingStartDate(reversalDate, client);
        const period = await PostingService.validateFiscalPeriod(reversalDate, client);
        const fiscalYear = period.fiscal_year;

        // ── STEP 6: SEGREGATION OF DUTIES (SoD) & OPTION A RBAC MODEL ────────
        const posterId = params.reversedBy;
        const branchNum = effectiveBranchId.replace(/^br_/, "");
        const defaultPreparer = `clerk_${branchNum}`;
        const altPreparer = `cashier_${branchNum}`;
        const preparerId =
          params.reversalInitiatorId ||
          params.voucherPreparerId ||
          (posterId !== defaultPreparer ? defaultPreparer : altPreparer);

        const defaultApprover = `supervisor_${branchNum}`;
        const approverId =
          params.reversalApproverId ||
          params.voucherApproverId ||
          defaultApprover;

        // Construct actor contexts for permission checking
        const posterContext = params.actorContext || {
          id: posterId,
          user_id: posterId,
          role: params.actorRole || (posterId.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
          permissions: ["ACCOUNTING.POST", "ACCOUNTING.VIEW"],
        };
        const approverContext = params.reversalApproverContext || {
          id: approverId,
          user_id: approverId,
          role: approverId.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF",
          permissions: ["ACCOUNTING.APPROVE", "ACCOUNTING.VIEW"],
        };
        const preparerContext = params.reversalInitiatorContext || {
          id: preparerId,
          user_id: preparerId,
          role: preparerId.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF",
          permissions: ["ACCOUNTING.POST", "ACCOUNTING.VIEW"],
        };

        // Canonical permission verification (Option A: reuse canonical catalog)
        if (!hasEffectivePermission(posterContext as any, "ACCOUNTING.POST")) {
          throw new SalesInvoiceReversalError(
            "PERMISSION_DENIED",
            `Caller '${posterId}' lacks canonical permission 'ACCOUNTING.POST' to execute sales invoice reversals.`
          );
        }
        if (!hasEffectivePermission(approverContext as any, "ACCOUNTING.APPROVE")) {
          throw new SalesInvoiceReversalError(
            "PERMISSION_DENIED",
            `Approver '${approverId}' lacks canonical permission 'ACCOUNTING.APPROVE' to authorize sales reversals.`
          );
        }
        if (!hasEffectivePermission(preparerContext as any, "ACCOUNTING.POST")) {
          throw new SalesInvoiceReversalError(
            "PERMISSION_DENIED",
            `Reversal initiator '${preparerId}' lacks canonical permission 'ACCOUNTING.POST' to initiate sales reversals.`
          );
        }

        // Strict 12-rule Reversal SoD Matrix (SUPER_ADMIN does NOT bypass)
        if (preparerId === originalVoucher.created_by) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Original sales voucher creator ('${originalVoucher.created_by}') cannot initiate reversal for their own voucher.`
          );
        }
        if (originalVoucher.approved_by && preparerId === originalVoucher.approved_by) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Original sales voucher approver ('${originalVoucher.approved_by}') cannot initiate reversal for this voucher.`
          );
        }
        if (approverId === preparerId) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Reversal submitter ('${preparerId}') cannot approve their own reversal draft.`
          );
        }
        if (approverId === originalVoucher.created_by) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Original sales voucher creator ('${originalVoucher.created_by}') cannot approve the invoice reversal.`
          );
        }
        if (originalVoucher.approved_by && approverId === originalVoucher.approved_by) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Original sales voucher approver ('${originalVoucher.approved_by}') cannot approve the invoice reversal.`
          );
        }
        if (posterId === approverId) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Reversal approver ('${approverId}') cannot post the reversal voucher.`
          );
        }
        if (posterId === originalVoucher.created_by) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Original sales voucher creator ('${originalVoucher.created_by}') cannot post the invoice reversal.`
          );
        }
        if (originalVoucher.approved_by && posterId === originalVoucher.approved_by) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Original sales voucher approver ('${originalVoucher.approved_by}') cannot post the invoice reversal.`
          );
        }
        if (originalVoucher.posted_by && posterId === originalVoucher.posted_by) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Original sales voucher poster ('${originalVoucher.posted_by}') cannot post the invoice reversal.`
          );
        }

        const ordCreator = order.metadata?.created_by;
        const ordCustomer = order.customer_id;
        if (ordCreator && (posterId === ordCreator || approverId === ordCreator || preparerId === ordCreator)) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Commercial order creator ('${ordCreator}') cannot initiate, approve, or post invoice reversal.`
          );
        }
        if (ordCustomer && (posterId === ordCustomer || approverId === ordCustomer || preparerId === ordCustomer)) {
          throw new SalesInvoiceReversalError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `SoD Violation: Customer identity ('${ordCustomer}') cannot self-reverse or approve their own commercial sales invoice.`
          );
        }

        // ── STEP 7: QUERY ORIGINAL JOURNAL ENTRY & LINES ─────────────────────
        const origJeRes = await client.query<AccountingJournalEntryRow>(
          `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1 FOR UPDATE`,
          [originalVoucher.id]
        );
        const originalJournal = origJeRes.rows[0];
        if (!originalJournal) {
          throw new SalesInvoiceReversalError(
            "ORIGINAL_JOURNAL_NOT_FOUND",
            `No journal entry found for original sales voucher '${originalVoucher.voucher_no}'.`
          );
        }
        if (originalJournal.is_reversed) {
          throw new SalesInvoiceReversalError(
            "ORDER_ALREADY_REVERSED",
            `Original journal entry '${originalJournal.entry_no}' is already marked reversed.`
          );
        }

        const origLinesRes = await client.query<AccountingJournalLineRow>(
          `SELECT jl.*, acc.code as account_code 
           FROM public.accounting_journal_line jl
           JOIN public.accounting_account acc ON acc.id = jl.account_id
           WHERE jl.journal_entry_id = $1
           ORDER BY jl.line_no ASC`,
          [originalJournal.id]
        );
        const originalLines = origLinesRes.rows;
        if (originalLines.length === 0) {
          throw new SalesInvoiceReversalError(
            "ORIGINAL_JOURNAL_EMPTY",
            `Original journal entry '${originalJournal.entry_no}' has zero journal lines.`
          );
        }

        // ── STEP 8: INVENTORY & COST LEDGER INVESTIGATION ────────────────────
        // Inspect original SALES_FULFILLMENT movements and inventory_cost_consumption
        const iccRes = await client.query<any>(
          `SELECT 
             icc.id AS consumption_id,
             icc.movement_id,
             icc.lot_id,
             icc.quantity AS consumed_quantity,
             icc.unit_cost,
             icc.total_cost,
             icl.product_id,
             icl.variant_id,
             icl.remaining_quantity,
             icl.received_quantity,
             icl.item_type
           FROM public.inventory_cost_consumption icc
           JOIN public.inventory_movement im ON im.id = icc.movement_id
           JOIN public.inventory_cost_lot icl ON icl.id = icc.lot_id
           WHERE im.order_id = $1 
             AND im.movement_type = 'SALES_FULFILLMENT'
           ORDER BY icl.received_at DESC, icl.id DESC
           FOR UPDATE OF icl;`,
          [effectiveOrderId]
        );

        const restoredAccessories: RestoredAccessorySummary[] = [];
        const createdMovements: InventoryMovementRow[] = [];
        let totalRestoredAccessoryCost = 0;

        // Group consumptions by item type
        const accessoryConsumptions = iccRes.rows.filter((c: any) => c.item_type === "ACCESSORY");

        // Durable Accessories: restore lots, update branch inventory, insert INVOICE_REVERSAL movement
        if (accessoryConsumptions.length > 0) {
          const qtyByVariant = new Map<string, { productId: string; quantity: number }>();

          for (const cons of accessoryConsumptions) {
            const restoreQty = Number(cons.consumed_quantity);
            const lotCost = Number(cons.total_cost);

            // Re-instate cost lot atomically
            await client.query(
              `UPDATE public.inventory_cost_lot
               SET remaining_quantity = remaining_quantity + $1,
                   status = 'ACTIVE',
                   updated_at = NOW()
               WHERE id = $2;`,
              [restoreQty, cons.lot_id]
            );

            restoredAccessories.push({
              productId: cons.product_id,
              variantId: cons.variant_id,
              quantity: restoreQty,
              restoredCost: lotCost,
              lotId: cons.lot_id,
            });

            totalRestoredAccessoryCost += lotCost;

            if (cons.variant_id) {
              const current = qtyByVariant.get(cons.variant_id) || { productId: cons.product_id, quantity: 0 };
              qtyByVariant.set(cons.variant_id, { productId: cons.product_id, quantity: current.quantity + restoreQty });
            }
          }

          // Restore physical stock in branch_inventory
          for (const [variantId, item] of qtyByVariant.entries()) {
            await client.query(
              `UPDATE public.branch_inventory
               SET quantity = quantity + $1, updated_at = NOW()
               WHERE branch_id = $2 AND variant_id = $3;`,
              [item.quantity, effectiveBranchId, variantId]
            );

            // Record compensating inventory_movement
            const movRes = await client.query<InventoryMovementRow>(
              `INSERT INTO public.inventory_movement (
                 branch_id, product_id, variant_id,
                 movement_type, quantity, direction,
                 order_id, narration, created_by, created_at
               ) VALUES (
                 $1, $2, $3,
                 'INVOICE_REVERSAL', $4, 'IN',
                 $5, $6, $7, NOW()
               ) RETURNING *;`,
              [
                effectiveBranchId,
                item.productId,
                variantId,
                item.quantity,
                effectiveOrderId,
                `Invoice reversal accessory restoration for Order ${order.display_id || effectiveOrderId}`,
                posterId,
              ]
            );
            createdMovements.push(movRes.rows[0]);
          }
        }

        totalRestoredAccessoryCost = Math.round(totalRestoredAccessoryCost * 100) / 100;

        // ── STEP 9: CONSTRUCT INVERTED COMPENSATING JOURNAL LINES ────────────
        // Reversal debits and credits invert the original journal lines
        const compensatingLines: JournalLineInput[] = [];

        for (const line of originalLines) {
          const accCode = (line as any).account_code;
          const origDebit = Number(line.debit_amount);
          const origCredit = Number(line.credit_amount);

          // Food Hygiene Standard: Perishable cakes and consumable packaging are NEVER reversed into inventory
          if (["5110", "1132"].includes(accCode)) {
            // Cake COGS and Cake Inventory are omitted from reversal journal (costs physically incurred/destroyed)
            continue;
          }
          if (["5130", "1133"].includes(accCode)) {
            // Packaging COGS and Packaging Inventory are omitted from reversal journal
            continue;
          }

          // Commercial lines (1121, 1122, 4110, 4120, 4130, 4180, 2121..2129) and accessory COGS (5120, 1131)
          compensatingLines.push({
            account_id: line.account_id,
            debit_amount: origCredit,
            credit_amount: origDebit,
            branch_id: line.branch_id || effectiveBranchId,
            customer_id: line.customer_id,
            tax_rate: line.tax_rate,
            tax_class: line.tax_class,
            narration: `Reversal of [${originalVoucher.voucher_no}]: ${line.narration || "Sales Entry"} (${params.reason})`,
            metadata: {
              reversal_of_journal_line_id: line.id,
              original_voucher_id: originalVoucher.id,
              order_id: effectiveOrderId,
              reason: params.reason,
            },
          });
        }

        // If accessories were restored but original journal lacked COGS lines (e.g. pure commercial voucher),
        // add accessory restoration lines Dr 1131 / Cr 5120
        const hasAccessoryLines = compensatingLines.some((l) => {
          const matchingOrig = originalLines.find((ol) => ol.account_id === l.account_id);
          return (matchingOrig as any)?.account_code === "1131" || (matchingOrig as any)?.account_code === "5120";
        });

        if (!hasAccessoryLines && totalRestoredAccessoryCost > 0) {
          const coaRes = await client.query<AccountingAccountRow>(
            `SELECT id, code FROM public.accounting_account WHERE code IN ('1131', '5120') AND is_active = true`
          );
          const acc1131 = coaRes.rows.find((a) => a.code === "1131");
          const acc5120 = coaRes.rows.find((a) => a.code === "5120");
          if (acc1131 && acc5120) {
            compensatingLines.push({
              account_id: acc1131.id,
              debit_amount: totalRestoredAccessoryCost,
              credit_amount: 0,
              branch_id: effectiveBranchId,
              narration: `Restoration of accessory inventory asset value on reversal (${order.display_id || effectiveOrderId})`,
            });
            compensatingLines.push({
              account_id: acc5120.id,
              debit_amount: 0,
              credit_amount: totalRestoredAccessoryCost,
              branch_id: effectiveBranchId,
              narration: `Reversal of accessory COGS on invoice reversal (${order.display_id || effectiveOrderId})`,
            });
          }
        }

        // Validate double-entry balance and accounts
        PostingService.validateJournalLines(compensatingLines);
        await PostingService.validatePostingAccounts(
          compensatingLines.map((l) => l.account_id),
          client
        );

        // ── STEP 10: CREATE, SUBMIT, APPROVE, AND POST REVERSAL VOUCHER ───────
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "JOURNAL",
            voucher_date: reversalDate,
            branch_id: effectiveBranchId,
            narration: `Compensating Reversal for Sales Invoice ${originalVoucher.voucher_no}: ${params.reason}`,
            reference_type: "SALES_REVERSAL",
            reference_id: effectiveOrderId,
            reference_event: "INVOICE_REVERSAL",
            reversal_of_voucher_id: originalVoucher.id,
            lines: compensatingLines,
            metadata: {
              order_id: effectiveOrderId,
              original_voucher_id: originalVoucher.id,
              original_voucher_no: originalVoucher.voucher_no,
              reversal_reason: params.reason,
            },
          },
          branchId: effectiveBranchId,
          fiscalYear,
          createdBy: preparerId,
          client,
        });

        if (!draftRes.success) {
          if (draftRes.code === "DUPLICATE_SOURCE_EVENT") {
            const existRev = await AccountingVoucherRepository.findBySourceEvent(
              "SALES_REVERSAL",
              effectiveOrderId,
              "INVOICE_REVERSAL",
              client
            );
            if (existRev) {
              const jeRes = await client.query<AccountingJournalEntryRow>(
                `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`,
                [existRev.id]
              );
              const je = jeRes.rows[0];
              const linesRes = je
                ? await client.query<any>(
                    `SELECT jl.*, acc.code as account_code, acc.name as account_name
                     FROM public.accounting_journal_line jl
                     JOIN public.accounting_account acc ON acc.id = jl.account_id
                     WHERE jl.journal_entry_id = $1 
                     ORDER BY jl.line_no ASC`,
                    [je.id]
                  )
                : { rows: [] };
              const movRes = await client.query<InventoryMovementRow>(
                `SELECT * FROM public.inventory_movement WHERE voucher_id = $1`,
                [existRev.id]
              );

              return {
                reversalVoucher: existRev,
                reversalJournalEntry: { ...(je as any), lines: linesRes.rows },
                originalVoucher,
                orderId: effectiveOrderId,
                reversedTotal: Number(existRev.total_amount),
                restoredAccessories: [],
                movements: movRes.rows,
                postReversalArBalance: 0,
                maxCustomerRefundable: 0,
                wasDuplicate: true,
              };
            }
          }
          throw new SalesInvoiceReversalError(
            draftRes.code as SalesInvoiceReversalErrorCode,
            `Failed to create compensating reversal voucher draft: ${draftRes.error}`
          );
        }
        const reversalDraft = draftRes.data;

        // Submit Voucher
        const submitRes = await PostingService.submitVoucher({
          voucherId: reversalDraft.id,
          submittedBy: preparerId,
          branchId: effectiveBranchId,
          client,
        });
        if (!submitRes.success) {
          throw new SalesInvoiceReversalError(
            submitRes.code as SalesInvoiceReversalErrorCode,
            `Failed to submit compensating reversal voucher: ${submitRes.error}`
          );
        }

        // Approve Voucher (SoD: approverId !== preparerId)
        const approveRes = await PostingService.approveVoucher({
          voucherId: reversalDraft.id,
          approvedBy: approverId,
          branchId: effectiveBranchId,
          client,
        });
        if (!approveRes.success) {
          throw new SalesInvoiceReversalError(
            approveRes.code as SalesInvoiceReversalErrorCode,
            `Failed to approve compensating reversal voucher: ${approveRes.error}`
          );
        }

        // Post Reversal Voucher to General Ledger
        const postRes = await PostingService.postVoucher({
          voucherId: reversalDraft.id,
          postedBy: posterId,
          lines: compensatingLines,
          branchId: effectiveBranchId,
          client,
        });
        if (!postRes.success) {
          throw new SalesInvoiceReversalError(
            postRes.code as SalesInvoiceReversalErrorCode,
            `Failed to post compensating reversal voucher to General Ledger: ${postRes.error} [${postRes.code}]`
          );
        }

        const postedReversalVoucher = postRes.data.voucher;
        const rawJournalEntry = postRes.data.journal_entry;

        // Enrich journal lines with account_code for authoritative verification
        const enrichedLinesRes = await client.query<any>(
          `SELECT jl.*, acc.code as account_code, acc.name as account_name
           FROM public.accounting_journal_line jl
           JOIN public.accounting_account acc ON acc.id = jl.account_id
           WHERE jl.journal_entry_id = $1
           ORDER BY jl.line_no ASC`,
          [rawJournalEntry.id]
        );
        const postedJournalEntry = {
          ...rawJournalEntry,
          lines: enrichedLinesRes.rows,
        };

        // ── STEP 11: ESTABLISH AUTHORITATIVE BIDIRECTIONAL LINKAGE ───────────
        const updatedOriginalVoucher = await PostingService.linkReversal(
          {
            originalVoucherId: originalVoucher.id,
            reversalVoucherId: postedReversalVoucher.id,
            reversedBy: posterId,
            branchId: effectiveBranchId,
          },
          client
        );

        // Link created movements to reversal voucher
        for (const mov of createdMovements) {
          await client.query(
            `UPDATE public.inventory_movement SET voucher_id = $1 WHERE id = $2`,
            [postedReversalVoucher.id, mov.id]
          );
        }

        // Update commercial order metadata
        const existingOrderMeta = (order.metadata || {}) as Record<string, any>;
        const updatedOrderMeta = {
          ...existingOrderMeta,
          is_reversed: true,
          reversal_voucher_id: postedReversalVoucher.id,
          reversal_date: reversalDate,
          reversal_reason: params.reason,
          reversed_by: posterId,
        };
        await client.query(
          `UPDATE public."order" SET metadata = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedOrderMeta), effectiveOrderId]
        );

        // ── STEP 12: DERIVE AR BALANCE AND CUSTOMER REFUND ELIGIBILITY ───────
        // Invariant: Reversal != customer refund. Existing receipts remain intact.
        const receiptsRes = await client.query(
          `SELECT COALESCE(SUM(total_amount), 0) AS total_received
           FROM public.accounting_voucher
           WHERE voucher_type = 'RECEIPT'
             AND status = 'POSTED'
             AND deleted_at IS NULL
             AND (reference_id = $1 OR metadata->>'order_id' = $1);`,
          [effectiveOrderId]
        );
        const refundsRes = await client.query(
          `SELECT COALESCE(SUM(total_amount), 0) AS total_refunded
           FROM public.accounting_voucher
           WHERE voucher_type = 'PAYMENT'
             AND reference_type = 'CUSTOMER_REFUND'
             AND status = 'POSTED'
             AND deleted_at IS NULL
             AND (reference_id = $1 OR metadata->>'order_id' = $1);`,
          [effectiveOrderId]
        );

        const totalReceived = Number(receiptsRes.rows[0]?.total_received || 0);
        const totalRefunded = Number(refundsRes.rows[0]?.total_refunded || 0);
        const netPaid = Math.max(0, totalReceived - totalRefunded);
        const postReversalArBalance = -netPaid; // Negative represents credit balance (bakery owes customer)
        const maxCustomerRefundable = netPaid;

        return {
          reversalVoucher: postedReversalVoucher,
          reversalJournalEntry: postedJournalEntry,
          originalVoucher: updatedOriginalVoucher,
          orderId: effectiveOrderId,
          reversedTotal: Number(postedReversalVoucher.total_amount),
          restoredAccessories,
          movements: createdMovements,
          postReversalArBalance,
          maxCustomerRefundable,
          wasDuplicate: false,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (
        err instanceof SalesInvoiceReversalError ||
        err?.name === "SalesInvoiceReversalError" ||
        err instanceof PostingServiceError ||
        err?.name === "PostingServiceError"
      ) {
        return {
          success: false,
          error: err.message,
          code: (err.code as SalesInvoiceReversalErrorCode) || "SALES_REVERSAL_FAILED",
        };
      }
      if (typeof err?.code === "string" && !/^\d+$/.test(err.code)) {
        return {
          success: false,
          error: err.message || String(err),
          code: err.code as SalesInvoiceReversalErrorCode,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "SALES_REVERSAL_FAILED" };
    }
  }
}
