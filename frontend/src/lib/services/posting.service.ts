/**
 * CakeToHome ERP — Accounting Posting Service Foundation
 * Phase 4F Step 2: Transaction-safe posting service foundation.
 *
 * ARCHITECTURE & CONSTRAINTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH — No JSON, mock, or synthetic fallback.
 * 2. ACCOUNTING START DATE HARD BLOCK:
 *    Refuses any posting while accounting_start_date is unconfigured.
 *    Rejects dates prior to accounting_start_date.
 * 3. FISCAL PERIOD HARD BLOCK:
 *    0 periods in DB returns PERIOD_NOT_CONFIGURED and hard-blocks posting.
 *    Locked periods return PERIOD_LOCKED and hard-blocks posting.
 *    Never assumes Apr-Mar or auto-creates periods.
 * 4. POSTING ACCOUNT VALIDATION:
 *    Validates all accounts in DB: active, non-deleted, and non-group (is_group = false).
 *    Summary groups are strictly forbidden from receiving direct postings.
 * 5. DOUBLE-ENTRY INTEGRITY:
 *    At least 2 lines; strictly single-sided debit/credit; sum(debit) == sum(credit); total_debit > 0.
 * 6. ATOMIC POSTING TRANSACTION:
 *    BEGIN -> SELECT FOR UPDATE (voucher) -> guards -> create journal entry -> create lines -> markPosted -> COMMIT.
 *    Any failure triggers ROLLBACK; zero partial writes.
 * 7. FORWARD-ONLY LIFECYCLE:
 *    DRAFT -> SUBMITTED -> APPROVED -> POSTED (terminal).
 *    Cancellation allowed for DRAFT/SUBMITTED/APPROVED -> CANCELLED.
 *    Reversals audited via linkage (reversed_by_voucher_id / reversal_of_voucher_id) and journal is_reversed.
 * 8. SEGREGATION OF DUTIES:
 *    approved_by != created_by enforced server-side.
 * 9. IDEMPOTENCY:
 *    Source event idempotency (reference_type, reference_id, reference_event) enforced via DB partial unique index.
 * 10. NO BUSINESS LOGIC MATRIX:
 *     Purchase/sales/COGS/GST/fleet posting will be implemented in later isolated steps.
 */

import { dbTransaction, dbQuery } from "../db";
import type { PoolClient } from "pg";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountingFiscalPeriodRepository } from "../repositories/accounting-fiscal-period.repository";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  AccountingAccountRow,
  AccountingFiscalPeriodRow,
  VoucherCreateInput,
  JournalLineInput,
  VoucherType,
  VoucherStatus,
} from "../types/accounting.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type PostingErrorCode =
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "POSTING_BEFORE_ACCOUNTING_START_DATE"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "FISCAL_PERIOD_LOCKED"
  | "VOUCHER_NOT_FOUND"
  | "INVALID_VOUCHER_STATE"
  | "VOUCHER_ALREADY_POSTED"
  | "POSTING_ACCOUNT_INVALID"
  | "GROUP_ACCOUNT_NOT_POSTABLE"
  | "JOURNAL_UNBALANCED"
  | "JOURNAL_LINE_INVALID"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "DUPLICATE_SOURCE_EVENT"
  | "BRANCH_ACCESS_DENIED"
  | "POSTING_FAILED";

export class PostingServiceError extends Error {
  readonly code: PostingErrorCode;

  constructor(code: PostingErrorCode, message: string) {
    super(message);
    this.name = "PostingServiceError";
    this.code = code;
  }
}

// ─── DTOs & Service Response Types ────────────────────────────────────────────

export type PostingServiceResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: PostingErrorCode };

export interface PostingResult {
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
}

export interface PostVoucherParams {
  voucherId: string;
  postedBy: string;
  lines: JournalLineInput[];
  branchId?: string;
  client?: PoolClient;
}

export interface CreateVoucherDraftParams {
  input: VoucherCreateInput;
  branchId: string;
  fiscalYear: string;
  createdBy: string;
  client?: PoolClient;
}

export interface SubmitVoucherParams {
  voucherId: string;
  submittedBy: string;
  branchId: string;
  client?: PoolClient;
}

export interface ApproveVoucherParams {
  voucherId: string;
  approvedBy: string;
  branchId: string;
  client?: PoolClient;
}

export interface CancelVoucherParams {
  voucherId: string;
  cancelledBy: string;
  branchId: string;
  client?: PoolClient;
}

export interface LinkReversalParams {
  originalVoucherId: string;
  reversalVoucherId: string;
  reversedBy: string;
  branchId?: string;
}

// ─── PostingService ────────────────────────────────────────────────────────────

export class PostingService {
  // ── 1. ACCOUNTING START DATE GUARD (HARD BLOCK) ──────────────────────────────

  /**
   * Validates that accounting_start_date is configured and that voucherDate >= startDate.
   * Hard blocks if unconfigured. Never infers or auto-creates dates.
   *
   * @throws {PostingServiceError} ACCOUNTING_START_DATE_NOT_CONFIGURED or POSTING_BEFORE_ACCOUNTING_START_DATE
   */
  static async validateAccountingStartDate(
    voucherDate: string,
    client?: PoolClient
  ): Promise<string> {
    const config = await AccountingFiscalPeriodRepository.getAccountingStartDateConfig(client);

    if (!config.configured) {
      throw new PostingServiceError(
        "ACCOUNTING_START_DATE_NOT_CONFIGURED",
        "Accounting start date is unconfigured. Operational postings are locked until an official cut-off start date is established."
      );
    }

    if (voucherDate < config.startDate) {
      throw new PostingServiceError(
        "POSTING_BEFORE_ACCOUNTING_START_DATE",
        `Voucher date '${voucherDate}' is prior to accounting start date '${config.startDate}'. Postings before the cut-off date are rejected.`
      );
    }

    return config.startDate;
  }

  // ── 2. FISCAL PERIOD GUARD (HARD BLOCK) ──────────────────────────────────────

  /**
   * Validates that an active, open fiscal period exists for the voucher date.
   * Hard blocks if PERIOD_NOT_CONFIGURED or PERIOD_LOCKED.
   *
   * @throws {PostingServiceError} FISCAL_PERIOD_NOT_CONFIGURED or FISCAL_PERIOD_LOCKED
   */
  static async validateFiscalPeriod(
    voucherDate: string,
    client?: PoolClient
  ): Promise<AccountingFiscalPeriodRow> {
    const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(
      voucherDate,
      client
    );

    if (periodStatus.status === "PERIOD_NOT_CONFIGURED") {
      throw new PostingServiceError(
        "FISCAL_PERIOD_NOT_CONFIGURED",
        `No fiscal period has been configured covering date '${voucherDate}'. Postings are rejected until a fiscal period is established.`
      );
    }

    if (periodStatus.status === "PERIOD_LOCKED") {
      throw new PostingServiceError(
        "FISCAL_PERIOD_LOCKED",
        `Fiscal period '${periodStatus.period.period_name}' (${periodStatus.period.start_date} to ${periodStatus.period.end_date}) is locked. Postings to locked periods are rejected.`
      );
    }

    return periodStatus.period;
  }

  // ── 3. POSTING ACCOUNT VALIDATION ────────────────────────────────────────────

  /**
   * Validates that all accounts exist, are active, non-deleted, and are NOT group accounts.
   * Reuses AccountingAccountRepository.validatePostingAccounts.
   *
   * @throws {PostingServiceError} POSTING_ACCOUNT_INVALID or GROUP_ACCOUNT_NOT_POSTABLE
   */
  static async validatePostingAccounts(
    accountIds: string[],
    client?: PoolClient
  ): Promise<Map<string, AccountingAccountRow>> {
    if (!accountIds || accountIds.length === 0) {
      throw new PostingServiceError(
        "JOURNAL_LINE_INVALID",
        "Journal lines must contain valid account IDs."
      );
    }

    try {
      return await AccountingAccountRepository.validatePostingAccounts(accountIds, client);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("summary group")) {
        throw new PostingServiceError("GROUP_ACCOUNT_NOT_POSTABLE", msg);
      }
      throw new PostingServiceError("POSTING_ACCOUNT_INVALID", msg);
    }
  }

  // ── 4. DOUBLE-ENTRY JOURNAL LINES VALIDATION ─────────────────────────────────

  /**
   * Mathematical and structural validation of journal lines:
   * - Minimum 2 lines
   * - Exclusively single-sided (debit > 0 XOR credit > 0; non-negative)
   * - Sum of debits == Sum of credits
   * - Total debit > 0
   *
   * @returns verified total amount
   * @throws {PostingServiceError} JOURNAL_LINE_INVALID or JOURNAL_UNBALANCED
   */
  static validateJournalLines(lines: JournalLineInput[]): number {
    if (!lines || lines.length < 2) {
      throw new PostingServiceError(
        "JOURNAL_LINE_INVALID",
        "Double-entry accounting requires at least 2 journal lines."
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineIdx = i + 1;

      if (!line.account_id || typeof line.account_id !== "string") {
        throw new PostingServiceError(
          "JOURNAL_LINE_INVALID",
          `Journal line ${lineIdx} is missing a valid account_id.`
        );
      }

      const debit = Number(line.debit_amount);
      const credit = Number(line.credit_amount);

      if (isNaN(debit) || isNaN(credit) || debit < 0 || credit < 0) {
        throw new PostingServiceError(
          "JOURNAL_LINE_INVALID",
          `Journal line ${lineIdx} has negative or invalid amounts: debit=${line.debit_amount}, credit=${line.credit_amount}.`
        );
      }

      const debitPos = debit > 0;
      const creditPos = credit > 0;

      // Exclusivity: exactly one side positive, other strictly zero
      if (!((debitPos && credit === 0) || (creditPos && debit === 0))) {
        throw new PostingServiceError(
          "JOURNAL_LINE_INVALID",
          `Journal line ${lineIdx} violates single-sided requirement: exactly one of debit or credit must be positive, and the other must be zero. Got debit=${debit}, credit=${credit}.`
        );
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    if (totalDebit <= 0) {
      throw new PostingServiceError(
        "JOURNAL_UNBALANCED",
        "Total journal debit amount must be strictly greater than zero."
      );
    }

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new PostingServiceError(
        "JOURNAL_UNBALANCED",
        `Journal is unbalanced: total debit (${totalDebit.toFixed(2)}) != total credit (${totalCredit.toFixed(2)}). Each journal entry must balance to zero.`
      );
    }

    return Math.round(totalDebit * 100) / 100;
  }

  // ── 5. CORE ATOMIC POSTING TRANSACTION ────────────────────────────────────────

  /**
   * Atomically posts an approved voucher to the General Ledger.
   *
   * Transaction boundaries:
   * BEGIN
   *   1. Lock voucher row with SELECT ... FOR UPDATE (concurrency safety)
   *   2. Validate voucher exists, deleted_at IS NULL, status === 'APPROVED'
   *   3. Validate branch scope (BOLA defense)
   *   4. Validate accounting start date (hard block if unconfigured / before start date)
   *   5. Validate fiscal period (hard block if unconfigured / locked)
   *   6. Validate posting accounts (active, non-group, non-deleted)
   *   7. Validate journal lines (double-entry, single-sided, balanced)
   *   8. Create journal entry and lines (DB deferred trigger enforces balancing at commit)
   *   9. Mark voucher POSTED
   * COMMIT
   *
   * On any failure: ROLLBACK. Zero partial state is committed.
   */
  static async postVoucher(
    params: PostVoucherParams
  ): Promise<PostingServiceResponse<PostingResult>> {
    try {
      const executePosting = async (client: PoolClient): Promise<PostingResult> => {
        // 1. Lock voucher row exclusively for update
        const lockSql = `
          SELECT * FROM public.accounting_voucher
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE
        `;
        const lockRes = await client.query<AccountingVoucherRow>(lockSql, [params.voucherId]);
        const voucher = lockRes.rows[0];

        if (!voucher) {
          throw new PostingServiceError(
            "VOUCHER_NOT_FOUND",
            `Voucher '${params.voucherId}' not found.`
          );
        }

        // BOLA / branch isolation check
        if (params.branchId && voucher.branch_id !== params.branchId) {
          throw new PostingServiceError(
            "BRANCH_ACCESS_DENIED",
            `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
          );
        }

        // Status checks
        if (voucher.status === "POSTED") {
          throw new PostingServiceError(
            "VOUCHER_ALREADY_POSTED",
            `Voucher '${params.voucherId}' is already posted and immutable.`
          );
        }

        if (voucher.status !== "APPROVED") {
          throw new PostingServiceError(
            "INVALID_VOUCHER_STATE",
            `Voucher '${params.voucherId}' cannot be posted from status '${voucher.status}'. Only APPROVED vouchers can be posted.`
          );
        }

        // 2. Validate Accounting Start Date (HARD BLOCK)
        await PostingService.validateAccountingStartDate(voucher.voucher_date, client);

        // 3. Validate Fiscal Period (HARD BLOCK)
        await PostingService.validateFiscalPeriod(voucher.voucher_date, client);

        // 4. Validate Posting Accounts
        const accountIds = params.lines.map((l) => l.account_id);
        await PostingService.validatePostingAccounts(accountIds, client);

        // 5. Validate Journal Lines
        const totalAmount = PostingService.validateJournalLines(params.lines);

        // 6. Create Journal Entry and Lines
        const journalEntry = await AccountingJournalRepository.createJournalEntry(
          voucher.id,
          voucher.voucher_date,
          voucher.branch_id,
          voucher.fiscal_year,
          voucher.narration,
          params.lines,
          params.postedBy,
          client
        );

        // 7. Mark Voucher POSTED
        const postedVoucher = await AccountingVoucherRepository.markPosted(
          voucher.id,
          params.postedBy,
          totalAmount,
          client
        );

        return {
          voucher: postedVoucher,
          journal_entry: journalEntry,
        };
      };

      const result = params.client
        ? await executePosting(params.client)
        : await dbTransaction(executePosting);

      return { success: true, data: result };
    } catch (err) {
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "POSTING_FAILED" };
    }
  }

  // ── 6. VOUCHER LIFECYCLE PRIMITIVES ──────────────────────────────────────────

  /**
   * Create a new voucher in DRAFT status with source idempotency check.
   */
  static async createVoucherDraft(
    params: CreateVoucherDraftParams
  ): Promise<PostingServiceResponse<AccountingVoucherRow>> {
    try {
      const { input, branchId, fiscalYear, createdBy, client } = params;

      // Idempotency pre-check for non-manual source events
      if (input.reference_type && input.reference_type !== "MANUAL" && input.reference_id) {
        const existing = await AccountingVoucherRepository.findBySourceEvent(
          input.reference_type,
          input.reference_id,
          input.reference_event ?? "PRIMARY",
          client
        );
        if (existing) {
          return {
            success: false,
            error: `Duplicate source event: an active voucher (${existing.voucher_no}) already exists for ${input.reference_type}:${input.reference_id}:${input.reference_event ?? "PRIMARY"}.`,
            code: "DUPLICATE_SOURCE_EVENT",
          };
        }
      }

      const voucher = await AccountingVoucherRepository.createDraft(
        input,
        branchId,
        fiscalYear,
        createdBy,
        client
      );
      return { success: true, data: voucher };
    } catch (err) {
      if (err instanceof PostingServiceError) {
        return { success: false, error: err.message, code: err.code };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, code: "POSTING_FAILED" };
    }
  }

  /**
   * DRAFT -> SUBMITTED.
   */
  static async submitVoucher(
    params: SubmitVoucherParams
  ): Promise<PostingServiceResponse<AccountingVoucherRow>> {
    try {
      const voucher = await AccountingVoucherRepository.submit(
        params.voucherId,
        params.submittedBy,
        params.branchId,
        params.client
      );
      return { success: true, data: voucher };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code: PostingErrorCode = message.includes("lifecycle violation")
        ? "INVALID_VOUCHER_STATE"
        : "POSTING_FAILED";
      return { success: false, error: message, code };
    }
  }

  /**
   * SUBMITTED -> APPROVED.
   * Enforces Segregation of Duties (approvedBy != created_by).
   */
  static async approveVoucher(
    params: ApproveVoucherParams
  ): Promise<PostingServiceResponse<AccountingVoucherRow>> {
    try {
      const voucher = await AccountingVoucherRepository.approve(
        params.voucherId,
        params.approvedBy,
        params.branchId,
        params.client
      );
      return { success: true, data: voucher };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      let code: PostingErrorCode = "POSTING_FAILED";
      if (message.includes("Segregation of Duties")) {
        code = "SEGREGATION_OF_DUTIES_VIOLATION";
      } else if (message.includes("lifecycle violation")) {
        code = "INVALID_VOUCHER_STATE";
      }
      return { success: false, error: message, code };
    }
  }

  /**
   * Cancel a DRAFT, SUBMITTED, or APPROVED voucher.
   * POSTED vouchers cannot be cancelled.
   */
  static async cancelVoucher(
    params: CancelVoucherParams
  ): Promise<PostingServiceResponse<AccountingVoucherRow>> {
    try {
      const voucher = await AccountingVoucherRepository.cancel(
        params.voucherId,
        params.cancelledBy,
        params.branchId,
        params.client
      );
      return { success: true, data: voucher };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code: PostingErrorCode = message.includes("lifecycle violation")
        ? "INVALID_VOUCHER_STATE"
        : "POSTING_FAILED";
      return { success: false, error: message, code };
    }
  }

  // ── 7. REVERSAL PRIMITIVES (FOUNDATION ONLY — NO BUSINESS POSTING YET) ───────

  /**
   * Safe foundation primitive for future reversal operations.
   * Links a compensating reversal voucher to the original POSTED voucher and flags
   * the original journal entry as reversed.
   *
   * Must run inside caller-provided transaction client.
   */
  static async linkReversal(
    params: LinkReversalParams,
    client: PoolClient
  ): Promise<AccountingVoucherRow> {
    // 1. Record reversal linkage on original voucher (status remains POSTED)
    const updatedVoucher = await AccountingVoucherRepository.recordReversalLinkage(
      params.originalVoucherId,
      params.reversalVoucherId,
      client,
      params.branchId
    );

    // 2. Mark linked original journal entry as is_reversed = true
    const jeSql = `
      UPDATE public.accounting_journal_entry
      SET is_reversed = true,
          reversed_at = NOW()
      WHERE voucher_id = $1 AND is_reversed = false
      RETURNING *
    `;
    const jeRes = await client.query(jeSql, [params.originalVoucherId]);
    if (!jeRes.rows[0]) {
      throw new PostingServiceError(
        "INVALID_VOUCHER_STATE",
        `Failed to mark journal entry as reversed for voucher '${params.originalVoucherId}': entry not found or already reversed.`
      );
    }

    // 3. Ensure compensating reversal voucher has reversal_of_voucher_id set
    await client.query(
      `UPDATE public.accounting_voucher
       SET reversal_of_voucher_id = $1
       WHERE id = $2 AND reversal_of_voucher_id IS NULL`,
      [params.originalVoucherId, params.reversalVoucherId]
    );

    return updatedVoucher;
  }
}
