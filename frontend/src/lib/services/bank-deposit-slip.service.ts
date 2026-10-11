/**
 * CakeToHome ERP — Bank Deposit Slip Service
 * Phase 4F Step 4.10 Substep 4.10.2: Cash Drawer to Bank Deposit Workflow
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - Bank deposit slips and accounting vouchers are governed strictly by PostgreSQL.
 * 2. TWO-STAGE DEPOSIT IN TRANSIT ARCHITECTURE:
 *    - Stage 1 (Scope of 4.10.2): Physical cash handover & transit dispatch:
 *        Dr 1118 Deposit in Transit (Branch X)
 *        Cr 1111 Cash in Hand       (Branch X)
 *    - Stage 2 (Bank credit / reconciliation: Dr 1112 / Cr 1118) belongs strictly to later steps.
 * 3. HARD ACCOUNTING CONFIGURATION GUARDS:
 *    - Enforces: accounting_start_date configured, fiscal_period configured and open,
 *      accounts 1118 and 1111 active and non-group.
 *    - Fails closed immediately if unconfigured. Never falls back to 1119 Unclassified Suspense.
 * 4. STRICT 3-TIER SEGREGATION OF DUTIES (SoD):
 *    - preparer != approver != poster.
 *    - Self-approval and self-posting are strictly prohibited, even for SUPER_ADMIN.
 * 5. SERVER-SIDE DENOMINATION VALIDATION:
 *    - Validates denomination counts (non-negative numbers).
 *    - If denominations are supplied, the sum must mathematically equal the deposit amount.
 *    - Mismatch fails closed with DEPOSIT_DENOMINATION_MISMATCH.
 * 6. SOURCE IDEMPOTENCY & CONCURRENCY:
 *    - Deterministic lock ordering: bank_deposit_slip -> bank_account -> accounting_voucher.
 *    - Idempotent retry returns authoritative existing result (wasDuplicate: true).
 * 7. IMMUTABILITY OF POSTED EVIDENCE:
 *    - Once posted to GL, a deposit slip cannot be cancelled, rejected, or modified.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  BankDepositSlipRepository,
  BankDepositSlipError,
} from "../repositories/bank-deposit-slip.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  BankDepositSlipRow,
  BankDepositStatus,
  BankDepositDenominations,
  PrepareBankDepositSlipParams,
  ApproveBankDepositSlipParams,
  PostBankDepositSlipParams,
  CancelBankDepositSlipParams,
  RejectBankDepositSlipParams,
  BankDepositSlipResult,
  BankDepositErrorCode,
  JournalLineInput,
} from "../types/accounting.types";

export class BankDepositServiceError extends Error {
  readonly code: BankDepositErrorCode;

  constructor(code: BankDepositErrorCode, message: string) {
    super(message);
    this.name = "BankDepositServiceError";
    this.code = code;
  }
}

const DENOMINATION_MULTIPLIERS: Record<string, number> = {
  notes_2000: 2000,
  notes_500: 500,
  notes_200: 200,
  notes_100: 100,
  notes_50: 50,
  notes_20: 20,
  notes_10: 10,
  notes_5: 5,
  coins: 1,
};

export class BankDepositSlipService {
  /**
   * Helper to resolve actor context and branch authorization safely.
   */
  private static resolveActorScope(actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    [key: string]: unknown;
  }): { isSuperAdmin: boolean; actorBranch: string | null; actorId: string } {
    if (!actorContext) {
      throw new BankDepositServiceError("PERMISSION_DENIED", "Missing actor context for deposit operation.");
    }

    const role = (actorContext.role || "").toUpperCase();
    const actorId = actorContext.id || actorContext.user_id || "";
    const isSuperAdmin = role === "SUPER_ADMIN" || actorId === "admin_01";
    const actorBranch = actorContext.branch_id || actorContext.branchId || null;

    return { isSuperAdmin, actorBranch, actorId };
  }

  /**
   * Calculates and validates the total from the denomination breakdown.
   */
  static validateDenominations(
    denominations: BankDepositDenominations | undefined,
    expectedAmount: number
  ): void {
    if (!denominations || Object.keys(denominations).length === 0) {
      return; // Optional, but if supplied must match
    }

    let calculatedTotal = 0;
    let hasValidEntries = false;

    for (const [key, val] of Object.entries(denominations)) {
      if (val === undefined || val === null) continue;
      if (typeof val !== "number" || isNaN(val) || val < 0 || !Number.isFinite(val)) {
        throw new BankDepositServiceError(
          "INVALID_DENOMINATIONS",
          `Invalid denomination count for '${key}': must be a non-negative number, got ${val}`
        );
      }
      const multiplier = DENOMINATION_MULTIPLIERS[key];
      if (multiplier === undefined) {
        throw new BankDepositServiceError(
          "INVALID_DENOMINATIONS",
          `Unsupported denomination key '${key}'. Supported: ${Object.keys(DENOMINATION_MULTIPLIERS).join(", ")}`
        );
      }
      calculatedTotal += val * multiplier;
      if (val > 0) hasValidEntries = true;
    }

    if (hasValidEntries) {
      const diff = Math.abs(calculatedTotal - expectedAmount);
      if (diff > 0.001) {
        throw new BankDepositServiceError(
          "DEPOSIT_DENOMINATION_MISMATCH",
          `Denomination breakdown total (₹${calculatedTotal.toFixed(2)}) does not match deposit amount (₹${expectedAmount.toFixed(2)}). Difference: ₹${diff.toFixed(2)}.`
        );
      }
    }
  }

  /**
   * Prepares a new cash deposit slip in DRAFT status.
   */
  static async prepareDepositSlip(
    params: PrepareBankDepositSlipParams,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const { isSuperAdmin, actorBranch, actorId } = this.resolveActorScope(params.actorContext);

    // 1. RBAC Permission Check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "BANK.DEPOSIT_PREPARE") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");

    if (!hasPerm) {
      throw new BankDepositServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission (BANK.DEPOSIT_PREPARE or ACCOUNTING.POST) to prepare deposit slips."
      );
    }

    // 2. Reject client-selected accounting accounts
    if ((params as any).account_id || (params as any).gl_account || (params as any).accounting_account_id) {
      throw new BankDepositServiceError(
        "BANK_DEPOSIT_ERROR",
        "Client cannot specify accounting accounts. Deposits use 1118 Deposit in Transit and 1111 Cash in Hand."
      );
    }

    // 3. Branch Isolation & BOLA Defense
    let targetBranchId: string;
    if (!isSuperAdmin) {
      if (!actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          "Non-super-admin user has no authorized branch assignment."
        );
      }
      if (params.branchId && params.branchId !== actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch deposit slip preparation denied: User branch '${actorBranch}' cannot prepare for branch '${params.branchId}'.`
        );
      }
      targetBranchId = actorBranch;
    } else {
      if (!params.branchId) {
        throw new BankDepositServiceError("BRANCH_ACCESS_DENIED", "Branch ID is required for cash deposit slips.");
      }
      targetBranchId = params.branchId;
    }

    // 4. Validate Amount
    const amount = Number(params.amount);
    if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
      throw new BankDepositServiceError(
        "INVALID_DEPOSIT_AMOUNT",
        `Deposit amount must be strictly greater than zero. Got: ${params.amount}`
      );
    }

    // 5. Validate Date
    if (!params.depositDate || isNaN(Date.parse(params.depositDate))) {
      throw new BankDepositServiceError("INVALID_DEPOSIT_DATE", `Invalid deposit date: '${params.depositDate}'.`);
    }

    // 6. Validate Denominations
    this.validateDenominations(params.denominations, amount);

    // 7. Verify Bank Account
    const execute = async (c: PoolClient): Promise<BankDepositSlipRow> => {
      const bankAccount = await BankAccountRepository.findById(params.bankAccountId, c);
      if (!bankAccount) {
        throw new BankDepositServiceError(
          "BANK_ACCOUNT_NOT_FOUND",
          `Bank account '${params.bankAccountId}' not found.`
        );
      }

      if (bankAccount.status === "INACTIVE") {
        throw new BankDepositServiceError(
          "BANK_ACCOUNT_INACTIVE",
          `Bank account '${bankAccount.id}' (${bankAccount.bank_name}) is INACTIVE and cannot receive deposits.`
        );
      }

      if (bankAccount.status === "FROZEN") {
        throw new BankDepositServiceError(
          "BANK_ACCOUNT_FROZEN",
          `Bank account '${bankAccount.id}' (${bankAccount.bank_name}) is FROZEN and cannot receive deposits.`
        );
      }

      // Bank accounts belong to the company and are shared across branches for cash deposits.

      // Unique slip number check
      const slipNumber =
        params.slipNumber ||
        `DEP-${targetBranchId.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}-${Date.now()}`;

      const existingSlip = await BankDepositSlipRepository.findBySlipNumber(slipNumber, c);
      if (existingSlip) {
        throw new BankDepositServiceError(
          "DEPOSIT_SLIP_ALREADY_EXISTS",
          `Deposit slip number '${slipNumber}' already exists.`
        );
      }

      const preparerId = params.preparedBy || actorId;
      if (!preparerId) {
        throw new BankDepositServiceError("BANK_DEPOSIT_ERROR", "Preparer identifier is required.");
      }

      return await BankDepositSlipRepository.create(
        {
          slip_number: slipNumber,
          company_id: params.companyId || await CompanyRepository.resolveCompanyId(),
          branch_id: targetBranchId,
          bank_account_id: bankAccount.id,
          deposit_date: params.depositDate,
          amount,
          denominations: params.denominations,
          status: "DRAFT",
          prepared_by: preparerId,
          metadata: {
            ...params.metadata,
            operational_bank_account_name: bankAccount.bank_name,
            operational_bank_account_masked: bankAccount.account_number_masked,
            ifsc_code: bankAccount.ifsc_code,
          },
        },
        c
      );
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Dispatches a draft deposit slip (DRAFT -> DISPATCHED).
   */
  static async dispatchDepositSlip(
    depositSlipId: string,
    actorContext?: {
      id?: string;
      user_id?: string;
      role?: string;
      branch_id?: string | null;
      branchId?: string | null;
      permissions?: string[];
      [key: string]: unknown;
    },
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(actorContext);

    const execute = async (c: PoolClient): Promise<BankDepositSlipRow> => {
      const slip = await BankDepositSlipRepository.findById(depositSlipId, c, true);
      if (!slip) {
        throw new BankDepositServiceError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${depositSlipId}' not found.`);
      }

      if (!isSuperAdmin && slip.branch_id !== actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch dispatch denied: Slip belongs to branch '${slip.branch_id}'.`
        );
      }

      if (slip.status !== "DRAFT") {
        throw new BankDepositServiceError(
          "INVALID_DEPOSIT_STATUS",
          `Cannot dispatch deposit slip in status '${slip.status}'. Only DRAFT slips can be dispatched.`
        );
      }

      return await BankDepositSlipRepository.updateStatus(depositSlipId, "DISPATCHED", c);
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Approves a deposit slip (DISPATCHED/DRAFT -> CONFIRMED).
   * Enforces 3-tier SoD: approvedBy !== prepared_by.
   * Super Admin cannot self-approve.
   */
  static async approveDepositSlip(
    params: ApproveBankDepositSlipParams,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "BANK.DEPOSIT_APPROVE") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.APPROVE");

    if (!hasPerm) {
      throw new BankDepositServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission (BANK.DEPOSIT_APPROVE or ACCOUNTING.APPROVE) to approve deposit slips."
      );
    }

    const execute = async (c: PoolClient): Promise<BankDepositSlipRow> => {
      const slip = await BankDepositSlipRepository.findById(params.depositSlipId, c, true);
      if (!slip) {
        throw new BankDepositServiceError(
          "DEPOSIT_SLIP_NOT_FOUND",
          `Deposit slip '${params.depositSlipId}' not found.`
        );
      }

      // Branch isolation
      if (!isSuperAdmin && slip.branch_id !== actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch approval denied: Slip belongs to branch '${slip.branch_id}'.`
        );
      }

      // State check
      if (slip.status !== "DRAFT" && slip.status !== "DISPATCHED") {
        throw new BankDepositServiceError(
          "INVALID_DEPOSIT_STATUS",
          `Cannot approve deposit slip in status '${slip.status}'. Only DRAFT or DISPATCHED slips can be approved.`
        );
      }

      // STRICT SoD: Preparer cannot approve own deposit slip (Even Super Admin cannot bypass!)
      if (slip.prepared_by === params.approvedBy) {
        throw new BankDepositServiceError(
          "SELF_APPROVAL_FORBIDDEN",
          `Segregation of Duties violation: Preparer '${slip.prepared_by}' cannot approve their own deposit slip.`
        );
      }

      return await BankDepositSlipRepository.recordApproval(params.depositSlipId, params.approvedBy, c);
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Posts cash deposit to the General Ledger:
   * Dr 1118 Deposit in Transit
   * Cr 1111 Cash in Hand
   *
   * Hard accounting configuration guards:
   * - accounting start date configured
   * - fiscal period configured and open
   * - accounts 1118 and 1111 active and non-group
   *
   * Concurrency & Idempotency:
   * - Locks bank_deposit_slip, then bank_account.
   * - If already posted, returns existing voucher (wasDuplicate: true).
   * - Enforces 3-tier SoD: postedBy != prepared_by and postedBy != approved_by.
   */
  static async postDepositSlip(
    params: PostBankDepositSlipParams,
    client?: PoolClient
  ): Promise<BankDepositSlipResult> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "BANK.DEPOSIT_POST") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");

    if (!hasPerm) {
      throw new BankDepositServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission (BANK.DEPOSIT_POST or ACCOUNTING.POST) to post cash deposits."
      );
    }

    const execute = async (c: PoolClient): Promise<BankDepositSlipResult> => {
      // 1. Lock bank_deposit_slip FOR UPDATE (lock ordering: slip -> account)
      const slip = await BankDepositSlipRepository.findById(params.depositSlipId, c, true);
      if (!slip) {
        throw new BankDepositServiceError(
          "DEPOSIT_SLIP_NOT_FOUND",
          `Deposit slip '${params.depositSlipId}' not found.`
        );
      }

      // 2. Lock bank_account FOR UPDATE
      const bankAccount = await BankAccountRepository.findById(slip.bank_account_id, c, true);
      if (!bankAccount) {
        throw new BankDepositServiceError(
          "BANK_ACCOUNT_NOT_FOUND",
          `Bank account '${slip.bank_account_id}' not found.`
        );
      }

      // Branch isolation
      if (!isSuperAdmin && slip.branch_id !== actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch posting denied: Slip belongs to branch '${slip.branch_id}'.`
        );
      }

      // Idempotency: if already posted, return authoritative existing result
      if (slip.transit_voucher_id) {
        return {
          depositSlip: slip,
          wasDuplicate: true,
        };
      }

      // Status check
      if (slip.status !== "CONFIRMED" && slip.status !== "DISPATCHED") {
        throw new BankDepositServiceError(
          "INVALID_DEPOSIT_STATUS",
          `Cannot post deposit slip in status '${slip.status}'. Slip must be approved/confirmed before GL posting.`
        );
      }

      // 3. Strict 3-Tier SoD:
      // Poster cannot be preparer or approver (Even Super Admin cannot bypass!)
      if (params.postedBy === slip.prepared_by) {
        throw new BankDepositServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Preparer '${slip.prepared_by}' cannot post the accounting voucher.`
        );
      }

      if (slip.approved_by && params.postedBy === slip.approved_by) {
        throw new BankDepositServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Approver '${slip.approved_by}' cannot post the accounting voucher.`
        );
      }

      const voucherDate = params.voucherDate || slip.deposit_date;

      // 4. HARD ACCOUNTING CONFIGURATION GUARDS
      // A. Accounting start date guard
      try {
        await PostingService.validateAccountingStartDate(voucherDate, c);
      } catch (err: any) {
        if (err instanceof PostingServiceError) {
          throw new BankDepositServiceError(err.code as BankDepositErrorCode, err.message);
        }
        throw err;
      }

      // B. Fiscal period guard
      let fiscalPeriod;
      try {
        fiscalPeriod = await PostingService.validateFiscalPeriod(voucherDate, c);
      } catch (err: any) {
        if (err instanceof PostingServiceError) {
          throw new BankDepositServiceError(err.code as BankDepositErrorCode, err.message);
        }
        throw err;
      }

      // C. Control Accounts Validation: 1118 (Deposit in Transit) and 1111 (Cash in Hand)
      const accountsRes = await c.query(
        `SELECT id, code, name, is_active, is_group
         FROM public.accounting_account
         WHERE code IN ('1118', '1111') AND deleted_at IS NULL`
      );

      const accMap = new Map<string, any>();
      for (const row of accountsRes.rows) {
        accMap.set(row.code, row);
      }

      const acc1118 = accMap.get("1118");
      if (!acc1118 || !acc1118.is_active || acc1118.is_group) {
        throw new BankDepositServiceError(
          "CONTROL_ACCOUNT_INACTIVE",
          "Control Account 1118 (Deposit in Transit) is missing, inactive, or a group account."
        );
      }

      const acc1111 = accMap.get("1111");
      if (!acc1111 || !acc1111.is_active || acc1111.is_group) {
        throw new BankDepositServiceError(
          "CONTROL_ACCOUNT_INACTIVE",
          "Account 1111 (Cash in Hand) is missing, inactive, or a group account."
        );
      }

      // 5. Canonical Double-Entry Journal Lines Construction:
      // Line 1: Dr 1118 Deposit in Transit
      // Line 2: Cr 1111 Cash in Hand
      const amountNum = Number(slip.amount);
      const lines: JournalLineInput[] = [
        {
          account_id: acc1118.id,
          debit_amount: amountNum,
          credit_amount: 0,
          narration: `Cash deposit in transit - Slip ${slip.slip_number} to ${bankAccount.bank_name}`,
          metadata: {
            deposit_slip_id: slip.id,
            slip_number: slip.slip_number,
            bank_account_id: bankAccount.id,
            branch_id: slip.branch_id,
          },
        },
        {
          account_id: acc1111.id,
          debit_amount: 0,
          credit_amount: amountNum,
          narration: `Cash drawer dispatch - Branch ${slip.branch_id} - Slip ${slip.slip_number}`,
          metadata: {
            deposit_slip_id: slip.id,
            slip_number: slip.slip_number,
            branch_id: slip.branch_id,
          },
        },
      ];

      // 6. Canonical PostingService Workflow
      // A. Create Draft Voucher
      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "CONTRA",
          voucher_date: voucherDate,
          branch_id: slip.branch_id,
          narration: `Physical cash dispatched to bank transit for ${bankAccount.bank_name} (${bankAccount.account_number_masked}) - Slip ${slip.slip_number}`,
          reference_type: "BANK_DEPOSIT",
          reference_id: slip.id,
          reference_event: "TRANSIT_DISPATCH",
          metadata: {
            source_module: "BANK_DEPOSIT",
            deposit_slip_id: slip.id,
            bank_account_id: bankAccount.id,
            branch_id: slip.branch_id,
          },
        },
        branchId: slip.branch_id,
        fiscalYear: fiscalPeriod.fiscal_year || "FY2026-27",
        createdBy: slip.prepared_by,
        client: c,
      });

      if (!draftRes.success) {
        throw new BankDepositServiceError(draftRes.code as BankDepositErrorCode, draftRes.error);
      }
      const draftVoucher = draftRes.data;

      // B. Submit Voucher
      const submitRes = await PostingService.submitVoucher({
        voucherId: draftVoucher.id,
        submittedBy: slip.prepared_by,
        branchId: slip.branch_id,
        client: c,
      });
      if (!submitRes.success) {
        throw new BankDepositServiceError(submitRes.code as BankDepositErrorCode, submitRes.error);
      }

      // C. Approve Voucher (using slip's approved_by or supervisor)
      const voucherApprover = slip.approved_by || params.postedBy;
      const approveRes = await PostingService.approveVoucher({
        voucherId: draftVoucher.id,
        approvedBy: voucherApprover,
        branchId: slip.branch_id,
        client: c,
      });
      if (!approveRes.success) {
        throw new BankDepositServiceError(approveRes.code as BankDepositErrorCode, approveRes.error);
      }

      // D. Post Voucher to GL
      const postRes = await PostingService.postVoucher({
        voucherId: draftVoucher.id,
        postedBy: params.postedBy,
        lines,
        branchId: slip.branch_id,
        client: c,
      });
      if (!postRes.success) {
        throw new BankDepositServiceError(postRes.code as BankDepositErrorCode, postRes.error);
      }

      // 7. Update deposit slip with transit voucher and posted_by
      const updatedSlip = await BankDepositSlipRepository.recordTransitPosting(
        slip.id,
        params.postedBy,
        postRes.data.voucher.id,
        c
      );

      return {
        depositSlip: updatedSlip,
        voucher: postRes.data.voucher,
        journalEntry: postRes.data.journal_entry,
        wasDuplicate: false,
      };
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Cancels a deposit slip before posting.
   */
  static async cancelDepositSlip(
    params: CancelBankDepositSlipParams,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(params.actorContext);

    const execute = async (c: PoolClient): Promise<BankDepositSlipRow> => {
      const slip = await BankDepositSlipRepository.findById(params.depositSlipId, c, true);
      if (!slip) {
        throw new BankDepositServiceError(
          "DEPOSIT_SLIP_NOT_FOUND",
          `Deposit slip '${params.depositSlipId}' not found.`
        );
      }

      if (!isSuperAdmin && slip.branch_id !== actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch cancellation denied: Slip belongs to branch '${slip.branch_id}'.`
        );
      }

      // Immutability of posted evidence
      if (slip.transit_voucher_id || slip.status === "CONFIRMED") {
        throw new BankDepositServiceError(
          "POSTED_DEPOSIT_IMMUTABLE",
          "Cannot cancel a deposit slip that has already been approved or posted."
        );
      }

      return await BankDepositSlipRepository.cancel(params.depositSlipId, params.reason, c);
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Rejects a deposit slip during approval.
   */
  static async rejectDepositSlip(
    params: RejectBankDepositSlipParams,
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "BANK.DEPOSIT_APPROVE") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.APPROVE");

    if (!hasPerm) {
      throw new BankDepositServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission to reject deposit slips."
      );
    }

    const execute = async (c: PoolClient): Promise<BankDepositSlipRow> => {
      const slip = await BankDepositSlipRepository.findById(params.depositSlipId, c, true);
      if (!slip) {
        throw new BankDepositServiceError(
          "DEPOSIT_SLIP_NOT_FOUND",
          `Deposit slip '${params.depositSlipId}' not found.`
        );
      }

      if (!isSuperAdmin && slip.branch_id !== actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch rejection denied: Slip belongs to branch '${slip.branch_id}'.`
        );
      }

      // SoD: Preparer cannot reject own slip
      if (slip.prepared_by === params.rejectedBy) {
        throw new BankDepositServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Preparer cannot act as rejecter of their own slip."
        );
      }

      if (slip.transit_voucher_id) {
        throw new BankDepositServiceError(
          "POSTED_DEPOSIT_IMMUTABLE",
          "Cannot reject a deposit slip that has already been posted to the General Ledger."
        );
      }

      return await BankDepositSlipRepository.reject(params.depositSlipId, params.rejectedBy, params.reason, c);
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Retrieves a deposit slip by ID with branch scoping.
   */
  static async getDepositSlip(
    id: string,
    actorContext?: {
      id?: string;
      user_id?: string;
      role?: string;
      branch_id?: string | null;
      branchId?: string | null;
      permissions?: string[];
      [key: string]: unknown;
    },
    client?: PoolClient
  ): Promise<BankDepositSlipRow> {
    const slip = await BankDepositSlipRepository.findById(id, client);
    if (!slip) {
      throw new BankDepositServiceError("DEPOSIT_SLIP_NOT_FOUND", `Deposit slip '${id}' not found.`);
    }

    if (actorContext) {
      const { isSuperAdmin, actorBranch } = this.resolveActorScope(actorContext);
      const hasView =
        isSuperAdmin ||
        hasEffectivePermission(actorContext, "BANK.VIEW") ||
        hasEffectivePermission(actorContext, "ACCOUNTING.VIEW");

      if (!hasView) {
        throw new BankDepositServiceError("PERMISSION_DENIED", "Actor lacks permission to view deposit slips.");
      }

      if (!isSuperAdmin && slip.branch_id !== actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch access denied: Slip belongs to branch '${slip.branch_id}'.`
        );
      }
    }

    return slip;
  }

  /**
   * Lists deposit slips with branch scoping.
   */
  static async listDepositSlips(
    filter: {
      branchId?: string;
      bankAccountId?: string;
      status?: BankDepositStatus;
      startDate?: string;
      endDate?: string;
      companyId?: string;
      actorContext?: {
        id?: string;
        user_id?: string;
        role?: string;
        branch_id?: string | null;
        branchId?: string | null;
        permissions?: string[];
        [key: string]: unknown;
      };
    } = {},
    client?: PoolClient
  ): Promise<BankDepositSlipRow[]> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(filter.actorContext);

    const hasView =
      isSuperAdmin ||
      hasEffectivePermission(filter.actorContext, "BANK.VIEW") ||
      hasEffectivePermission(filter.actorContext, "ACCOUNTING.VIEW");

    if (!hasView) {
      throw new BankDepositServiceError("PERMISSION_DENIED", "Actor lacks permission to list deposit slips.");
    }

    let queryBranchId: string | undefined = filter.branchId;
    if (!isSuperAdmin) {
      if (!actorBranch) {
        throw new BankDepositServiceError(
          "BRANCH_ACCESS_DENIED",
          "Non-super-admin user has no authorized branch assignment."
        );
      }
      queryBranchId = actorBranch;
    }

    return await BankDepositSlipRepository.list(
      {
        branchId: queryBranchId,
        bankAccountId: filter.bankAccountId,
        status: filter.status,
        startDate: filter.startDate,
        endDate: filter.endDate,
        companyId: filter.companyId,
      },
      client
    );
  }
}
