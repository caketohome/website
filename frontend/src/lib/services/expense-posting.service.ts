/**
 * CakeToHome ERP — Expense Posting Service
 * Phase C5: Canonical accounting integration for expenses.
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Follows canonical voucher lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED.
 * 2. Uses canonical PostingService primitives, row-level locks, and transaction boundaries.
 * 3. Atomic double-entry journal creation (Dr Expense, Dr Input Tax, Cr Cash/Bank/AP).
 * 4. Dual settlement models:
 *    - DIRECT_PAYMENT (Cash drawer via C4 Teller, Petty Cash 1114, or Bank Account GL).
 *    - CREDIT_ACCRUAL (Accounts Payable 2111 with supplier dimension, or Accruals 2150-2153).
 * 5. Indian GST statutory compliance:
 *    - ITC_ELIGIBLE: Debits Input Tax accounts (1141-1149).
 *    - ITC_INELIGIBLE: Capitalizes taxes directly into debit Expense account (Section 17(5)).
 *    - RCM_APPLICABLE: Credits Output Tax RCM liability (2121-2129), pays vendor net taxable.
 * 6. Strict Segregation of Duties (SoD):
 *    - created_by != approved_by (No Super Admin bypass).
 *    - created_by != posted_by (No Super Admin bypass).
 * 7. Fail-closed guards: Accounting start date and open fiscal period validation.
 */

import { dbTransaction, dbQuery } from "../db";
import type { PoolClient } from "pg";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { ExpenseRepository } from "../repositories/expense.repository";
import { TellerSessionRepository } from "../repositories/teller-session.repository";
import { TellerMovementService } from "./teller-movement.service";
import { PostingService, PostingServiceError } from "./posting.service";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingAccountRow,
  JournalLineInput,
} from "../types/accounting.types";
import type {
  ExpenseRow,
  ExpenseStatus,
} from "../types/expense.types";
import type { TellerSessionRow } from "../types/teller.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type ExpensePostingErrorCode =
  | "EXPENSE_NOT_FOUND"
  | "INVALID_EXPENSE_STATUS"
  | "EXPENSE_ALREADY_POSTED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "BRANCH_ACCESS_DENIED"
  | "CATEGORY_NOT_FOUND"
  | "GL_ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_INACTIVE"
  | "TELLER_SESSION_INVALID"
  | "TELLER_SESSION_NOT_FOUND"
  | "INVALID_SESSION_STATE"
  | "INSUFFICIENT_CASH_DRAWER_BALANCE"
  | "INSUFFICIENT_CASH_BALANCE"
  | "NO_AUTHORIZED_CASH_FLOAT"
  | "JOURNAL_UNBALANCED"
  | "POSTING_GUARD_FAILED"
  | "EXPENSE_POSTING_FAILED";

export class ExpensePostingError extends Error {
  readonly code: ExpensePostingErrorCode;

  constructor(code: ExpensePostingErrorCode, message: string) {
    super(message);
    this.name = "ExpensePostingError";
    this.code = code;
  }
}

export interface ExpensePostingResult {
  expense: ExpenseRow;
  voucher: AccountingVoucherRow;
  journal_entry: AccountingJournalEntryRow;
}

// ─── Tax Account Resolution Helper ────────────────────────────────────────────

async function resolveTaxAccount(
  component: "CGST" | "SGST" | "IGST",
  rate: number,
  type: "INPUT_TAX" | "OUTPUT_TAX",
  client: PoolClient
): Promise<AccountingAccountRow> {
  const roundedRate = (Math.round(rate * 100) / 100).toFixed(2);
  const namePattern = `%${component}%`;

  // 1. Exact match by subtype, name component, and tax_rate
  const exactRes = await client.query<AccountingAccountRow>(
    `SELECT * FROM public.accounting_account 
     WHERE subtype = $1 
       AND name ILIKE $2 
       AND tax_rate = $3 
       AND is_group = false
       AND is_active = true
       AND deleted_at IS NULL 
     LIMIT 1`,
    [type, namePattern, roundedRate]
  );
  if (exactRes.rows[0]) return exactRes.rows[0];

  // 2. Fallback by subtype and component name
  const fallbackRes = await client.query<AccountingAccountRow>(
    `SELECT * FROM public.accounting_account 
     WHERE subtype = $1 
       AND name ILIKE $2 
       AND is_group = false
       AND is_active = true
       AND deleted_at IS NULL 
     ORDER BY code ASC 
     LIMIT 1`,
    [type, namePattern]
  );
  if (fallbackRes.rows[0]) return fallbackRes.rows[0];

  throw new ExpensePostingError(
    "GL_ACCOUNT_NOT_FOUND",
    `No active ${type} account found in Chart of Accounts for ${component} at rate ${rate}%.`
  );
}

// ─── ExpensePostingService ────────────────────────────────────────────────────

export class ExpensePostingService {
  // ── 1. CREATE VOUCHER DRAFT ─────────────────────────────────────────────────

  /**
   * Prepares an accounting voucher draft for an operational expense.
   */
  static async createExpenseVoucherDraft(
    expenseId: string,
    actorUserId: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<AccountingVoucherRow> {
    const execute = async (c: PoolClient): Promise<AccountingVoucherRow> => {
      const expRes = await c.query<ExpenseRow>(
        `SELECT * FROM public.expense WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [expenseId]
      );
      const expense = expRes.rows[0];
      if (!expense) {
        throw new ExpensePostingError("EXPENSE_NOT_FOUND", `Expense '${expenseId}' not found.`);
      }

      if (branchId && expense.branch_id !== branchId) {
        throw new ExpensePostingError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
      }

      if (expense.status === "POSTED" || expense.status === "REVERSED") {
        throw new ExpensePostingError(
          "INVALID_EXPENSE_STATUS",
          `Cannot create voucher for expense in status '${expense.status}'.`
        );
      }

      if (expense.voucher_id) {
        const vRes = await c.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL`,
          [expense.voucher_id]
        );
        if (vRes.rows[0]) return vRes.rows[0];
      }

      // Resolve fiscal period
      const fiscalPeriod = await PostingService.validateFiscalPeriod(expense.expense_date, c);

      // Create voucher draft
      const voucherRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "EXPENSE",
          voucher_date: expense.expense_date,
          branch_id: expense.branch_id,
          narration: `Expense: ${expense.description}`,
          reference_type: "EXPENSE",
          reference_id: expense.id,
          reference_event: "PRIMARY",
          metadata: {
            expense_id: expense.id,
            category_id: expense.category_id,
            settlement_type: expense.settlement_type,
            payment_method: expense.payment_method,
            supplier_id: expense.supplier_id,
          },
        },
        branchId: expense.branch_id,
        fiscalYear: fiscalPeriod.fiscal_year,
        createdBy: actorUserId,
        client: c,
      });

      if (!voucherRes.success) {
        throw new ExpensePostingError("EXPENSE_POSTING_FAILED", voucherRes.error || "Failed to create voucher draft.");
      }
      if (!voucherRes.data) {
        throw new ExpensePostingError("EXPENSE_POSTING_FAILED", "Voucher draft data is missing.");
      }

      // Link voucher to expense
      await c.query(
        `UPDATE public.expense SET voucher_id = $1, updated_at = NOW() WHERE id = $2`,
        [voucherRes.data.id, expense.id]
      );

      return voucherRes.data;
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  // ── 2. SUBMIT EXPENSE ───────────────────────────────────────────────────────

  /**
   * Submits a DRAFT expense for managerial/accounting approval.
   */
  static async submitExpense(
    expenseId: string,
    actorUserId: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<ExpenseRow> {
    const execute = async (c: PoolClient): Promise<ExpenseRow> => {
      const expRes = await c.query<ExpenseRow>(
        `SELECT * FROM public.expense WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [expenseId]
      );
      const expense = expRes.rows[0];
      if (!expense) {
        throw new ExpensePostingError("EXPENSE_NOT_FOUND", `Expense '${expenseId}' not found.`);
      }

      if (branchId && expense.branch_id !== branchId) {
        throw new ExpensePostingError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
      }

      if (expense.status !== "DRAFT") {
        throw new ExpensePostingError(
          "INVALID_EXPENSE_STATUS",
          `Cannot submit expense in status '${expense.status}'. Only DRAFT expenses can be submitted.`
        );
      }

      // Ensure voucher exists
      const voucher = await this.createExpenseVoucherDraft(expenseId, actorUserId, branchId, c);

      // Submit voucher if in DRAFT
      if (voucher.status === "DRAFT") {
        const subRes = await PostingService.submitVoucher({
          voucherId: voucher.id,
          submittedBy: actorUserId,
          branchId: expense.branch_id,
          client: c,
        });
        if (!subRes.success) {
          throw new ExpensePostingError("EXPENSE_POSTING_FAILED", subRes.error || "Failed to submit voucher.");
        }
      }

      // Update operational expense status
      const updatedExp = await c.query<ExpenseRow>(
        `UPDATE public.expense SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [expenseId]
      );

      return updatedExp.rows[0];
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  // ── 3. APPROVE EXPENSE ─────────────────────────────────────────────────────

  /**
   * Approves a SUBMITTED expense.
   * Enforces strict Segregation of Duties: approvedBy != expense.created_by.
   */
  static async approveExpense(
    expenseId: string,
    approvedBy: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<ExpenseRow> {
    const execute = async (c: PoolClient): Promise<ExpenseRow> => {
      const expRes = await c.query<ExpenseRow>(
        `SELECT * FROM public.expense WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [expenseId]
      );
      const expense = expRes.rows[0];
      if (!expense) {
        throw new ExpensePostingError("EXPENSE_NOT_FOUND", `Expense '${expenseId}' not found.`);
      }

      if (branchId && expense.branch_id !== branchId) {
        throw new ExpensePostingError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
      }

      if (expense.status !== "SUBMITTED") {
        throw new ExpensePostingError(
          "INVALID_EXPENSE_STATUS",
          `Cannot approve expense in status '${expense.status}'. Only SUBMITTED expenses can be approved.`
        );
      }

      // STRICT SOD: Maker != Checker (No Super Admin bypass)
      if (expense.created_by && expense.created_by === approvedBy) {
        throw new ExpensePostingError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: The creator (${expense.created_by}) cannot approve their own expense.`
        );
      }

      // Ensure voucher exists
      let voucher: AccountingVoucherRow;
      if (!expense.voucher_id) {
        voucher = await this.createExpenseVoucherDraft(expenseId, expense.created_by || approvedBy, branchId, c);
      } else {
        const vRes = await c.query<AccountingVoucherRow>(
          `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL`,
          [expense.voucher_id]
        );
        voucher = vRes.rows[0];
      }

      // Submit voucher if still draft
      if (voucher.status === "DRAFT") {
        await PostingService.submitVoucher({
          voucherId: voucher.id,
          submittedBy: expense.created_by || approvedBy,
          branchId: expense.branch_id,
          client: c,
        });
      }

      // Approve voucher
      const appRes = await PostingService.approveVoucher({
        voucherId: voucher.id,
        approvedBy,
        branchId: expense.branch_id,
        client: c,
      });

      if (!appRes.success) {
        throw new ExpensePostingError("EXPENSE_POSTING_FAILED", appRes.error || "Failed to approve voucher.");
      }

      // Update operational expense
      const updatedExp = await c.query<ExpenseRow>(
        `UPDATE public.expense 
         SET status = 'APPROVED', approved_by = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [approvedBy, expenseId]
      );

      return updatedExp.rows[0];
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  // ── 4. ATOMIC POST TO GENERAL LEDGER ────────────────────────────────────────

  /**
   * Atomically posts an APPROVED expense to the General Ledger.
   *
   * Transaction Boundaries:
   * BEGIN
   *   1. Lock expense row exclusively (FOR UPDATE)
   *   2. Validate status === 'APPROVED'
   *   3. Validate SoD: postedBy !== expense.created_by
   *   4. Resolve Category GL Account
   *   5. Resolve Tax Lines (Input GST 1141-1149 or capitalized per ITC eligibility & RCM)
   *   6. Resolve Settlement Account (Cash drawer, Petty Cash 1114, Bank Account GL, AP 2111, or Accruals)
   *   7. Atomically record Teller Movement if CASH with active teller session
   *   8. Validate balanced journal and post voucher via PostingService.postVoucher
   *   9. Mark expense POSTED with posted_at and posted_by
   * COMMIT
   */
  static async postExpenseToGL(
    expenseId: string,
    postedBy: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<ExpensePostingResult> {
    const execute = async (c: PoolClient): Promise<ExpensePostingResult> => {
      // 1. Lock expense
      const expRes = await c.query<ExpenseRow>(
        `SELECT e.*, ec.gl_account_id AS cat_gl_id, ec.gl_account_code AS cat_gl_code, ec.name AS cat_name
         FROM public.expense e
         LEFT JOIN public.expense_category ec ON ec.id = e.category_id
         WHERE e.id = $1 AND e.deleted_at IS NULL
         FOR UPDATE OF e`,
        [expenseId]
      );
      const expense = expRes.rows[0] as ExpenseRow & {
        cat_gl_id?: string | null;
        cat_gl_code?: string | null;
        cat_name?: string | null;
      };

      if (!expense) {
        throw new ExpensePostingError("EXPENSE_NOT_FOUND", `Expense '${expenseId}' not found.`);
      }

      if (branchId && expense.branch_id !== branchId) {
        throw new ExpensePostingError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
      }

      if (expense.status === "POSTED") {
        throw new ExpensePostingError("EXPENSE_ALREADY_POSTED", `Expense '${expenseId}' is already posted.`);
      }

      if (expense.status !== "APPROVED") {
        throw new ExpensePostingError(
          "INVALID_EXPENSE_STATUS",
          `Cannot post expense in status '${expense.status}'. Only APPROVED expenses can be posted to the General Ledger.`
        );
      }

      // STRICT SOD: Maker != Poster (No Super Admin bypass)
      if (expense.created_by && expense.created_by === postedBy) {
        throw new ExpensePostingError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: The creator (${expense.created_by}) cannot post their own expense to GL.`
        );
      }

      // Ensure voucher exists and is approved
      let voucherId = expense.voucher_id;
      if (!voucherId) {
        const vDraft = await this.createExpenseVoucherDraft(expenseId, expense.created_by || postedBy, branchId, c);
        voucherId = vDraft.id;
      }

      const vRes = await c.query<AccountingVoucherRow>(
        `SELECT * FROM public.accounting_voucher WHERE id = $1 FOR UPDATE`,
        [voucherId]
      );
      const voucher = vRes.rows[0];
      if (!voucher) {
        throw new ExpensePostingError("EXPENSE_POSTING_FAILED", "Voucher record missing.");
      }

      if (voucher.status === "DRAFT") {
        await PostingService.submitVoucher({
          voucherId: voucher.id,
          submittedBy: expense.created_by || postedBy,
          branchId: expense.branch_id,
          client: c,
        });
        await PostingService.approveVoucher({
          voucherId: voucher.id,
          approvedBy: expense.approved_by || postedBy,
          branchId: expense.branch_id,
          client: c,
        });
      } else if (voucher.status === "SUBMITTED") {
        await PostingService.approveVoucher({
          voucherId: voucher.id,
          approvedBy: expense.approved_by || postedBy,
          branchId: expense.branch_id,
          client: c,
        });
      }

      // 4. Resolve Expense GL Account
      let expenseAccountId = expense.cat_gl_id;
      if (!expenseAccountId) {
        if (expense.cat_gl_code) {
          const acc = await AccountingAccountRepository.findByCode(expense.cat_gl_code, c);
          if (acc) expenseAccountId = acc.id;
        }
      }

      if (!expenseAccountId) {
        // Fallback to 5299 Miscellaneous Operating Expenses
        const miscAcc = await AccountingAccountRepository.findByCode("5299", c);
        if (!miscAcc) {
          throw new ExpensePostingError("GL_ACCOUNT_NOT_FOUND", "No default operating expense account (5299) found.");
        }
        expenseAccountId = miscAcc.id;
      }

      // 5. Construct Double-Entry Journal Lines
      const journalLines: JournalLineInput[] = [];
      const subtotal = Number(expense.subtotal || 0);
      const discount = Number(expense.discount || 0);
      const taxableValue = Math.round(Number(expense.taxable_value || (subtotal - discount)) * 100) / 100;
      const cgst = Math.round(Number(expense.cgst || 0) * 100) / 100;
      const sgst = Math.round(Number(expense.sgst || 0) * 100) / 100;
      const igst = Math.round(Number(expense.igst || 0) * 100) / 100;
      const totalTax = Math.round((cgst + sgst + igst) * 100) / 100;
      const totalAmount = Math.round(Number(expense.total) * 100) / 100;

      const isItcEligible = expense.itc_eligibility !== "ITC_INELIGIBLE";
      const isRcm = Boolean(expense.rcm_applicable);

      // Estimate tax rates if not present
      const cgstRate = taxableValue > 0 && cgst > 0 ? Math.round((cgst / taxableValue) * 1000) / 10 : 9;
      const sgstRate = taxableValue > 0 && sgst > 0 ? Math.round((sgst / taxableValue) * 1000) / 10 : 9;
      const igstRate = taxableValue > 0 && igst > 0 ? Math.round((igst / taxableValue) * 1000) / 10 : 18;

      // ── DEBIT: EXPENSE ACCOUNT ──────────────────────────────────────────────
      // If ITC is ineligible, capitalize taxes into expense
      const expenseDebitAmount = isItcEligible ? taxableValue : totalAmount;

      journalLines.push({
        account_id: expenseAccountId,
        debit_amount: expenseDebitAmount,
        credit_amount: 0,
        branch_id: expense.branch_id,
        supplier_id: expense.supplier_id || null,
        narration: `Expense: ${expense.description} (${expense.cat_name || "General"})`,
        metadata: {
          expense_id: expense.id,
          category_id: expense.category_id,
          taxable_value: taxableValue,
          itc_eligibility: expense.itc_eligibility,
        },
      });

      // ── DEBIT: INPUT GST (If ITC Eligible) ──────────────────────────────────
      if (isItcEligible && totalTax > 0) {
        if (cgst > 0) {
          const cgstAcc = await resolveTaxAccount("CGST", cgstRate, "INPUT_TAX", c);
          journalLines.push({
            account_id: cgstAcc.id,
            debit_amount: cgst,
            credit_amount: 0,
            branch_id: expense.branch_id,
            supplier_id: expense.supplier_id || null,
            tax_rate: cgstRate,
            tax_class: "GST_INPUT_CGST",
            narration: `Input CGST on expense ${expense.id}`,
            metadata: { expense_id: expense.id, tax_component: "CGST" },
          });
        }
        if (sgst > 0) {
          const sgstAcc = await resolveTaxAccount("SGST", sgstRate, "INPUT_TAX", c);
          journalLines.push({
            account_id: sgstAcc.id,
            debit_amount: sgst,
            credit_amount: 0,
            branch_id: expense.branch_id,
            supplier_id: expense.supplier_id || null,
            tax_rate: sgstRate,
            tax_class: "GST_INPUT_SGST",
            narration: `Input SGST on expense ${expense.id}`,
            metadata: { expense_id: expense.id, tax_component: "SGST" },
          });
        }
        if (igst > 0) {
          const igstAcc = await resolveTaxAccount("IGST", igstRate, "INPUT_TAX", c);
          journalLines.push({
            account_id: igstAcc.id,
            debit_amount: igst,
            credit_amount: 0,
            branch_id: expense.branch_id,
            supplier_id: expense.supplier_id || null,
            tax_rate: igstRate,
            tax_class: "GST_INPUT_IGST",
            narration: `Input IGST on expense ${expense.id}`,
            metadata: { expense_id: expense.id, tax_component: "IGST" },
          });
        }
      }

      // ── CREDIT: RCM OUTPUT TAX LIABILITY (If RCM Applicable) ────────────────
      if (isRcm && totalTax > 0) {
        if (cgst > 0) {
          const outCgstAcc = await resolveTaxAccount("CGST", cgstRate, "OUTPUT_TAX", c);
          journalLines.push({
            account_id: outCgstAcc.id,
            debit_amount: 0,
            credit_amount: cgst,
            branch_id: expense.branch_id,
            supplier_id: expense.supplier_id || null,
            tax_rate: cgstRate,
            tax_class: "GST_RCM_CGST",
            narration: `RCM Output CGST liability on expense ${expense.id}`,
            metadata: { expense_id: expense.id, tax_component: "CGST", rcm: true },
          });
        }
        if (sgst > 0) {
          const outSgstAcc = await resolveTaxAccount("SGST", sgstRate, "OUTPUT_TAX", c);
          journalLines.push({
            account_id: outSgstAcc.id,
            debit_amount: 0,
            credit_amount: sgst,
            branch_id: expense.branch_id,
            supplier_id: expense.supplier_id || null,
            tax_rate: sgstRate,
            tax_class: "GST_RCM_SGST",
            narration: `RCM Output SGST liability on expense ${expense.id}`,
            metadata: { expense_id: expense.id, tax_component: "SGST", rcm: true },
          });
        }
        if (igst > 0) {
          const outIgstAcc = await resolveTaxAccount("IGST", igstRate, "OUTPUT_TAX", c);
          journalLines.push({
            account_id: outIgstAcc.id,
            debit_amount: 0,
            credit_amount: igst,
            branch_id: expense.branch_id,
            supplier_id: expense.supplier_id || null,
            tax_rate: igstRate,
            tax_class: "GST_RCM_IGST",
            narration: `RCM Output IGST liability on expense ${expense.id}`,
            metadata: { expense_id: expense.id, tax_component: "IGST", rcm: true },
          });
        }
      }

      // ── CREDIT: SETTLEMENT / PAYABLE ACCOUNT ─────────────────────────────────
      // If RCM, vendor receives only taxableValue. Otherwise, vendor receives totalAmount.
      const vendorSettlementAmount = isRcm ? taxableValue : totalAmount;

      if (expense.settlement_type === "DIRECT_PAYMENT") {
        const isBankPayment = ["BANK_TRANSFER", "UPI", "CARD", "CHEQUE"].includes(expense.payment_method || "");

        if (isBankPayment) {
          let bankGlAccountId: string;

          if (expense.bank_account_id) {
            const bankAcc = await BankAccountRepository.findById(expense.bank_account_id, c);
            if (!bankAcc) throw new ExpensePostingError("BANK_ACCOUNT_NOT_FOUND", `Bank account '${expense.bank_account_id}' not found.`);
            if (bankAcc.status !== "ACTIVE") throw new ExpensePostingError("BANK_ACCOUNT_INACTIVE", `Bank account '${bankAcc.account_name}' is not ACTIVE.`);
            bankGlAccountId = bankAcc.gl_account_id;
          } else {
            // Fallback to default Bank Operating Account 1112
            const defBank = await AccountingAccountRepository.findByCode("1112", c);
            if (!defBank) throw new ExpensePostingError("GL_ACCOUNT_NOT_FOUND", "Bank Operating account 1112 not found.");
            bankGlAccountId = defBank.id;
          }

          journalLines.push({
            account_id: bankGlAccountId,
            debit_amount: 0,
            credit_amount: vendorSettlementAmount,
            branch_id: expense.branch_id,
            narration: `Bank settlement (${expense.payment_method}) for expense ${expense.id}`,
            metadata: { expense_id: expense.id, bank_account_id: expense.bank_account_id, payment_method: expense.payment_method },
          });
        } else {
          // ── DIRECT CASH DISBURSEMENT GUARD (Server-side, fail-closed, atomic) ────
          // Cash is disbursed either from retail teller drawer (1111) or petty cash float (1114/1111)
          if (!expense.teller_session_id && expense.branch_id) {
            const branchSessions = await TellerSessionRepository.findActiveByBranchId(expense.branch_id, c);
            const openSession = branchSessions.find((s) => s.status === "OPEN");
            if (openSession) {
              expense.teller_session_id = openSession.id;
              await c.query(`UPDATE public.expense SET teller_session_id = $1 WHERE id = $2`, [
                openSession.id,
                expense.id,
              ]);
            }
          }

          if (expense.teller_session_id) {
            // Path A: Cash from Retail Drawer Session (Account 1111 Cash in Hand)
            const cashAcc = await AccountingAccountRepository.findByCode("1111", c);
            if (!cashAcc) throw new ExpensePostingError("GL_ACCOUNT_NOT_FOUND", "Cash in Hand account 1111 not found.");

            // 1. Pessimistic row-level lock on teller session
            const sessRes = await c.query<TellerSessionRow>(
              `SELECT * FROM public.teller_session WHERE id = $1 FOR UPDATE`,
              [expense.teller_session_id]
            );
            const session = sessRes.rows[0];
            if (!session) {
              throw new ExpensePostingError(
                "TELLER_SESSION_NOT_FOUND",
                `Target teller session '${expense.teller_session_id}' not found.`
              );
            }

            if (expense.branch_id && session.branch_id !== expense.branch_id) {
              throw new ExpensePostingError(
                "BRANCH_ACCESS_DENIED",
                `Session '${session.id}' belongs to branch '${session.branch_id}', not '${expense.branch_id}'.`
              );
            }

            if (session.status !== "OPEN") {
              throw new ExpensePostingError(
                "INVALID_SESSION_STATE",
                `Cannot disburse cash from teller session '${session.id}': session is currently ${session.status} (expected OPEN).`
              );
            }

            // 2. Authoritative physical drawer balance: opening_float + sum(IN) - sum(OUT)
            const movRes = await c.query<{ net_mov: string }>(
              `SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)::text AS net_mov
               FROM public.teller_movement
               WHERE teller_session_id = $1`,
              [session.id]
            );
            const netMov = Number(movRes.rows[0]?.net_mov || 0);
            const openingFloat = Number(session.opening_float || 0);
            const availableDrawerCash = Math.round((openingFloat + netMov) * 100) / 100;

            if (openingFloat <= 0 && netMov <= 0) {
              throw new ExpensePostingError(
                "NO_AUTHORIZED_CASH_FLOAT",
                `Teller session '${session.id}' has no authorized opening float or positive cash balance (available: ₹${availableDrawerCash.toFixed(2)}). Cash disbursement is rejected.`
              );
            }

            if (availableDrawerCash < vendorSettlementAmount) {
              throw new ExpensePostingError(
                "INSUFFICIENT_CASH_DRAWER_BALANCE",
                `Cannot disburse ₹${vendorSettlementAmount.toFixed(2)} from teller drawer: available balance is ₹${availableDrawerCash.toFixed(2)}. Cash overdraft is strictly prohibited.`
              );
            }

            journalLines.push({
              account_id: cashAcc.id,
              debit_amount: 0,
              credit_amount: vendorSettlementAmount,
              branch_id: expense.branch_id,
              narration: `Cash drawer disbursement for expense ${expense.id}`,
              metadata: { expense_id: expense.id, teller_session_id: expense.teller_session_id },
            });

            // Atomically project custody movement in C4 Teller ledger
            await TellerMovementService.projectExpensePayment(
              expense.id,
              expense.branch_id,
              vendorSettlementAmount,
              postedBy,
              expense.teller_session_id,
              c
            );
          } else {
            // Path B: Petty Cash / Direct Branch Cash Float (Account 1114 or 1111)
            const pettyAcc = (await AccountingAccountRepository.findByCode("1114", c)) ||
                             (await AccountingAccountRepository.findByCode("1111", c));
            if (!pettyAcc) throw new ExpensePostingError("GL_ACCOUNT_NOT_FOUND", "Petty cash account 1114 or Cash account 1111 not found.");

            // 1. Concurrency Control: Advisory transaction lock on (branch_id, account_id)
            if (expense.branch_id) {
              await c.query(`SELECT pg_advisory_xact_lock(hashtext('cash_guard_' || $1 || '_' || $2))`, [
                expense.branch_id,
                pettyAcc.id,
              ]);
            } else {
              await c.query(`SELECT pg_advisory_xact_lock(hashtext('cash_guard_global_' || $1))`, [
                pettyAcc.id,
              ]);
            }

            // 2. Authoritative General Ledger book balance: sum(debit - credit)
            const balRes = await c.query<{ branch_bal: string; total_bal: string }>(
              `SELECT 
                 COALESCE(SUM(CASE WHEN jl.branch_id = $2::text THEN jl.debit_amount - jl.credit_amount ELSE 0 END), 0)::text AS branch_bal,
                 COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::text AS total_bal
               FROM public.accounting_journal_line jl
               JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
               WHERE jl.account_id = $1`,
              [pettyAcc.id, expense.branch_id || null]
            );

            const branchBalance = expense.branch_id
              ? Math.round(Number(balRes.rows[0]?.branch_bal || 0) * 100) / 100
              : Math.round(Number(balRes.rows[0]?.total_bal || 0) * 100) / 100;

            if (branchBalance <= 0) {
              throw new ExpensePostingError(
                "NO_AUTHORIZED_CASH_FLOAT",
                `Direct cash disbursement of ₹${vendorSettlementAmount.toFixed(2)} rejected: no authorized opening float or positive cash balance exists for account '${pettyAcc.code} (${pettyAcc.name})' at branch '${expense.branch_id || "ALL"}' (current balance: ₹${branchBalance.toFixed(2)}). An approved opening float voucher must be posted before disbursing cash.`
              );
            }

            if (branchBalance < vendorSettlementAmount) {
              throw new ExpensePostingError(
                "INSUFFICIENT_CASH_BALANCE",
                `Direct cash disbursement of ₹${vendorSettlementAmount.toFixed(2)} rejected: available balance for account '${pettyAcc.code} (${pettyAcc.name})' at branch '${expense.branch_id || "ALL"}' is ₹${branchBalance.toFixed(2)}. Cash overdraft is strictly prohibited.`
              );
            }

            journalLines.push({
              account_id: pettyAcc.id,
              debit_amount: 0,
              credit_amount: vendorSettlementAmount,
              branch_id: expense.branch_id,
              narration: `Petty cash disbursement for expense ${expense.id}`,
              metadata: { expense_id: expense.id, petty_cash: true },
            });
          }
        }
      } else {
        // CREDIT_ACCRUAL
        if (expense.supplier_id) {
          // Trade creditor: Account 2111 Accounts Payable with supplier_id dimension
          const apAcc = await AccountingAccountRepository.findByCode("2111", c);
          if (!apAcc) throw new ExpensePostingError("GL_ACCOUNT_NOT_FOUND", "Accounts Payable account 2111 not found.");

          journalLines.push({
            account_id: apAcc.id,
            debit_amount: 0,
            credit_amount: vendorSettlementAmount,
            branch_id: expense.branch_id,
            supplier_id: expense.supplier_id,
            narration: `Accounts Payable: Expense bill ${expense.reference_no || expense.id}`,
            metadata: { expense_id: expense.id, supplier_id: expense.supplier_id },
          });
        } else {
          // Non-supplier operating accrual
          let accrualCode = "2153"; // Accrued Operating Expenses
          if (expense.cat_gl_code === "5210") accrualCode = "2152"; // Rent Payable
          if (expense.cat_gl_code === "5250") accrualCode = "2151"; // Salaries & Wages Payable

          const accrualAcc = (await AccountingAccountRepository.findByCode(accrualCode, c)) ||
                             (await AccountingAccountRepository.findByCode("2153", c));
          if (!accrualAcc) throw new ExpensePostingError("GL_ACCOUNT_NOT_FOUND", `Accruals account ${accrualCode} not found.`);

          journalLines.push({
            account_id: accrualAcc.id,
            debit_amount: 0,
            credit_amount: vendorSettlementAmount,
            branch_id: expense.branch_id,
            narration: `Accrual for expense ${expense.id}`,
            metadata: { expense_id: expense.id, accrual_code: accrualCode },
          });
        }
      }

      // 6. Post Voucher to GL via canonical PostingService
      const postRes = await PostingService.postVoucher({
        voucherId: voucher.id,
        postedBy,
        lines: journalLines,
        branchId: expense.branch_id,
        client: c,
      });

      if (!postRes.success) {
        throw new ExpensePostingError("EXPENSE_POSTING_FAILED", postRes.error || "General Ledger posting failed.");
      }
      if (!postRes.data) {
        throw new ExpensePostingError("EXPENSE_POSTING_FAILED", "General Ledger posting data is missing.");
      }

      // 7. Update Operational Expense Record
      const finalExpRes = await c.query<ExpenseRow>(
        `UPDATE public.expense 
         SET status = 'POSTED', posted_at = NOW(), updated_at = NOW() 
         WHERE id = $1 
         RETURNING *`,
        [expense.id]
      );

      return {
        expense: finalExpRes.rows[0],
        voucher: postRes.data.voucher,
        journal_entry: postRes.data.journal_entry,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }
}
