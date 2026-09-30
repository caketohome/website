/**
 * CakeToHome ERP — Expense & Category Types
 * Phase 2: Canonical TypeScript DTOs for the Expense module.
 *
 * DESIGN DECISIONS:
 * - analytics_expense NOT used — wrong data types, no lifecycle, no consumers
 * - expense_category is DB-driven (not hardcoded)
 * - Lifecycle mirrors Purchase: DRAFT → SUBMITTED → APPROVED → POSTED
 * - All monetary: NUMERIC(14,2) — no floating point
 * - branchId always from session — never from client
 */

// ─── Expense Status Lifecycle ─────────────────────────────────────────────────

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED";

export const EXPENSE_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  DRAFT:     ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "DRAFT"],
  APPROVED:  ["POSTED"],
  POSTED:    [],
};

// ─── Payment Method ────────────────────────────────────────────────────────────

export type ExpensePaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "CARD" | "OTHER";

// ─── Expense Category ─────────────────────────────────────────────────────────

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExpenseCategoryCreateInput {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface ExpenseCategoryUpdateInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface ExpenseRow {
  id: string;
  branch_id: string;
  category_id: string | null;
  supplier_id: string | null;
  expense_date: string;
  reference_no: string | null;
  description: string;
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  payment_method: ExpensePaymentMethod | null;
  notes: string | null;
  status: ExpenseStatus;
  created_by: string | null;
  approved_by: string | null;
  posted_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields
  category_name?: string | null;
  supplier_name?: string | null;
  branch_name?: string | null;
}

export interface ExpenseCreateInput {
  category_id?: string | null;
  supplier_id?: string | null;
  expense_date: string;
  reference_no?: string | null;
  description: string;
  subtotal: number;
  discount?: number;
  taxable_value: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total: number;
  payment_method?: ExpensePaymentMethod | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExpenseUpdateInput extends Partial<ExpenseCreateInput> {}

export interface ExpenseListFilters {
  branch_id?: string;
  category_id?: string;
  supplier_id?: string;
  status?: ExpenseStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  payment_method?: ExpensePaymentMethod;
  limit?: number;
  offset?: number;
}

export interface ExpenseListResult {
  expenses: ExpenseRow[];
  total: number;
}

// ─── Report DTOs ──────────────────────────────────────────────────────────────

export interface ExpenseRegisterRow {
  expense_id: string;
  expense_date: string;
  category_id: string | null;
  category_name: string | null;
  supplier_name: string | null;
  reference_no: string | null;
  description: string;
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  payment_method: string | null;
  status: ExpenseStatus;
  branch_name: string | null;
}

export interface CategoryWiseExpenseRow {
  category_id: string | null;
  category_name: string | null;
  expense_count: number;
  total_amount: number;
  taxable_value: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
}

export interface BranchWiseExpenseRow {
  branch_id: string;
  branch_name: string | null;
  expense_count: number;
  total_amount: number;
  taxable_value: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
}

export interface DateWiseExpenseRow {
  expense_date: string;
  expense_count: number;
  total_amount: number;
}

export interface PaymentMethodExpenseRow {
  payment_method: string | null;
  expense_count: number;
  total_amount: number;
}

export interface SupplierWiseExpenseRow {
  supplier_id: string;
  supplier_name: string;
  expense_count: number;
  total_amount: number;
  taxable_value: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
}

export interface ExpenseGstSummaryRow {
  category_name: string | null;
  taxable_value: number;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
}

export interface ExpenseReportFilters {
  branch_id?: string;
  category_id?: string;
  supplier_id?: string;
  startDate?: string;
  endDate?: string;
  status?: ExpenseStatus;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ExpenseApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
