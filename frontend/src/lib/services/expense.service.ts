/**
 * CakeToHome ERP — Expense Service
 * Phase 2: Business logic for expense management.
 *
 * KEY RULES:
 * - branchId ALWAYS from the resolved session — never from client body
 * - Server validates totals (taxable_value + taxes ≈ total, ±₹0.50)
 * - Lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED (repo enforced)
 * - Non-super-admin cannot APPROVE or POST
 * - No accounting journal entries created
 * - Empty DB returns empty arrays — never fabricated data
 */

import { dbQuery } from "../db";
import { ExpenseRepository } from "../repositories/expense.repository";
import { ExpenseCategoryRepository } from "../repositories/expense-category.repository";
import { ExpensePostingService } from "./expense-posting.service";
import { ExpenseReversalService } from "./expense-reversal.service";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
} from "../types/accounting.types";
import type {
  ExpenseRow,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseListFilters,
  ExpenseListResult,
  ExpenseStatus,
  ExpenseApiResponse,
  ExpenseCategoryRow,
  ExpenseCategoryCreateInput,
  ExpenseCategoryUpdateInput,
  ExpenseRegisterRow,
  CategoryWiseExpenseRow,
  BranchWiseExpenseRow,
  DateWiseExpenseRow,
  PaymentMethodExpenseRow,
  SupplierWiseExpenseRow,
  ExpenseGstSummaryRow,
  ExpenseReportFilters,
} from "../types/expense.types";

// ─── Server-side Total Validation ────────────────────────────────────────────

function validateExpenseTotals(
  input: ExpenseCreateInput | ExpenseUpdateInput
): string | null {
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

export class ExpenseService {
  // ── CREATE ──────────────────────────────────────────────────────────────────

  static async createExpense(
    input: ExpenseCreateInput,
    branchId: string,
    createdBy: string
  ): Promise<ExpenseApiResponse<ExpenseRow>> {
    if (!branchId) {
      return { success: false, error: "Branch context is required." };
    }
    if (!input.description?.trim()) {
      return { success: false, error: "Description is required." };
    }
    if (!input.expense_date) {
      return { success: false, error: "Expense date is required." };
    }
    if (Number(input.total) < 0) {
      return { success: false, error: "Total amount cannot be negative." };
    }

    const totalErr = validateExpenseTotals(input);
    if (totalErr) return { success: false, error: totalErr };

    try {
      const expense = await ExpenseRepository.create(input, branchId, createdBy);
      return { success: true, data: expense };
    } catch (e: any) {
      return { success: false, error: `Failed to create expense: ${e.message}` };
    }
  }

  // ── READ ────────────────────────────────────────────────────────────────────

  static async getExpense(
    id: string,
    branchId?: string
  ): Promise<ExpenseApiResponse<ExpenseRow>> {
    const expense = await ExpenseRepository.findById(id, branchId);
    if (!expense) return { success: false, error: "Expense not found or access denied." };
    return { success: true, data: expense };
  }

  static async listExpenses(
    filters: ExpenseListFilters
  ): Promise<ExpenseApiResponse<ExpenseListResult>> {
    const result = await ExpenseRepository.list(filters);
    return { success: true, data: result };
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  static async updateExpense(
    id: string,
    input: ExpenseUpdateInput,
    branchId: string
  ): Promise<ExpenseApiResponse<ExpenseRow>> {
    if (!id) return { success: false, error: "Expense ID is required." };

    // Only DRAFT can be edited
    const existing = await ExpenseRepository.findById(id, branchId);
    if (!existing) return { success: false, error: "Expense not found or access denied." };
    if (existing.status !== "DRAFT") {
      return { success: false, error: `Cannot edit an expense with status '${existing.status}'. Only DRAFT expenses can be edited.` };
    }

    const totalErr = validateExpenseTotals(input);
    if (totalErr) return { success: false, error: totalErr };

    try {
      const updated = await ExpenseRepository.update(id, input, branchId);
      if (!updated) return { success: false, error: "Expense not found after update." };
      return { success: true, data: updated };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ── STATUS LIFECYCLE ────────────────────────────────────────────────────────

  /**
   * Transition expense status with genuine accounting integration.
   * - SUBMITTED: creates/submits accounting voucher draft
   * - APPROVED: approves accounting voucher draft (enforcing SoD: approvedBy !== createdBy)
   * - POSTED: executes atomic General Ledger posting via ExpensePostingService (enforcing SoD: postedBy !== createdBy)
   * - DRAFT / CANCELLED: updates operational record
   */
  static async transitionStatus(
    id: string,
    newStatus: ExpenseStatus,
    userId: string,
    isSuperAdmin: boolean,
    branchId?: string,
    reversalReason?: string
  ): Promise<ExpenseApiResponse<null>> {
    const scopedBranchId = isSuperAdmin ? undefined : branchId;

    try {
      if (newStatus === "SUBMITTED") {
        await ExpensePostingService.submitExpense(id, userId, scopedBranchId);
        return { success: true, message: "Expense submitted for approval." };
      }

      if (newStatus === "APPROVED") {
        await ExpensePostingService.approveExpense(id, userId, scopedBranchId);
        return { success: true, message: "Expense approved." };
      }

      if (newStatus === "POSTED") {
        await ExpensePostingService.postExpenseToGL(id, userId, scopedBranchId);
        return { success: true, message: "Expense posted to General Ledger." };
      }

      if (newStatus === "REVERSED") {
        await ExpenseReversalService.reverseExpense({
          expenseId: id,
          reversedBy: userId,
          reversalReason: reversalReason || "Manager reversal",
          branchId: scopedBranchId,
        });
        return { success: true, message: "Expense reversed in General Ledger." };
      }

      const result = await ExpenseRepository.transitionStatus(id, newStatus, userId, scopedBranchId);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, message: `Expense status updated to ${newStatus}.` };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update expense status." };
    }
  }

  /**
   * Reverse a posted expense.
   */
  static async reverseExpense(
    id: string,
    reversedBy: string,
    reversalReason: string,
    branchId?: string,
    targetTellerSessionId?: string,
    cashReturnDestination?: "TELLER_DRAWER" | "PETTY_CASH"
  ): Promise<ExpenseApiResponse<any>> {
    try {
      const result = await ExpenseReversalService.reverseExpense({
        expenseId: id,
        reversedBy,
        reversalReason,
        branchId,
        targetTellerSessionId,
        cashReturnDestination,
      });
      return { success: true, data: result, message: "Expense reversed successfully." };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to reverse expense." };
    }
  }

  /**
   * Retrieves full accounting details for an expense:
   * - Accounting Voucher
   * - Journal Entry & Lines
   * - Reversal Voucher & Lines (if reversed)
   */
  static async getExpenseAccounting(
    id: string,
    branchId?: string
  ): Promise<ExpenseApiResponse<any>> {
    const expense = await ExpenseRepository.findById(id, branchId);
    if (!expense) return { success: false, error: "Expense not found or access denied." };

    if (!expense.voucher_id) {
      return {
        success: true,
        data: {
          expense,
          voucher: null,
          journal_entry: null,
          journal_lines: [],
          reversal_voucher: null,
          reversal_journal_entry: null,
          reversal_journal_lines: [],
        },
      };
    }

    const voucherRes = await dbQuery<AccountingVoucherRow>(
      `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL`,
      [expense.voucher_id]
    );
    const voucher = voucherRes.rows[0] || null;

    let journalEntry = null;
    let journalLines: any[] = [];

    if (voucher) {
      const jeRes = await dbQuery<AccountingJournalEntryRow>(
        `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`,
        [voucher.id]
      );
      journalEntry = jeRes.rows[0] || null;

      if (journalEntry) {
        const jlRes = await dbQuery(
          `SELECT jl.*, jl.debit_amount AS debit, jl.credit_amount AS credit, aa.code AS account_code, aa.name AS account_name, aa.type AS account_type
           FROM public.accounting_journal_line jl
           JOIN public.accounting_account aa ON aa.id = jl.account_id
           WHERE jl.journal_entry_id = $1
           ORDER BY jl.line_no ASC`,
          [journalEntry.id]
        );
        journalLines = jlRes.rows;
      }
    }

    let reversalVoucher = null;
    let reversalJournalEntry = null;
    let reversalJournalLines: any[] = [];

    if (expense.reversal_voucher_id) {
      const rvRes = await dbQuery<AccountingVoucherRow>(
        `SELECT * FROM public.accounting_voucher WHERE id = $1 AND deleted_at IS NULL`,
        [expense.reversal_voucher_id]
      );
      reversalVoucher = rvRes.rows[0] || null;

      if (reversalVoucher) {
        const rjeRes = await dbQuery<AccountingJournalEntryRow>(
          `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1`,
          [reversalVoucher.id]
        );
        reversalJournalEntry = rjeRes.rows[0] || null;

        if (reversalJournalEntry) {
          const rjlRes = await dbQuery(
            `SELECT jl.*, jl.debit_amount AS debit, jl.credit_amount AS credit, aa.code AS account_code, aa.name AS account_name, aa.type AS account_type
             FROM public.accounting_journal_line jl
             JOIN public.accounting_account aa ON aa.id = jl.account_id
             WHERE jl.journal_entry_id = $1
             ORDER BY jl.line_no ASC`,
            [reversalJournalEntry.id]
          );
          reversalJournalLines = rjlRes.rows;
        }
      }
    }

    return {
      success: true,
      data: {
        expense,
        voucher,
        journal_entry: journalEntry,
        journal_lines: journalLines,
        reversal_voucher: reversalVoucher,
        reversal_journal_entry: reversalJournalEntry,
        reversal_journal_lines: reversalJournalLines,
      },
    };
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────

  static async deleteExpense(
    id: string,
    branchId: string
  ): Promise<ExpenseApiResponse<null>> {
    const result = await ExpenseRepository.softDelete(id, branchId);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, message: "Expense deleted." };
  }

  // ── CATEGORY MANAGEMENT ──────────────────────────────────────────────────────

  static async createCategory(
    input: ExpenseCategoryCreateInput,
    createdBy: string
  ): Promise<ExpenseApiResponse<ExpenseCategoryRow>> {
    if (!input.name?.trim()) {
      return { success: false, error: "Category name is required." };
    }
    try {
      const cat = await ExpenseCategoryRepository.create(input, createdBy);
      return { success: true, data: cat };
    } catch (e: any) {
      return { success: false, error: `Failed to create category: ${e.message}` };
    }
  }

  static async updateCategory(
    id: string,
    input: ExpenseCategoryUpdateInput
  ): Promise<ExpenseApiResponse<ExpenseCategoryRow>> {
    if (!id) return { success: false, error: "Category ID is required." };
    if (input.name !== undefined && !input.name.trim()) {
      return { success: false, error: "Category name cannot be empty." };
    }
    const cat = await ExpenseCategoryRepository.update(id, input);
    if (!cat) return { success: false, error: "Category not found." };
    return { success: true, data: cat };
  }

  static async deleteCategory(id: string): Promise<ExpenseApiResponse<null>> {
    if (!id) return { success: false, error: "Category ID is required." };
    const result = await ExpenseCategoryRepository.softDelete(id);
    if (!result.success) return { success: false, error: result.reason };
    return { success: true, message: "Category deactivated." };
  }

  static async listCategories(
    includeInactive = false
  ): Promise<ExpenseApiResponse<ExpenseCategoryRow[]>> {
    const cats = await ExpenseCategoryRepository.list(includeInactive);
    return { success: true, data: cats };
  }

  // ── REPORTS ─────────────────────────────────────────────────────────────────

  static async getExpenseRegister(
    filters: ExpenseReportFilters
  ): Promise<ExpenseApiResponse<ExpenseRegisterRow[]>> {
    const rows = await ExpenseRepository.getExpenseRegister(filters);
    return { success: true, data: rows };
  }

  static async getCategoryWiseSummary(
    filters: ExpenseReportFilters
  ): Promise<ExpenseApiResponse<CategoryWiseExpenseRow[]>> {
    const rows = await ExpenseRepository.getCategoryWiseSummary(filters);
    return { success: true, data: rows };
  }

  static async getBranchWiseSummary(
    filters: ExpenseReportFilters
  ): Promise<ExpenseApiResponse<BranchWiseExpenseRow[]>> {
    const rows = await ExpenseRepository.getBranchWiseSummary(filters);
    return { success: true, data: rows };
  }

  static async getDateWiseSummary(
    filters: ExpenseReportFilters
  ): Promise<ExpenseApiResponse<DateWiseExpenseRow[]>> {
    const rows = await ExpenseRepository.getDateWiseSummary(filters);
    return { success: true, data: rows };
  }

  static async getPaymentMethodSummary(
    filters: ExpenseReportFilters
  ): Promise<ExpenseApiResponse<PaymentMethodExpenseRow[]>> {
    const rows = await ExpenseRepository.getPaymentMethodSummary(filters);
    return { success: true, data: rows };
  }

  static async getSupplierWiseSummary(
    filters: ExpenseReportFilters
  ): Promise<ExpenseApiResponse<SupplierWiseExpenseRow[]>> {
    const rows = await ExpenseRepository.getSupplierWiseSummary(filters);
    return { success: true, data: rows };
  }

  static async getGstSummary(
    filters: ExpenseReportFilters
  ): Promise<ExpenseApiResponse<ExpenseGstSummaryRow[]>> {
    const rows = await ExpenseRepository.getGstSummary(filters);
    return { success: true, data: rows };
  }
}
