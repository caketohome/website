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

import { ExpenseRepository } from "../repositories/expense.repository";
import { ExpenseCategoryRepository } from "../repositories/expense-category.repository";
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
   * Transition expense status.
   * Non-admin can only SUBMIT (DRAFT → SUBMITTED).
   * Only SUPER_ADMIN can APPROVE or POST.
   */
  static async transitionStatus(
    id: string,
    newStatus: ExpenseStatus,
    userId: string,
    isSuperAdmin: boolean,
    branchId?: string
  ): Promise<ExpenseApiResponse<null>> {
    if (!isSuperAdmin && (newStatus === "APPROVED" || newStatus === "POSTED")) {
      return { success: false, error: "Only Super Admin can approve or post expenses." };
    }
    const scopedBranchId = isSuperAdmin ? undefined : branchId;
    const result = await ExpenseRepository.transitionStatus(id, newStatus, userId, scopedBranchId);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, message: `Expense status updated to ${newStatus}.` };
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
