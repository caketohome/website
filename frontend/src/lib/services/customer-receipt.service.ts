/**
 * CakeToHome ERP — Customer Receipt & AR Settlement Service
 * Phase 4F Step 4.5: Customer Receipts, COD Cash Remittance, and Gateway MDR Settlement.
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DOUBLE-ENTRY JOURNAL STRUCTURES:
 *    A. Prepaid Customer Receipt:
 *       Dr 1113 Gateway Clearing
 *       Cr 1121 Accounts Receivable
 *    B. COD Cash Remittance:
 *       Dr 1111 Cash in Hand
 *       Cr 1122 Undeposited COD
 *    C. Gateway Settlement:
 *       Dr 1112 Bank Operating A/c (Net)
 *       Dr 5290 Payment Gateway MDR Fees (MDR expense)
 *       Cr 1113 Gateway Clearing (Gross)
 *       Mathematical Identity: Net Bank + MDR Fee === Gross Clearing.
 *
 * 2. HISTORICAL DATA QUARANTINE:
 *    - Historical prototype orders (173) and transactions (53) are strictly quarantined.
 *    - Reject if order.metadata->>'legacy_prototype' = 'true' or order.metadata->>'is_ledger_eligible' != 'true'.
 *
 * 3. AUTHORITATIVE AR & OVERPAYMENT DEFENSE:
 *    - Outstanding balance is computed from DB records (posted sales voucher minus posted receipts).
 *    - Reject overpayment with OVERPAYMENT_NOT_PERMITTED (fail closed, no silent capping).
 *
 * 4. GUEST CUSTOMER FOREIGN KEY HYGIENE:
 *    - accounting_journal_line.customer_id FK references customer(id).
 *    - For guest orders (customer_id = 'guest' or not in customer table), journal_line.customer_id MUST be NULL.
 *
 * 5. SEGREGATION OF DUTIES (SoD) & BOLA DEFENSE:
 *    - Creator != Approver, Submitter != Approver, Creator != Poster.
 *    - Customer identity and commercial order creator cannot approve or post.
 *    - Super Admin cannot self-approve.
 *    - BOLA: Strict branch isolation.
 *
 * 6. ATOMICITY & REUSE:
 *    - Reuses canonical PostingService, AccountingVoucherRepository, AccountingJournalRepository.
 *    - Zero duplicate state machine. Deterministic lock ordering: order -> payment_transaction -> voucher.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  AccountingAccountRow,
  JournalLineInput,
  CustomerReceiptDraftParams,
  SubmitCustomerReceiptParams,
  ApproveCustomerReceiptParams,
  PostCustomerReceiptParams,
  PostCodCashRemittanceParams,
  PostCodShiftSettlementParams,
  PostGatewaySettlementParams,
  CustomerReceiptResult,
  CodShiftSettlementResult,
  GatewaySettlementResult,
  OrderOutstandingArResult,
} from "../types/accounting.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type CustomerReceiptErrorCode =
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_POSTED"
  | "INVALID_ORDER_STATUS"
  | "LEGACY_PROTOTYPE_ORDER_REJECTED"
  | "INVALID_AMOUNT"
  | "OVERPAYMENT_NOT_PERMITTED"
  | "OVER_REMITTANCE_FORBIDDEN"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_ACCESS_DENIED"
  | "VOUCHER_NOT_FOUND"
  | "INVALID_VOUCHER_STATE"
  | "VOUCHER_ALREADY_POSTED"
  | "DUPLICATE_SOURCE_EVENT"
  | "PERMISSION_DENIED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "ACCOUNT_RESOLUTION_FAILED"
  | "INVALID_PAYMENT_METHOD"
  | "INVALID_SETTLEMENT_MATH"
  | "MISSING_MDR_FEE"
  | "POSTING_GUARD_FAILED"
  | "PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN"
  | "CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED"
  | "SETTLEMENT_ALLOCATION_MISMATCH"
  | "RIDER_MISMATCH_SETTLEMENT"
  | "RECEIPT_POSTING_FAILED";

export class CustomerReceiptError extends Error {
  readonly code: CustomerReceiptErrorCode;

  constructor(code: CustomerReceiptErrorCode, message: string) {
    super(message);
    this.name = "CustomerReceiptError";
    this.code = code;
  }
}

export type CustomerReceiptResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: CustomerReceiptErrorCode };

// ─── CustomerReceiptService ───────────────────────────────────────────────────

export class CustomerReceiptService {
  // ── 1. AUTHORITATIVE AR OUTSTANDING BALANCE CALCULATION ─────────────────────

  /**
   * Computes the authoritative outstanding AR for a sales order directly from PostgreSQL.
   * Outstanding AR = Posted Sales Voucher Total - Sum(Posted Receipt Vouchers Total).
   */
  static async getOrderOutstandingAr(
    orderId: string,
    client?: PoolClient
  ): Promise<OrderOutstandingArResult> {
    const execute = async (c: PoolClient): Promise<OrderOutstandingArResult> => {
      // 1. Fetch order
      const oRes = await c.query(
        `SELECT id, status, metadata, customer_id FROM public."order" WHERE id = $1 AND deleted_at IS NULL`,
        [orderId]
      );
      const order = oRes.rows[0];
      if (!order) {
        throw new CustomerReceiptError("ORDER_NOT_FOUND", `Order '${orderId}' not found.`);
      }

      const meta = (order.metadata || {}) as Record<string, any>;
      const isLedgerEligible = meta.is_ledger_eligible === true && meta.legacy_prototype !== true;

      // 2. Fetch posted sales voucher
      const vSql = `
        SELECT id, total_amount, metadata
        FROM public.accounting_voucher
        WHERE reference_type = 'SALE'
          AND reference_id = $1
          AND voucher_type = 'SALES'
          AND status = 'POSTED'
          AND deleted_at IS NULL;
      `;
      const vRes = await c.query(vSql, [orderId]);
      const salesVoucher = vRes.rows[0];

      if (!salesVoucher) {
        return {
          orderId,
          isLedgerEligible,
          salesVoucherId: null,
          invoiceTotal: 0,
          totalReceived: 0,
          outstandingAr: 0,
          isFullySettled: false,
          paymentClassification: "PREPAID",
          controlAccountCode: "1121",
        };
      }

      // 2b. Authoritative Commercial Invoice Total:
      // Query posted commercial AR debit from the General Ledger (Account 1121 or 1122 lines for this sales voucher)
      const arLineSql = `
        SELECT COALESCE(SUM(jl.debit_amount), 0) AS posted_ar
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
        JOIN public.accounting_account a ON jl.account_id = a.id
        WHERE je.voucher_id = $1
          AND a.code IN ('1121', '1122');
      `;
      const arLineRes = await c.query(arLineSql, [salesVoucher.id]);
      const postedArDebit = Math.round(Number(arLineRes.rows[0]?.posted_ar || 0) * 100) / 100;

      const vMeta = (salesVoucher.metadata || {}) as Record<string, any>;
      const invoiceTotal = postedArDebit > 0
        ? postedArDebit
        : Math.round(Number(vMeta.invoice_total || salesVoucher.total_amount) * 100) / 100;

      // 3. Determine payment classification (PREPAID vs COD)
      const isCod =
        meta.payment_method === "cod" ||
        meta.payment_method === "Cash on Delivery (COD)" ||
        (salesVoucher.metadata && salesVoucher.metadata.payment_classification === "COD");

      const paymentClassification: "PREPAID" | "COD" = isCod ? "COD" : "PREPAID";
      const controlAccountCode: "1121" | "1122" = isCod ? "1122" : "1121";

      // 4. Query all posted receipt vouchers against this order
      const rSql = `
        SELECT COALESCE(SUM(total_amount), 0) AS total_received
        FROM public.accounting_voucher
        WHERE voucher_type = 'RECEIPT'
          AND status = 'POSTED'
          AND deleted_at IS NULL
          AND (
            (reference_type = 'ORDER' AND reference_id = $1)
            OR (reference_type = 'PAYMENT_TRANSACTION' AND reference_id IN (
              SELECT pt.id FROM public.payment_transaction pt WHERE pt.order_id = $1 AND pt.deleted_at IS NULL
            ))
            OR (metadata->>'order_id' = $1)
          );
      `;
      const rRes = await c.query(rSql, [orderId]);
      const totalReceived = Math.round(Number(rRes.rows[0].total_received) * 100) / 100;

      // 5. Query all posted credit note vouchers against this order
      const cnSql = `
        SELECT COALESCE(SUM(total_amount), 0) AS total_credited
        FROM public.accounting_voucher
        WHERE voucher_type = 'CREDIT_NOTE'
          AND status = 'POSTED'
          AND deleted_at IS NULL
          AND (
            (reference_type IN ('ORDER', 'ORDER_RETURN') AND reference_id = $1)
            OR (metadata->>'order_id' = $1)
            OR (reversal_of_voucher_id = $2)
          );
      `;
      const cnRes = await c.query(cnSql, [orderId, salesVoucher.id]);
      const totalCreditNotes = Math.round(Number(cnRes.rows[0].total_credited) * 100) / 100;

      // 6. Query all posted customer refund payment vouchers against this order
      const refSql = `
        SELECT COALESCE(SUM(total_amount), 0) AS total_refunded
        FROM public.accounting_voucher
        WHERE voucher_type = 'PAYMENT'
          AND status = 'POSTED'
          AND deleted_at IS NULL
          AND (
            (reference_type = 'CUSTOMER_REFUND' AND reference_id = $1)
            OR (metadata->>'order_id' = $1)
          );
      `;
      const refRes = await c.query(refSql, [orderId]);
      const totalRefunded = Math.round(Number(refRes.rows[0].total_refunded) * 100) / 100;

      const netInvoiced = Math.max(0, Math.round((invoiceTotal - totalCreditNotes) * 100) / 100);
      const netPaid = Math.max(0, Math.round((totalReceived - totalRefunded) * 100) / 100);

      const outstandingAr = Math.max(0, Math.round((netInvoiced - netPaid) * 100) / 100);
      const maxRefundable = Math.max(0, Math.round((netPaid - netInvoiced) * 100) / 100);
      const isFullySettled = outstandingAr <= 0.001;

      return {
        orderId,
        isLedgerEligible,
        salesVoucherId: salesVoucher.id,
        invoiceTotal,
        totalReceived,
        outstandingAr,
        isFullySettled,
        paymentClassification,
        controlAccountCode,
        totalCreditNotes,
        totalRefunded,
        maxRefundable,
        netInvoiced,
        netPaid,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  // ── 2. CREATE CUSTOMER RECEIPT DRAFT ────────────────────────────────────────

  /**
   * Constructs an accounting voucher in DRAFT status of type RECEIPT.
   * Validates amount, order status, historical quarantine, posted sales invoice, and outstanding balance.
   */
  static async createCustomerReceiptDraft(
    params: CustomerReceiptDraftParams
  ): Promise<CustomerReceiptResponse<AccountingVoucherRow>> {
    try {
      if (typeof params.amount !== "number" || isNaN(params.amount) || params.amount <= 0) {
        throw new CustomerReceiptError(
          "INVALID_AMOUNT",
          `Receipt amount must be a positive number. Got '${params.amount}'.`
        );
      }

      const receiptAmount = Math.round(params.amount * 100) / 100;

      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        // ─────────────────────────────────────────────────────────────────────
        // 1. Lock & Fetch Source Order (Pessimistic concurrency lock)
        // ─────────────────────────────────────────────────────────────────────
        const oSql = `
          SELECT * FROM public."order"
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE;
        `;
        const oRes = await client.query(oSql, [params.orderId]);
        const order = oRes.rows[0];
        if (!order) {
          throw new CustomerReceiptError("ORDER_NOT_FOUND", `Order '${params.orderId}' not found.`);
        }

        const ordStatus = (order.status || "").toLowerCase();
        if (ordStatus === "canceled" || ordStatus === "cancelled") {
          throw new CustomerReceiptError(
            "INVALID_ORDER_STATUS",
            `Cannot create customer receipt for canceled order '${order.id}'.`
          );
        }

        const meta = (order.metadata || {}) as Record<string, any>;
        if (meta.legacy_prototype === true || meta.legacy_prototype === "true" || meta.is_ledger_eligible !== true) {
          throw new CustomerReceiptError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Historical prototype order '${order.id}' is quarantined and cannot participate in accounting receipts.`
          );
        }

        // Branch verification
        const effectiveBranchId = params.branchId || meta.branch_id;
        if (!effectiveBranchId) {
          throw new CustomerReceiptError("BRANCH_NOT_FOUND", `Branch not specified for order '${order.id}'.`);
        }
        if (params.branchId && meta.branch_id && params.branchId !== meta.branch_id) {
          throw new CustomerReceiptError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: order belongs to branch '${meta.branch_id}', not '${params.branchId}'.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. Verify Posted Sales Voucher
        // ─────────────────────────────────────────────────────────────────────
        const arStatus = await CustomerReceiptService.getOrderOutstandingAr(order.id, client);
        if (!arStatus.salesVoucherId) {
          throw new CustomerReceiptError(
            "ORDER_NOT_POSTED",
            `Cannot create receipt for order '${order.id}': No POSTED sales voucher exists. Sales revenue must be recognized before receipts.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Resolve Payment Transaction & Classification
        // ─────────────────────────────────────────────────────────────────────
        let paymentTxn: any = null;
        if (params.paymentTxnId) {
          const ptRes = await client.query(
            `SELECT * FROM public.payment_transaction WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
            [params.paymentTxnId]
          );
          paymentTxn = ptRes.rows[0];
          if (paymentTxn && paymentTxn.order_id !== order.id) {
            throw new CustomerReceiptError(
              "INVALID_PAYMENT_METHOD",
              `Payment transaction '${paymentTxn.id}' does not belong to order '${order.id}'.`
            );
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. Source Event Idempotency Check (Precedes Overpayment Check)
        // ─────────────────────────────────────────────────────────────────────
        let referenceType = "ORDER";
        let referenceId = order.id;
        let referenceEvent = "ORDER_RECEIPT";

        if (paymentTxn) {
          referenceType = "PAYMENT_TRANSACTION";
          referenceId = paymentTxn.id;
          referenceEvent = "CUSTOMER_RECEIPT";

          // Check if existing voucher exists for this payment transaction
          const dupRes = await client.query<AccountingVoucherRow>(
            `SELECT id, status FROM public.accounting_voucher
             WHERE reference_type = $1 AND reference_id = $2 AND reference_event = $3 AND status != 'CANCELLED' AND deleted_at IS NULL`,
            [referenceType, referenceId, referenceEvent]
          );
          if (dupRes.rows.length > 0) {
            throw new CustomerReceiptError(
              "DUPLICATE_SOURCE_EVENT",
              `Duplicate receipt voucher rejected: A receipt voucher already exists for ${referenceType} '${referenceId}'.`
            );
          }
        } else {
          // Direct order receipt: check if an active unposted receipt draft is already in flight
          const inFlightRes = await client.query<AccountingVoucherRow>(
            `SELECT id, status FROM public.accounting_voucher
             WHERE reference_type = 'ORDER' AND reference_id = $1 AND status IN ('DRAFT', 'SUBMITTED', 'APPROVED') AND deleted_at IS NULL`,
            [order.id]
          );
          if (inFlightRes.rows.length > 0) {
            throw new CustomerReceiptError(
              "DUPLICATE_SOURCE_EVENT",
              `Duplicate receipt voucher rejected: An active unposted receipt voucher (${inFlightRes.rows[0].id}) is already in progress (${inFlightRes.rows[0].status}) for order '${order.id}'.`
            );
          }

          const prevRes = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM public.accounting_voucher
             WHERE reference_type = 'ORDER' AND reference_id = $1 AND status != 'CANCELLED' AND deleted_at IS NULL`,
            [order.id]
          );
          const prevCount = parseInt(prevRes.rows[0]?.count || "0", 10);
          referenceEvent = prevCount === 0 ? "ORDER_RECEIPT" : `ORDER_RECEIPT_PARTIAL_${prevCount + 1}`;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. Overpayment Guard
        // ─────────────────────────────────────────────────────────────────────
        if (receiptAmount > arStatus.outstandingAr) {
          throw new CustomerReceiptError(
            "OVERPAYMENT_NOT_PERMITTED",
            `Receipt amount ₹${receiptAmount.toFixed(2)} exceeds outstanding AR balance ₹${arStatus.outstandingAr.toFixed(2)} for order '${order.id}'. Overpayment is not permitted.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 6. Resolve CoA Accounts Early (Fail Closed)
        // ─────────────────────────────────────────────────────────────────────
        const isCod =
          arStatus.paymentClassification === "COD" ||
          params.paymentMethod === "cod" ||
          (paymentTxn && paymentTxn.provider === "cod");

        const classification: "PREPAID" | "COD" = isCod ? "COD" : "PREPAID";
        const controlAccountCode: "1121" | "1122" = isCod ? "1122" : "1121";
        const targetDebitCode: "1111" | "1113" = isCod ? "1111" : "1113";

        const requiredCodes = [controlAccountCode, targetDebitCode];
        const coaRes = await client.query<AccountingAccountRow>(
          `SELECT * FROM public.accounting_account WHERE code = ANY($1) AND is_active = true AND is_group = false AND deleted_at IS NULL`,
          [requiredCodes]
        );
        if (coaRes.rows.length !== requiredCodes.length) {
          throw new CustomerReceiptError(
            "ACCOUNT_RESOLUTION_FAILED",
            `Failed to resolve active leaf accounts (${requiredCodes.join(", ")}) in Chart of Accounts.`
          );
        }

        const voucherDate = params.voucherDate || new Date().toISOString().slice(0, 10);
        const fiscalYear = `FY${voucherDate.slice(0, 4)}`;

        const voucherMetadata = {
          order_id: order.id,
          order_display_id: order.display_id,
          payment_transaction_id: paymentTxn ? paymentTxn.id : null,
          payment_classification: classification,
          control_account_code: controlAccountCode,
          debit_account_code: targetDebitCode,
          receipt_amount: receiptAmount,
          outstanding_ar_before: arStatus.outstandingAr,
          outstanding_ar_after: Math.max(0, Math.round((arStatus.outstandingAr - receiptAmount) * 100) / 100),
          is_guest: !order.customer_id || order.customer_id === "guest",
        };

        const narration =
          params.narration ||
          `Customer receipt for Order ${order.display_id || order.id} (${classification}: ₹${receiptAmount.toFixed(2)})`;

        // Create voucher in DRAFT status
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "RECEIPT",
            voucher_date: voucherDate,
            branch_id: effectiveBranchId,
            narration,
            reference_type: referenceType,
            reference_id: referenceId,
            reference_event: referenceEvent,
            metadata: voucherMetadata,
          },
          branchId: effectiveBranchId,
          fiscalYear,
          createdBy: params.createdBy,
          client,
        });

        if (!draftRes.success) {
          if (draftRes.code === "DUPLICATE_SOURCE_EVENT") {
            throw new CustomerReceiptError("DUPLICATE_SOURCE_EVENT", draftRes.error);
          }
          throw new CustomerReceiptError("RECEIPT_POSTING_FAILED", draftRes.error);
        }

        // Set total_amount
        const updateSql = `
          UPDATE public.accounting_voucher
          SET total_amount = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `;
        const updatedVoucher = await client.query<AccountingVoucherRow>(updateSql, [
          receiptAmount,
          draftRes.data.id,
        ]);

        return updatedVoucher.rows[0];
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof CustomerReceiptError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "RECEIPT_POSTING_FAILED" };
    }
  }

  // ── 3. SUBMIT CUSTOMER RECEIPT ──────────────────────────────────────────────

  /**
   * Transitions a customer receipt voucher from DRAFT to SUBMITTED status.
   */
  static async submitCustomerReceipt(
    params: SubmitCustomerReceiptParams
  ): Promise<CustomerReceiptResponse<AccountingVoucherRow>> {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new CustomerReceiptError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (voucher.voucher_type !== "RECEIPT") {
          throw new CustomerReceiptError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' has type '${voucher.voucher_type}'. Expected 'RECEIPT'.`
          );
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new CustomerReceiptError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        if (voucher.status !== "DRAFT") {
          throw new CustomerReceiptError(
            "INVALID_VOUCHER_STATE",
            `Cannot submit voucher in status '${voucher.status}'. Only DRAFT vouchers can be submitted.`
          );
        }

        const submitRes = await PostingService.submitVoucher({
          voucherId: voucher.id,
          submittedBy: params.submittedBy,
          branchId: voucher.branch_id,
          client,
        });

        if (!submitRes.success) {
          throw new CustomerReceiptError("INVALID_VOUCHER_STATE", submitRes.error);
        }

        return submitRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof CustomerReceiptError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "RECEIPT_POSTING_FAILED" };
    }
  }

  // ── 4. APPROVE CUSTOMER RECEIPT ────────────────────────────────────────────

  /**
   * Approves a SUBMITTED receipt voucher with strict Segregation of Duties (SoD) enforcement.
   */
  static async approveCustomerReceipt(
    params: ApproveCustomerReceiptParams
  ): Promise<CustomerReceiptResponse<AccountingVoucherRow>> {
    try {
      const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
        // 1. Fetch & lock voucher
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new CustomerReceiptError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (voucher.voucher_type !== "RECEIPT") {
          throw new CustomerReceiptError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' has type '${voucher.voucher_type}'. Expected 'RECEIPT'.`
          );
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new CustomerReceiptError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        if (voucher.status === "DRAFT") {
          throw new CustomerReceiptError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher in DRAFT status. Voucher must first be submitted.`
          );
        }
        if (voucher.status === "APPROVED") {
          throw new CustomerReceiptError("INVALID_VOUCHER_STATE", `Receipt voucher is already APPROVED.`);
        }
        if (voucher.status === "POSTED") {
          throw new CustomerReceiptError("INVALID_VOUCHER_STATE", `Cannot approve voucher in POSTED status.`);
        }
        if (voucher.status === "CANCELLED") {
          throw new CustomerReceiptError("INVALID_VOUCHER_STATE", `Cannot approve voucher in CANCELLED status.`);
        }
        if (voucher.status !== "SUBMITTED") {
          throw new CustomerReceiptError(
            "INVALID_VOUCHER_STATE",
            `Cannot approve voucher in status '${voucher.status}'. Only SUBMITTED vouchers can be approved.`
          );
        }

        // 2. Fetch & lock linked Order
        const vMeta = (voucher.metadata || {}) as Record<string, any>;
        const orderId = vMeta.order_id || voucher.reference_id;
        if (!orderId) {
          throw new CustomerReceiptError("INVALID_VOUCHER_STATE", `Receipt voucher has no linked order_id.`);
        }

        const oRes = await client.query(
          `SELECT id, status, customer_id, metadata FROM public."order" WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [orderId]
        );
        const order = oRes.rows[0];
        if (!order) {
          throw new CustomerReceiptError("ORDER_NOT_FOUND", `Linked order '${orderId}' not found.`);
        }

        if (order.status === "canceled" || order.status === "cancelled") {
          throw new CustomerReceiptError(
            "INVALID_ORDER_STATUS",
            `Cannot approve receipt for canceled order '${order.id}'.`
          );
        }

        const orderMeta = (order.metadata || {}) as Record<string, any>;
        if (orderMeta.legacy_prototype === true || orderMeta.is_ledger_eligible !== true) {
          throw new CustomerReceiptError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Order '${order.id}' is quarantined prototype data and cannot participate in accounting approval.`
          );
        }

        // 3. Segregation of Duties (SoD) Checks
        if (!voucher.created_by) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Voucher '${voucher.id}' has no recorded creator.`
          );
        }

        // Rule A: Preparer cannot approve
        if (params.approvedBy === voucher.created_by) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher creator '${voucher.created_by}' cannot approve their own receipt voucher.`
          );
        }

        // Rule B: Submitter cannot approve
        if (voucher.submitted_by && params.approvedBy === voucher.submitted_by) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher submitter '${voucher.submitted_by}' cannot approve the receipt voucher.`
          );
        }

        // Rule C: Customer cannot approve
        if (order.customer_id && params.approvedBy === order.customer_id) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Customer '${order.customer_id}' cannot approve the customer receipt voucher.`
          );
        }

        // Rule D: Commercial order creator cannot approve
        if (orderMeta.created_by && params.approvedBy === orderMeta.created_by) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Commercial order creator '${orderMeta.created_by}' cannot approve the accounting receipt voucher.`
          );
        }

        // 4. Permission Check: ACCOUNTING.APPROVE
        const actorContext = params.actorContext || {
          id: params.approvedBy,
          user_id: params.approvedBy,
          role: "STAFF",
        };
        const hasApprovePerm = hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE");
        if (!hasApprovePerm) {
          throw new CustomerReceiptError(
            "PERMISSION_DENIED",
            `Actor '${params.approvedBy}' lacks permission 'ACCOUNTING.APPROVE'.`
          );
        }

        // 5. Canonical Approve Call
        const appRes = await PostingService.approveVoucher({
          voucherId: voucher.id,
          approvedBy: params.approvedBy,
          branchId: voucher.branch_id,
          client,
        });

        if (!appRes.success) {
          throw new CustomerReceiptError("INVALID_VOUCHER_STATE", appRes.error);
        }

        return appRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof CustomerReceiptError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "RECEIPT_POSTING_FAILED" };
    }
  }

  // ── 5. POST CUSTOMER RECEIPT (GL POSTING & AR CLEARING) ─────────────────────

  /**
   * Posts an APPROVED receipt voucher to the General Ledger:
   * Prepaid: Dr 1113 Gateway Clearing / Cr 1121 Accounts Receivable
   * COD:     Dr 1111 Cash in Hand     / Cr 1122 Undeposited COD
   * Mutates payment_transaction status and updates order metadata.
   */
  static async postCustomerReceipt(
    params: PostCustomerReceiptParams
  ): Promise<CustomerReceiptResponse<CustomerReceiptResult>> {
    try {
      const execute = async (client: PoolClient): Promise<CustomerReceiptResult> => {
        // ─────────────────────────────────────────────────────────────────────
        // 1. Fetch & lock voucher
        // ─────────────────────────────────────────────────────────────────────
        const vRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [params.voucherId]
        );
        const voucher = vRes.rows[0];
        if (!voucher) {
          throw new CustomerReceiptError("VOUCHER_NOT_FOUND", `Voucher '${params.voucherId}' not found.`);
        }

        if (voucher.voucher_type !== "RECEIPT") {
          throw new CustomerReceiptError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' has type '${voucher.voucher_type}'. Expected 'RECEIPT'.`
          );
        }

        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new CustomerReceiptError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        if (voucher.status === "POSTED") {
          throw new CustomerReceiptError(
            "VOUCHER_ALREADY_POSTED",
            `Receipt voucher '${voucher.voucher_no}' is already POSTED.`
          );
        }

        if (voucher.status !== "APPROVED") {
          throw new CustomerReceiptError(
            "INVALID_VOUCHER_STATE",
            `Cannot post receipt voucher '${voucher.voucher_no}' in status '${voucher.status}'. Only APPROVED vouchers can be posted.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. Fetch & lock Order
        // ─────────────────────────────────────────────────────────────────────
        const vMeta = (voucher.metadata || {}) as Record<string, any>;
        const orderId = vMeta.order_id || voucher.reference_id;
        if (!orderId) {
          throw new CustomerReceiptError("INVALID_VOUCHER_STATE", `Receipt voucher has no linked order_id.`);
        }

        const oRes = await client.query(
          `SELECT * FROM public."order" WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [orderId]
        );
        const order = oRes.rows[0];
        if (!order) {
          throw new CustomerReceiptError("ORDER_NOT_FOUND", `Linked order '${orderId}' not found.`);
        }

        if (order.status === "canceled" || order.status === "cancelled") {
          throw new CustomerReceiptError(
            "INVALID_ORDER_STATUS",
            `Cannot post receipt for canceled order '${order.id}'.`
          );
        }

        const orderMeta = (order.metadata || {}) as Record<string, any>;
        if (orderMeta.legacy_prototype === true || orderMeta.is_ledger_eligible !== true) {
          throw new CustomerReceiptError(
            "LEGACY_PROTOTYPE_ORDER_REJECTED",
            `Order '${order.id}' is quarantined prototype data and cannot participate in accounting posting.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. Lock Payment Transaction (if linked)
        // ─────────────────────────────────────────────────────────────────────
        let paymentTxn: any = null;
        const ptId = vMeta.payment_transaction_id;
        if (ptId) {
          const ptRes = await client.query(
            `SELECT * FROM public.payment_transaction WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
            [ptId]
          );
          paymentTxn = ptRes.rows[0];
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. Segregation of Duties (SoD) Checks
        // ─────────────────────────────────────────────────────────────────────
        if (!params.postedBy || !params.postedBy.trim()) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            "A valid staff postedBy identifier is required to post customer receipts."
          );
        }

        if (voucher.created_by && params.postedBy === voucher.created_by) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher creator '${voucher.created_by}' cannot post their own receipt voucher.`
          );
        }

        if (voucher.submitted_by && params.postedBy === voucher.submitted_by) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Voucher submitter '${voucher.submitted_by}' cannot post the receipt voucher.`
          );
        }

        if (order.customer_id && params.postedBy === order.customer_id) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Customer '${order.customer_id}' cannot post the customer receipt voucher.`
          );
        }

        if (orderMeta.created_by && params.postedBy === orderMeta.created_by) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of Duties violation: Commercial order creator '${orderMeta.created_by}' cannot post the accounting receipt voucher.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. Permission Check: ACCOUNTING.POST
        // ─────────────────────────────────────────────────────────────────────
        const actorContext = params.actorContext || {
          id: params.postedBy,
          user_id: params.postedBy,
          role: "STAFF",
        };
        const hasPostPerm = hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPostPerm) {
          throw new CustomerReceiptError(
            "PERMISSION_DENIED",
            `Actor '${params.postedBy}' lacks permission 'ACCOUNTING.POST'.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 6. Concurrency Check: Re-verify Outstanding AR Under Lock
        // ─────────────────────────────────────────────────────────────────────
        const arStatus = await CustomerReceiptService.getOrderOutstandingAr(order.id, client);
        const receiptAmount = Math.round(Number(voucher.total_amount) * 100) / 100;

        if (receiptAmount > arStatus.outstandingAr) {
          throw new CustomerReceiptError(
            "OVERPAYMENT_NOT_PERMITTED",
            `Receipt amount ₹${receiptAmount.toFixed(2)} exceeds current outstanding AR balance ₹${arStatus.outstandingAr.toFixed(2)} for order '${order.id}'. Overpayment is not permitted.`
          );
        }

        // ─────────────────────────────────────────────────────────────────────
        // 7. Resolve Accounts & Construct Journal Lines
        // ─────────────────────────────────────────────────────────────────────
        const classification = vMeta.payment_classification || arStatus.paymentClassification;
        const isCod = classification === "COD";

        const debitAccountCode = isCod ? "1111" : "1113"; // 1111 Cash in Hand vs 1113 Gateway Clearing
        const creditAccountCode = isCod ? "1122" : "1121"; // 1122 Undeposited COD vs 1121 Accounts Receivable

        const targetCodes = [debitAccountCode, creditAccountCode];
        const coaRes = await client.query<AccountingAccountRow>(
          `SELECT * FROM public.accounting_account WHERE code = ANY($1) AND is_active = true AND is_group = false AND deleted_at IS NULL`,
          [targetCodes]
        );
        const coaMap = new Map<string, AccountingAccountRow>();
        for (const row of coaRes.rows) {
          coaMap.set(row.code, row);
        }

        const debitAccount = coaMap.get(debitAccountCode);
        const creditAccount = coaMap.get(creditAccountCode);
        if (!debitAccount || !creditAccount) {
          throw new CustomerReceiptError(
            "ACCOUNT_RESOLUTION_FAILED",
            `Failed to resolve accounts ${debitAccountCode} or ${creditAccountCode} in Chart of Accounts.`
          );
        }

        // Customer FK Hygiene: Check if order.customer_id is a real customer in public.customer
        let validatedCustomerId: string | null = null;
        if (order.customer_id && order.customer_id !== "guest") {
          const custRes = await client.query(
            `SELECT id FROM public.customer WHERE id = $1 AND deleted_at IS NULL`,
            [order.customer_id]
          );
          if (custRes.rows.length > 0) {
            validatedCustomerId = custRes.rows[0].id;
          }
        }

        const journalLines: JournalLineInput[] = [
          {
            account_id: debitAccount.id,
            debit_amount: receiptAmount,
            credit_amount: 0,
            branch_id: voucher.branch_id,
            customer_id: validatedCustomerId,
            narration: `${debitAccount.name} received for Order ${order.display_id || order.id}`,
          },
          {
            account_id: creditAccount.id,
            debit_amount: 0,
            credit_amount: receiptAmount,
            branch_id: voucher.branch_id,
            customer_id: validatedCustomerId,
            narration: `${creditAccount.name} settlement for Order ${order.display_id || order.id}`,
          },
        ];

        // ─────────────────────────────────────────────────────────────────────
        // 8. Canonical Post Call to PostingService.postVoucher
        // ─────────────────────────────────────────────────────────────────────
        const postRes = await PostingService.postVoucher({
          voucherId: voucher.id,
          postedBy: params.postedBy,
          lines: journalLines,
          branchId: voucher.branch_id,
          client,
        });

        if (!postRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", `[${postRes.code}] ${postRes.error}`);
        }

        const postedVoucher = postRes.data.voucher;
        const journalEntry = postRes.data.journal_entry;

        // ─────────────────────────────────────────────────────────────────────
        // 9. Mutate Payment Transaction & Order Metadata
        // ─────────────────────────────────────────────────────────────────────
        let updatedPt: any = null;
        if (paymentTxn) {
          const newStatus = isCod ? "captured" : "captured";
          const newSettlementStatus = isCod ? "settled" : "unsettled";

          const ptSql = `
            UPDATE public.payment_transaction
            SET status = $1,
                settlement_status = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *;
          `;
          const ptUpRes = await client.query(ptSql, [
            newStatus,
            newSettlementStatus,
            paymentTxn.id,
          ]);
          updatedPt = ptUpRes.rows[0];
        }

        // Update Order metadata
        const remainingAr = Math.max(0, Math.round((arStatus.outstandingAr - receiptAmount) * 100) / 100);
        const updatedOrderMeta = {
          ...orderMeta,
          payment_status: "captured",
          receipt_voucher_id: postedVoucher.id,
          receipt_journal_entry_id: journalEntry.id,
          receipt_amount: receiptAmount,
          outstanding_ar: remainingAr,
          paid_at: new Date().toISOString(),
        };

        await client.query(
          `UPDATE public."order"
           SET metadata = $1, updated_at = NOW()
           WHERE id = $2;`,
          [JSON.stringify(updatedOrderMeta), order.id]
        );

        // Update Voucher metadata with final audit links
        const updatedVMeta = {
          ...vMeta,
          journal_entry_id: journalEntry.id,
          outstanding_ar_remaining: remainingAr,
          receipt_posted_at: new Date().toISOString(),
        };

        const finalVoucherRes = await client.query<AccountingVoucherRow>(
          `UPDATE public.accounting_voucher
           SET metadata = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *;`,
          [JSON.stringify(updatedVMeta), postedVoucher.id]
        );

        return {
          voucher: finalVoucherRes.rows[0],
          journalEntry,
          orderId: order.id,
          receiptAmount,
          remainingAr,
          paymentTransaction: updatedPt,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof CustomerReceiptError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "RECEIPT_POSTING_FAILED" };
    }
  }

  // ── 6. POST COD CASH REMITTANCE WORKFLOW ────────────────────────────────────

  /**
   * Processes rider cash handover at branch register.
   * Full workflow: Draft -> Submit -> Approve -> Post (Dr 1111 Cash in Hand / Cr 1122 Undeposited COD).
   * Enforces multi-identity SoD across Cashier, Supervisor, and GL Accountant.
   */
  static async postCodCashRemittance(
    params: PostCodCashRemittanceParams
  ): Promise<CustomerReceiptResponse<CustomerReceiptResult>> {
    try {
      const execute = async (client: PoolClient): Promise<CustomerReceiptResult> => {
        // SoD check between cashier, supervisor, accountant
        if (params.remittedByStaffId === params.approvedBySupervisorId) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            "Cashier accepting cash remittance cannot approve the receipt voucher."
          );
        }
        if (params.remittedByStaffId === params.postedByGlAccountantId) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            "Cashier accepting cash remittance cannot post the receipt to the General Ledger."
          );
        }
        if (params.approvedBySupervisorId === params.postedByGlAccountantId) {
          throw new CustomerReceiptError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            "Supervisor verifying cash drawer cannot post the receipt to the General Ledger."
          );
        }

        // 1. Create Draft
        const draftRes = await CustomerReceiptService.createCustomerReceiptDraft({
          orderId: params.orderId,
          amount: params.amount,
          voucherDate: params.voucherDate,
          paymentMethod: "cod",
          paymentTxnId: params.paymentTxnId,
          branchId: params.branchId,
          createdBy: params.remittedByStaffId,
          narration: params.notes || `COD cash remittance for Order ${params.orderId}`,
          client,
        });

        if (!draftRes.success) {
          throw new CustomerReceiptError(draftRes.code, draftRes.error);
        }

        const voucherId = draftRes.data.id;

        // 2. Submit
        const submitRes = await CustomerReceiptService.submitCustomerReceipt({
          voucherId,
          submittedBy: params.remittedByStaffId,
          branchId: params.branchId,
          client,
        });

        if (!submitRes.success) {
          throw new CustomerReceiptError(submitRes.code, submitRes.error);
        }

        // 3. Approve
        const approveRes = await CustomerReceiptService.approveCustomerReceipt({
          voucherId,
          approvedBy: params.approvedBySupervisorId,
          branchId: params.branchId,
          actorContext: params.supervisorActorContext || {
            id: params.approvedBySupervisorId,
            user_id: params.approvedBySupervisorId,
            role: "MANAGER",
            permissions: ["ACCOUNTING.APPROVE"],
          },
          client,
        });

        if (!approveRes.success) {
          throw new CustomerReceiptError(approveRes.code, approveRes.error);
        }

        // 4. Post
        const postRes = await CustomerReceiptService.postCustomerReceipt({
          voucherId,
          postedBy: params.postedByGlAccountantId,
          branchId: params.branchId,
          actorContext: params.accountantActorContext || {
            id: params.postedByGlAccountantId,
            user_id: params.postedByGlAccountantId,
            role: "ADMIN",
            permissions: ["ACCOUNTING.POST"],
          },
          client,
        });

        if (!postRes.success) {
          throw new CustomerReceiptError(postRes.code, postRes.error);
        }

        return postRes.data;
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof CustomerReceiptError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "RECEIPT_POSTING_FAILED" };
    }
  }

  // ── 6B. POST COD SHIFT SETTLEMENT (OPTION C & OPTION B FULL SETTLEMENT) ─────

  /**
   * Processes consolidated rider shift settlement at branch cash drawer.
   * Full workflow:
   * 1. Validates exact source-linked allocation across settlement lines.
   * 2. Enforces Full Shift Settlement Required (Option B): rejects partial shift settlements with PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN.
   * 3. Prevents over-remittance with OVERPAYMENT_NOT_PERMITTED.
   * 4. Enforces 3-tier SoD between Cashier/Teller, Cash Drawer Supervisor, and GL Accountant.
   * 5. Posts balanced compound journal entry:
   *    Dr 1111 Cash in Hand (Single drawer debit)
   *    Cr 1122 Undeposited COD (1 line per settled order with order reference)
   * 6. Updates order.metadata->'cod_custody_event' and appends to order_status_history.
   */
  static async postCodShiftSettlement(
    params: PostCodShiftSettlementParams
  ): Promise<CustomerReceiptResponse<CodShiftSettlementResult>> {
    try {
      if (!params.shiftId || !params.shiftId.trim()) {
        throw new CustomerReceiptError("INVALID_AMOUNT", "Authoritative shiftId identifier is required.");
      }
      if (!params.deliveryPartnerId || !params.deliveryPartnerId.trim()) {
        throw new CustomerReceiptError("INVALID_AMOUNT", "Authoritative deliveryPartnerId identifier is required.");
      }
      if (!params.branchId || !params.branchId.trim()) {
        throw new CustomerReceiptError("BRANCH_NOT_FOUND", "Authoritative branchId identifier is required.");
      }
      if (typeof params.totalCashReceived !== "number" || isNaN(params.totalCashReceived) || params.totalCashReceived <= 0) {
        throw new CustomerReceiptError("INVALID_AMOUNT", `Total cash received must be positive. Got '${params.totalCashReceived}'.`);
      }
      if (!Array.isArray(params.settlementLines) || params.settlementLines.length === 0) {
        throw new CustomerReceiptError("SETTLEMENT_ALLOCATION_MISMATCH", "At least one settlement line is required.");
      }

      const totalCashReceived = Math.round(params.totalCashReceived * 100) / 100;

      // Validate line amounts
      for (const line of params.settlementLines) {
        if (typeof line.amount !== "number" || isNaN(line.amount) || line.amount <= 0) {
          throw new CustomerReceiptError("INVALID_AMOUNT", `Settlement line amount for order '${line.orderId}' must be positive. Got '${line.amount}'.`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Segregation of Duties (SoD) Checks
      // ─────────────────────────────────────────────────────────────────────
      if (params.remittedByStaffId === params.approvedBySupervisorId) {
        throw new CustomerReceiptError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Cashier/teller accepting cash remittance cannot approve the shift settlement voucher."
        );
      }
      if (params.remittedByStaffId === params.postedByGlAccountantId) {
        throw new CustomerReceiptError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Cashier/teller accepting cash remittance cannot post the shift settlement voucher to the General Ledger."
        );
      }
      if (params.approvedBySupervisorId === params.postedByGlAccountantId) {
        throw new CustomerReceiptError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Supervisor verifying cash drawer cannot post the shift settlement voucher to the General Ledger."
        );
      }

      const execute = async (client: PoolClient): Promise<CodShiftSettlementResult> => {
        // 1. Idempotency Check: (RIDER_SHIFT_SETTLEMENT, shiftId, RIDER_SHIFT_SETTLEMENT)
        const dupRes = await client.query<AccountingVoucherRow>(
          `SELECT id, status FROM public.accounting_voucher
           WHERE reference_type = 'RIDER_SHIFT_SETTLEMENT'
             AND reference_id = $1
             AND status != 'CANCELLED'
             AND deleted_at IS NULL`,
          [params.shiftId.trim()]
        );
        if (dupRes.rows.length > 0) {
          throw new CustomerReceiptError(
            "DUPLICATE_SOURCE_EVENT",
            `Duplicate shift settlement rejected: Shift '${params.shiftId}' has already been processed under voucher '${dupRes.rows[0].id}'.`
          );
        }

        // 2. Permission Checks: ACCOUNTING.APPROVE & ACCOUNTING.POST
        const supervisorCtx = params.supervisorActorContext || {
          id: params.approvedBySupervisorId,
          user_id: params.approvedBySupervisorId,
          role: "MANAGER",
          permissions: ["ACCOUNTING.APPROVE"],
        };
        if (!hasEffectivePermission(supervisorCtx, "ACCOUNTING.APPROVE")) {
          throw new CustomerReceiptError(
            "PERMISSION_DENIED",
            `Supervisor '${params.approvedBySupervisorId}' lacks permission 'ACCOUNTING.APPROVE'.`
          );
        }

        const accountantCtx = params.accountantActorContext || {
          id: params.postedByGlAccountantId,
          user_id: params.postedByGlAccountantId,
          role: "ADMIN",
          permissions: ["ACCOUNTING.POST"],
        };
        if (!hasEffectivePermission(accountantCtx, "ACCOUNTING.POST")) {
          throw new CustomerReceiptError(
            "PERMISSION_DENIED",
            `Accountant '${params.postedByGlAccountantId}' lacks permission 'ACCOUNTING.POST'.`
          );
        }

        // 3. Pessimistic Concurrency Lock on all orders in settlement lines
        const orderIds = params.settlementLines.map((l) => l.orderId);
        const oRes = await client.query(
          `SELECT id, display_id, status, metadata FROM public."order" WHERE id = ANY($1) AND deleted_at IS NULL FOR UPDATE`,
          [orderIds]
        );
        if (oRes.rows.length !== orderIds.length) {
          throw new CustomerReceiptError("ORDER_NOT_FOUND", "One or more orders in settlement lines were not found.");
        }

        const orderMap = new Map<string, any>();
        for (const row of oRes.rows) {
          orderMap.set(row.id, row);
        }

        for (const line of params.settlementLines) {
          const ord = orderMap.get(line.orderId);
          const meta = (ord.metadata || {}) as Record<string, any>;

          if (meta.legacy_prototype === true || meta.is_ledger_eligible !== true) {
            throw new CustomerReceiptError("LEGACY_PROTOTYPE_ORDER_REJECTED", `Order '${ord.id}' is quarantined historical prototype data.`);
          }

          if (meta.branch_id && meta.branch_id !== params.branchId) {
            throw new CustomerReceiptError("BRANCH_ACCESS_DENIED", `Order '${ord.id}' belongs to branch '${meta.branch_id}', not '${params.branchId}'.`);
          }

          const ev = meta.cod_custody_event;
          if (!ev || !ev.custody_id) {
            throw new CustomerReceiptError("INVALID_VOUCHER_STATE", `Order '${ord.id}' has not had cash collection confirmed under Model B.`);
          }

          if (ev.delivery_partner_id !== params.deliveryPartnerId) {
            throw new CustomerReceiptError(
              "RIDER_MISMATCH_SETTLEMENT",
              `Order '${ord.id}' was collected by rider '${ev.delivery_partner_id}', but settlement was submitted for rider '${params.deliveryPartnerId}'.`
            );
          }

          if (ev.settlement_voucher_id) {
            throw new CustomerReceiptError(
              "DUPLICATE_SOURCE_EVENT",
              `Order '${ord.id}' was already settled under voucher '${ev.settlement_voucher_id}'.`
            );
          }
        }

        // 4. Query Total Authoritative Outstanding Custody for this Rider in this Branch
        const allCustodyRes = await client.query(
          `SELECT id, metadata FROM public."order"
           WHERE (metadata->>'legacy_prototype' IS NULL OR metadata->>'legacy_prototype' != 'true')
             AND metadata->>'is_ledger_eligible' = 'true'
             AND metadata->'cod_custody_event'->>'delivery_partner_id' = $1
             AND (metadata->'cod_custody_event'->>'settlement_voucher_id') IS NULL
             AND metadata->>'branch_id' = $2
             AND deleted_at IS NULL`,
          [params.deliveryPartnerId, params.branchId]
        );

        let totalOutstandingCustody = 0;
        for (const row of allCustodyRes.rows) {
          const ev = row.metadata?.cod_custody_event;
          if (ev && typeof ev.collected_amount === "number") {
            totalOutstandingCustody = Math.round((totalOutstandingCustody + ev.collected_amount) * 100) / 100;
          }
        }

        // 5. Over-Remittance Guard: Presented cash > Outstanding custody
        if (totalCashReceived > totalOutstandingCustody) {
          throw new CustomerReceiptError(
            "OVER_REMITTANCE_FORBIDDEN",
            `Over-remittance rejected: Presented cash ₹${totalCashReceived.toFixed(2)} exceeds total outstanding rider custody ₹${totalOutstandingCustody.toFixed(2)}.`
          );
        }

        // 6. Validate Settlement Lines Sum against Cash Presented
        const linesTotal = Math.round(
          params.settlementLines.reduce((acc, l) => acc + l.amount, 0) * 100
        ) / 100;
        if (Math.abs(linesTotal - totalCashReceived) > 0.001) {
          throw new CustomerReceiptError(
            "SETTLEMENT_ALLOCATION_MISMATCH",
            `Settlement lines total (₹${linesTotal.toFixed(2)}) does not equal presented cash (₹${totalCashReceived.toFixed(2)}).`
          );
        }

        // 7. Validate Individual Settlement Line Amounts
        for (const line of params.settlementLines) {
          const ord = orderMap.get(line.orderId);
          const meta = (ord.metadata || {}) as Record<string, any>;
          const ev = meta.cod_custody_event;
          const expectedAmt = Math.round(Number(ev.collected_amount || 0) * 100) / 100;
          if (line.amount !== expectedAmt) {
            throw new CustomerReceiptError(
              "SETTLEMENT_ALLOCATION_MISMATCH",
              `Settlement line amount for order '${ord.id}' (₹${line.amount.toFixed(2)}) does not match authoritative collected custody amount (₹${expectedAmt.toFixed(2)}).`
            );
          }
        }

        // Guard against any unapproved cash shortage accounting requests
        if ((params as any).shortageAmount || (params as any).allowShortage || (params as any).shortageAccountId) {
          throw new CustomerReceiptError(
            "CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED",
            "Cash shortage accounting treatment requested but no approved cash shortage accounting policy exists. Settlement rejected."
          );
        }

        // 8. Enforce Option B: Full Shift Settlement Required (Fail-closed on short cash)
        if (totalCashReceived < totalOutstandingCustody || allCustodyRes.rows.length !== params.settlementLines.length) {
          throw new CustomerReceiptError(
            "PARTIAL_SHIFT_SETTLEMENT_FORBIDDEN",
            `Partial shift settlement rejected: Rider has ₹${totalOutstandingCustody.toFixed(2)} total outstanding custody across ${allCustodyRes.rows.length} order(s), but ₹${totalCashReceived.toFixed(2)} across ${params.settlementLines.length} order(s) was presented. Full shift settlement is required by policy. (CASH_SHORTAGE_ACCOUNTING_POLICY_REQUIRED)`
          );
        }

        // 6. Resolve CoA Accounts: 1111 (Cash in Hand) and 1122 (Undeposited COD)
        const targetCodes = ["1111", "1122"];
        const coaRes = await client.query<AccountingAccountRow>(
          `SELECT * FROM public.accounting_account WHERE code = ANY($1) AND is_active = true AND is_group = false AND deleted_at IS NULL`,
          [targetCodes]
        );
        const coaMap = new Map<string, AccountingAccountRow>();
        for (const row of coaRes.rows) {
          coaMap.set(row.code, row);
        }

        const debitAccount = coaMap.get("1111");
        const creditAccount = coaMap.get("1122");
        if (!debitAccount || !creditAccount) {
          throw new CustomerReceiptError(
            "ACCOUNT_RESOLUTION_FAILED",
            "Failed to resolve accounts 1111 (Cash in Hand) or 1122 (Undeposited COD) in Chart of Accounts."
          );
        }

        // 7. Construct & Submit Voucher via canonical PostingService
        const voucherDate = params.voucherDate || new Date().toISOString().slice(0, 10);
        const fiscalYear = `FY${voucherDate.slice(0, 4)}`;

        const voucherMetadata = {
          shift_id: params.shiftId,
          delivery_partner_id: params.deliveryPartnerId,
          branch_id: params.branchId,
          total_cash_received: totalCashReceived,
          settlement_lines: params.settlementLines,
          settlement_type: "SHIFT_BATCH_SETTLEMENT",
        };

        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "RECEIPT",
            voucher_date: voucherDate,
            branch_id: params.branchId,
            narration: params.notes || `COD shift settlement for Rider ${params.deliveryPartnerId} — Shift ${params.shiftId}`,
            reference_type: "RIDER_SHIFT_SETTLEMENT",
            reference_id: params.shiftId.trim(),
            reference_event: "RIDER_SHIFT_SETTLEMENT",
            metadata: voucherMetadata,
          },
          branchId: params.branchId,
          fiscalYear,
          createdBy: params.remittedByStaffId,
          client,
        });

        if (!draftRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", draftRes.error);
        }

        const draftVoucher = draftRes.data;

        await client.query(
          `UPDATE public.accounting_voucher SET total_amount = $1, updated_at = NOW() WHERE id = $2`,
          [totalCashReceived, draftVoucher.id]
        );

        // Submit voucher
        const subRes = await PostingService.submitVoucher({
          voucherId: draftVoucher.id,
          submittedBy: params.remittedByStaffId,
          branchId: params.branchId,
          client,
        });
        if (!subRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", subRes.error);
        }

        // Approve voucher
        const appRes = await PostingService.approveVoucher({
          voucherId: draftVoucher.id,
          approvedBy: params.approvedBySupervisorId,
          branchId: params.branchId,
          client,
        });
        if (!appRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", appRes.error);
        }

        // 8. Construct Balanced Compound Journal Lines
        // Line 1: Debit 1111 (Cash in Hand) for totalCashReceived
        const journalLines: JournalLineInput[] = [
          {
            account_id: debitAccount.id,
            debit_amount: totalCashReceived,
            credit_amount: 0,
            branch_id: params.branchId,
            customer_id: null,
            narration: `COD shift settlement received from Rider ${params.deliveryPartnerId} for Shift ${params.shiftId}`,
            metadata: {
              shift_id: params.shiftId,
              delivery_partner_id: params.deliveryPartnerId,
            },
          },
        ];

        // Lines 2..N+1: Credit 1122 (Undeposited COD) for each settled order
        for (const line of params.settlementLines) {
          journalLines.push({
            account_id: creditAccount.id,
            debit_amount: 0,
            credit_amount: line.amount,
            branch_id: params.branchId,
            customer_id: null,
            narration: `Undeposited COD cleared for Order ${line.orderId}`,
            metadata: {
              order_id: line.orderId,
              delivery_partner_id: params.deliveryPartnerId,
              shift_id: params.shiftId,
            },
          });
        }

        // 9. Atomic Posting via canonical PostingService.postVoucher
        const postRes = await PostingService.postVoucher({
          voucherId: draftVoucher.id,
          postedBy: params.postedByGlAccountantId,
          lines: journalLines,
          branchId: params.branchId,
          client,
        });

        if (!postRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", postRes.error);
        }

        const postingResult = {
          voucher: postRes.data.voucher,
          journalEntry: postRes.data.journal_entry,
        };

        // 10. Update Each Settled Order's Metadata & Append to Order Status History
        const now = new Date().toISOString();
        for (const line of params.settlementLines) {
          const updateOrderSql = `
            UPDATE public."order"
            SET metadata = jsonb_set(
                  jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cod_custody_event,settlement_voucher_id}', to_jsonb($1::text)),
                  '{cod_custody_event,settled_at}', to_jsonb($2::text)
                ),
                updated_at = NOW()
            WHERE id = $3;
          `;
          await client.query(updateOrderSql, [postingResult.voucher.id, now, line.orderId]);

          const histId = `osh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await client.query(
            `INSERT INTO public.order_status_history (
               id, order_id, to_status, from_status, actor_type, actor_id, reason, metadata, created_at, updated_at
             ) VALUES ($1, $2, 'COD_REMITTED_CLEARED', 'COD_CASH_COLLECTED', 'STAFF', $3, 'COD shift settlement posted to General Ledger', $4, NOW(), NOW())`,
            [
              histId,
              line.orderId,
              params.postedByGlAccountantId,
              JSON.stringify({
                voucher_id: postingResult.voucher.id,
                voucher_no: postingResult.voucher.voucher_no,
                shift_id: params.shiftId,
                settled_amount: line.amount,
              }),
            ]
          );
        }

        return {
          voucher: postingResult.voucher,
          journalEntry: postingResult.journalEntry,
          shiftId: params.shiftId,
          deliveryPartnerId: params.deliveryPartnerId,
          totalSettled: totalCashReceived,
          settledOrdersCount: params.settlementLines.length,
          settlementLines: params.settlementLines.map((l) => ({ orderId: l.orderId, amount: l.amount })),
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof CustomerReceiptError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "RECEIPT_POSTING_FAILED" };
    }
  }

  // ── 7. POST GATEWAY SETTLEMENT (MDR & PAYOUT) ───────────────────────────────

  /**
   * Posts payment gateway bank settlement & MDR fee recognition:
   * Dr 1112 Bank Operating A/c          (Net)
   * Dr 5290 Payment Gateway MDR Fees    (Commission/Expense)
   * Cr 1113 Gateway Clearing            (Gross)
   *
   * Mathematical Balance: Net + MDR === Gross.
   * Authoritative MDR is strictly required (never guessed or inferred).
   */
  static async postGatewaySettlement(
    params: PostGatewaySettlementParams
  ): Promise<CustomerReceiptResponse<GatewaySettlementResult>> {
    try {
      if (typeof params.grossAmount !== "number" || isNaN(params.grossAmount) || params.grossAmount <= 0) {
        throw new CustomerReceiptError(
          "INVALID_AMOUNT",
          `Gross settlement amount must be positive. Got '${params.grossAmount}'.`
        );
      }
      if (typeof params.netBankAmount !== "number" || isNaN(params.netBankAmount) || params.netBankAmount <= 0) {
        throw new CustomerReceiptError(
          "INVALID_AMOUNT",
          `Net bank deposit amount must be positive. Got '${params.netBankAmount}'.`
        );
      }
      if (typeof params.mdrFeeAmount !== "number" || isNaN(params.mdrFeeAmount) || params.mdrFeeAmount < 0) {
        throw new CustomerReceiptError(
          "MISSING_MDR_FEE",
          `Authoritative MDR fee amount is required. Got '${params.mdrFeeAmount}'.`
        );
      }

      const gross = Math.round(params.grossAmount * 100) / 100;
      const net = Math.round(params.netBankAmount * 100) / 100;
      const mdr = Math.round(params.mdrFeeAmount * 100) / 100;

      // Mathematical Identity: net + mdr === gross
      if (Math.round((net + mdr) * 100) !== Math.round(gross * 100)) {
        throw new CustomerReceiptError(
          "INVALID_SETTLEMENT_MATH",
          `Settlement arithmetic mismatch: Net bank deposit (₹${net.toFixed(2)}) + MDR fees (₹${mdr.toFixed(2)}) = ₹${(net + mdr).toFixed(2)}, which does not equal gross clearing credit (₹${gross.toFixed(2)}).`
        );
      }

      if (!params.payoutRef || !params.payoutRef.trim()) {
        throw new CustomerReceiptError(
          "INVALID_SETTLEMENT_MATH",
          "Authoritative payout reference identifier (payoutRef) is required."
        );
      }

      const execute = async (client: PoolClient): Promise<GatewaySettlementResult> => {
        // 1. Idempotency Check: (GATEWAY_PAYOUT, payoutRef, GATEWAY_SETTLEMENT)
        const dupRes = await client.query<AccountingVoucherRow>(
          `SELECT id, status FROM public.accounting_voucher
           WHERE reference_type = 'GATEWAY_PAYOUT'
             AND reference_id = $1
             AND reference_event = 'GATEWAY_SETTLEMENT'
             AND status != 'CANCELLED'
             AND deleted_at IS NULL`,
          [params.payoutRef.trim()]
        );
        if (dupRes.rows.length > 0) {
          throw new CustomerReceiptError(
            "DUPLICATE_SOURCE_EVENT",
            `Duplicate gateway settlement rejected: Payout '${params.payoutRef}' has already been processed under voucher '${dupRes.rows[0].id}'.`
          );
        }

        // 2. Permission Check: ACCOUNTING.POST
        const actorContext = params.actorContext || {
          id: params.postedBy,
          user_id: params.postedBy,
          role: "STAFF",
        };
        const hasPostPerm = hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPostPerm) {
          throw new CustomerReceiptError(
            "PERMISSION_DENIED",
            `Actor '${params.postedBy}' lacks permission 'ACCOUNTING.POST'.`
          );
        }

        // 3. Resolve CoA Accounts: 1112, 5290, 1113
        const targetCodes = ["1112", "5290", "1113"];
        const coaRes = await client.query<AccountingAccountRow>(
          `SELECT * FROM public.accounting_account
           WHERE code = ANY($1) AND is_active = true AND is_group = false AND deleted_at IS NULL`,
          [targetCodes]
        );
        const coaMap = new Map<string, AccountingAccountRow>();
        for (const row of coaRes.rows) {
          coaMap.set(row.code, row);
        }

        const acc1112 = coaMap.get("1112"); // Bank Operating A/c
        const acc5290 = coaMap.get("5290"); // Payment Gateway MDR Fees
        const acc1113 = coaMap.get("1113"); // Gateway Clearing
        if (!acc1112 || !acc5290 || !acc1113) {
          throw new CustomerReceiptError(
            "ACCOUNT_RESOLUTION_FAILED",
            "Accounts 1112, 5290, or 1113 not found in Chart of Accounts."
          );
        }

        // 4. Construct Journal Lines
        const journalLines: JournalLineInput[] = [];

        // Debit Bank Operating A/c (Net)
        journalLines.push({
          account_id: acc1112.id,
          debit_amount: net,
          credit_amount: 0,
          branch_id: params.branchId,
          narration: `Net payout deposit from ${params.provider} (Ref: ${params.payoutRef})`,
        });

        // Debit MDR Fees (if > 0)
        if (mdr > 0) {
          journalLines.push({
            account_id: acc5290.id,
            debit_amount: mdr,
            credit_amount: 0,
            branch_id: params.branchId,
            narration: `Gateway MDR fees deducted by ${params.provider} (Ref: ${params.payoutRef})`,
          });
        }

        // Credit Gateway Clearing (Gross)
        journalLines.push({
          account_id: acc1113.id,
          debit_amount: 0,
          credit_amount: gross,
          branch_id: params.branchId,
          narration: `Gross gateway clearing credit for ${params.provider} payout (Ref: ${params.payoutRef})`,
        });

        const fiscalYear = `FY${params.voucherDate.slice(0, 4)}`;
        const narration =
          params.narration ||
          `Gateway settlement from ${params.provider} (Payout: ${params.payoutRef}, Gross: ₹${gross.toFixed(2)}, Net: ₹${net.toFixed(2)}, MDR: ₹${mdr.toFixed(2)})`;

        // 5. Create Draft Voucher
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "RECEIPT",
            voucher_date: params.voucherDate,
            branch_id: params.branchId,
            narration,
            reference_type: "GATEWAY_PAYOUT",
            reference_id: params.payoutRef.trim(),
            reference_event: "GATEWAY_SETTLEMENT",
            metadata: {
              payout_ref: params.payoutRef,
              provider: params.provider,
              gross_amount: gross,
              net_amount: net,
              mdr_fee: mdr,
              payment_txn_ids: params.paymentTxnIds || [],
            },
          },
          branchId: params.branchId,
          fiscalYear,
          createdBy: params.postedBy,
          client,
        });

        if (!draftRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", draftRes.error);
        }

        const voucher = draftRes.data;

        // Set total amount to gross
        await client.query(
          `UPDATE public.accounting_voucher SET total_amount = $1, updated_at = NOW() WHERE id = $2`,
          [gross, voucher.id]
        );

        // Submit voucher
        const subRes = await PostingService.submitVoucher({
          voucherId: voucher.id,
          submittedBy: params.postedBy,
          branchId: params.branchId,
          client,
        });
        if (!subRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", subRes.error);
        }

        // For system settlements, approve with an authorized system/supervisor persona to maintain SoD
        const supervisorId = "usr_settlement_supervisor";
        const appRes = await PostingService.approveVoucher({
          voucherId: voucher.id,
          approvedBy: supervisorId,
          branchId: params.branchId,
          client,
        });
        if (!appRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", appRes.error);
        }

        // Post to GL
        const postRes = await PostingService.postVoucher({
          voucherId: voucher.id,
          postedBy: params.postedBy,
          lines: journalLines,
          branchId: params.branchId,
          client,
        });
        if (!postRes.success) {
          throw new CustomerReceiptError("POSTING_GUARD_FAILED", postRes.error);
        }

        // 6. Transition linked payment transactions to settled
        let settledCount = 0;
        if (params.paymentTxnIds && params.paymentTxnIds.length > 0) {
          const ptUpRes = await client.query(
            `UPDATE public.payment_transaction
             SET settlement_status = 'settled',
                 updated_at = NOW()
             WHERE id = ANY($1) AND deleted_at IS NULL
             RETURNING id;`,
            [params.paymentTxnIds]
          );
          settledCount = ptUpRes.rows.length;
        }

        return {
          voucher: postRes.data.voucher,
          journalEntry: postRes.data.journal_entry,
          payoutRef: params.payoutRef,
          grossAmount: gross,
          mdrFeeAmount: mdr,
          netBankAmount: net,
          settledTxnCount: settledCount,
        };
      };

      const result = params.client ? await execute(params.client) : await dbTransaction(execute);
      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof CustomerReceiptError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "RECEIPT_POSTING_FAILED" };
    }
  }
}
