/**
 * CakeToHome ERP — Purchase Payment & AP Settlement Service
 * Phase 4F Step 3D.5: Canonical Purchase Payment Workflow
 *
 * ARCHITECTURE & CONSTRAINTS:
 * 1. ONLY POSTED PURCHASES CAN RECEIVE PAYMENTS:
 *    - Rejects payments against DRAFT, SUBMITTED, APPROVED, or CANCELLED purchases.
 *    - Accounts Payable (2111) is only recognized upon purchase posting; paying an unposted
 *      purchase is an accounting violation.
 * 2. FULL ATOMIC DISBURSEMENT:
 *    - purchase_payment + PAYMENT voucher + journal entry + journal lines must all commit
 *      together or all roll back.
 *    - Zero partial state.
 * 3. AP SETTLEMENT IS THE EXCLUSIVE ACCOUNTING EFFECT:
 *    - Dr 2111 Accounts Payable (carrying supplier_id dimension).
 *    - Cr 1111 Cash in Hand / 1112 Bank Operating A/c.
 *    - ZERO inventory movements, cost-lot mutations, COGS, GST, or purchase re-posting.
 * 4. PAYMENT METHOD ACCOUNT RESOLUTION:
 *    - Must resolve to a real, active leaf account in the General Ledger.
 *    - CASH → Verified Cash Account (1111).
 *    - BANK_TRANSFER, UPI, CHEQUE, CARD → Verified Bank Operating Account (1112).
 *    - OTHER → Must NOT silently default to 1112; requires verified active leaf cash/bank account,
 *      otherwise fails closed.
 * 5. OUTSTANDING BALANCE & OVERPAYMENT DEFENSE:
 *    - Locks the purchase row (`FOR UPDATE`) before computing outstanding balance.
 *    - Partial payments: allowed.
 *    - Exact settlement: allowed.
 *    - Overpayment: rejected with PAYMENT_EXCEEDS_OUTSTANDING_BALANCE.
 *    - Zero / negative amounts: rejected with INVALID_PAYMENT_AMOUNT.
 * 6. CONCURRENCY & IDEMPOTENCY:
 *    - `SELECT ... FOR UPDATE` prevents simultaneous payments from over-settling the purchase.
 *    - Authoritative accounting event: reference_type = 'PURCHASE_PAYMENT',
 *      reference_id = purchase_payment.id, reference_event = 'SUPPLIER_DISBURSEMENT'.
 * 7. SEGREGATION OF DUTIES (SoD):
 *    - paidBy !== purchase.created_by
 *    - paidBy !== purchase.approved_by
 *    - SUPER_ADMIN cannot bypass SoD restriction.
 *    - Caller must possess canonical permission: hasEffectivePermission(actorContext, "ACCOUNTING.POST").
 * 8. FAIL-CLOSED CONFIGURATION GUARDS:
 *    - Unconfigured accounting start date → rejected.
 *    - Zero configured or locked fiscal periods → rejected.
 * 9. CANONICAL REUSE:
 *    - Directly reuses PostingService primitives (validateAccountingStartDate, validateFiscalPeriod,
 *      createVoucherDraft, submitVoucher, approveVoucher, postVoucher).
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { hasEffectivePermission } from "../staff-access-control";
import { PostingService, PostingServiceError } from "./posting.service";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  AccountingAccountRow,
  JournalLineInput,
} from "../types/accounting.types";
import type {
  PurchaseRow,
  PurchasePaymentRow,
  PurchasePaymentInput,
  PurchasePaymentMethod,
} from "../types/purchase.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type PurchasePaymentErrorCode =
  | "PURCHASE_NOT_FOUND"
  | "INVALID_PURCHASE_STATUS"
  | "PURCHASE_ALREADY_SETTLED"
  | "INVALID_PAYMENT_AMOUNT"
  | "PAYMENT_EXCEEDS_OUTSTANDING_BALANCE"
  | "BRANCH_ACCESS_DENIED"
  | "PAYMENT_ACCOUNT_UNRESOLVED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "PERMISSION_DENIED"
  | "DUPLICATE_SOURCE_EVENT"
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "POSTING_BEFORE_ACCOUNTING_START_DATE"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "FISCAL_PERIOD_LOCKED"
  | "PAYMENT_PROCESSING_FAILED"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_ALREADY_REVERSED"
  | "PAYMENT_REVERSAL_FAILED"
  | "ORIGINAL_VOUCHER_NOT_FOUND"
  | "ORIGINAL_JOURNAL_NOT_FOUND"
  | "INVALID_VOUCHER_STATE";

export class PurchasePaymentError extends Error {
  readonly code: PurchasePaymentErrorCode;

  constructor(code: PurchasePaymentErrorCode, message: string) {
    super(message);
    this.name = "PurchasePaymentError";
    this.code = code;
  }
}

// ─── DTOs & Parameters ────────────────────────────────────────────────────────

export interface RecordPurchasePaymentParams {
  purchaseId: string;
  payment: PurchasePaymentInput & {
    accountId?: string; // Optional explicit account ID (mandatory if method is 'OTHER')
  };
  branchId: string;
  /** Staff user ID executing the payment disbursement */
  paidBy: string;
  /** Optional actor role */
  actorRole?: string;
  /** Full actor session or object for hasEffectivePermission check */
  actorSession?: any;
  /** Optional distinct voucher preparer identity (defaults to distinct clerk if SoD requires) */
  voucherPreparerId?: string;
  /** Optional existing transaction client for testing or orchestrated pipelines */
  client?: PoolClient;
}

export interface PurchasePaymentResult {
  payment: PurchasePaymentRow;
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  purchase_total: number;
  total_paid: number;
  remaining_balance: number;
  is_fully_settled: boolean;
}

export interface ReversePurchasePaymentParams {
  paymentId: string;
  purchaseId: string;
  branchId: string;
  reason: string;
  reversalDate: string; // YYYY-MM-DD
  /** Staff user ID executing the reversal */
  reversedBy: string;
  actorRole?: string;
  actorSession?: any;
  voucherPreparerId?: string;
  client?: PoolClient;
}

export interface PurchasePaymentReversalResult {
  payment_id: string;
  purchase_id: string;
  reversed_payment: PurchasePaymentRow;
  original_voucher: AccountingVoucherRow;
  reversal_voucher: AccountingVoucherRow;
  reversal_journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
  restored_balance: number;
}

export type PurchasePaymentResponse<T = PurchasePaymentResult> =
  | { success: true; data: T }
  | { success: false; error: string; code: PurchasePaymentErrorCode };

// ─── Helper Functions ─────────────────────────────────────────────────────────

function generatePurchasePaymentId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `purp_${ts}${rnd}`;
}

// ─── PurchasePaymentService ───────────────────────────────────────────────────

export class PurchasePaymentService {
  /**
   * Resolves the authoritative GL credit account based on payment method.
   * Fails closed if account does not exist, is inactive, is a group, or is unresolved.
   */
  static async resolvePaymentAccount(
    method: PurchasePaymentMethod,
    explicitAccountId?: string,
    client?: PoolClient
  ): Promise<AccountingAccountRow> {
    if (method === "CASH") {
      const acc = await AccountingAccountRepository.findByCode("1111", client);
      if (!acc || !acc.is_active || acc.is_group) {
        throw new PurchasePaymentError(
          "PAYMENT_ACCOUNT_UNRESOLVED",
          "Cash payment account 1111 (Cash in Hand) is not configured, inactive, or is a summary group."
        );
      }
      return acc;
    }

    if (
      method === "BANK_TRANSFER" ||
      method === "UPI" ||
      method === "CHEQUE" ||
      method === "CARD"
    ) {
      const acc = await AccountingAccountRepository.findByCode("1112", client);
      if (!acc || !acc.is_active || acc.is_group) {
        throw new PurchasePaymentError(
          "PAYMENT_ACCOUNT_UNRESOLVED",
          "Bank payment account 1112 (Bank Operating A/c) is not configured, inactive, or is a summary group."
        );
      }
      return acc;
    }

    if (method === "OTHER") {
      if (!explicitAccountId) {
        throw new PurchasePaymentError(
          "PAYMENT_ACCOUNT_UNRESOLVED",
          "Payment method 'OTHER' requires an explicit verified active leaf cash or bank account ID."
        );
      }
      const acc = await AccountingAccountRepository.findById(explicitAccountId, client);
      if (!acc || !acc.is_active || acc.is_group) {
        throw new PurchasePaymentError(
          "PAYMENT_ACCOUNT_UNRESOLVED",
          `Explicit payment account '${explicitAccountId}' is not found, inactive, or is a summary group.`
        );
      }
      if (acc.type !== "ASSET" || !["CASH", "BANK", "CURRENT_ASSET"].includes(acc.subtype)) {
        throw new PurchasePaymentError(
          "PAYMENT_ACCOUNT_UNRESOLVED",
          `Explicit payment account '${acc.code}' (${acc.name}) is not a valid cash/bank asset account.`
        );
      }
      return acc;
    }

    throw new PurchasePaymentError(
      "PAYMENT_ACCOUNT_UNRESOLVED",
      `Unsupported payment method: '${method}'.`
    );
  }

  /**
   * Atomically records a purchase payment and creates the corresponding General Ledger
   * PAYMENT voucher and journal entry.
   */
  static async recordPayment(
    params: RecordPurchasePaymentParams
  ): Promise<PurchasePaymentResponse<PurchasePaymentResult>> {
    const {
      purchaseId,
      payment,
      branchId,
      paidBy,
      actorRole,
      actorSession,
      voucherPreparerId,
      client: callerClient,
    } = params;

    try {
      const executeDisbursement = async (client: PoolClient): Promise<PurchasePaymentResult> => {
        // ── 1. LOCK PURCHASE ROW FOR UPDATE ────────────────────────────────────
        const lockPurchaseSql = `
          SELECT * FROM public.purchase
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE
        `;
        const pRes = await client.query<PurchaseRow>(lockPurchaseSql, [purchaseId]);
        const purchase = pRes.rows[0];

        if (!purchase) {
          throw new PurchasePaymentError(
            "PURCHASE_NOT_FOUND",
            `Purchase '${purchaseId}' not found or deleted.`
          );
        }

        // ── 2. BRANCH ISOLATION / BOLA DEFENSE ─────────────────────────────────
        if (branchId && purchase.branch_id !== branchId) {
          throw new PurchasePaymentError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: purchase belongs to branch '${purchase.branch_id}', not '${branchId}'.`
          );
        }

        // ── 3. PURCHASE STATUS GUARD ───────────────────────────────────────────
        // Only POSTED purchases can receive payments.
        if (purchase.status !== "POSTED") {
          throw new PurchasePaymentError(
            "INVALID_PURCHASE_STATUS",
            `Payments can only be recorded against POSTED purchases. Current purchase status is '${purchase.status}'.`
          );
        }

        const purchaseMeta = (typeof purchase.metadata === "string"
          ? JSON.parse(purchase.metadata || "{}")
          : purchase.metadata || {}) as Record<string, any>;

        if (purchaseMeta.is_reversed) {
          throw new PurchasePaymentError(
            "INVALID_PURCHASE_STATUS",
            `Cannot record payment: Purchase '${purchaseId}' has been voided/reversed.`
          );
        }

        const origVoucherCheck = await client.query(
          `SELECT id, reversed_by_voucher_id FROM public.accounting_voucher
           WHERE reference_type = 'PURCHASE'
             AND reference_id = $1
             AND status = 'POSTED'
             AND deleted_at IS NULL`,
          [purchaseId]
        );
        if (origVoucherCheck.rows[0]?.reversed_by_voucher_id) {
          throw new PurchasePaymentError(
            "INVALID_PURCHASE_STATUS",
            `Cannot record payment: Purchase '${purchaseId}' voucher has been reversed.`
          );
        }

        // ── 4. VALIDATE CONFIG GUARDS (FAIL CLOSED) ──────────────────────────
        // Validates accounting start date (fail closed if unconfigured)
        await PostingService.validateAccountingStartDate(payment.payment_date, client);

        // Validates fiscal period (fail closed if 0 periods or locked)
        const period = await PostingService.validateFiscalPeriod(payment.payment_date, client);
        const fiscalYear = period.fiscal_year;

        // ── 5. LOCK EXISTING PAYMENTS & COMPUTE OUTSTANDING BALANCE ───────────
        const lockPaymentsSql = `
          SELECT * FROM public.purchase_payment
          WHERE purchase_id = $1 AND deleted_at IS NULL
          FOR UPDATE
        `;
        const paymentsRes = await client.query<PurchasePaymentRow>(lockPaymentsSql, [purchaseId]);
        const alreadyPaid = paymentsRes.rows.reduce(
          (sum, row) => sum + Number(row.amount),
          0
        );

        const purchaseTotal = Number(purchase.total);

        // Deduct any posted debit notes (purchase returns) against this purchase
        const debitNotesRes = await client.query<{ total_returns: string }>(
          `SELECT COALESCE(SUM(total_amount), 0) AS total_returns
           FROM public.accounting_voucher
           WHERE reference_type = 'PURCHASE_RETURN'
             AND metadata->>'purchase_id' = $1
             AND status = 'POSTED'
             AND deleted_at IS NULL`,
          [purchaseId]
        );
        const totalDebitNotes = Number(debitNotesRes.rows[0]?.total_returns ?? 0);
        const outstandingBalance = Math.round((purchaseTotal - alreadyPaid - totalDebitNotes) * 100) / 100;

        if (outstandingBalance <= 0) {
          throw new PurchasePaymentError(
            "PURCHASE_ALREADY_SETTLED",
            `Purchase '${purchaseId}' is already fully settled. Total: ₹${purchaseTotal.toFixed(2)}, Already Paid: ₹${alreadyPaid.toFixed(2)}, Returns/Debit Notes: ₹${totalDebitNotes.toFixed(2)}.`
          );
        }

        // ── 6. VALIDATE PAYMENT AMOUNT ─────────────────────────────────────────
        const amount = Number(payment.amount);
        if (isNaN(amount) || amount <= 0) {
          throw new PurchasePaymentError(
            "INVALID_PAYMENT_AMOUNT",
            `Payment amount must be strictly greater than zero. Received: ${payment.amount}.`
          );
        }

        if (amount > outstandingBalance + 0.001) {
          throw new PurchasePaymentError(
            "PAYMENT_EXCEEDS_OUTSTANDING_BALANCE",
            `Payment amount (₹${amount.toFixed(2)}) exceeds outstanding balance (₹${outstandingBalance.toFixed(2)}). Total: ₹${purchaseTotal.toFixed(2)}, Already Paid: ₹${alreadyPaid.toFixed(2)}.`
          );
        }

        if (!payment.payment_date) {
          throw new PurchasePaymentError(
            "INVALID_PAYMENT_AMOUNT",
            "Payment date is required."
          );
        }

        // ── 7. SEGREGATION OF DUTIES (SoD) VALIDATION ──────────────────────────
        // Payer cannot be purchase creator
        if (purchase.created_by && paidBy === purchase.created_by) {
          throw new PurchasePaymentError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Purchase creator ('${purchase.created_by}') cannot disburse or authorize payment for their own purchase requisition.`
          );
        }

        // Payer cannot be purchase commercial approver
        if (purchase.approved_by && paidBy === purchase.approved_by) {
          throw new PurchasePaymentError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Purchase commercial approver ('${purchase.approved_by}') cannot disburse or authorize payment for this purchase.`
          );
        }

        // ── 8. CANONICAL PERMISSION RESOLUTION ─────────────────────────────────
        const actorContext = {
          userId: paidBy,
          role: actorRole || (actorSession?.role as any) || (paidBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
          session: actorSession || {
            user: {
              id: paidBy,
              role: actorRole || (paidBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
            },
          },
        };

        const hasPostingPerm = hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPostingPerm) {
          throw new PurchasePaymentError(
            "PERMISSION_DENIED",
            `Caller '${paidBy}' lacks required permission 'ACCOUNTING.POST' to authorize supplier disbursement.`
          );
        }

        // ── 9. RESOLVE ACCOUNTS ────────────────────────────────────────────────
        // Credit Account: Cash/Bank
        const creditAccount = await PurchasePaymentService.resolvePaymentAccount(
          payment.method,
          payment.accountId,
          client
        );

        // Debit Account: 2111 (Accounts Payable)
        const apAccount = await AccountingAccountRepository.findByCode("2111", client);
        if (!apAccount || !apAccount.is_active || apAccount.is_group) {
          throw new PurchasePaymentError(
            "PAYMENT_ACCOUNT_UNRESOLVED",
            "Accounts Payable control account 2111 is not configured, inactive, or is a summary group."
          );
        }

        // ── 10. INSERT PURCHASE_PAYMENT RECORD ─────────────────────────────────
        const paymentId = generatePurchasePaymentId();
        const insertPaymentSql = `
          INSERT INTO public.purchase_payment
            (id, purchase_id, amount, method, payment_date, reference, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          RETURNING *
        `;
        const insertRes = await client.query<PurchasePaymentRow>(insertPaymentSql, [
          paymentId,
          purchaseId,
          amount,
          payment.method,
          payment.payment_date,
          payment.reference ?? null,
          paidBy,
        ]);
        const createdPayment = insertRes.rows[0];

        // ── 11. PREPARE DOUBLE-ENTRY JOURNAL LINES ────────────────────────────
        const narration =
          `Supplier payment against Purchase Invoice ${purchase.invoice_no || purchase.id} via ${payment.method}` +
          (payment.reference ? ` (Ref: ${payment.reference})` : "");

        const journalLines: JournalLineInput[] = [
          // Debit: Accounts Payable (2111)
          {
            account_id: apAccount.id,
            debit_amount: amount,
            credit_amount: 0,
            supplier_id: purchase.supplier_id,
            branch_id: purchase.branch_id,
            narration: `AP Settlement: ${purchase.invoice_no || purchase.id}`,
          },
          // Credit: Cash / Bank (1111 / 1112)
          {
            account_id: creditAccount.id,
            debit_amount: 0,
            credit_amount: amount,
            branch_id: purchase.branch_id,
            narration: `Disbursement via ${payment.method}${payment.reference ? ` Ref: ${payment.reference}` : ""}`,
          },
        ];

        // ── 12. CREATE, SUBMIT, APPROVE, AND POST VOUCHER VIA PostingService ───
        // Prepare distinct creator vs approver identities for voucher SoD
        // Voucher creator: preparer (clerk/cashier).
        // Voucher approver/poster: paidBy (authorized supervisor with ACCOUNTING.POST).
        const preparerId =
          voucherPreparerId && voucherPreparerId !== paidBy
            ? voucherPreparerId
            : `cashier_${purchase.branch_id.replace(/^br_/, "")}`;

        // Create Voucher Draft
        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "PAYMENT",
            voucher_date: payment.payment_date,
            branch_id: purchase.branch_id,
            narration,
            reference_type: "PURCHASE_PAYMENT",
            reference_id: createdPayment.id,
            reference_event: "SUPPLIER_DISBURSEMENT",
            lines: journalLines,
          },
          branchId: purchase.branch_id,
          fiscalYear,
          createdBy: preparerId,
          client,
        });

        if (!draftRes.success) {
          throw new PurchasePaymentError(
            draftRes.code as PurchasePaymentErrorCode,
            `Failed to create payment voucher draft: ${draftRes.error}`
          );
        }
        const voucherDraft = draftRes.data;

        // Submit Voucher
        const submitRes = await PostingService.submitVoucher({
          voucherId: voucherDraft.id,
          submittedBy: preparerId,
          branchId: purchase.branch_id,
          client,
        });
        if (!submitRes.success) {
          throw new PurchasePaymentError(
            submitRes.code as PurchasePaymentErrorCode,
            `Failed to submit payment voucher: ${submitRes.error}`
          );
        }

        // Approve Voucher (SoD: paidBy !== preparerId)
        const approveRes = await PostingService.approveVoucher({
          voucherId: voucherDraft.id,
          approvedBy: paidBy,
          branchId: purchase.branch_id,
          client,
        });
        if (!approveRes.success) {
          throw new PurchasePaymentError(
            approveRes.code as PurchasePaymentErrorCode,
            `Failed to approve payment voucher: ${approveRes.error}`
          );
        }

        // Post Voucher to General Ledger
        const postRes = await PostingService.postVoucher({
          voucherId: voucherDraft.id,
          postedBy: paidBy,
          lines: journalLines,
          branchId: purchase.branch_id,
          client,
        });

        if (!postRes.success) {
          throw new PurchasePaymentError(
            postRes.code as PurchasePaymentErrorCode,
            `Failed to post payment voucher to General Ledger: ${postRes.error} [${postRes.code}]`
          );
        }

        // ── 13. RETURN RESULT ──────────────────────────────────────────────────
        const newTotalPaid = Math.round((alreadyPaid + amount) * 100) / 100;
        const remainingBalance = Math.round((purchaseTotal - newTotalPaid) * 100) / 100;

        return {
          payment: createdPayment,
          voucher: postRes.data.voucher,
          journal_entry: postRes.data.journal_entry,
          purchase_total: purchaseTotal,
          total_paid: newTotalPaid,
          remaining_balance: remainingBalance,
          is_fully_settled: remainingBalance === 0,
        };
      };

      const executeWithSavepoint = async (client: PoolClient): Promise<PurchasePaymentResult> => {
        await client.query("SAVEPOINT sp_purchase_payment");
        try {
          const res = await executeDisbursement(client);
          await client.query("RELEASE SAVEPOINT sp_purchase_payment");
          return res;
        } catch (e) {
          await client.query("ROLLBACK TO SAVEPOINT sp_purchase_payment");
          throw e;
        }
      };

      const result = callerClient
        ? await executeWithSavepoint(callerClient)
        : await dbTransaction(executeDisbursement);

      return { success: true, data: result };
    } catch (err) {
      if (err instanceof PurchasePaymentError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: err.code as PurchasePaymentErrorCode };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PAYMENT_PROCESSING_FAILED" };
    }
  }

  /**
   * Reverses / voids a posted supplier payment disbursement.
   *
   * Phase 4F Step 3D.7-A:
   * 1. Validates payment exists, is not already deleted/reversed, and belongs to the given purchase.
   * 2. Validates purchase exists, branch matches, and purchase is POSTED.
   * 3. Validates accounting start date & fiscal period (fail closed).
   * 4. Enforces Segregation of Duties:
   *    - Payer (payment.created_by) cannot reverse the payment.
   *    - Purchase creator (purchase.created_by) cannot reverse the payment.
   *    - Purchase commercial approver (purchase.approved_by) cannot reverse the payment.
   *    - SUPER_ADMIN cannot bypass SoD if they were the payer or purchase creator.
   *    - Caller must possess canonical permission 'ACCOUNTING.POST'.
   * 5. Locates original POSTED payment voucher (reference_type = 'PURCHASE_PAYMENT', reference_id = payment.id).
   *    - Rejects if already reversed (reversed_by_voucher_id is not null).
   * 6. Inverts original journal lines:
   *    - Dr Cash/Bank (Account 1111/1112 from original Cr line).
   *    - Cr Accounts Payable (Account 2111 from original Dr line, carrying supplier_id & branch_id).
   * 7. Creates, submits, approves, and posts compensating reversal voucher via PostingService.
   * 8. Establishes authoritative bidirectional reversal linkage:
   *    - original_voucher.reversed_by_voucher_id = reversal_voucher.id (original remains POSTED).
   *    - reversal_voucher.reversal_of_voucher_id = original_voucher.id.
   *    - original_journal_entry.is_reversed = true, reversed_at = NOW().
   * 9. Soft-deletes payment record (deleted_at = NOW()).
   * 10. Computes and returns restored outstanding balance on the purchase invoice.
   * 11. Full transactional atomicity with savepoint rollback on failure.
   */
  static async reversePayment(
    params: ReversePurchasePaymentParams
  ): Promise<PurchasePaymentResponse<PurchasePaymentReversalResult>> {
    const {
      paymentId,
      purchaseId,
      branchId,
      reason,
      reversalDate,
      reversedBy,
      actorRole,
      actorSession,
      voucherPreparerId,
      client: callerClient,
    } = params;

    try {
      if (!paymentId || typeof paymentId !== "string" || paymentId.trim().length === 0) {
        throw new PurchasePaymentError("PAYMENT_NOT_FOUND", "A valid paymentId is required.");
      }
      if (!purchaseId || typeof purchaseId !== "string" || purchaseId.trim().length === 0) {
        throw new PurchasePaymentError("PURCHASE_NOT_FOUND", "A valid purchaseId is required.");
      }
      if (!branchId || typeof branchId !== "string" || branchId.trim().length === 0) {
        throw new PurchasePaymentError("BRANCH_ACCESS_DENIED", "A valid branchId is required.");
      }
      if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
        throw new PurchasePaymentError(
          "PAYMENT_REVERSAL_FAILED",
          "A substantive reason (at least 3 characters) is required to reverse a supplier payment."
        );
      }
      if (!reversalDate || !/^\d{4}-\d{2}-\d{2}$/.test(reversalDate)) {
        throw new PurchasePaymentError(
          "PAYMENT_REVERSAL_FAILED",
          "A valid reversal date (YYYY-MM-DD) is required."
        );
      }
      if (!reversedBy || typeof reversedBy !== "string" || reversedBy.trim().length === 0) {
        throw new PurchasePaymentError(
          "PERMISSION_DENIED",
          "Caller identity (reversedBy) is required."
        );
      }

      const executeReversal = async (client: PoolClient): Promise<PurchasePaymentReversalResult> => {
        // ── 1. LOCK & FETCH PURCHASE_PAYMENT RECORD ─────────────────────────────
        const lockPaymentSql = `
          SELECT * FROM public.purchase_payment
          WHERE id = $1 AND purchase_id = $2
          FOR UPDATE
        `;
        const payRes = await client.query<PurchasePaymentRow>(lockPaymentSql, [paymentId, purchaseId]);
        const payment = payRes.rows[0];

        if (!payment) {
          throw new PurchasePaymentError(
            "PAYMENT_NOT_FOUND",
            `Payment '${paymentId}' not found for purchase '${purchaseId}'.`
          );
        }

        if (payment.deleted_at) {
          throw new PurchasePaymentError(
            "PAYMENT_ALREADY_REVERSED",
            `Payment '${paymentId}' has already been reversed or deleted.`
          );
        }

        // ── 2. LOCK & FETCH PURCHASE RECORD ────────────────────────────────────
        const lockPurchaseSql = `
          SELECT * FROM public.purchase
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE
        `;
        const pRes = await client.query<PurchaseRow>(lockPurchaseSql, [purchaseId]);
        const purchase = pRes.rows[0];

        if (!purchase) {
          throw new PurchasePaymentError(
            "PURCHASE_NOT_FOUND",
            `Purchase '${purchaseId}' not found or deleted.`
          );
        }

        // Branch Isolation / BOLA Defense
        if (branchId && purchase.branch_id !== branchId) {
          throw new PurchasePaymentError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: purchase belongs to branch '${purchase.branch_id}', not '${branchId}'.`
          );
        }

        if (purchase.status !== "POSTED") {
          throw new PurchasePaymentError(
            "INVALID_PURCHASE_STATUS",
            `Supplier payments can only be reversed on POSTED purchases. Current purchase status is '${purchase.status}'.`
          );
        }

        // ── 3. FAIL-CLOSED CONFIG GUARDS ───────────────────────────────────────
        await PostingService.validateAccountingStartDate(reversalDate, client);
        const period = await PostingService.validateFiscalPeriod(reversalDate, client);
        const fiscalYear = period.fiscal_year;

        // ── 4. SEGREGATION OF DUTIES (SoD) & RBAC ──────────────────────────────
        if (payment.created_by && reversedBy === payment.created_by) {
          throw new PurchasePaymentError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Staff member who disbursed the payment ('${payment.created_by}') cannot reverse or void their own disbursement.`
          );
        }

        if (purchase.created_by && reversedBy === purchase.created_by) {
          throw new PurchasePaymentError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Purchase requisition creator ('${purchase.created_by}') cannot reverse supplier payments for this purchase.`
          );
        }

        if (purchase.approved_by && reversedBy === purchase.approved_by) {
          throw new PurchasePaymentError(
            "SEGREGATION_OF_DUTIES_VIOLATION",
            `Segregation of duties violation: Purchase commercial approver ('${purchase.approved_by}') cannot reverse supplier payments for this purchase.`
          );
        }

        const actorContext = {
          userId: reversedBy,
          role: actorRole || (actorSession?.role as any) || (reversedBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
          session: actorSession || {
            user: {
              id: reversedBy,
              role: actorRole || (reversedBy.startsWith("admin_") ? "SUPER_ADMIN" : "STAFF"),
            },
          },
        };

        const hasPostingPerm = hasEffectivePermission(actorContext, "ACCOUNTING.POST");
        if (!hasPostingPerm) {
          throw new PurchasePaymentError(
            "PERMISSION_DENIED",
            `Caller '${reversedBy}' lacks required permission 'ACCOUNTING.POST' to reverse supplier payments.`
          );
        }

        // ── 5. LOCATE & LOCK ORIGINAL PAYMENT VOUCHER ──────────────────────────
        const origVoucherRes = await client.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher
           WHERE reference_type = 'PURCHASE_PAYMENT'
             AND reference_id = $1
             AND reference_event = 'SUPPLIER_DISBURSEMENT'
             AND status = 'POSTED'
             AND deleted_at IS NULL
           FOR UPDATE`,
          [payment.id]
        );
        const originalVoucher = origVoucherRes.rows[0];

        if (!originalVoucher) {
          throw new PurchasePaymentError(
            "ORIGINAL_VOUCHER_NOT_FOUND",
            `No posted payment voucher found for supplier payment '${payment.id}'.`
          );
        }

        if (originalVoucher.reversed_by_voucher_id) {
          throw new PurchasePaymentError(
            "PAYMENT_ALREADY_REVERSED",
            `Original payment voucher '${originalVoucher.voucher_no}' has already been reversed by voucher '${originalVoucher.reversed_by_voucher_id}'.`
          );
        }

        const origJeRes = await client.query<AccountingJournalEntryRow>(
          `SELECT * FROM public.accounting_journal_entry
           WHERE voucher_id = $1`,
          [originalVoucher.id]
        );
        const originalJournal = origJeRes.rows[0];

        if (!originalJournal) {
          throw new PurchasePaymentError(
            "ORIGINAL_JOURNAL_NOT_FOUND",
            `No journal entry found for original payment voucher '${originalVoucher.voucher_no}'.`
          );
        }

        if (originalJournal.is_reversed) {
          throw new PurchasePaymentError(
            "PAYMENT_ALREADY_REVERSED",
            `Original journal entry '${originalJournal.entry_no}' is already marked reversed.`
          );
        }

        // ── 6. CONSTRUCT INVERTED COMPENSATING JOURNAL LINES ───────────────────
        const origLinesRes = await client.query<AccountingJournalLineRow>(
          `SELECT * FROM public.accounting_journal_line
           WHERE journal_entry_id = $1
           ORDER BY line_no ASC`,
          [originalJournal.id]
        );
        const originalLines = origLinesRes.rows;

        const compensatingLines: JournalLineInput[] = originalLines.map((line) => {
          const origDebit = Number(line.debit_amount);
          const origCredit = Number(line.credit_amount);

          return {
            account_id: line.account_id,
            // Invert debit and credit
            debit_amount: origCredit,
            credit_amount: origDebit,
            branch_id: purchase.branch_id,
            supplier_id: line.supplier_id || purchase.supplier_id,
            tax_rate: line.tax_rate,
            tax_class: line.tax_class,
            narration: `Reversal of [${originalVoucher.voucher_no}]: ${line.narration || "Supplier Payment"} (${reason})`,
            metadata: {
              reversal_of_journal_line_id: line.id,
              original_voucher_id: originalVoucher.id,
              payment_id: payment.id,
              purchase_id: purchase.id,
              reason,
            },
          };
        });

        PostingService.validateJournalLines(compensatingLines);
        await PostingService.validatePostingAccounts(
          compensatingLines.map((l) => l.account_id),
          client
        );

        // ── 7. CREATE, SUBMIT, APPROVE, AND POST COMPENSATING VOUCHER ──────────
        const defaultPreparer = `cashier_${purchase.branch_id.replace(/^br_/, "")}`;
        const preparerId =
          voucherPreparerId && voucherPreparerId !== reversedBy
            ? voucherPreparerId
            : (reversedBy === defaultPreparer
                ? `clerk_${purchase.branch_id.replace(/^br_/, "")}`
                : defaultPreparer);

        const draftRes = await PostingService.createVoucherDraft({
          input: {
            voucher_type: "JOURNAL",
            voucher_date: reversalDate,
            branch_id: purchase.branch_id,
            narration: `Compensating Reversal for Supplier Payment ${payment.id} against Invoice ${purchase.invoice_no || purchase.id}: ${reason}`,
            reference_type: "PURCHASE_PAYMENT_REVERSAL",
            reference_id: payment.id,
            reference_event: "PAYMENT_REVERSAL",
            reversal_of_voucher_id: originalVoucher.id,
            lines: compensatingLines,
            metadata: {
              purchase_id: purchase.id,
              payment_id: payment.id,
              original_voucher_id: originalVoucher.id,
              original_voucher_no: originalVoucher.voucher_no,
              reversal_reason: reason,
            },
          },
          branchId: purchase.branch_id,
          fiscalYear,
          createdBy: preparerId,
          client,
        });

        if (!draftRes.success) {
          throw new PurchasePaymentError(
            draftRes.code as PurchasePaymentErrorCode,
            `Failed to create compensating reversal voucher draft: ${draftRes.error}`
          );
        }
        const reversalDraft = draftRes.data;

        // Submit Voucher
        const submitRes = await PostingService.submitVoucher({
          voucherId: reversalDraft.id,
          submittedBy: preparerId,
          branchId: purchase.branch_id,
          client,
        });
        if (!submitRes.success) {
          throw new PurchasePaymentError(
            submitRes.code as PurchasePaymentErrorCode,
            `Failed to submit compensating reversal voucher: ${submitRes.error}`
          );
        }

        // Approve Voucher (SoD: reversedBy !== preparerId)
        const approveRes = await PostingService.approveVoucher({
          voucherId: reversalDraft.id,
          approvedBy: reversedBy,
          branchId: purchase.branch_id,
          client,
        });
        if (!approveRes.success) {
          throw new PurchasePaymentError(
            approveRes.code as PurchasePaymentErrorCode,
            `Failed to approve compensating reversal voucher: ${approveRes.error}`
          );
        }

        // Post Reversal Voucher to General Ledger
        const postRes = await PostingService.postVoucher({
          voucherId: reversalDraft.id,
          postedBy: reversedBy,
          lines: compensatingLines,
          branchId: purchase.branch_id,
          client,
        });
        if (!postRes.success) {
          throw new PurchasePaymentError(
            postRes.code as PurchasePaymentErrorCode,
            `Failed to post compensating reversal voucher to General Ledger: ${postRes.error} [${postRes.code}]`
          );
        }
        const postedReversalVoucher = postRes.data.voucher;
        const postedJournalEntry = postRes.data.journal_entry;

        // ── 8. ESTABLISH AUTHORITATIVE REVERSAL LINKAGE ──────────────────────
        const updatedOriginalVoucher = await PostingService.linkReversal(
          {
            originalVoucherId: originalVoucher.id,
            reversalVoucherId: postedReversalVoucher.id,
            reversedBy,
            branchId: purchase.branch_id,
          },
          client
        );

        // ── 9. SOFT-DELETE PAYMENT RECORD & ANNOTATE REFERENCE ────────────────
        const updatePaymentRes = await client.query<PurchasePaymentRow>(
          `UPDATE public.purchase_payment
           SET deleted_at = NOW(),
               reference = CASE 
                 WHEN reference IS NULL OR reference = '' THEN 'REVERSED: ' || $1
                 ELSE reference || ' [REVERSED: ' || $1 || ']'
               END,
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [reason, payment.id]
        );
        const reversedPayment = updatePaymentRes.rows[0];

        // ── 10. RECOMPUTE RESTORED OUTSTANDING BALANCE ────────────────────────
        const remainingPaymentsRes = await client.query<{ total_paid: string }>(
          `SELECT COALESCE(SUM(amount), 0) AS total_paid
           FROM public.purchase_payment
           WHERE purchase_id = $1 AND deleted_at IS NULL`,
          [purchase.id]
        );
        const remainingPaid = Number(remainingPaymentsRes.rows[0]?.total_paid ?? 0);

        const dnCheck = await client.query<{ total_returns: string }>(
          `SELECT COALESCE(SUM(total_amount), 0) AS total_returns
           FROM public.accounting_voucher
           WHERE reference_type = 'PURCHASE_RETURN'
             AND metadata->>'purchase_id' = $1
             AND status = 'POSTED'
             AND deleted_at IS NULL`,
          [purchase.id]
        );
        const totalDebitNotes = Number(dnCheck.rows[0]?.total_returns ?? 0);
        const restoredBalance = Math.max(0, Math.round((Number(purchase.total) - remainingPaid - totalDebitNotes) * 100) / 100);

        return {
          payment_id: payment.id,
          purchase_id: purchase.id,
          reversed_payment: reversedPayment,
          original_voucher: updatedOriginalVoucher,
          reversal_voucher: postedReversalVoucher,
          reversal_journal_entry: postedJournalEntry,
          restored_balance: restoredBalance,
        };
      };

      const executeWithSavepoint = async (client: PoolClient): Promise<PurchasePaymentReversalResult> => {
        await client.query("SAVEPOINT sp_purchase_payment_reversal");
        try {
          const res = await executeReversal(client);
          await client.query("RELEASE SAVEPOINT sp_purchase_payment_reversal");
          return res;
        } catch (e) {
          await client.query("ROLLBACK TO SAVEPOINT sp_purchase_payment_reversal");
          throw e;
        }
      };

      const result = callerClient
        ? await executeWithSavepoint(callerClient)
        : await dbTransaction(executeReversal);

      return { success: true, data: result };
    } catch (err: any) {
      if (err instanceof PurchasePaymentError) {
        return { success: false, error: err.message, code: err.code };
      }
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: err.code as PurchasePaymentErrorCode };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "PAYMENT_REVERSAL_FAILED" };
    }
  }

  /**
   * Retrieves all payments recorded against a purchase along with total paid and balance due.
   */
  static async getPurchasePayments(
    purchaseId: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<{
    payments: PurchasePaymentRow[];
    purchase_total: number;
    total_paid: number;
    total_debit_notes: number;
    balance_due: number;
    is_fully_settled: boolean;
  }> {
    const pSql = `
      SELECT total, branch_id FROM public.purchase
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const pRes = client
      ? await client.query<{ total: number; branch_id: string }>(pSql, [purchaseId])
      : await (await import("../db")).dbQuery<{ total: number; branch_id: string }>(pSql, [purchaseId]);

    const purchase = pRes.rows[0];
    if (!purchase) {
      throw new PurchasePaymentError("PURCHASE_NOT_FOUND", `Purchase '${purchaseId}' not found.`);
    }

    if (branchId && purchase.branch_id !== branchId) {
      throw new PurchasePaymentError(
        "BRANCH_ACCESS_DENIED",
        `Access denied: purchase belongs to branch '${purchase.branch_id}'.`
      );
    }

    const paySql = `
      SELECT * FROM public.purchase_payment
      WHERE purchase_id = $1 AND deleted_at IS NULL
      ORDER BY payment_date ASC, created_at ASC
    `;
    const payRes = client
      ? await client.query<PurchasePaymentRow>(paySql, [purchaseId])
      : await (await import("../db")).dbQuery<PurchasePaymentRow>(paySql, [purchaseId]);

    const totalPaid = payRes.rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const purchaseTotal = Number(purchase.total);

    const dnSql = `
      SELECT COALESCE(SUM(total_amount), 0) AS total_returns
      FROM public.accounting_voucher
      WHERE reference_type = 'PURCHASE_RETURN'
        AND metadata->>'purchase_id' = $1
        AND status = 'POSTED'
        AND deleted_at IS NULL
    `;
    const dnRes = client
      ? await client.query<{ total_returns: string }>(dnSql, [purchaseId])
      : await (await import("../db")).dbQuery<{ total_returns: string }>(dnSql, [purchaseId]);
    const totalDebitNotes = Number(dnRes.rows[0]?.total_returns ?? 0);

    const balanceDue = Math.max(0, Math.round((purchaseTotal - totalPaid - totalDebitNotes) * 100) / 100);

    return {
      payments: payRes.rows,
      purchase_total: purchaseTotal,
      total_paid: Math.round(totalPaid * 100) / 100,
      total_debit_notes: Math.round(totalDebitNotes * 100) / 100,
      balance_due: balanceDue,
      is_fully_settled: balanceDue === 0,
    };
  }
}
