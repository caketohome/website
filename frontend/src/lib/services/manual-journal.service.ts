/**
 * CakeToHome ERP — Manual Journal Service
 * Phase C6.2: Domain Logic & Workflow Engine for Manual Journals / Journal Vouchers.
 *
 * ARCHITECTURAL CONTRACT:
 * 1. INR ONLY: Operates strictly in functional base currency 'INR'. No FX conversions or tables.
 * 2. CANONICAL VOUCHER LIFECYCLE: DRAFT → SUBMITTED → APPROVED → POSTED.
 * 3. STRICT SEGREGATION OF DUTIES (SoD):
 *    - created_by != approved_by (enforced in service and PostgreSQL chk_voucher_segregation).
 *    - created_by != posted_by (GL poster cannot be the voucher maker).
 *    - No Super Admin bypass.
 * 4. AUTHORITATIVE LEAF ACCOUNT VALIDATION:
 *    - Validates accounts exist, active, non-deleted, and is_group = false.
 *    - Direct posting to summary group accounts is strictly prohibited.
 * 5. STRONGLY TYPED PARTY DIMENSIONS:
 *    - Accounts Receivable (1121/1122): customer_id validated against public.customer.
 *    - Accounts Payable (2111): supplier_id validated against public.supplier.
 *    - Unrelated accounts: party dimensions strictly nullified.
 * 6. CANONICAL POSTING ENGINE:
 *    - Reuses PostingService primitives, row locking (SELECT FOR UPDATE), and transaction safety.
 *    - Converts metadata.lines into authoritative accounting_journal_entry & accounting_journal_line.
 *    - Deferred balance trigger trg_check_journal_balance guarantees double-entry at commit.
 * 7. IMMUTABILITY & COMPENSATING REVERSAL:
 *    - POSTED vouchers cannot be edited or cancelled.
 *    - Reversal creates a compensating JOURNAL voucher with inverted lines (Dr ↔ Cr).
 *    - Establishes bidirectional reversal linkage via PostingService.linkReversal.
 *    - Prevents double-reversal and reversal-of-reversal.
 * 8. FAIL-CLOSED GUARDS:
 *    - Accounting start date validation.
 *    - Open fiscal period validation & historical year-end close lockout guard.
 */

import { dbTransaction, dbQuery } from "../db";
import type { PoolClient } from "pg";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountingFiscalPeriodRepository } from "../repositories/accounting-fiscal-period.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { AccountGovernanceService } from "./account-governance.service";
import { AccountGovernanceError } from "../types/accounting.types";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  AccountingAccountRow,
  JournalLineInput,
  ManualJournalLineItem,
  ManualJournalMetadata,
  ManualJournalDraftInput,
  ManualJournalUpdateDraftInput,
  ManualJournalDetailResult,
  ManualJournalListFilters,
  ManualJournalListResult,
} from "../types/accounting.types";

// ─── Domain Error Model ────────────────────────────────────────────────────────

export type ManualJournalErrorCode =
  | "VOUCHER_NOT_FOUND"
  | "INVALID_VOUCHER_STATE"
  | "VOUCHER_ALREADY_POSTED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "POSTING_ACCOUNT_INVALID"
  | "GROUP_ACCOUNT_NOT_POSTABLE"
  | "PARTY_DIMENSION_INVALID"
  | "JOURNAL_UNBALANCED"
  | "JOURNAL_LINE_INVALID"
  | "FISCAL_PERIOD_LOCKED"
  | "FISCAL_PERIOD_NOT_CONFIGURED"
  | "POSTING_BEFORE_ACCOUNTING_START_DATE"
  | "ACCOUNTING_START_DATE_NOT_CONFIGURED"
  | "DUPLICATE_SOURCE_EVENT"
  | "REVERSAL_VIOLATION"
  | "BRANCH_ACCESS_DENIED"
  | "COST_CENTRE_PROHIBITED"
  | "COST_CENTRE_REQUIRED"
  | "COST_CENTRE_INVALID"
  | "OPERATION_FAILED";

export class ManualJournalDomainError extends Error {
  readonly code: ManualJournalErrorCode;

  constructor(code: ManualJournalErrorCode, message: string) {
    super(message);
    this.name = "ManualJournalDomainError";
    this.code = code;
  }
}

// ─── Service Parameter Interfaces ──────────────────────────────────────────────

export interface CreateManualJournalDraftServiceParams {
  voucherDate: string;
  branchId: string;
  narration: string;
  lines: ManualJournalLineItem[];
  createdBy: string;
  idempotencyKey?: string;
  cost_centre_id?: string | null;
  client?: PoolClient;
}

export interface UpdateManualJournalDraftServiceParams {
  voucherId: string;
  voucherDate?: string;
  narration?: string;
  lines?: ManualJournalLineItem[];
  updatedBy: string;
  branchId?: string;
  client?: PoolClient;
}

export interface SubmitManualJournalServiceParams {
  voucherId: string;
  submittedBy: string;
  branchId?: string;
  client?: PoolClient;
}

export interface ApproveManualJournalServiceParams {
  voucherId: string;
  approvedBy: string;
  branchId?: string;
  client?: PoolClient;
}

export interface PostManualJournalServiceParams {
  voucherId: string;
  postedBy: string;
  branchId?: string;
  client?: PoolClient;
}

export interface CancelManualJournalServiceParams {
  voucherId: string;
  cancelledBy: string;
  branchId?: string;
  client?: PoolClient;
}

export interface ReverseManualJournalServiceParams {
  voucherId: string;
  reversalDate: string;
  reason: string;
  reversedBy: string;
  branchId?: string;
  client?: PoolClient;
}

export interface PostManualJournalResult {
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
}

export interface ReverseManualJournalResult {
  original_voucher: AccountingVoucherRow;
  reversal_voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow & { lines: AccountingJournalLineRow[] };
}

// ─── ManualJournalService ──────────────────────────────────────────────────────

export class ManualJournalService {
  // ── 1. LINE & PARTY VALIDATION HELPER ────────────────────────────────────────

  /**
   * Authoritative validation of journal lines:
   * - Leaf accounts only (no summary groups, active, non-deleted).
   * - Party dimensions: validates customer_id on RECEIVABLE, supplier_id on PAYABLE, clears unrelated.
   * - Returns validated account map and sanitized lines.
   */
  private static async validateAccountsAndParties(
    lines: ManualJournalLineItem[],
    client?: PoolClient
  ): Promise<{
    accountMap: Map<string, AccountingAccountRow>;
    sanitizedLines: ManualJournalLineItem[];
  }> {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new ManualJournalDomainError(
        "JOURNAL_LINE_INVALID",
        "Double-entry accounting requires at least 2 balanced journal lines."
      );
    }

    const accountIds = Array.from(new Set(lines.map((l) => l.account_id).filter(Boolean)));
    if (accountIds.length === 0) {
      throw new ManualJournalDomainError(
        "JOURNAL_LINE_INVALID",
        "Journal lines must contain valid account IDs."
      );
    }

    // Leaf account validation via AccountingAccountRepository
    let accountMap: Map<string, AccountingAccountRow>;
    try {
      accountMap = await AccountingAccountRepository.validatePostingAccounts(accountIds, client);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("summary group")) {
        throw new ManualJournalDomainError("GROUP_ACCOUNT_NOT_POSTABLE", msg);
      }
      throw new ManualJournalDomainError("POSTING_ACCOUNT_INVALID", msg);
    }

    // Party validation: customer_id & supplier_id
    const customerIds = Array.from(
      new Set(lines.map((l) => l.customer_id?.trim()).filter(Boolean))
    ) as string[];
    const supplierIds = Array.from(
      new Set(lines.map((l) => l.supplier_id?.trim()).filter(Boolean))
    ) as string[];

    if (customerIds.length > 0) {
      const custSql = `SELECT id FROM public.customer WHERE id = ANY($1) AND deleted_at IS NULL`;
      const custRes = client
        ? await client.query(custSql, [customerIds])
        : await dbQuery(custSql, [customerIds]);
      const validCustIds = new Set(custRes.rows.map((r: any) => r.id));
      for (const cId of customerIds) {
        if (!validCustIds.has(cId)) {
          throw new ManualJournalDomainError(
            "PARTY_DIMENSION_INVALID",
            `Customer '${cId}' specified on journal line does not exist or is inactive.`
          );
        }
      }
    }

    if (supplierIds.length > 0) {
      const suppSql = `SELECT id FROM public.supplier WHERE id = ANY($1) AND deleted_at IS NULL`;
      const suppRes = client
        ? await client.query(suppSql, [supplierIds])
        : await dbQuery(suppSql, [supplierIds]);
      const validSuppIds = new Set(suppRes.rows.map((r: any) => r.id));
      for (const sId of supplierIds) {
        if (!validSuppIds.has(sId)) {
          throw new ManualJournalDomainError(
            "PARTY_DIMENSION_INVALID",
            `Supplier '${sId}' specified on journal line does not exist or is inactive.`
          );
        }
      }
    }

    // Cost centre validation: existence and active check
    const costCentreIds = Array.from(
      new Set(lines.map((l) => l.cost_centre_id?.trim()).filter(Boolean))
    ) as string[];

    if (costCentreIds.length > 0) {
      const ccSql = `SELECT id, code, is_active FROM public.cost_centre WHERE id = ANY($1) AND deleted_at IS NULL`;
      const ccRes = client
        ? await client.query<{ id: string; code: string; is_active: boolean }>(ccSql, [costCentreIds])
        : await dbQuery<{ id: string; code: string; is_active: boolean }>(ccSql, [costCentreIds]);
      const validCcMap = new Map<string, { id: string; code: string; is_active: boolean }>();
      for (const r of ccRes.rows) validCcMap.set(r.id, r);

      for (const ccId of costCentreIds) {
        const cc = validCcMap.get(ccId);
        if (!cc) {
          throw new ManualJournalDomainError(
            "COST_CENTRE_INVALID",
            `Cost centre '${ccId}' specified on journal line does not exist.`
          );
        }
        if (!cc.is_active) {
          throw new ManualJournalDomainError(
            "COST_CENTRE_INVALID",
            `Cost centre '${cc.code}' (ID '${ccId}') specified on journal line is inactive.`
          );
        }
      }
    }

    // Sanitize lines based on account subtype and governance policy
    const sanitizedLines: ManualJournalLineItem[] = lines.map((l, idx) => {
      const acct = accountMap.get(l.account_id);
      if (!acct) {
        throw new ManualJournalDomainError(
          "POSTING_ACCOUNT_INVALID",
          `Account '${l.account_id}' on line ${idx + 1} not found in chart of accounts.`
        );
      }

      // Enforce Account Governance Policy on line-level cost centre
      try {
        AccountGovernanceService.validateLineCostCentre(acct, l.cost_centre_id);
      } catch (err) {
        if (err instanceof AccountGovernanceError) {
          throw new ManualJournalDomainError(
            err.code as ManualJournalErrorCode,
            err.message
          );
        }
        throw err;
      }

      let customerId = l.customer_id?.trim() || null;
      let supplierId = l.supplier_id?.trim() || null;

      if (acct.subtype === "RECEIVABLE") {
        if (supplierId) {
          throw new ManualJournalDomainError(
            "PARTY_DIMENSION_INVALID",
            `Line ${idx + 1} targets Accounts Receivable (${acct.code}) and cannot carry a supplier_id.`
          );
        }
      } else if (acct.subtype === "PAYABLE") {
        if (customerId) {
          throw new ManualJournalDomainError(
            "PARTY_DIMENSION_INVALID",
            `Line ${idx + 1} targets Accounts Payable (${acct.code}) and cannot carry a customer_id.`
          );
        }
      } else {
        // Unrelated accounts: party dimensions strictly nullified per Rule 5
        customerId = null;
        supplierId = null;
      }

      return {
        ...l,
        account_id: acct.id,
        customer_id: customerId,
        supplier_id: supplierId,
        account_code: acct.code,
        account_name: acct.name,
        account_type: acct.type,
        account_subtype: acct.subtype,
      };
    });

    return { accountMap, sanitizedLines };
  }

  // ── 2. CREATE DRAFT ──────────────────────────────────────────────────────────

  /**
   * Create a new Manual Journal voucher in DRAFT status.
   * Orchestrates account validation, fiscal checks, balance checks, and metadata persistence.
   */
  static async createDraft(
    params: CreateManualJournalDraftServiceParams
  ): Promise<AccountingVoucherRow> {
    const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
      // 1. Validate accounting start date (hard block)
      try {
        await PostingService.validateAccountingStartDate(params.voucherDate, client);
      } catch (err: any) {
        throw new ManualJournalDomainError(err.code || "POSTING_BEFORE_ACCOUNTING_START_DATE", err.message);
      }

      // 2. Validate open fiscal period (hard block)
      let fiscalYear: string;
      try {
        const period = await PostingService.validateFiscalPeriod(params.voucherDate, client);
        fiscalYear = period.fiscal_year;
      } catch (err: any) {
        throw new ManualJournalDomainError(err.code || "FISCAL_PERIOD_LOCKED", err.message);
      }

      // 3. Idempotency check
      if (params.idempotencyKey) {
        const idemSql = `
          SELECT id, voucher_no FROM public.accounting_voucher
          WHERE voucher_type = 'JOURNAL'
            AND (reference_id = $1 OR metadata->>'idempotency_key' = $1)
            AND status <> 'CANCELLED'
            AND deleted_at IS NULL
          LIMIT 1
        `;
        const idemRes = client
          ? await client.query(idemSql, [params.idempotencyKey])
          : await dbQuery(idemSql, [params.idempotencyKey]);
        if (idemRes.rows.length > 0) {
          const existing = idemRes.rows[0];
          throw new ManualJournalDomainError(
            "DUPLICATE_SOURCE_EVENT",
            `Duplicate manual journal: an active voucher (${existing.voucher_no}) already exists for idempotency key '${params.idempotencyKey}'.`
          );
        }
      }

      // 4. Validate accounts and party dimensions
      const { sanitizedLines } = await ManualJournalService.validateAccountsAndParties(
        params.lines,
        client
      );

      // 5. Persist draft voucher via AccountingVoucherRepository
      try {
        return await AccountingVoucherRepository.createManualJournalDraft(
          {
            voucher_date: params.voucherDate,
            branch_id: params.branchId,
            narration: params.narration,
            lines: sanitizedLines,
            created_by: params.createdBy,
            fiscal_year: fiscalYear,
            idempotency_key: params.idempotencyKey,
            cost_centre_id: params.cost_centre_id,
          },
          params.branchId,
          fiscalYear,
          params.createdBy,
          client
        );
      } catch (err: any) {
        if (err instanceof ManualJournalDomainError) throw err;
        throw new ManualJournalDomainError("JOURNAL_UNBALANCED", err.message);
      }
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  // ── 3. UPDATE DRAFT ──────────────────────────────────────────────────────────

  /**
   * Update an existing Manual Journal voucher in DRAFT status.
   * If voucher is not in DRAFT status, modification is strictly blocked.
   */
  static async updateDraft(
    params: UpdateManualJournalDraftServiceParams
  ): Promise<AccountingVoucherRow> {
    const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
      // 1. Fetch current voucher
      const current = await AccountingVoucherRepository.findById(
        params.voucherId,
        params.branchId,
        client
      );
      if (!current) {
        throw new ManualJournalDomainError(
          "VOUCHER_NOT_FOUND",
          `Manual journal voucher '${params.voucherId}' not found.`
        );
      }

      // 2. Immutability guard: only DRAFT may be modified
      if (current.status !== "DRAFT") {
        throw new ManualJournalDomainError(
          "INVALID_VOUCHER_STATE",
          `Cannot edit manual journal in status '${current.status}'. Only DRAFT vouchers may be edited.`
        );
      }

      // 3. Validate new voucher date if changed
      const targetDate = params.voucherDate || current.voucher_date;
      if (params.voucherDate && params.voucherDate !== current.voucher_date) {
        try {
          await PostingService.validateAccountingStartDate(targetDate, client);
          await PostingService.validateFiscalPeriod(targetDate, client);
        } catch (err: any) {
          throw new ManualJournalDomainError(err.code || "FISCAL_PERIOD_LOCKED", err.message);
        }
      }

      // 4. Validate accounts and party dimensions if lines are updated
      let sanitizedLines: ManualJournalLineItem[] | undefined;
      if (params.lines) {
        const validated = await ManualJournalService.validateAccountsAndParties(
          params.lines,
          client
        );
        sanitizedLines = validated.sanitizedLines;
      }

      // 5. Update draft via repository
      try {
        return await AccountingVoucherRepository.updateManualJournalDraft(
          {
            voucher_id: params.voucherId,
            voucher_date: params.voucherDate,
            narration: params.narration,
            lines: sanitizedLines,
            updated_by: params.updatedBy,
            branch_id: params.branchId,
          },
          client
        );
      } catch (err: any) {
        if (err instanceof ManualJournalDomainError) throw err;
        throw new ManualJournalDomainError("OPERATION_FAILED", err.message);
      }
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  // ── 4. SUBMIT DRAFT ──────────────────────────────────────────────────────────

  /**
   * Transition manual journal from DRAFT to SUBMITTED.
   * Preserves maker identity and audit timestamps.
   */
  static async submitDraft(
    params: SubmitManualJournalServiceParams
  ): Promise<AccountingVoucherRow> {
    const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
      const current = await AccountingVoucherRepository.findById(
        params.voucherId,
        params.branchId,
        client
      );
      if (!current) {
        throw new ManualJournalDomainError(
          "VOUCHER_NOT_FOUND",
          `Manual journal voucher '${params.voucherId}' not found.`
        );
      }

      if (current.status !== "DRAFT") {
        throw new ManualJournalDomainError(
          "INVALID_VOUCHER_STATE",
          `Cannot submit manual journal in status '${current.status}'. Only DRAFT vouchers may be submitted.`
        );
      }

      try {
        return await AccountingVoucherRepository.submit(
          params.voucherId,
          params.submittedBy,
          current.branch_id,
          client
        );
      } catch (err: any) {
        throw new ManualJournalDomainError("OPERATION_FAILED", err.message);
      }
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  // ── 5. APPROVE DRAFT ─────────────────────────────────────────────────────────

  /**
   * Transition manual journal from SUBMITTED to APPROVED.
   * Strictly enforces Segregation of Duties: approved_by !== created_by.
   */
  static async approveDraft(
    params: ApproveManualJournalServiceParams
  ): Promise<AccountingVoucherRow> {
    const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
      const current = await AccountingVoucherRepository.findById(
        params.voucherId,
        params.branchId,
        client
      );
      if (!current) {
        throw new ManualJournalDomainError(
          "VOUCHER_NOT_FOUND",
          `Manual journal voucher '${params.voucherId}' not found.`
        );
      }

      if (current.status !== "SUBMITTED") {
        throw new ManualJournalDomainError(
          "INVALID_VOUCHER_STATE",
          `Cannot approve manual journal in status '${current.status}'. Only SUBMITTED vouchers may be approved.`
        );
      }

      // Segregation of Duties (SoD) verification
      if (current.created_by === params.approvedBy) {
        throw new ManualJournalDomainError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Staff '${params.approvedBy}' cannot approve their own manual journal voucher '${current.voucher_no}'.`
        );
      }

      try {
        return await AccountingVoucherRepository.approve(
          params.voucherId,
          params.approvedBy,
          current.branch_id,
          client
        );
      } catch (err: any) {
        const msg = err.message || String(err);
        if (msg.includes("Segregation of Duties") || msg.includes("chk_voucher_segregation")) {
          throw new ManualJournalDomainError("SEGREGATION_OF_DUTIES_VIOLATION", msg);
        }
        throw new ManualJournalDomainError("OPERATION_FAILED", msg);
      }
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  // ── 6. POST TO GENERAL LEDGER ────────────────────────────────────────────────

  /**
   * Commit an APPROVED manual journal voucher to the General Ledger.
   * Uses canonical PostingService inside an atomic PostgreSQL transaction with row-level locking.
   * Converts proposed metadata.lines into authoritative accounting_journal_entry and accounting_journal_line.
   */
  static async postToGL(
    params: PostManualJournalServiceParams
  ): Promise<PostManualJournalResult> {
    const execute = async (client: PoolClient): Promise<PostManualJournalResult> => {
      // 1. Lock voucher row exclusively
      const lockSql = `
        SELECT * FROM public.accounting_voucher
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
      `;
      const lockRes = await client.query<AccountingVoucherRow>(lockSql, [params.voucherId]);
      const voucher = lockRes.rows[0];

      if (!voucher) {
        throw new ManualJournalDomainError(
          "VOUCHER_NOT_FOUND",
          `Manual journal voucher '${params.voucherId}' not found.`
        );
      }

      // Branch isolation check
      if (params.branchId && voucher.branch_id !== params.branchId) {
        throw new ManualJournalDomainError(
          "BRANCH_ACCESS_DENIED",
          `Access denied: voucher belongs to branch '${voucher.branch_id}', not '${params.branchId}'.`
        );
      }

      // State check
      if (voucher.status === "POSTED") {
        throw new ManualJournalDomainError(
          "VOUCHER_ALREADY_POSTED",
          `Manual journal voucher '${voucher.voucher_no}' is already posted and immutable.`
        );
      }

      if (voucher.status !== "APPROVED") {
        throw new ManualJournalDomainError(
          "INVALID_VOUCHER_STATE",
          `Cannot post manual journal in status '${voucher.status}'. Only APPROVED vouchers can be posted.`
        );
      }

      // Segregation of Duties: Poster cannot be Maker
      if (voucher.created_by === params.postedBy) {
        throw new ManualJournalDomainError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Staff '${params.postedBy}' created voucher '${voucher.voucher_no}' and cannot post it to the General Ledger.`
        );
      }

      // 2. Extract proposed lines from metadata
      const meta = voucher.metadata as Record<string, unknown> | null;
      const proposedLines = (meta?.lines as ManualJournalLineItem[]) || [];

      if (!proposedLines || proposedLines.length < 2) {
        throw new ManualJournalDomainError(
          "JOURNAL_LINE_INVALID",
          `Manual journal voucher '${voucher.voucher_no}' has no valid proposed lines in metadata.`
        );
      }

      // 3. Convert proposed lines into canonical JournalLineInput[]
      const accountIds = proposedLines.map((l) => l.account_id);
      const accountMap = await AccountingAccountRepository.validatePostingAccounts(accountIds, client);

      const glLines: JournalLineInput[] = proposedLines.map((l, idx) => {
        const account = accountMap.get(l.account_id);
        const policy = account ? AccountGovernanceService.getCostCentrePolicy(account) : "PROHIBITED";
        // Inherit voucher-level cost centre only if account permits cost centres (not PROHIBITED)
        const effectiveCostCentreId =
          l.cost_centre_id !== undefined && l.cost_centre_id !== null && l.cost_centre_id !== ""
            ? l.cost_centre_id
            : policy !== "PROHIBITED"
            ? voucher.cost_centre_id || null
            : null;

        return {
          account_id: l.account_id,
          debit_amount: l.debit_amount,
          credit_amount: l.credit_amount,
          branch_id: l.branch_id || voucher.branch_id,
          customer_id: l.customer_id || null,
          supplier_id: l.supplier_id || null,
          cost_centre_id: effectiveCostCentreId,
          tax_rate: l.tax_rate ?? null,
          tax_class: l.tax_class ?? null,
          narration: l.narration || voucher.narration,
          metadata: {
            line_no: l.line_no || idx + 1,
            is_manual: true,
          },
        };
      });

      // 4. Post via canonical PostingService
      const postRes = await PostingService.postVoucher({
        voucherId: voucher.id,
        postedBy: params.postedBy,
        lines: glLines,
        branchId: params.branchId,
        client,
      });

      if (!postRes.success) {
        const errCode =
          postRes.code === "SEGREGATION_OF_DUTIES_VIOLATION" ? "SEGREGATION_OF_DUTIES_VIOLATION"
          : postRes.code === "FISCAL_PERIOD_LOCKED" ? "FISCAL_PERIOD_LOCKED"
          : postRes.code === "FISCAL_PERIOD_NOT_CONFIGURED" ? "FISCAL_PERIOD_NOT_CONFIGURED"
          : postRes.code === "POSTING_BEFORE_ACCOUNTING_START_DATE" ? "POSTING_BEFORE_ACCOUNTING_START_DATE"
          : postRes.code === "GROUP_ACCOUNT_NOT_POSTABLE" ? "GROUP_ACCOUNT_NOT_POSTABLE"
          : postRes.code === "POSTING_ACCOUNT_INVALID" ? "POSTING_ACCOUNT_INVALID"
          : "OPERATION_FAILED";

        throw new ManualJournalDomainError(errCode, postRes.error);
      }

      return postRes.data;
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  // ── 7. CANCEL VOUCHER ────────────────────────────────────────────────────────

  /**
   * Cancel a DRAFT, SUBMITTED, or APPROVED manual journal voucher.
   * POSTED vouchers cannot be cancelled (must be reversed).
   */
  static async cancel(
    params: CancelManualJournalServiceParams
  ): Promise<AccountingVoucherRow> {
    const execute = async (client: PoolClient): Promise<AccountingVoucherRow> => {
      const current = await AccountingVoucherRepository.findById(
        params.voucherId,
        params.branchId,
        client
      );
      if (!current) {
        throw new ManualJournalDomainError(
          "VOUCHER_NOT_FOUND",
          `Manual journal voucher '${params.voucherId}' not found.`
        );
      }

      if (current.status === "POSTED") {
        throw new ManualJournalDomainError(
          "INVALID_VOUCHER_STATE",
          `Cannot cancel posted voucher '${current.voucher_no}'. Posted vouchers are immutable and must be reversed.`
        );
      }

      try {
        return await AccountingVoucherRepository.cancel(
          params.voucherId,
          params.cancelledBy,
          current.branch_id,
          client
        );
      } catch (err: any) {
        throw new ManualJournalDomainError("OPERATION_FAILED", err.message);
      }
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  // ── 8. REVERSE POSTED JOURNAL ────────────────────────────────────────────────

  /**
   * Post a compensating reversal voucher for an existing POSTED manual journal.
   * Strictly enforces:
   * - Original voucher must be POSTED.
   * - Cannot reverse an already reversed voucher.
   * - Cannot reverse a reversal voucher (no chained reversals).
   * - Inverts original debits and credits.
   * - Links vouchers and sets is_reversed = true on original journal entry.
   */
  static async reverse(
    params: ReverseManualJournalServiceParams
  ): Promise<ReverseManualJournalResult> {
    const execute = async (client: PoolClient): Promise<ReverseManualJournalResult> => {
      // 1. Lock original voucher exclusively
      const lockSql = `
        SELECT * FROM public.accounting_voucher
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
      `;
      const lockRes = await client.query<AccountingVoucherRow>(lockSql, [params.voucherId]);
      const original = lockRes.rows[0];

      if (!original) {
        throw new ManualJournalDomainError(
          "VOUCHER_NOT_FOUND",
          `Manual journal voucher '${params.voucherId}' not found.`
        );
      }

      // Branch scope check
      if (params.branchId && original.branch_id !== params.branchId) {
        throw new ManualJournalDomainError(
          "BRANCH_ACCESS_DENIED",
          `Access denied: voucher belongs to branch '${original.branch_id}', not '${params.branchId}'.`
        );
      }

      // Status check: only POSTED can be reversed
      if (original.status !== "POSTED") {
        throw new ManualJournalDomainError(
          "INVALID_VOUCHER_STATE",
          `Cannot reverse voucher '${original.voucher_no}' with status '${original.status}'. Only POSTED vouchers can be reversed.`
        );
      }

      // Reversal limit checks
      if (original.reversed_by_voucher_id) {
        throw new ManualJournalDomainError(
          "REVERSAL_VIOLATION",
          `Voucher '${original.voucher_no}' has already been reversed by voucher '${original.reversed_by_voucher_id}'.`
        );
      }

      if (original.reversal_of_voucher_id) {
        throw new ManualJournalDomainError(
          "REVERSAL_VIOLATION",
          `Voucher '${original.voucher_no}' is itself a reversal voucher and cannot be reversed (chk_voucher_reversal_limit).`
        );
      }

      // SoD for reversal: creator cannot reverse own voucher
      if (original.created_by === params.reversedBy) {
        throw new ManualJournalDomainError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Staff '${params.reversedBy}' created voucher '${original.voucher_no}' and cannot reverse it.`
        );
      }

      // 2. Validate reversal date against accounting start date and open fiscal period
      try {
        await PostingService.validateAccountingStartDate(params.reversalDate, client);
      } catch (err: any) {
        throw new ManualJournalDomainError(err.code || "POSTING_BEFORE_ACCOUNTING_START_DATE", err.message);
      }

      let reversalFiscalYear: string;
      try {
        const period = await PostingService.validateFiscalPeriod(params.reversalDate, client);
        reversalFiscalYear = period.fiscal_year;
      } catch (err: any) {
        throw new ManualJournalDomainError(err.code || "FISCAL_PERIOD_LOCKED", err.message);
      }

      // 3. Fetch original authoritative journal entry and lines from DB
      const origJe = await AccountingJournalRepository.findByVoucherId(original.id, client);
      if (!origJe) {
        throw new ManualJournalDomainError(
          "JOURNAL_LINE_INVALID",
          `No posted journal entry found for voucher '${original.voucher_no}'.`
        );
      }

      const origLines = await AccountingJournalRepository.findLinesByEntryId(origJe.id, client);
      if (!origLines || origLines.length < 2) {
        throw new ManualJournalDomainError(
          "JOURNAL_LINE_INVALID",
          `Original journal entry '${origJe.entry_no}' has missing or invalid lines.`
        );
      }

      // 4. Invert lines: original Debit becomes Credit, original Credit becomes Debit
      const invertedGlLines: JournalLineInput[] = origLines.map((l, idx) => ({
        account_id: l.account_id,
        debit_amount: Number(l.credit_amount),
        credit_amount: Number(l.debit_amount),
        branch_id: l.branch_id || original.branch_id,
        customer_id: l.customer_id || null,
        supplier_id: l.supplier_id || null,
        tax_rate: l.tax_rate ?? null,
        tax_class: l.tax_class ?? null,
        narration: `Reversal of line ${l.line_no}: ${l.narration || original.narration}`,
        metadata: {
          line_no: idx + 1,
          original_line_id: l.id,
          is_reversal_line: true,
        },
      }));

      const invertedProposedLines: ManualJournalLineItem[] = origLines.map((l, idx) => ({
        line_no: idx + 1,
        account_id: l.account_id,
        debit_amount: Number(l.credit_amount),
        credit_amount: Number(l.debit_amount),
        branch_id: l.branch_id || original.branch_id,
        customer_id: l.customer_id || null,
        supplier_id: l.supplier_id || null,
        narration: `Reversal of line ${l.line_no}: ${l.narration || original.narration}`,
      }));

      // 5. Create compensating reversal voucher in APPROVED status
      // Use 'system_reversal_engine' as creator to strictly satisfy chk_voucher_segregation
      // when approved_by is set to params.reversedBy
      const reversalInput = {
        voucher_type: "JOURNAL" as const,
        voucher_date: params.reversalDate,
        branch_id: original.branch_id,
        narration: `Reversal of ${original.voucher_no}: ${params.reason.trim()}`,
        reference_type: "MANUAL_REVERSAL",
        reference_id: original.id,
        reversal_of_voucher_id: original.id,
        metadata: {
          is_manual_journal: true,
          is_reversal: true,
          original_voucher_id: original.id,
          original_voucher_no: original.voucher_no,
          reversal_reason: params.reason.trim(),
          lines: invertedProposedLines,
          total_amount: Number(original.total_amount),
        },
      };

      const reversalVoucherDraft = await AccountingVoucherRepository.createDraft(
        reversalInput,
        original.branch_id,
        reversalFiscalYear,
        "system_reversal_engine",
        client
      );

      // Auto-approve reversal voucher for atomic posting
      await client.query(
        `UPDATE public.accounting_voucher
         SET status = 'APPROVED',
             submitted_by = 'system_reversal_engine',
             submitted_at = NOW(),
             approved_by = $1,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [params.reversedBy, reversalVoucherDraft.id]
      );

      // 6. Post compensating voucher to GL via canonical PostingService
      const postRes = await PostingService.postVoucher({
        voucherId: reversalVoucherDraft.id,
        postedBy: params.reversedBy,
        lines: invertedGlLines,
        branchId: original.branch_id,
        client,
      });

      if (!postRes.success) {
        throw new ManualJournalDomainError(
          "OPERATION_FAILED",
          `Failed to post compensating reversal voucher: ${postRes.error}`
        );
      }

      // 7. Establish canonical bidirectional reversal linkages
      const updatedOriginal = await PostingService.linkReversal(
        {
          originalVoucherId: original.id,
          reversalVoucherId: reversalVoucherDraft.id,
          reversedBy: params.reversedBy,
          branchId: original.branch_id,
        },
        client
      );

      return {
        original_voucher: updatedOriginal,
        reversal_voucher: postRes.data.voucher,
        journal_entry: postRes.data.journal_entry,
      };
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  // ── 9. RETRIEVAL QUERIES ─────────────────────────────────────────────────────

  /**
   * Fetch full manual journal details including proposed workflow lines and authoritative GL lines.
   */
  static async getDetail(
    id: string,
    branchId?: string
  ): Promise<ManualJournalDetailResult | null> {
    return AccountingVoucherRepository.findManualJournalDetail(id, branchId);
  }

  /**
   * List Manual Journal vouchers with server-side pagination, branch scoping, and search.
   */
  static async list(
    filters: ManualJournalListFilters = {}
  ): Promise<ManualJournalListResult> {
    return AccountingVoucherRepository.listManualJournals(filters);
  }
}
